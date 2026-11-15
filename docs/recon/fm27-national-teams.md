# FM27: nations and their national teams

Notes towards a tab for national teams (#169). They were read on the Mac Steam build 26385295 (27.0.1, Apple
silicon), on a save of 14 September 2026 with the game in Italian, with the probe only: nothing here was written to
the game. Italia's men's team was then checked against the game's own screens (see [Checked in the
game](#checked-in-the-game)).

## In short

A national team is not a club. The clubs array the Clubs tab reads holds none of them, so the tab cannot show them.
Each nation has two objects of their own, one for its men's teams and one for its women's, of the class
`db::NATIONAL_TEAM_CONTAINER`. Each holds a list of teams that are laid out like a club's teams (`[team]`): the same
kind, age limit, players, manager, captains and reputation. So most of what the club profile reads of a team, and its
Squad tab, would read a national team as it is.

```text
game_plugin+0x576eef8 ─> (begin, end) of 251 containers, the men's
game_plugin+0x576ef10 ─> (begin, end) of 251 containers, the women's

db::NATIONAL_TEAM_CONTAINER  +0x18 teams ─> db::NATIONAL_TEAM (laid out as [team])
                             +0x170      ─> db::NATION
db::NATION                   +0x110 men's container, +0x118 women's container
```

## Nations (`db::NATION`)

There are 251 of them, 0x208 bytes each, one after another in memory (`fmlibre-probe instances db::NATION`). The
editor so far only knew `uid` and `name`, from the people's `nation` pointers.

| Offset | Field |
| --- | --- |
| `+0x0C` | `u32` UID (Algeria 5, Inghilterra 765, Italia 776, Brasile 1651) |
| `+0x18` | name, an FM string ("Italia") |
| `+0x20` | short name; the same as the name for the nations looked at |
| `+0x28` | three-letter code ("ITA", "ENG", "SMR") |
| `+0x30` | nationality adjective ("italiano", "sammarinese") |
| `+0xF0` | pointer to its capital (`db::CITY`) |
| `+0xF8` | pointer to its continent (`db::CONTINENT`) |
| `+0x100` | pointer to its region (`db::REGION`) |
| `+0x108` | pointer to its currency (`db::CURRENCY_RECORD`) |
| `+0x110` | pointer to the container of its men's teams |
| `+0x118` | pointer to the container of its women's teams |
| `+0x1EC` | `u32`, its population: Italia 58,952,704, Brasile 211,998,573, San Marino 33,977 |

All 251 nations have both containers. From `+0x180` to `+0x200` there are more numbers (counts, four `f32`, small
bytes that could be ratings) that differ from nation to nation. Which of them the game shows, and where, can only be
told against its nation screens.

## Containers (`db::NATIONAL_TEAM_CONTAINER`)

There are 502 of them, 0x8A0 bytes each: 251 men's and 251 women's. Two arrays in the game plugin's writable data,
next to the players', staff's and clubs' arrays, each hold the 251 of one kind. The probe's `scan` does not list
them, since it only looks for arrays of 500 elements or more.

| Offset | Field |
| --- | --- |
| `+0x0C` | `u32` UID: the nation's for the men's (Algeria 5), its own for the women's (2000169518) |
| `+0x18` | the teams, `(begin, end, capacity)` of pointers; the first is the senior team |
| `+0x60`, `+0x78`, `+0x90` | its medical, coaching and scouting staff, where a club keeps them: Italia's physiotherapists (2), its coaches, goalkeeping coaches and fitness coaches of every team (16), and its scout and chief scout (2) |
| `+0xB9` | `u8`, 1 for a women's container, as a club's `women`: 0 at all 251 of the first array, 1 at all 251 of the second |
| `+0x170` | pointer back to its nation, at all 502 |
| `+0x1C8` | the clubs of the nation (Algeria: 20 clubs, among them Mouloudia Club d'Alger and Jeunesse Sportive de Kabylie) |
| `+0x870` | `u16`, the year its federation was founded (Italia 1898, Inghilterra 1863, Brasile 1914, Algeria 1962), the same in both containers of a nation; 0 at 50 of the 502 |

Past `+0x18`, a container is not laid out like a club: where a club has its name (`+0xC0`), a container has a list.
Its name is its nation's.

## National teams (`db::NATIONAL_TEAM`)

There are 3,586 of them, 0x108 bytes each (a club's team takes 0xB8). The fields of `[team]` read as they do for a
club's team:

| Offset | Field | Italia, senior team |
| --- | --- | --- |
| `+0x28` | kind | 0 |
| `+0x2C` | age limit | 100 |
| `+0x30` | pointer to its container, where a club's team points at its club | the men's container of Italia |
| `+0x38` | its players, `(begin, end, capacity)` of pointers | 23, from Donnarumma, Di Lorenzo, Bastoni, Mancini |
| `+0x80` | its manager, a member of staff | Roberto Mancini |
| `+0x88`, `+0x90` | its captain and vice-captain, pointers as a club's team holds them | Donnarumma, Barella |
| `+0xA8` | reputation, `u16` | 8500 |

The players are the squad the game shows for the team (see below). A player in the list still plays for his club's
team: his own `team` pointer still leads there (Donnarumma's to Manchester City's).

Across the save:

- Every men's container but one starts with a team of kind 0, its senior team, which points back at it. The one
  without is The United Kingdom of Great Britain and Ireland, which only has six other teams (kinds 9, 33, 10, 18,
  11, 12). The women's 251 all start with a senior team.
- The men's senior teams have a manager at 219 of 251, a captain at 136 and a vice-captain at 123; the women's at
  199, 121 and 99. They call up 0 to 40 players (median 9; 54 call up none). The women's call up 0 to 23 (102 call up
  none).
- The men's senior reputations run from 1 to 9,750: Francia and Spagna 9,750, Inghilterra 9,600, Argentina 9,400,
  Brasile 9,200. The women's run up to 9,950.
- The other kinds, with the age limits they had: 3 (none), 9 (23 or none), 10 (21 or none), 11 (19 or none), 12
  (none), 18 (20 or none) and 33 (none). Their names in the game are not known yet.
- The game plugin also keeps two arrays of national teams: 1,770 of the men's teams (`+0x576f0c8`) and 1,772 of the
  women's (`+0x576f170`). The array of every team (`+0x576f038`, 68,234) holds 3,542 national teams with the clubs'.

The game names more classes about national teams, among them `db::NATIONAL_TEAM_SQUAD_SELECTION_MONEY_INFO`,
`NATION_CALLUP_EDIT_SESSION` and `NATIONAL_SQUAD_SELECTION_EDIT_SESSION`. Calling a player up is likely more than
adding him to the team's list, and was not looked at.

## Checked in the game

With the game open on the same day, on Italia (Maschile), and nothing written:

- The game's search finds Italia three times: "Nazionale femminile", "Nazionale maschile" and "Nazione", the two
  containers and the nation.
- **Prima squadra › Rosa Italia** lists "Giocatori Prima squadra (23)": the 23 players of the senior team's list, in
  the order the list holds them, from Donnarumma, Di Lorenzo, Bastoni and Mancini to Acerbi and Scalvini.
- **Prima squadra › Staff** shows Roberto Mancini as the first team's Allenatore, the senior team's `manager`; and
  Silvio Baldini, Carmine Nunziata and Mauro Bianchessi as the managers of the under-21s (kind 10), under-20s (kind
  18) and under-19s (kind 11), each his team's `manager`. The physiotherapists, coaches and scouts it shows are those
  of the container's three lists. Mancini has a contract there (€4.41M a year); the editor reads none for him
  (`staff-member 12523`: contract none), so a national team's manager keeps his contract somewhere else.
- **Generale › Profilo nazione** shows the federation founded in 1898 (container `+0x870`), Classifica Mondiale 15°,
  Reputazione "Mondiale" (a word, not the number), and no main stadium, as the senior team points at none (`+0x78`
  is null).

The captain was not found on these screens: Donnarumma's profile does not say he is Italia's captain.

## What a tab could take from this

- A list of nations from the two arrays of containers, each container leading to its nation (name, code, flag by
  UID) and its teams.
- The senior team's reputation, at the place the club profile already edits a club's (`team.reputation`).
- The squad as the club profile's Squad tab shows it, captains included: same lists, same pointers.

## Still to check

- Where the game shows a national team's captain, and what it makes of a changed reputation over a game day; how it
  turns the reputation into words ("Mondiale").
- Where a national team's manager keeps his contract, and the world ranking (15 for Italia), which none of the three
  objects holds as a byte.
- The same places on the Windows Steam and Game Pass builds, and the two arrays' places in each build profile.
- The names of the team kinds, and what the numbers from `+0x180` of a nation are.
- What a national team's 0x50 bytes past a club team's end hold.
