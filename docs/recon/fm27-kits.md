# A club's kits (recon plan, not yet found)

Status: **nothing is known yet.** No kit structure of FM27 has been located, so the editor cannot read or write kits, and
this note says how to find them. It was written after a request to offer what other editors show in a club's "Kits and
Colours" tab. Only the game's own screens and the game's memory are used; no other editor's code or assets are consulted.

## What the game's kit data holds (from the in-game kit screens, to confirm in memory)

For each of a club's six kits (home, away, third, and the three goalkeeper kits), a list of items (shirt, shorts, socks...).
Each item very likely has: an item type, three colours (foreground, background, outline), the number colour and its outline
colour, a competition it is reserved for, an optional start year, an alternative kit number, and a style index (a small
integer choosing the pattern). All of this is a hypothesis until read from the heap.

## Plan

1. Pick a club with an unusual, easy to spot kit (for example a club whose home shirt is pure `#FF00FF` after edit in the
   game's own Edit Kit screen, if the game has one, or a club known by its colours).
2. With `fmlibre-probe club <uid>` and `fmlibre-probe dump`, follow the club's pointers (the sponsorships list at club
   `+0x130` and finances at `+0x150` show the pattern: a `(begin, end, capacity)` record, then one pointer per element).
   Look for a list of 6 sub-lists, or 6 pointers, whose elements are small records holding 3-4 byte colour values.
3. Search the heap for the club's known colour as 32-bit values (`fmlibre-probe scan`), then change the colour in the game,
   save, and see which word moved. Do it for foreground, background and outline separately, then for the style index.
4. Confirm on two clubs and on both storefronts (Game Pass 0.9.2524.0 and Steam), then write the layout into
   `layout.toml` and a `[layout.club_kits]` profile section, and a reader in `crates/fmlibre-core/src/` next to
   `sponsorship.rs`. Read only first; then writes with the same five checks as every other field.
5. UI: a Kits tab in the club profile with a colour picker per item and a style stepper, and an undo entry.

## Risks

- Colours may be stored as an index into a palette, or as packed ARGB or ABGR; the scan in step 3 tells which.
- The game may regenerate the kit from another structure on load (as it drops renamed stadiums), so a write has to be
  checked on the screen, not only by reading memory back.
- Kit changes in memory are lost on reload unless the save is saved from the game.
