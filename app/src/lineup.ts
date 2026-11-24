// The squad calculator's logic: from the players of a club, the eleven starters of a formation, a replacement for each
// of those eleven places, and where everyone else belongs (the reserve team, the under-19s, or the first-team group).
// It only reads what the Squad tab already reads (`SquadPlayer`); nothing here writes to the game.
//
// How it chooses:
//  1. Each place of the formation accepts some positions as its own ("main"), and some others at a cost ("alt"). A
//     player's score for a place is his current ability minus that cost, or minus a large penalty when none of the
//     positions the game lists for him fits (he can still be put there, and is flagged as out of position).
//  2. The starters are the best assignment of players to the eleven places, the one with the highest total score (the
//     Hungarian method), not a place-by-place pick: a versatile player is not wasted where another could play.
//  3. The replacements are the same assignment over those who are left, so there is one for each place.
//  4. Those who are left again go to the first-team group, the reserve team or the under-19s by age, potential and level
//     (see `PLACEMENT_RULES`).

import type { SquadPlayer } from "./types";

/** One place of a formation. */
export interface Slot {
  /** Unique within the formation: "dc1" and "dc2" are its two centre-backs. */
  id: string;
  /** The position it is, as `positionLabel` takes it ("dc"). */
  position: string;
  /** Positions the game lists for a player that fit the place fully. */
  main: readonly string[];
  /** Positions that fit it at a cost, in current-ability points. */
  alt: readonly (readonly [position: string, cost: number])[];
  /** Where it stands on a pitch drawn upright: across from the left, and down from the opponent's goal, both in %. */
  x: number;
  y: number;
}

/** The slot `slot` standing at (`x`, `y`) of the pitch. */
const at = (slot: Slot, x: number, y: number): Slot => ({ ...slot, x, y });

const gk: Slot = { id: "gk", position: "gk", main: ["gk"], alt: [], x: 50, y: 92 };

const dl: Slot = { id: "dl", position: "dl", main: ["dl"], alt: [["wbl", 3], ["dr", 7], ["dc", 8]], x: 0, y: 0 };
const dr: Slot = { id: "dr", position: "dr", main: ["dr"], alt: [["wbr", 3], ["dl", 7], ["dc", 8]], x: 0, y: 0 };
const dc = (n: number): Slot => ({ id: `dc${n}`, position: "dc", main: ["dc"], alt: [["dm", 6], ["dl", 8], ["dr", 8]], x: 0, y: 0 });
const wbl: Slot = { id: "wbl", position: "wbl", main: ["wbl"], alt: [["dl", 3], ["ml", 4], ["aml", 8]], x: 0, y: 0 };
const wbr: Slot = { id: "wbr", position: "wbr", main: ["wbr"], alt: [["dr", 3], ["mr", 4], ["amr", 8]], x: 0, y: 0 };
const dm = (n: number): Slot => ({ id: `dm${n}`, position: "dm", main: ["dm"], alt: [["mc", 4], ["dc", 6]], x: 0, y: 0 });
const mc = (n: number): Slot => ({ id: `mc${n}`, position: "mc", main: ["mc"], alt: [["dm", 3], ["amc", 4]], x: 0, y: 0 });
const ml: Slot = { id: "ml", position: "ml", main: ["ml"], alt: [["aml", 3], ["wbl", 5], ["mc", 8]], x: 0, y: 0 };
const mr: Slot = { id: "mr", position: "mr", main: ["mr"], alt: [["amr", 3], ["wbr", 5], ["mc", 8]], x: 0, y: 0 };
const aml: Slot = { id: "aml", position: "aml", main: ["aml"], alt: [["ml", 3], ["st", 8]], x: 0, y: 0 };
const amr: Slot = { id: "amr", position: "amr", main: ["amr"], alt: [["mr", 3], ["st", 8]], x: 0, y: 0 };
const amc: Slot = { id: "amc", position: "amc", main: ["amc"], alt: [["mc", 4], ["aml", 6], ["amr", 6], ["st", 6]], x: 0, y: 0 };
const st = (n: number): Slot => ({ id: `st${n}`, position: "st", main: ["st"], alt: [["amc", 5], ["aml", 8], ["amr", 8]], x: 0, y: 0 });

/** The formations offered, as their names and the places in them, goalkeeper first. */
export const FORMATIONS = {
  "4-2-3-1": [
    gk, at(dl, 14, 72), at(dc(1), 38, 74), at(dc(2), 62, 74), at(dr, 86, 72),
    at(dm(1), 36, 54), at(dm(2), 64, 54),
    at(aml, 15, 30), at(amc, 50, 32), at(amr, 85, 30), at(st(1), 50, 10),
  ],
  "4-3-3": [
    gk, at(dl, 14, 72), at(dc(1), 38, 74), at(dc(2), 62, 74), at(dr, 86, 72),
    at(dm(1), 50, 57), at(mc(1), 30, 42), at(mc(2), 70, 42),
    at(aml, 16, 20), at(st(1), 50, 10), at(amr, 84, 20),
  ],
  "4-4-2": [
    gk, at(dl, 14, 72), at(dc(1), 38, 74), at(dc(2), 62, 74), at(dr, 86, 72),
    at(ml, 14, 44), at(mc(1), 38, 46), at(mc(2), 62, 46), at(mr, 86, 44),
    at(st(1), 38, 14), at(st(2), 62, 14),
  ],
  "4-1-4-1": [
    gk, at(dl, 14, 72), at(dc(1), 38, 74), at(dc(2), 62, 74), at(dr, 86, 72),
    at(dm(1), 50, 58), at(ml, 14, 38), at(mc(1), 38, 40), at(mc(2), 62, 40), at(mr, 86, 38),
    at(st(1), 50, 10),
  ],
  "3-5-2": [
    gk, at(dc(1), 28, 74), at(dc(2), 50, 76), at(dc(3), 72, 74),
    at(wbl, 14, 50), at(mc(1), 34, 44), at(dm(1), 50, 58), at(mc(2), 66, 44), at(wbr, 86, 50),
    at(st(1), 38, 14), at(st(2), 62, 14),
  ],
  "3-4-3": [
    gk, at(dc(1), 28, 74), at(dc(2), 50, 76), at(dc(3), 72, 74),
    at(wbl, 14, 50), at(mc(1), 38, 48), at(mc(2), 62, 48), at(wbr, 86, 50),
    at(aml, 16, 20), at(st(1), 50, 10), at(amr, 84, 20),
  ],
} as const satisfies Record<string, readonly Slot[]>;

export type FormationName = keyof typeof FORMATIONS;

export const FORMATION_NAMES = Object.keys(FORMATIONS) as FormationName[];

export const DEFAULT_FORMATION: FormationName = "4-2-3-1";

/** What it costs to play a place none of whose positions the game lists for him, in current-ability points. */
export const OUT_OF_POSITION_COST = 30;

/** What it costs to put a goalkeeper in the field or a field player in goal. */
export const GOALKEEPER_MISMATCH_COST = 80;

/** The thresholds that decide where the players left out of the squad go; shown to the user as they are. */
export const PLACEMENT_RULES = {
  /** At most this old, he goes to the under-19s. */
  u19MaxAge: 19,
  /** Up to this many points under the median replacement, and not younger than the under-19s, he stays with the first team. */
  rotationMargin: 5,
  /** Up to this age and with a potential this far over the median replacement, the reserve team is a stage, not a dead end. */
  prospectMaxAge: 22,
  prospectPotentialMargin: 10,
  /** From this age and this far under the median replacement, the reserve team is where he waits to be sold or released. */
  surplusMinAge: 27,
  surplusMargin: 8,
} as const;

/** What a place costs a player: 0 for his own position, a few points for a neighbouring one, a lot for none. */
function fitCost(player: SquadPlayer, slot: Slot): { cost: number; fit: Fit } {
  const keeper = player.positions.includes("gk");
  if (keeper !== (slot.position === "gk")) {
    return { cost: GOALKEEPER_MISMATCH_COST, fit: "out" };
  }
  // The positions are listed best first; one further down the list costs a point per place, up to three.
  const mainAt = player.positions.findIndex((position) => slot.main.includes(position));
  if (mainAt >= 0) {
    return { cost: Math.min(mainAt, 3), fit: mainAt === 0 ? "main" : "alt" };
  }
  let best: number | null = null;
  for (const [position, cost] of slot.alt) {
    const at = player.positions.indexOf(position);
    if (at >= 0 && (best === null || cost + Math.min(at, 3) < best)) {
      best = cost + Math.min(at, 3);
    }
  }
  return best === null ? { cost: OUT_OF_POSITION_COST, fit: "out" } : { cost: best, fit: "alt" };
}

/** "main": his best position; "alt": another he is listed for, or a neighbouring one; "out": none of them. */
export type Fit = "main" | "alt" | "out";

export interface Pick {
  slot: Slot;
  /** Null when there is nobody left for the place. */
  player: SquadPlayer | null;
  /** His current ability minus what the place costs him. */
  score: number;
  fit: Fit;
}

/** Why a player who is not in the squad goes where he goes. */
export type PlacementReason = "youth" | "rotation" | "prospect" | "surplus" | "reserve";

export type Destination = "rotation" | "reserve" | "u19";

export interface Placement {
  player: SquadPlayer;
  destination: Destination;
  reason: PlacementReason;
}

export interface Lineup {
  formation: FormationName;
  starters: Pick[];
  replacements: Pick[];
  placements: Placement[];
  /** Those who cannot be picked: on loan elsewhere, and (unless asked for) injured or banned. */
  unavailable: { player: SquadPlayer; reason: "loanedOut" | "injured" | "banned" }[];
  /** The mean current ability of the starters, and of the replacements who are there. */
  startersAverage: number | null;
  replacementsAverage: number | null;
}

export interface LineupOptions {
  formation: FormationName;
  /** Whether the injured and the banned may be picked. */
  includeUnavailable: boolean;
}

/**
 * The players of the club, each once, in the order of the teams (the senior team's first): a player the game lists in
 * two teams is the same player.
 */
export function clubPlayers(teams: readonly { players: readonly SquadPlayer[] }[]): SquadPlayer[] {
  const seen = new Map<number, SquadPlayer>();
  for (const team of teams) {
    for (const player of team.players) {
      const known = seen.get(player.uid);
      // A row that says he plays for this team is the better one: it is the team he is in.
      if (known === undefined || (!known.playsHere && player.playsHere)) {
        seen.set(player.uid, player);
      }
    }
  }
  return [...seen.values()];
}

/**
 * The assignment of `slots` to `players` that has the highest total score, by the Hungarian method. There may be fewer
 * players than places: the places left over have no player.
 */
function assign(slots: readonly Slot[], players: readonly SquadPlayer[]): Pick[] {
  const rows = slots.length;
  // Dummy columns stand for nobody, so that there are at least as many columns as rows.
  const columns = Math.max(players.length, rows);
  const NOBODY = 1_000;
  const value: number[][] = slots.map((slot) =>
    Array.from({ length: columns }, (_, j) => {
      const player = players[j];
      return player === undefined ? -NOBODY : player.currentAbility - fitCost(player, slot).cost;
    }),
  );

  // The shortest-augmenting-path version, on costs (the negated scores); 1-based as in its usual statement.
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(columns + 1).fill(0);
  const matched = new Array<number>(columns + 1).fill(0);
  const way = new Array<number>(columns + 1).fill(0);
  for (let i = 1; i <= rows; i++) {
    matched[0] = i;
    let j0 = 0;
    const minv = new Array<number>(columns + 1).fill(INF);
    const used = new Array<boolean>(columns + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = matched[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= columns; j++) {
        if (!used[j]) {
          const cost = -value[i0 - 1][j - 1] - u[i0] - v[j];
          if (cost < minv[j]) {
            minv[j] = cost;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= columns; j++) {
        if (used[j]) {
          u[matched[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (matched[j0] !== 0);
    do {
      const j1 = way[j0];
      matched[j0] = matched[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const picks: Pick[] = slots.map((slot) => ({ slot, player: null, score: 0, fit: "out" }));
  for (let j = 1; j <= columns; j++) {
    const row = matched[j] - 1;
    const player = players[j - 1];
    if (row >= 0 && player !== undefined) {
      const { cost, fit } = fitCost(player, slots[row]);
      picks[row] = { slot: slots[row], player, score: player.currentAbility - cost, fit };
    }
  }
  return picks;
}

const average = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Where a player who is not in the squad goes, with `benchLevel`, the current ability of the median replacement. */
function place(player: SquadPlayer, benchLevel: number): Placement {
  const rules = PLACEMENT_RULES;
  const age = player.age ?? 99;
  // A potential below zero is a range the game has not settled (see `Ability`): the level he has is all that is known.
  const potential = player.potentialAbility < 0 ? player.currentAbility : player.potentialAbility;
  if (age <= rules.u19MaxAge) {
    return { player, destination: "u19", reason: "youth" };
  }
  if (player.currentAbility >= benchLevel - rules.rotationMargin) {
    return { player, destination: "rotation", reason: "rotation" };
  }
  if (age <= rules.prospectMaxAge && potential >= benchLevel + rules.prospectPotentialMargin) {
    return { player, destination: "reserve", reason: "prospect" };
  }
  if (age >= rules.surplusMinAge && player.currentAbility < benchLevel - rules.surplusMargin) {
    return { player, destination: "reserve", reason: "surplus" };
  }
  return { player, destination: "reserve", reason: "reserve" };
}

/** The starters, the replacements and the placements of the players of a club. */
export function buildLineup(players: readonly SquadPlayer[], { formation, includeUnavailable }: LineupOptions): Lineup {
  const unavailable: Lineup["unavailable"] = [];
  const pool: SquadPlayer[] = [];
  for (const player of players) {
    if (player.loan === "out") {
      unavailable.push({ player, reason: "loanedOut" });
    } else if (!includeUnavailable && player.injuries > 0) {
      unavailable.push({ player, reason: "injured" });
    } else if (!includeUnavailable && player.bans > 0) {
      unavailable.push({ player, reason: "banned" });
    } else {
      pool.push(player);
    }
  }

  const slots = FORMATIONS[formation];
  const starters = assign(slots, pool);
  const started = new Set(starters.flatMap((pick) => (pick.player ? [pick.player.uid] : [])));
  const afterStarters = pool.filter((player) => !started.has(player.uid));
  const replacements = assign(slots, afterStarters);
  const subbed = new Set(replacements.flatMap((pick) => (pick.player ? [pick.player.uid] : [])));

  const replacementLevels = replacements.flatMap((pick) => (pick.player ? [pick.player.currentAbility] : []));
  // The level of the bench is its median, not its weakest: one place nobody fits would pull the bar down.
  const sortedLevels = [...replacementLevels].sort((a, b) => a - b);
  const benchLevel = sortedLevels.length > 0 ? sortedLevels[Math.floor(sortedLevels.length / 2)] : 0;
  const placements = afterStarters
    .filter((player) => !subbed.has(player.uid))
    .map((player) => place(player, benchLevel))
    .sort(
      (a, b) =>
        a.destination.localeCompare(b.destination) || b.player.currentAbility - a.player.currentAbility,
    );

  return {
    formation,
    starters,
    replacements,
    placements,
    unavailable,
    startersAverage: average(starters.flatMap((pick) => (pick.player ? [pick.player.currentAbility] : []))),
    replacementsAverage: average(replacementLevels),
  };
}

/**
 * The formation that gives the best squad: the one whose starters have the highest mean current ability, where the
 * squad's own positions fit best. Ties keep the order of `FORMATION_NAMES`, so 4-2-3-1 first.
 */
export function bestFormation(players: readonly SquadPlayer[], includeUnavailable: boolean): FormationName {
  let best = DEFAULT_FORMATION;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const formation of FORMATION_NAMES) {
    const { starters } = buildLineup(players, { formation, includeUnavailable });
    // The score counts the cost of a place that does not fit, not just the ability, which is what picks a shape.
    const score = starters.reduce((sum, pick) => sum + pick.score, 0);
    if (score > bestScore + 1e-9) {
      best = formation;
      bestScore = score;
    }
  }
  return best;
}
