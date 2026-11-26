# A club's kits (recon plan, not yet found)

Status: **the persistent kit data is not found yet** (see "What the first probe session found"). No kit structure of FM27 has been located, so the editor cannot read or write kits, and
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

## What the first probe session found (Game Pass 0.9.2524.0, a Regional 1 club)

All by reading memory with `fmlibre-probe`; nothing was written to the game.

- The club object (`CLUB`, 0x170 bytes) holds no kit data. Its last 16 bytes are reputations (u16 values), not colours.
  None of the objects it points to (one and two levels down) has a class named for kits or colours.
- The home kit's colours, read from the game's own kit screen, are multiples of 8 per channel (for example 144, 16, 0 and
  248, 248, 248), which hints at 5 bits per channel somewhere in the source data.
- A search for the club's colours as 4 bytes (R, G, B, 0xFF) finds 11 copies of a block of 22 such colours inside larger
  records beside player-like statistics, and several small objects of 3 colours that point into `GameAssembly.dll`. These
  look like the match engine's input and the interface's copies: derived data, not the stored kits.
- 3-byte and 16-bit (555, 565) searches find no stored copy; the one 555 candidate group was float data.

Conclusion: the stored kits are in another encoding (a palette index, or a packed form). Finding it needs a
before/after difference around a real kit change (`fmlibre-probe pages OUT`, then `pages OUT2 --against OUT`), which in
turn needs a way to change a kit in the game. Without it, a read or write cannot be proven correct and no kit editing
should be shipped.

## Where the kits are (Game Pass 0.9.2524.0): found

This section replaces the conclusion above that no persistent store had been found: it has been, and written to.

**Chain.** Club + `0xB0` points at an object; at +`0x78` of that object is a `(begin, end, capacity)` list of pointers, one
per kit item. Checked on Olympique de Valence (2 items) and its two neighbours in memory (2 and 13 items): the club
objects are 0x170 apart and each one's `0xB0` leads to a different object.

**Item record, 0x28 bytes.**

| offset | what |
|---|---|
| 0x00..0x14 | five colours, each 4 bytes B G R 0xff: foreground, background, outline, number, number outline |
| 0x14 | u32 style (Valence home 27, away 1) |
| 0x18 | two words of 0xffffffff: probably competition and season, none |
| 0x22 | slot: 0 home, 1 away, 2 third |
| 0x23 | type of item: 1 shirt; the club with 13 items also has 2, 3, 4, 5 and 0x21 (shorts, socks, goalkeeper items: not named yet) |

Channels are always multiples of 8 (the game keeps 5 bits). Valence has only shirts, which matches the Kits and Colours
screen of the other tool's screenshots (no shorts or socks lines for it).

**Writing, checked.** Writing a colour into the home item's foreground (white to green) changed the sleeves, and the
whole UI theme (top bar), after a day was advanced; putting it back restored them. Nothing shows until a day passes. The
UI theme follows the home kit: red primary, white (the foreground) secondary.

**Tools.** `fmlibre-probe kits UID` lists a club's items; `fmlibre-probe set-kit UID INDEX --colour 0=00f800 --style 27
--hold 60` writes one and, with `--hold`, puts it back. Without `--hold` the change stays, which is how persistence over
days and save/reload is checked. Layout: `[kits]` in `profiles/fm27/layout.toml`.

**Not known yet.** Whether a change survives a save and reload; what the types 2, 3, 4, 5 and 0x21 are; the meaning of
the bytes after the slot and type; how a kit is added (a third kit would mean growing the list); whether women's and youth
teams share a club's items.
