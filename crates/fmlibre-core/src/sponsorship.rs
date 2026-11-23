//! A club's sponsorship deals, as its Sponsorship screen lists them (#114). Read only.
//!
//! A club points (`[sponsorship] club_list`) at a `(begin, end, capacity)` record whose list holds one pointer per
//! deal, and each pointer leads to an entry of 24 bytes: the start and end dates, the total value and the amount per
//! season in pounds, a percentage the deal changes by on relegation, the club's reputation when it was signed, and the
//! kind. The game pays the season's sponsorship money from these entries (a change of one was paid as written), and
//! its screen lists the deals that have not ended, without the kinds it has no name for.
//!
//! The kinds' names are the ones the game's screen shows, in English, as the reports in #114 matched them by amount and
//! date. Kinds 6 and 17 are in the entries of clubs without being on the screen, and 2 was seen without a name: they
//! are left unnamed rather than guessed.

use std::fmt;

use fmlibre_mem::is_user_pointer;
use serde::Serialize;

use crate::clubs::ClubSummary;
use crate::date::FmDate;
use crate::profile::SponsorshipLayout;
use crate::session::Session;

/// The most deals a club is taken to hold: a club had up to 14 on the saves seen.
const MOST_DEALS: u64 = 64;

/// The name the game's Sponsorship screen gives a kind, or none where it shows none.
pub fn kind_name(kind: u8) -> Option<&'static str> {
    Some(match kind {
        1 => "Main Kit",
        3 => "Stadium",
        4 => "General",
        5 => "Individual TV Deal",
        7 => "Club Membership",
        8 => "Away Kit",
        9 => "Additional Kit Sponsor",
        11 => "Back of Shirt",
        12 => "Shorts",
        13 => "Training Kit",
        14 => "Youth Team",
        15 => "Training Ground",
        16 => "Continental Competition",
        19 => "Shirt Sleeve",
        22 => "Kit Manufacturer",
        // A second kind the screen labels as the first.
        23 => "Stadium",
        _ => return None,
    })
}

/// The kind of a kit manufacturer's deal, whose percentage the game words as a rise on promotion.
const KIT_MANUFACTURER: u8 = 22;

/// One deal a club holds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sponsorship {
    pub kind: u8,
    /// As the game's screen names the kind; none for a kind it has no name for here.
    pub name: Option<&'static str>,
    pub start: Option<FmDate>,
    pub end: Option<FmDate>,
    /// Whole years the deal runs, as the screen counts them: from the start to the day after the end, rounded.
    pub years: Option<u32>,
    /// Pounds, for the whole deal.
    pub total: u32,
    /// Pounds, each season.
    pub per_season: u32,
    /// The percentage the amount changes by: down on relegation, up on a promotion to the top division for a kit
    /// manufacturer (`rises`). Zero for none.
    pub percent: u16,
    pub rises: bool,
    /// The club's reputation when the deal was signed.
    pub reputation: u16,
    /// Whether the deal ended before the game's date, which the game's screen leaves out. None where the date is not
    /// known.
    pub ended: Option<bool>,
}

/// Why the app shows no sponsorship deals on this build of the game.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SponsorshipUnavailable {
    /// Nobody has read the deals on this build and matched them to the game's screen yet.
    Build,
    /// The build was checked, but what the editor found does not read as the game's.
    Unreadable,
}

impl fmt::Display for SponsorshipUnavailable {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            SponsorshipUnavailable::Build => "the sponsorship deals have not been checked on this build of the game",
            SponsorshipUnavailable::Unreadable => "the sponsorship deals do not read as the game's on this build",
        })
    }
}

/// Why a club's deals were not read.
#[derive(Debug)]
pub enum SponsorshipReadError {
    Unavailable(SponsorshipUnavailable),
    Memory(fmlibre_mem::Error),
}

/// The whole years a deal runs: the months from its start to the day after its end, rounded to years, and at least one.
fn years_between(start: FmDate, end: FmDate) -> Option<u32> {
    let after = end.plus_days(1);
    let months = (i32::from(after.year) - i32::from(start.year)) * 12 + i32::from(after.month)
        - i32::from(start.month)
        - i32::from(after.day < start.day);
    u32::try_from(months).ok().map(|months| ((months + 6) / 12).max(1))
}

/// Reads one entry's bytes (from its start to [`SponsorshipLayout::end_of_entry`]). None where they do not read as a
/// deal: no kind, or an end before the start.
pub(crate) fn read_entry(bytes: &[u8], s: &SponsorshipLayout, today: Option<FmDate>) -> Option<Sponsorship> {
    let u16_at = |at: u64| u16::from_le_bytes(bytes[at as usize..at as usize + 2].try_into().expect("2 bytes"));
    let u32_at = |at: u64| u32::from_le_bytes(bytes[at as usize..at as usize + 4].try_into().expect("4 bytes"));
    let date = |at: u64| FmDate::from_raw(u16_at(at), u16_at(at + 2));
    let kind = bytes[s.kind as usize];
    let (start, end) = (date(s.start), date(s.end));
    if kind == 0 || start.zip(end).is_some_and(|(start, end)| end < start) {
        return None;
    }
    Some(Sponsorship {
        kind,
        name: kind_name(kind),
        start,
        end,
        years: start.zip(end).and_then(|(start, end)| years_between(start, end)),
        total: u32_at(s.total),
        per_season: u32_at(s.per_season),
        percent: u16_at(s.percent),
        rises: kind == KIT_MANUFACTURER,
        reputation: u16_at(s.reputation),
        ended: today.zip(end).map(|(today, end)| end < today),
    })
}

impl Session {
    /// The sponsorship deals the club holds, as the app shows them: on the builds whose profile says the deals were
    /// checked there, and when what is found reads as the game's. See [`Session::sponsorships`].
    pub fn checked_sponsorships(&self, club: &ClubSummary) -> Result<Vec<Sponsorship>, SponsorshipReadError> {
        if !self.profile.as_ref().is_some_and(|profile| profile.sponsorships) {
            return Err(SponsorshipReadError::Unavailable(SponsorshipUnavailable::Build));
        }
        self.sponsorships(club)
    }

    /// The sponsorship deals the club holds, in the game's order, as read from its memory just now, on any build whose
    /// layout places them: the probe reads them on a build nobody has checked. Only reads. A list that fits its record
    /// and entries that read as deals; a club with no list, or an empty one, holds none.
    pub fn sponsorships(&self, club: &ClubSummary) -> Result<Vec<Sponsorship>, SponsorshipReadError> {
        let unavailable = |reason| Err(SponsorshipReadError::Unavailable(reason));
        let Some(s) = self.layout.sponsorship.as_ref() else {
            return unavailable(SponsorshipUnavailable::Build);
        };
        let process = &self.process;
        let memory = SponsorshipReadError::Memory;
        if process.read_u32(club.address + self.layout.club.uid).map_err(memory)? != club.uid {
            return Ok(Vec::new());
        }
        let record = process.read_u64(club.address + s.club_list).map_err(memory)?;
        if record == 0 {
            return Ok(Vec::new());
        }
        let unreadable = || unavailable(SponsorshipUnavailable::Unreadable);
        if !is_user_pointer(record) {
            return unreadable();
        }
        let words = process.read_bytes(record, 24).map_err(memory)?;
        let word = |at: usize| u64::from_le_bytes(words[at..at + 8].try_into().expect("8 bytes"));
        let (begin, end, capacity) = (word(0), word(8), word(16));
        if begin == end {
            return Ok(Vec::new());
        }
        let size = end.wrapping_sub(begin);
        if end < begin || size % 8 != 0 || size / 8 > MOST_DEALS || capacity < end || !is_user_pointer(begin) {
            return unreadable();
        }
        let pointers = process.read_bytes(begin, size as usize).map_err(memory)?;
        let today = self.game_date();
        let mut deals = Vec::new();
        for pointer in pointers.as_chunks::<8>().0 {
            let entry = u64::from_le_bytes(*pointer);
            if !is_user_pointer(entry) {
                return unreadable();
            }
            let bytes = process.read_bytes(entry, s.end_of_entry() as usize).map_err(memory)?;
            match read_entry(&bytes, s, today) {
                Some(deal) => deals.push(deal),
                None => return unreadable(),
            }
        }
        Ok(deals)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> SponsorshipLayout {
        SponsorshipLayout {
            club_list: 0x130,
            entry_size: 24,
            start: 0,
            end: 4,
            total: 8,
            per_season: 0xC,
            percent: 0x10,
            reputation: 0x12,
            kind: 0x14,
        }
    }

    /// An entry as the game keeps it: dates as a day of the year and a year.
    fn entry(
        start: FmDate,
        end: FmDate,
        total: u32,
        per_season: u32,
        percent: u16,
        reputation: u16,
        kind: u8,
    ) -> Vec<u8> {
        let mut bytes = vec![0u8; 24];
        bytes[0..2].copy_from_slice(&start.day_of_year().to_le_bytes());
        bytes[2..4].copy_from_slice(&start.year.to_le_bytes());
        bytes[4..6].copy_from_slice(&end.day_of_year().to_le_bytes());
        bytes[6..8].copy_from_slice(&end.year.to_le_bytes());
        bytes[8..12].copy_from_slice(&total.to_le_bytes());
        bytes[12..16].copy_from_slice(&per_season.to_le_bytes());
        bytes[16..18].copy_from_slice(&percent.to_le_bytes());
        bytes[18..20].copy_from_slice(&reputation.to_le_bytes());
        bytes[20] = kind;
        bytes
    }

    fn date(year: u16, month: u8, day: u8) -> FmDate {
        FmDate { year, month, day }
    }

    #[test]
    fn the_layout_ends_with_its_last_field() {
        assert_eq!(layout().end_of_entry(), 24);
    }

    /// A kit manufacturer's deal of a club in the Serie BKT, as the screen showed it (#114): six years, a rise of 15%
    /// on promotion.
    #[test]
    fn reads_a_deal() {
        let bytes = entry(date(2021, 7, 1), date(2027, 6, 30), 859_031, 143_171, 15, 6_000, 22);
        let deal = read_entry(&bytes, &layout(), Some(date(2026, 9, 14))).expect("a deal");
        assert_eq!((deal.kind, deal.name), (22, Some("Kit Manufacturer")));
        assert_eq!((deal.total, deal.per_season, deal.percent, deal.rises), (859_031, 143_171, 15, true));
        assert_eq!((deal.start, deal.end), (Some(date(2021, 7, 1)), Some(date(2027, 6, 30))));
        assert_eq!((deal.years, deal.ended, deal.reputation), (Some(6), Some(false), 6_000));
    }

    #[test]
    fn a_deal_that_ended_is_marked() {
        let bytes = entry(date(2025, 7, 1), date(2026, 6, 30), 73_017, 73_017, 0, 6_000, 12);
        assert_eq!(read_entry(&bytes, &layout(), Some(date(2026, 9, 14))).unwrap().ended, Some(true));
        assert_eq!(read_entry(&bytes, &layout(), Some(date(2026, 6, 30))).unwrap().ended, Some(false));
        assert_eq!(read_entry(&bytes, &layout(), None).unwrap().ended, None);
    }

    /// Durations the game's screen showed: a deal of 1.6.2026 to 30.6.2027 is one year, 6.12.2026 to 5.12.2028 two.
    #[test]
    fn counts_years_as_the_screen_does() {
        assert_eq!(years_between(date(2026, 6, 1), date(2027, 6, 30)), Some(1));
        assert_eq!(years_between(date(2026, 12, 6), date(2028, 12, 5)), Some(2));
        assert_eq!(years_between(date(2025, 7, 1), date(2035, 6, 1)), Some(10));
        assert_eq!(years_between(date(2026, 7, 1), date(2026, 7, 31)), Some(1));
    }

    #[test]
    fn leaves_a_kind_without_a_name_unnamed() {
        for kind in [2, 6, 17, 200] {
            let bytes = entry(date(2025, 7, 1), date(2028, 6, 30), 15_462_574, 0, 0, 0, kind);
            assert_eq!(read_entry(&bytes, &layout(), None).unwrap().name, None, "{kind}");
        }
        assert_eq!([1, 23, 22].map(kind_name), [Some("Main Kit"), Some("Stadium"), Some("Kit Manufacturer")]);
    }

    #[test]
    fn rejects_what_is_not_a_deal() {
        let none = entry(date(2025, 7, 1), date(2028, 6, 30), 1, 1, 0, 0, 0);
        assert_eq!(read_entry(&none, &layout(), None), None);
        let backwards = entry(date(2028, 6, 30), date(2025, 7, 1), 1, 1, 0, 0, 1);
        assert_eq!(read_entry(&backwards, &layout(), None), None);
    }
}
