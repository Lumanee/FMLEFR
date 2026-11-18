# A club's sponsorship deals

Where FM27 keeps them and what each field is, as found in #114 and read by the editor (`crates/fmlibre-core/src/sponsorship.rs`).
The app shows them, read only, in a club's finances. Writing to them is not done.

## Layout

A club points (club `+0x130`) at a `(begin, end, capacity)` record. Its list holds one pointer per deal, each to an entry of 24
bytes. Windows and macOS lay it out alike.

| Offset | Meaning |
|---|---|
| +0x00 | start date: `u16` day of the year (flags above bit 8), `u16` year |
| +0x04 | end date, the same |
| +0x08 | `u32` pounds, the total value of the deal |
| +0x0C | `u32` pounds per season |
| +0x10 | `u16` percentage: the amount falls by it on relegation; for a kit manufacturer the screen words it as a rise on promotion to the top division |
| +0x12 | `u16` the club's reputation when the deal was signed |
| +0x14 | `u8` kind |
| +0x15, +0x16 | `u8`s with no visible effect (changing them left the deal on the screen, unchanged) |

## Kinds

The names are the ones the game's Sponsorship screen shows, in English, matched by amount and date (#114).

| Kind | Name | Kind | Name |
|---|---|---|---|
| 1 | Main Kit | 13 | Training Kit |
| 3 | Stadium | 14 | Youth Team |
| 4 | General | 15 | Training Ground |
| 5 | Individual TV Deal | 16 | Continental Competition |
| 7 | Club Membership | 19 | Shirt Sleeve |
| 8 | Away Kit (very likely) | 22 | Kit Manufacturer |
| 9 | Additional Kit Sponsor | 23 | Stadium (a second kind with the same label) |
| 11 | Back of Shirt | 12 | Shorts |

Kinds 6 and 17 are in the entries of clubs and are not on the screen; 2 was seen without a name. The editor shows them as
"Type N".

## What the game does with them

- The season's sponsorship money is the sum of the entries' amounts per season, booked once, at the start of the season;
  an entry edited in a save was paid as written. The club's finance record only keeps what was booked.
- The screen lists the deals that have not ended. It reads an entry again from the next day in the game after a change.
- A deal can leave the list before its end date, for reasons not known.

- On Game Pass 0.9.2524.0 (a save of January 2028) many deals keep no amount per season and no reputation (`+0x0C` and
  `+0x12` read 0): nearly every deal of Manchester United, Barcelona, Real Madrid, Napoli and Benfica. The others keep
  both, and their amount per season is the total divided by the years (Beşiktaş's six, Manchester City's newer ones).
  The app shows a deal's amount per season only where it keeps one. Kind 18, which #114 did not name, was 32 of the 621
  deals of 90 clubs, mostly a single year that has ended.

## Open

- The end date of a club membership deal read 12.6.2029 where the screen showed 28.5.2029.
- The screen's amount per season for one youth team deal was the total divided by its years, not the entry's `+0x0C`.
- What the screen shows, and what the game pays each season, for a deal that keeps no amount per season.
- Adding a deal needs a longer list: its capacity always equals its count, so the game's own list would have to be
  reallocated. Not tried.
