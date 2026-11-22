# FM27: how the game records transfers

Notes towards a transfer with a fee that shows in the game's history. The first sections were
read from the Mac Steam build, on a save in July 2026 ("Tyrone Demarcus - Arsenal"), with the
probe (`refs`, `find --as u32`, `holders`, `dump`, `column`). The editor now gets such a
transfer by having the game make it: see [A transfer the game makes on a later
day](#a-transfer-the-game-makes-on-a-later-day), read on Windows.

## A person's internal ID

The identity block of a person, which contracts and captaincies point at (`object+0x388` on
macOS), holds after its class pointer:

| Offset | Field | Viktor Gyökeres |
| --- | --- | --- |
| `+0x08` | `u32` internal person ID | 23637 |
| `+0x0C` | `u32` UID | 93070271 |

Internal IDs are not indexes into the players array (index 23637 is someone else).

## The transfer history

The game keeps one list of transfers for the whole game: 48-byte records, laid out one after
another and sorted by the person's internal ID. A transfer made in this save sits among the
ones from the database. Anel Ahmedhodžić's move from Sheffield United to Burnley on
13 July 2026 is the record just before Gyökeres'.

| Offset | Field | Gyökeres, Sporting → Arsenal |
| --- | --- | --- |
| `+0x00` | buying club (club object) | Arsenal |
| `+0x08` | selling club (club object) | Sporting CP |
| `+0x10` | date | 2025-07-26, the contract's `joined` |
| `+0x14` | a second date, unset (1 January 1900) here | |
| `+0x18` | `u32`, an amount | 833,333 |
| `+0x1C` | `u32` internal person ID | 23637 |
| `+0x20` | `u32` flags | `0x250C` |
| `+0x24` | zero | |

- The amounts of neighbouring records are 107,378, 208,333, 833,333 and 2,083,333. The last
  three are 2.5, 10 and 25 million over 12, and every flags word ends in `0x0C`, which is 12.
- The amount is not the fee. The game shows £54M for Gyökeres' move and £6M for Anel
  Ahmedhodžić's (Sheffield United → Burnley, 13 July 2026, the record before his), against
  833,333 and 107,378: no one factor turns both into their fee.
- £54M occurs as a plain `u32` only in a library constant and in what looks like a contract's
  clauses (next to 60M, 20M and 1.5M). Near every place 26 July 2025 occurs, no plain fee in
  pounds or thousands shows up.
- So these records may be something other than the history the game shows: pending add-ons
  or instalments between clubs (payer, payee, from when, a monthly amount, the person, and a
  count of months), say. Where the shown fee lives is still open.
- An array of pointers to the records, one per record, sits elsewhere (`0x7629dac3e0` on this
  save): the list is reached through it.

The player object also holds his previous club (`+0x350`: Sporting) and dates around it
(`+0x360` on: 26 July 2025).

## Watching a transfer the game made

The maintainer bought Luke Bell (UID 2000039902, internal ID 24941), a Coventry City
goalkeeper, for £1.2M, a fee easy to find in memory. Memory was read with the deal agreed
but not yet accepted, then again once Accept and Continue had made the move (25 July 2026).

**While agreed.** The deal is held in objects that name the player's identity block, the
buying team (Arsenal's, twice), the selling team and the fee as a `u32` in pounds.
A list of 32-byte entries also holds Coventry, the date, the person's ID and the fee, as a
`u64` in pounds.

**Once made.** The game writes events of its own into a game-wide stream of mixed records:
small objects of several classes, laid out one after another, which nothing points at one by
one. Three were new:

| Class (`game_plugin+`) | Fields after the class pointer |
| --- | --- |
| `0x559FFB8`, 64 bytes | `+0x08` date, `+0x10` fee in pounds, `+0x18` the player's identity block, `+0x20` a pointer, `+0x28` buying club, `+0x30` selling club |
| `0x55A0020` | date, fee, the player, the selling club (Coventry's sale) |
| `0x55A0088` | date, fee, the player, the buying club (Arsenal's purchase) |

- The date is 8 bytes: a sequence byte, then the `u16` day of the year with flags (`0x44CE`
  is day 206 of 2026, 25 July), then the `u16` year.
- The stream holds 2,748 events of the first class, all from transfers made in this save. The
  database's own transfers, such as Gyökeres', are not among them; they are kept elsewhere.
- No `(begin, end)` pair covers the stream, and no pointer leads to an event. To add one, the
  game's write position and the room after it have to be found first. This is the riskiest
  kind of write: a mistake would break the save's history.

## Free agents, and releasing a player

The game's own free agents have a null team (`+0x128` on macOS) and a null contract pointer
(`+0x2F0`). Nothing else ties them to a club: no game-wide list of free agents was found.

The player object keeps the club he left last at `+0x350`, and the day he left it at `+0x364`
(the `u16` day of the year, then the `u16` year):

| Player | `+0x350` | `+0x364` | `+0x368` |
| --- | --- | --- | --- |
| Viktor Gyökeres, at Arsenal | Sporting CP | 26 July 2025 | 24 July 2026 |
| Yassine Bounou, free agent | his last club | 19 July 2026 | 19 July 2026 |
| Riyad Mahrez, free agent | his last club | 30 June 2026 | 30 June 2026 |
| Francesco Acerbi, free agent | his last club | 1 June 2026 | his birth date |

What else points at a player was read for Maximilian Arnold, Wolfsburg's captain (`refs` over
his object):
- his team's list of players, and the team's captain pointer (`team+0x88`);
- his contract (`contract+0x08`, the owner);
- lists of identity blocks that hold players of many clubs, and free agents too: not the
  club's;
- small records with his identity and Wolfsburg's senior team, likely his history there, and
  records of other clubs' interest in him.

The editor's release (`plan_release`) takes him out of every list of his club's teams that
holds him and empties a captaincy he holds, then clears his team and contract pointers, in that
order: nothing reaches him through his club once the pointers are cleared. The contract is
left as it was, since only the player points at it. A move also empties the captaincies the
player leaves. The release does not set `+0x350` or the dates, so the game still names the
club before as his last one; that belongs with the transfer history.

Checked on the Mac Steam build with `release --restore`: while released, Wolfsburg had no
captain and one player fewer, and both came back.

## A club a human manager runs

Read on the Mac Steam build (27.0.0, arm64), on the Arsenal save in January 2027, with the probe and a scratch tool
that names the class of whatever points at a player (the nearest vtable before the pointer, and the `(begin, end)`
lists that hold it).

**What points at a player there.** Gabriel, a regular starter, had about 250 pointers into his object; Micky van de
Ven, a starter at Tottenham, 22. The extra ones:

- about 160 objects of the assistant's advice (`backroom_advice_*::*_ADVICE_SUGGESTION`): the assistant's identity
  block at `+0x08`, the player's at `+0x10`;
- inbox items, team meeting records and match records, which players who have left keep too;
- a list of 16-byte entries (an identity block, then flags) at `+0x100` of `CLUB_HUMAN_MANAGER_DETAILS`, which held
  nine players;
- `TRAINING_EDIT_SESSION+0xc8`, the senior players at the club. It is the training screen's: once the manager went
  to another screen, its memory held something else.

**What the game does when a player leaves.** The manager put Remy Mitchell in goal and released him (both in the
game, then reloaded without saving). From one game day to the next, the game:

- took him out of the senior team's list, the later players moving up one;
- freed his contract, whose block another player's contract took at once;
- set his last club (`+0x350`) and the day he left (`+0x364`);
- emptied his slot in the team selection (below), which the tactics screen then showed as "None" in goal.

It left the advice objects and the manager's details pointing at him.

**The team selections.** The match engine keeps what the manager picked, for each tactic, as objects of
`simatch::PREPARED_TACTICS_CREATOR_ARRAY`:

| Offset | Field |
| --- | --- |
| `+0x00` | vtable |
| `+0x08` | a list `(begin, end, capacity)` |
| `+0x20` | flags: their low 16 bits read `0xff01` in the manager's, `0xff00` in other clubs' |
| `+0x28` | 26 `u32` slots of the game's person ids (a player's identity block `+0x08`): the eleven in the order of the formation's positions, then the substitutes; `0xFFFFFFFF` is empty |

- The save had 38 such objects. Three held the manager's current selection. The game emptied Mitchell's slot in one
  of them and left him in the other two.
- When the manager moved Kepa from the bench into goal, all three changed: the goal slot got Kepa's id, the first
  substitute's slot `0xFFFFFFFF`. Other copies were made for the screen and on a thread's stack.
- Nothing else in an object holds person ids: the set pieces are not among them.
- One object read 0 for the list's begin and had no player in its slots, as a block the allocator has taken back. All
  the others held a sound list.

**What the editor does.** A move, release or swap out of such a club first empties the player's slot in every copy
that holds him and whose filled slots are mostly players of the club's teams. A national team's selection, which
holds him among players of other clubs, is left alone. It finds the copies by their class, in one pass over the
game's memory: 3 to 4 seconds in a release build. It leaves the stacks out, and any object without a sound list. An
undo writes a copy's slots back only while they are what the move left there.

Checked on that save:

- Ezri Konsa was moved to Ipswich and held there for five minutes. The tactics screen showed "None" in his place, and
  he was not in the squad. He came back to all nine copies that had held him, with his squad number.
- Declan Rice, Arsenal's captain and a starter, was moved to Ipswich from the app. The next match and the following
  days went as usual. No copy held him afterwards, and Arsenal's captaincy stayed empty for the manager to fill.

**On Windows.** The class has the same layout there, and the editor finds its vtables from MSVC's descriptors: the
type descriptor that names `.?AVPREPARED_TACTICS_CREATOR_ARRAY@simatch@@`, the complete object locator that points at
the descriptor, and the vtable after a pointer to the locator (`fmlibre_core::rtti`). Read on the Game Pass save
(0.9.2409.0, 15 September 2026), whose manager runs Manchester United:

- 21 objects of the class. Three held Manchester United's selection, the same 20 players in each, one of them in
  another order; four held Manchester City's, four Millwall's, and nine were empty. Every one on the heap held a
  sound list at `+0x08` with one entry.
- The last one sat on a thread's stack, with 0 for its list and no person ids in its slots. Windows does not tag a
  stack's memory as macOS does, so the editor asks Windows for the game's threads and reads where each one's stack is
  from its environment block (TEB); it leaves those ranges out, and refuses the move when Windows will not tell.
- The flags at `+0x20` read `0xff00` in all of them, Manchester United's too.
- Finding the vtable takes about half a second, and finding the objects 3.7 seconds, in a release build.

Checked there with the probe's `move --restore --hold 20`: Mason Mount, a substitute, and Bruno Fernandes, the captain
and a starter, each moved to Juventus. While they were away, the slot each had held was empty in the three copies of
Manchester United's selection and nowhere else; Bruno Fernandes's captaincy was empty too. Moved back, all 21 objects
read as before, and Bruno Fernandes was captain again.

The Steam build (26340721) was read on a save of 1 July 2027, whose manager had just taken over Monza in the
close season. The class was found the same way. Of its 18 objects, ten held other clubs' selections with all 26
slots filled, seven were empty, and one held a list whose end came before its begin, as a block the allocator has
taken back; none held a Monza player yet. Adam Bakoune moved out of Monza to Juventus and back, with the probe and
through the app's dialog: as no copy was the club's, none changed, and every object read as before.

## A transfer the game makes on a later day

Read on Windows, Game Pass 0.9.2524.0, on a West Ham save of October 2026, by watching the game make transfers that
were agreed for the next day (Marc Guéhi, Erling Haaland and Antoine Semenyo, each between two clubs), comparing memory
before and after the day each went through, and then by arranging such transfers from the editor (Ebere Eze and Mikel
Merino from Arsenal to West Ham), which the game made on the day. The offsets are in `profiles/fm27/layout.toml`,
`[transfers]`; the code is `crates/fmlibre-core/src/arranged.rs`.

**What a move the editor makes leaves out.** The career screen shows each season a player had at a club as a row, with
the fee he joined for. A move the editor makes at once leaves the season under way as one row, for the new club, with
what he did at the old one, and no fee. When the game makes a transfer itself, it keeps the old club's row of the
season with his matches, opens one for the new club with the fee, writes its own records of the move and pays the fee:
Guéhi's screen showed Man City 2026/27 with his 6 matches and Hull City 2026/27 with €64M.

**Where the shown fee is not.** The transfer manager (`TRANSFER_MANAGER`, found by its class) keeps a list of the
transfers made, as pointers to records of 0x70 bytes (the buying team, the selling team, the date, the person's id, the
fee in pounds three times, the manager who made it). The player keeps the fee and the day of his last move at `+0x244`
and `+0x250`, his last club at `+0x390` and the day he left it at `+0x3A4`. The career screen reads none of these:
Julian Weigl's fee set to other amounts in all four places, his history shown afresh after the game was started again,
still read €6M. The screen's rows come from records the game writes as it makes the move, and keeps for the save in its
archives; the editor leaves them to the game.

**A transfer agreed for a later day** is, as the game keeps one:

| What | Where |
| --- | --- |
| An offer (`FULL_TRANSFER_OFFER`, 0xD0 bytes, a slot of the game's pool of them) | in the manager's list of offers (`+0x20`) |
| The contract the player is to have (`db::FULL_CONTRACT`), from the day of the move | named by the entry below |
| An entry of 0x48 bytes: the contract, the offer's number, agreed and waiting (state 2) | in the player's record of entries (`+0x328`) |
| The offer's number | in the player's record of offers' numbers (`+0x320`) |
| The move due: the player's person block, the day, the offer's number (16 bytes) | in the manager's list of moves due (`+0x50`) |
| A flag that a move is due | the manager's `+0x68` |

- The offer is agreed (state 19 at `+0x8D`): the player's person block, the buying team twice, the selling team, the
  fee, its number, the day it was made, the day it lapses (30 days on) and the day of the move. Its other bytes are
  those of the game's own agreed transfers: of the 103 on the save, 40 had the flags `0x40` and the same bytes from
  `+0x84` on.
- Without the move due, the game shows the player as "Transfer arranged" and joining on 1 January 1900, and never makes
  the move: the day it shows, and the day it acts on, are the move due's.
- On the day, the game makes the move as its own: the offer becomes made (state 20) with its days set, the contract
  becomes the player's running one, the move due is let go of and the flag dropped; the player's team, last fee and day,
  last club and the day he left it are set, records and news written, the fee paid. Eze's screen then showed Arsenal
  2026/27 with his matches and West Ham 2026/27 with the fee.

**The game's heap.** The game lets go of the move due, and of the manager's lists when it grows them, with the C
runtime's `free()`: the 8 bytes before such a block are Windows's own heap header (its last byte `0x80` while free,
`0x88` to `0x94` while in use), and the game process has one heap, the process heap. The game's offers and contracts
come from its pools; the records of a save are laid out by its loader. The editor takes heap blocks by running the
runtime's `_strdup` in the game on a thread of its own, with a marker string of the size it needs, and finds the block
by the marker (see `crates/fmlibre-core/src/heap.rs`); `free` gives one back. Right after a load the manager's lists are
full (the offers' held 5,178 of 5,178, the moves due 103 of 103), and a list the editor grows goes into such a block,
half as large again, as the game grows its own.

**The model's kind.** The bytes from `+0x84` on go with the kind of transfer: the offer's `+0x86` is 2 for a transfer
with a fee, 8 for a free move at the end of a contract and 1 for most loans, as its entry's kind (`+0x41`) is 2, 7 or 1.
So the model is a transfer with a fee, agreed or made, before an agreed free move, and the editor writes 2 there.

### On the Mac

Read on Steam build 26620374, Apple silicon, on the Arsenal save of 16 July 2027, which the game had just loaded:

- One `TRANSFER_MANAGER`, laid out as on Windows: 8,411 offers at `+0x20` (8,411 of 8,411), the moves due at `+0x50`
  (29 of 29), the flag at `+0x68`. The offers (`FULL_TRANSFER_OFFER`, 0xD0 bytes), the entries (0x48) and the moves due
  (16 bytes) are laid out as on Windows: each of the 29 moves due names a player whose entry and offer have its
  number, agreed (19) and waiting (2), Gonzalo Tapia's for 17 July among them.
- The player's records sit in the person, 0x40 earlier than on Windows as his other fields there: offers' numbers at
  `+0x2E0`, entries at `+0x2E8`. A record takes 24 bytes, the (begin, end, capacity) of its list, in a block of 24 of
  the game's allocator: of 40,369 players, 4,598 have both, 3,833 of those 24 bytes apart.
- The agreed offers with the flags `0x40` were all free moves at the end of a contract (`+0x86` 8, no fee), which is
  why the model is chosen by its kind.
- The game's own allocator serves the moves due, the entries, the records and the lists of up to 4,096 bytes (they sit
  their class apart in `MALLOC_SMALL` regions, where malloc's blocks are 512 bytes at the least); the list of offers
  (67,288 bytes) is malloc's, and goes to `free()` when the game grows it. The editor takes its blocks with the
  system's `strdup` run in the game on a thread of its own (see `crates/fmlibre-mem/src/macos/call.rs`), each up to
  4,096 bytes as large as the game's class for it, which the game hands out again once it lets the block go.

The probe's `arrange 28108494 1736 --fee 60000000 --restore --hold 25` (Phil Foden from Manchester City to Real
Madrid) wrote the offer (8,411, agreed, kind 2), the contract, the entry, the move due for 17 July and the flag, grew
the list of offers into a block of 12,616 and the moves due into one of 43, both malloc's, and took it all back.

## Still to find

- What the amount and the flags of the 48-byte records mean.
- Where the transfer events' stream keeps its write position and its room.
- The records the career screen reads: where the game keeps them while the season runs.
- Loans and moves without a fee arranged for a later day (entry kinds 1 and 7), and a move from or to a club of a
  human manager on another day than the next.
