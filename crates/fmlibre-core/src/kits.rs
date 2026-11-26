//! A club's kits: the items of its Kits and Colours screen. Read, and the colours and style of an item written.
//!
//! A club points (`[kits] club_object`) at an object that holds, at `[kits] list`, a `(begin, end, capacity)` list of
//! pointers, one per kit item. Each leads to a record of 40 bytes: five colours of 4 bytes (blue, green, red, 0xff):
//! foreground, background, outline, number and number outline; a `u32` style; two words of 0xffffffff (taken to be the
//! competition and the season, none); and a trailer whose third byte is the slot (0 home, 1 away, 2 third) and whose
//! fourth is the type of item (1 a shirt; a club with more items has others). The channels are multiples of 8: the game
//! keeps 5 bits of each.
//!
//! Layout found by comparing memory with the screen of a club manager's kit editor and by writing colours into a
//! record and watching the kit change in the game after the next day; see docs/recon/fm27-kits.md. The game redraws
//! kits only when a day passes, so a change shows after the next day.

use fmlibre_mem::is_user_pointer;
use serde::Serialize;

use crate::clubs::ClubSummary;
use crate::profile::KitsLayout;
use crate::session::Session;

/// The most items a club is taken to hold: the richest seen has 13.
const MOST_ITEMS: u64 = 64;
/// The colours of an item.
pub const COLOURS: usize = 5;
/// The names of the colours, in the order the item keeps them.
pub const COLOUR_NAMES: [&str; COLOURS] = ["foreground", "background", "outline", "number", "numberOutline"];

/// One kit item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KitItem {
    /// Where the record is in the game's memory just now.
    pub address: u64,
    /// 0 home, 1 away, 2 third.
    pub slot: u8,
    /// 1 a shirt; others as the layout says.
    pub item_type: u8,
    pub style: u32,
    /// Red, green and blue of each colour, in the order of [`COLOUR_NAMES`].
    pub colours: [[u8; 3]; COLOURS],
}

#[derive(Debug)]
pub enum KitsError {
    /// The layout of this build does not place the kits.
    Unavailable,
    /// What is found does not read as the game's kits.
    Unreadable(&'static str),
    /// A value is not one the editor writes.
    Refused(&'static str),
    Memory(fmlibre_mem::Error),
}

impl std::fmt::Display for KitsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KitsError::Unavailable => f.write_str("the kits are not placed in the layout of this build"),
            KitsError::Unreadable(why) => write!(f, "the kits do not read as the game's: {why}"),
            KitsError::Refused(why) => write!(f, "not written: {why}"),
            KitsError::Memory(err) => write!(f, "{err}"),
        }
    }
}

impl From<fmlibre_mem::Error> for KitsError {
    fn from(err: fmlibre_mem::Error) -> Self {
        KitsError::Memory(err)
    }
}

/// Reads an item's bytes (`item_size` of them). None when a colour does not end in 0xff or a channel is not a
/// multiple of 8.
pub(crate) fn read_item(address: u64, bytes: &[u8], k: &KitsLayout) -> Option<KitItem> {
    let at = |offset: u64| offset as usize;
    let mut colours = [[0u8; 3]; COLOURS];
    for (i, colour) in colours.iter_mut().enumerate() {
        let c = &bytes[at(k.colours) + i * 4..at(k.colours) + i * 4 + 4];
        if c[3] != 0xff || c[..3].iter().any(|channel| channel % 8 != 0) {
            return None;
        }
        *colour = [c[2], c[1], c[0]];
    }
    let style = u32::from_le_bytes(bytes[at(k.style)..at(k.style) + 4].try_into().expect("4 bytes"));
    Some(KitItem { address, slot: bytes[at(k.slot)], item_type: bytes[at(k.item_type)], style, colours })
}

/// The bytes of a colour as the game keeps them: blue, green, red, 0xff. Channels are rounded down to a multiple of 8,
/// which is all the game keeps.
fn colour_bytes(rgb: [u8; 3]) -> [u8; 4] {
    [rgb[2] & 0xf8, rgb[1] & 0xf8, rgb[0] & 0xf8, 0xff]
}

impl Session {
    fn kits_layout(&self) -> Result<&KitsLayout, KitsError> {
        self.layout.kits.as_ref().ok_or(KitsError::Unavailable)
    }

    /// The addresses of a club's kit item records, in the game's order.
    fn kit_item_addresses(&self, club: &ClubSummary) -> Result<Vec<u64>, KitsError> {
        let k = self.kits_layout()?;
        let process = &self.process;
        if process.read_u32(club.address + self.layout.club.uid)? != club.uid {
            return Err(KitsError::Unreadable("the club changed"));
        }
        let object = process.read_u64(club.address + k.club_object)?;
        if object == 0 {
            return Ok(Vec::new());
        }
        if !is_user_pointer(object) {
            return Err(KitsError::Unreadable("the club's kit object is not a pointer"));
        }
        let words = process.read_bytes(object + k.list, 24)?;
        let word = |at: usize| u64::from_le_bytes(words[at..at + 8].try_into().expect("8 bytes"));
        let (begin, end, capacity) = (word(0), word(8), word(16));
        if begin == end {
            return Ok(Vec::new());
        }
        let size = end.wrapping_sub(begin);
        if end < begin || size % 8 != 0 || size / 8 > MOST_ITEMS || capacity < end || !is_user_pointer(begin) {
            return Err(KitsError::Unreadable("the list does not fit its record"));
        }
        let pointers = process.read_bytes(begin, size as usize)?;
        let mut addresses = Vec::new();
        for pointer in pointers.as_chunks::<8>().0 {
            let address = u64::from_le_bytes(*pointer);
            if !is_user_pointer(address) {
                return Err(KitsError::Unreadable("an item is not a pointer"));
            }
            addresses.push(address);
        }
        Ok(addresses)
    }

    /// The kit items a club holds, as read from the game's memory just now.
    pub fn club_kits(&self, club: &ClubSummary) -> Result<Vec<KitItem>, KitsError> {
        let k = self.kits_layout()?;
        let mut items = Vec::new();
        for address in self.kit_item_addresses(club)? {
            let bytes = self.process.read_bytes(address, k.item_size as usize)?;
            items.push(read_item(address, &bytes, k).ok_or(KitsError::Unreadable("an item does not read as a kit"))?);
        }
        Ok(items)
    }

    /// Writes colours and a style into item number `index` of a club's kits: the colours given (by position, in the
    /// order of [`COLOUR_NAMES`]) and the style, if any. Checks the club and the item first, and reads the bytes back
    /// after. Returns the item as it was before, so it can be put back.
    pub fn set_kit_item(
        &self,
        club: &ClubSummary,
        index: usize,
        colours: &[(usize, [u8; 3])],
        style: Option<u32>,
    ) -> Result<KitItem, KitsError> {
        let k = self.kits_layout()?;
        if colours.iter().any(|(i, _)| *i >= COLOURS) {
            return Err(KitsError::Refused("a colour position above 4"));
        }
        if style.is_some_and(|style| style > 0xff) {
            return Err(KitsError::Refused("a style above 255"));
        }
        let address =
            *self.kit_item_addresses(club)?.get(index).ok_or(KitsError::Refused("the club has no such item"))?;
        let bytes = self.process.read_bytes(address, k.item_size as usize)?;
        let before = read_item(address, &bytes, k).ok_or(KitsError::Unreadable("the item does not read as a kit"))?;
        let mut new = bytes.clone();
        for (i, rgb) in colours {
            let at = k.colours as usize + i * 4;
            new[at..at + 4].copy_from_slice(&colour_bytes(*rgb));
        }
        if let Some(style) = style {
            let at = k.style as usize;
            new[at..at + 4].copy_from_slice(&style.to_le_bytes());
        }
        if new == bytes {
            return Ok(before);
        }
        // Only the colours and the style change; the rest of the record stays as it is.
        let (from, to) = (k.colours as usize, k.style as usize + 4);
        self.process.write_bytes(address + from as u64, &new[from..to])?;
        let after = self.process.read_bytes(address, k.item_size as usize)?;
        if after != new {
            // Put it back and say so rather than leave a half-written kit.
            self.process.write_bytes(address + from as u64, &bytes[from..to])?;
            return Err(KitsError::Unreadable("the game's memory did not take the write; it was put back"));
        }
        Ok(before)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> KitsLayout {
        KitsLayout {
            club_object: 0xb0,
            list: 0x78,
            item_size: 0x28,
            colours: 0,
            style: 0x14,
            slot: 0x22,
            item_type: 0x23,
        }
    }

    /// Valence's home shirt as the game keeps it: white, red, red, white, white; style 27.
    fn valence_home() -> Vec<u8> {
        let mut bytes = vec![
            0xf8, 0xf8, 0xf8, 0xff, 0x00, 0x10, 0x90, 0xff, 0x00, 0x10, 0x90, 0xff, 0xf8, 0xf8, 0xf8, 0xff, 0xf8, 0xf8,
            0xf8, 0xff, 0x1b, 0, 0, 0,
        ];
        bytes.extend([0xff; 8]);
        bytes.extend([0, 0, 0, 1, 0, 1, 0, 0]);
        bytes
    }

    #[test]
    fn reads_an_item() {
        let item = read_item(0x1000, &valence_home(), &layout()).expect("an item");
        assert_eq!((item.slot, item.item_type, item.style), (0, 1, 27));
        assert_eq!(item.colours[0], [0xf8, 0xf8, 0xf8]);
        assert_eq!(item.colours[1], [0x90, 0x10, 0x00]);
    }

    #[test]
    fn rejects_what_is_not_a_kit() {
        let mut bytes = valence_home();
        bytes[3] = 0; // no alpha
        assert_eq!(read_item(0, &bytes, &layout()), None);
        let mut bytes = valence_home();
        bytes[0] = 0x07; // not a multiple of 8
        assert_eq!(read_item(0, &bytes, &layout()), None);
    }

    #[test]
    fn colours_are_written_as_the_game_keeps_them() {
        assert_eq!(colour_bytes([0x90, 0x10, 0x00]), [0x00, 0x10, 0x90, 0xff]);
        assert_eq!(colour_bytes([0xff, 0x7f, 0x03]), [0x00, 0x78, 0xf8, 0xff]);
    }
}
