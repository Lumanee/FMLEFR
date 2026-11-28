// Tactical roles by position, and how well a player's attributes suit each: an estimate for the "best positions and
// roles" column of the squad calculator. The game does not store a rating per role; this reads the key attributes of
// each role (1–20, as FM shows them) and takes their weighted mean, so it ranks a player's roles, it does not
// reproduce the game's own figure. French and English only, like the calculator's text.

import { locale } from "./i18n";
import type { PlayerDetails } from "./types";

interface Role {
  id: string;
  en: string;
  fr: string;
  /** Attribute key → weight. */
  key: Readonly<Record<string, number>>;
}

const r = (id: string, en: string, fr: string, key: Record<string, number>): Role => ({ id, en, fr, key });

const GK: Role[] = [
  r("gk", "Goalkeeper", "Gardien", { handling: 3, reflexes: 3, command_of_area: 2, one_on_ones: 2, aerial_reach: 2, positioning: 2, concentration: 1, communication: 1 }),
  r("sk", "Sweeper keeper", "Gardien libéro", { rushing_out: 3, reflexes: 2, one_on_ones: 2, anticipation: 2, passing: 2, first_touch: 1.5, kicking: 1.5, pace: 1, composure: 1, decisions: 1 }),
  r("bpgk", "Ball-playing keeper", "Gardien relanceur", { passing: 3, kicking: 2.5, throwing: 2, vision: 2, first_touch: 2, composure: 1.5, reflexes: 2, handling: 2 }),
];

const CB: Role[] = [
  r("cd", "Central defender", "DC classique", { marking: 2.5, tackling: 2.5, positioning: 3, heading: 2, jumping_reach: 2, strength: 2, anticipation: 2, concentration: 1.5 }),
  r("stp", "Stopper", "DC stoppeur", { tackling: 3, aggression: 2, bravery: 2, heading: 2.5, strength: 2, anticipation: 2, jumping_reach: 2, marking: 1.5 }),
  r("cov", "Covering defender", "DC couvrant", { pace: 2.5, acceleration: 2, anticipation: 3, positioning: 3, marking: 2, concentration: 2, tackling: 1.5 }),
  r("bpd", "Ball-playing defender", "DC relanceur", { passing: 3, composure: 2.5, vision: 2, first_touch: 2, technique: 2, positioning: 2, tackling: 1.5, marking: 1.5, decisions: 1.5 }),
];

const FB: Role[] = [
  r("fb", "Full-back", "Latéral", { marking: 2, tackling: 2.5, positioning: 2.5, stamina: 2, pace: 2, work_rate: 2, anticipation: 1.5, crossing: 1 }),
  r("fba", "Attacking full-back", "Latéral offensif", { crossing: 3, dribbling: 2, pace: 2.5, acceleration: 2, stamina: 2.5, work_rate: 2, teamwork: 1.5, technique: 1.5, tackling: 1 }),
  r("ifb", "Inverted full-back", "Latéral inversé", { passing: 2.5, positioning: 2.5, composure: 2, vision: 1.5, tackling: 2, marking: 2, decisions: 1.5, first_touch: 1.5, anticipation: 1.5 }),
];

const WB: Role[] = [
  r("wb", "Wing-back", "Piston", { crossing: 2.5, dribbling: 2, pace: 2.5, acceleration: 2, stamina: 3, work_rate: 2.5, tackling: 1.5, teamwork: 1.5, positioning: 1 }),
  r("wbd", "Defensive wing-back", "Piston de maintien", { tackling: 2.5, marking: 2, positioning: 2.5, stamina: 2.5, pace: 2, work_rate: 2.5, anticipation: 1.5, crossing: 1 }),
  r("wbi", "Inverted wing-back", "Piston inversé", { passing: 2.5, technique: 2, positioning: 2, composure: 2, stamina: 2, work_rate: 2, tackling: 1.5, vision: 1.5, decisions: 1.5 }),
];

const DM: Role[] = [
  r("dm", "Defensive midfielder", "Milieu défensif", { tackling: 3, positioning: 3, anticipation: 2.5, teamwork: 2, work_rate: 2, strength: 1.5, concentration: 2, marking: 1.5 }),
  r("hb", "Half-back", "Demi défensif", { positioning: 3, tackling: 2.5, marking: 2.5, anticipation: 2.5, heading: 1.5, composure: 1.5, concentration: 2, strength: 1.5, passing: 1 }),
  r("dlp", "Deep-lying playmaker", "Régulateur reculé", { passing: 3, vision: 3, composure: 2, decisions: 2.5, technique: 2, first_touch: 2, teamwork: 1.5, positioning: 1 }),
  r("a", "Anchor", "Sentinelle", { positioning: 3, anticipation: 3, tackling: 2.5, concentration: 2.5, marking: 2, teamwork: 2, strength: 1.5, decisions: 1.5 }),
];

const MC: Role[] = [
  r("cm", "Central midfielder", "Milieu central", { passing: 2.5, decisions: 2.5, teamwork: 2.5, stamina: 2, work_rate: 2, first_touch: 1.5, technique: 1.5, vision: 1.5 }),
  r("b2b", "Box-to-box midfielder", "Box-to-box", { stamina: 3, work_rate: 3, pace: 1.5, acceleration: 1.5, passing: 2, dribbling: 1.5, off_the_ball: 2, tackling: 2, teamwork: 1.5, strength: 1 }),
  r("ap", "Advanced playmaker", "Meneur de jeu axial", { passing: 3, vision: 3, decisions: 2.5, technique: 2.5, first_touch: 2, composure: 2, off_the_ball: 1.5, flair: 1.5, teamwork: 1 }),
  r("mez", "Mezzala", "Milieu de demi-espace", { dribbling: 2, off_the_ball: 2.5, passing: 2, technique: 2, stamina: 2, work_rate: 2, flair: 1.5, acceleration: 1.5, long_shots: 1.5, vision: 1.5 }),
  r("cmd", "Screening midfielder", "Milieu écran", { tackling: 2.5, positioning: 3, anticipation: 2.5, teamwork: 2.5, work_rate: 2.5, stamina: 2, concentration: 2, marking: 1.5 }),
];

const WINGER_MID: Role[] = [
  r("w", "Winger", "Ailier", { pace: 3, acceleration: 3, dribbling: 2.5, crossing: 2.5, stamina: 1.5, work_rate: 1.5, technique: 1.5, flair: 1, agility: 1 }),
  r("wm", "Wide midfielder", "Milieu de côté", { work_rate: 2.5, teamwork: 2.5, stamina: 2.5, crossing: 2, passing: 2, positioning: 1.5, tackling: 1.5, decisions: 1.5 }),
  r("wp", "Wide playmaker", "Ailier créateur", { passing: 3, vision: 3, technique: 2.5, flair: 2, dribbling: 2, first_touch: 2, decisions: 2, composure: 1.5, crossing: 1 }),
  r("iw", "Inside forward", "Ailier intérieur", { finishing: 2.5, off_the_ball: 2.5, dribbling: 2.5, pace: 2.5, acceleration: 2, composure: 2, first_touch: 1.5, long_shots: 1.5, technique: 1.5 }),
];

const AMC: Role[] = [
  r("am", "Attacking midfielder", "Milieu offensif", { passing: 2.5, vision: 2.5, technique: 2.5, first_touch: 2, flair: 2, decisions: 2, composure: 2, dribbling: 1.5, long_shots: 1.5 }),
  r("ap2", "Advanced playmaker", "Meneur de jeu avancé", { passing: 3, vision: 3, decisions: 2.5, technique: 2.5, first_touch: 2, off_the_ball: 2, composure: 2, flair: 1.5 }),
  r("sh", "Shadow striker", "Attaquant fantôme", { off_the_ball: 3, finishing: 3, pace: 2, acceleration: 2, composure: 2, anticipation: 2, work_rate: 2, dribbling: 1.5, first_touch: 1.5 }),
  r("tq", "Free role", "Rôle libre", { flair: 3, dribbling: 2.5, technique: 2.5, vision: 2, passing: 2, finishing: 2, off_the_ball: 2, first_touch: 2, decisions: 1.5 }),
];

const ST: Role[] = [
  r("af", "Advanced forward", "Attaquant avancé", { finishing: 3, off_the_ball: 3, pace: 2.5, acceleration: 2.5, composure: 2, anticipation: 2, first_touch: 1.5, dribbling: 1.5 }),
  r("tf", "Target forward", "Pivot", { heading: 3, strength: 3, jumping_reach: 2.5, bravery: 2, balance: 2, first_touch: 2, finishing: 2, aggression: 1 }),
  r("p", "Poacher", "Renard des surfaces", { finishing: 3.5, off_the_ball: 3, anticipation: 2.5, composure: 2.5, concentration: 2, acceleration: 2, first_touch: 1.5 }),
  r("f9", "False nine", "Faux 9", { passing: 2.5, vision: 2.5, technique: 2.5, first_touch: 2.5, dribbling: 2, composure: 2, off_the_ball: 2, decisions: 2, finishing: 1.5 }),
  r("pf", "Pressing forward", "Attaquant de pressing", { work_rate: 3, stamina: 2.5, aggression: 2.5, teamwork: 2, pace: 2, acceleration: 1.5, finishing: 2, off_the_ball: 1.5, determination: 2 }),
  r("cf", "Complete forward", "Attaquant complet", { finishing: 2.5, off_the_ball: 2, first_touch: 2, passing: 2, dribbling: 2, heading: 1.5, strength: 1.5, pace: 1.5, composure: 2, technique: 2, vision: 1 }),
];

/** The roles each position of the game can be given. */
export const ROLES: Readonly<Record<string, readonly Role[]>> = {
  gk: GK,
  sw: CB,
  dc: CB,
  dl: FB,
  dr: FB,
  wbl: WB,
  wbr: WB,
  dm: DM,
  mc: MC,
  ml: WINGER_MID,
  mr: WINGER_MID,
  aml: WINGER_MID,
  amr: WINGER_MID,
  amc: AMC,
  st: ST,
};

const name = (role: Role) => (locale === "fr" ? role.fr : role.en);

/** What a player's attributes say of a role: the weighted mean of its key attributes, 1–20. */
export function roleScore(player: Pick<PlayerDetails, "attributes">, role: Role): number {
  let total = 0;
  let weights = 0;
  for (const [key, weight] of Object.entries(role.key)) {
    const attribute = player.attributes[key];
    if (attribute !== undefined) {
      total += attribute.value * weight;
      weights += weight;
    }
  }
  return weights === 0 ? 0 : total / weights;
}

/** A position of a player with the role that suits him best there. */
export interface PositionRole {
  position: string;
  /** His rating at the position, 1–20, as the game gives it. */
  rating: number;
  role: string;
  /** How well the role suits his attributes, 1–20, one decimal. */
  fit: number;
}

/** How many positions the column lists, and the rating from which a position counts as one of his. */
const MOST_POSITIONS = 3;
const MIN_RATING = 13;

/** The positions he plays best, each with its best role: up to three positions rated 13 or more, best first. */
export function bestRoles(player: Pick<PlayerDetails, "attributes" | "positionRatings">): PositionRole[] {
  const ranked = Object.entries(player.positionRatings)
    .filter(([position, rating]) => ROLES[position] !== undefined && rating >= MIN_RATING)
    .sort((a, b) => b[1] - a[1]);
  const found: PositionRole[] = [];
  const seen = new Set<string>();
  for (const [position, rating] of ranked) {
    const roles = ROLES[position];
    // The left and right of a pair share their roles: one entry for the pair is enough where both are rated alike.
    let best = roles[0];
    let bestFit = -1;
    for (const role of roles) {
      const fit = roleScore(player, role);
      if (fit > bestFit) {
        best = role;
        bestFit = fit;
      }
    }
    const label = `${position}:${best.id}`;
    if (!seen.has(label)) {
      seen.add(label);
      found.push({ position, rating, role: name(best), fit: Math.round(bestFit * 10) / 10 });
    }
    if (found.length === MOST_POSITIONS) {
      break;
    }
  }
  return found;
}
