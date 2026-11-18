//! Blocks of the game's own heap, taken and given back as the game's own code takes and gives back its blocks.
//!
//! Some of what the game lets go of it gives back to the C runtime's `free()`, which Windows's heap checks: a block the
//! editor took in memory of its own (see `own_memory.rs`) would stop the game there. A move due on a day is such a
//! block, and so is every list longer than the game's own allocator hands out (`[heap] largest_block`), such as the
//! transfer manager's list of offers. The game process has one heap, the process's, where the C runtime takes its
//! blocks too.
//!
//! The editor takes such a block by having the game's C runtime take it: it runs the runtime's `_strdup` in the game
//! on a thread of its own ([`fmlibre_mem::Process::call`]), with a string of the size wanted that it wrote into memory
//! of its own, unlike any other. `_strdup` takes a block of the heap that size and copies the string into it. Windows
//! keeps only the low 32 bits of what a thread returns, so the block is then found where its string is: at those 32
//! bits in one of the game's regions of heap. It is zeroed before it is used. A block is given back with the runtime's
//! `free`, run the same way. No code is written into the game.

use crate::session::Session;
use crate::transfer::MoveError;

/// The C runtime the game is built against.
#[cfg(windows)]
const RUNTIME: &str = "ucrtbase.dll";

/// The runtime's functions the editor runs: where they are in the game.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Runtime {
    strdup: u64,
    free: u64,
}

impl Session {
    /// A block of `size` bytes (2 or more) of the game's heap, zeroed: taken by the game's C runtime (see the module's
    /// notes).
    #[cfg(windows)]
    pub(crate) fn heap_block(&self, size: usize) -> Result<u64, MoveError> {
        let runtime = self.runtime().ok_or(MoveError::NoGameMemory)?;
        if size < 2 {
            return Err(MoveError::NoGameMemory);
        }
        let text = marker(size);
        let at = self.own_block(text.len() as u64)?;
        self.process.write_bytes(at, &text)?;
        let low = self.process.call(runtime.strdup, at)?;
        if low == 0 {
            return Err(MoveError::NoGameMemory);
        }
        let block = self.find_block(low, &text, at)?;
        self.process.write_bytes(block, &vec![0; size])?;
        Ok(block)
    }

    #[cfg(not(windows))]
    pub(crate) fn heap_block(&self, _size: usize) -> Result<u64, MoveError> {
        Err(MoveError::NoGameMemory)
    }

    /// Gives `block`, taken with [`Session::heap_block`], back to the game's C runtime.
    #[cfg(windows)]
    pub(crate) fn heap_free(&self, block: u64) -> Result<(), MoveError> {
        let runtime = self.runtime().ok_or(MoveError::NoGameMemory)?;
        self.process.call(runtime.free, block)?;
        Ok(())
    }

    #[cfg(not(windows))]
    pub(crate) fn heap_free(&self, _block: u64) -> Result<(), MoveError> {
        Err(MoveError::NoGameMemory)
    }

    /// Whether the editor can take blocks of the game's heap: the game's C runtime is loaded, and the editor may run
    /// its functions.
    pub fn takes_heap_blocks(&self) -> bool {
        cfg!(windows) && self.runtime().is_some()
    }

    /// Where the game's C runtime's `_strdup` and `free` are, found the first time they are needed.
    fn runtime(&self) -> Option<Runtime> {
        *self.runtime.get_or_init(|| self.find_runtime())
    }

    #[cfg(windows)]
    fn find_runtime(&self) -> Option<Runtime> {
        let modules = fmlibre_mem::list_modules(&self.process).ok()?;
        let module = modules.iter().find(|module| module.name.eq_ignore_ascii_case(RUNTIME))?;
        let image = fmlibre_mem::PeImage::read(&self.process, module.base).ok()?;
        let exports = image.exports(&self.process).ok()?;
        let at = |name: &str| exports.iter().find(|export| export.name == name).map(|e| module.base + u64::from(e.rva));
        Some(Runtime { strdup: at("_strdup")?, free: at("free")? })
    }

    #[cfg(not(windows))]
    fn find_runtime(&self) -> Option<Runtime> {
        None
    }

    /// The block `_strdup` returned, from the low 32 bits Windows kept of it: the one place among the game's regions of
    /// heap at those 32 bits that holds `text`, other than `source`, where the editor wrote it.
    #[cfg(windows)]
    fn find_block(&self, low: u32, text: &[u8], source: u64) -> Result<u64, MoveError> {
        let mut found = Vec::new();
        for region in fmlibre_mem::regions(&self.process, 0x1_0000, 0x7FFF_FFFF_0000) {
            if !region.holds_data() {
                continue;
            }
            let (start, end) = (region.base, region.end());
            for high in (start >> 32)..=((end - 1) >> 32) {
                let at = (high << 32) | u64::from(low);
                let inside = at >= start && at + text.len() as u64 <= end && at != source;
                if inside && self.process.read_bytes(at, text.len()).ok().as_deref() == Some(text) {
                    found.push(at);
                }
            }
        }
        match found[..] {
            [block] => Ok(block),
            _ => Err(MoveError::NoGameMemory),
        }
    }
}

/// A string of `size` bytes with its terminating zero, unlike any other: the editor's mark, the time and a count.
fn marker(size: usize) -> Vec<u8> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNT: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let head = format!("FMLE{nanos:x}.{}.", COUNT.fetch_add(1, Ordering::Relaxed));
    let mut text: Vec<u8> = head.bytes().chain(std::iter::repeat(b'x')).take(size - 1).collect();
    text.push(0);
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_marker_fills_the_size_and_ends_in_a_zero() {
        for size in [2, 16, 40, 1232] {
            let text = marker(size);
            assert_eq!(text.len(), size);
            assert_eq!(text[size - 1], 0);
            assert!(!text[..size - 1].contains(&0));
        }
        assert_ne!(marker(64), marker(64));
    }
}
