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
//!
//! The Mac game brings its own allocator for blocks up to 4,096 bytes, in chunks it takes from `malloc`, and hands a
//! larger one to the system's `free()`, which stops the game for a block `malloc` never gave out: the transfer
//! manager's list of offers, for one. The editor takes its blocks there the same way, from the system's `strdup`
//! (libsystem_c) run in the game on a thread of its own, which gives back the whole address, and gives them back with
//! the system's `free`. A block of up to 4,096 bytes is taken as large as the game's allocator would give it (see
//! [`crate::profile::HeapLayout::grown_block`]): the game lets such a block go into its own lists of free blocks, and
//! hands it out again for anything of its class. Only on Apple silicon (see `fmlibre_mem`'s `call.rs`).

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
    /// A block of at least `size` bytes (2 or more) of the game's heap, zeroed: taken by the game's C runtime (see the
    /// module's notes).
    pub(crate) fn heap_block(&self, size: usize) -> Result<u64, MoveError> {
        let runtime = self.runtime().ok_or(MoveError::NoGameMemory)?;
        let size = self.heap_block_size(size);
        if size < 2 {
            return Err(MoveError::NoGameMemory);
        }
        let text = marker(size);
        let at = self.own_block(text.len() as u64)?;
        self.process.write_bytes(at, &text)?;
        let block = self.strdup(runtime, &text, at)?;
        self.process.write_bytes(block, &vec![0; size])?;
        Ok(block)
    }

    /// Gives `block`, taken with [`Session::heap_block`], back to the game's C runtime.
    pub(crate) fn heap_free(&self, block: u64) -> Result<(), MoveError> {
        let runtime = self.runtime().ok_or(MoveError::NoGameMemory)?;
        self.process.call(runtime.free, block)?;
        Ok(())
    }

    /// Whether the editor can take blocks of the game's heap: the game's C runtime is loaded, and the editor may run
    /// its functions.
    pub fn takes_heap_blocks(&self) -> bool {
        self.runtime().is_some()
    }

    /// How large a block taken for `size` bytes is: as large as asked on Windows.
    #[cfg(windows)]
    fn heap_block_size(&self, size: usize) -> usize {
        size
    }

    /// How large a block taken for `size` bytes is: on the Mac, up to 4,096 bytes, as large as the game's own allocator
    /// would give it (see the module's notes).
    #[cfg(target_os = "macos")]
    fn heap_block_size(&self, size: usize) -> usize {
        self.layout.heap.grown_block(size as u64).map_or(size, |block| block as usize)
    }

    /// Runs `_strdup` on `text`, written at `at`, and gives back the block it took: found from the low 32 bits Windows
    /// keeps of what it returned.
    #[cfg(windows)]
    fn strdup(&self, runtime: Runtime, text: &[u8], at: u64) -> Result<u64, MoveError> {
        let low = self.process.call(runtime.strdup, at)?;
        if low == 0 {
            return Err(MoveError::NoGameMemory);
        }
        self.find_block(low, text, at)
    }

    /// Runs `strdup` on `text`, written at `at`, and gives back the block it took, once it holds the text.
    #[cfg(target_os = "macos")]
    fn strdup(&self, runtime: Runtime, text: &[u8], at: u64) -> Result<u64, MoveError> {
        let block = self.process.call(runtime.strdup, at)?;
        if block == 0 || self.process.read_bytes(block, text.len()).ok().as_deref() != Some(text) {
            return Err(MoveError::NoGameMemory);
        }
        Ok(block)
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

    /// The system's `strdup` and `free` where the game has them, the same library as the editor's, and the editor can
    /// run them there (see `fmlibre_mem`'s `call.rs`).
    #[cfg(target_os = "macos")]
    fn find_runtime(&self) -> Option<Runtime> {
        if !self.process.can_call() {
            return None;
        }
        let found =
            |library: &str, symbol: &std::ffi::CStr| self.process.system_function(library, symbol).ok().flatten();
        Some(Runtime {
            strdup: found("libsystem_c.dylib", c"strdup")?,
            free: found("libsystem_malloc.dylib", c"free")?,
        })
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

/// A string of `size` bytes with its terminating zero, unlike any other: the editor's mark, a count and the time, which a
/// short string cuts.
fn marker(size: usize) -> Vec<u8> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNT: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let head = format!("FMLE{:x}.{nanos:x}.", COUNT.fetch_add(1, Ordering::Relaxed));
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
        assert_ne!(marker(16), marker(16));
    }
}
