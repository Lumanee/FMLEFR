// The text of the Squad calculator tab (see `LineupTab.tsx`). French and English only: the other languages of the app
// show the English until someone translates it, as the app's `Strings` would need every key in all eleven files.

import { locale } from "./i18n";
import type { Fit, PlacementReason } from "./lineup";
import { PLACEMENT_RULES as rules } from "./lineup";

interface LineupStrings {
  intro: string;
  formation: string;
  auto: string;
  autoTitle: string;
  autoChosen: (formation: string) => string;
  fitTitle: (fit: Fit) => string;
  includeUnavailable: string;
  starters: string;
  replacements: string;
  placements: string;
  unavailable: string;
  average: (value: string) => string;
  noPlayer: string;
  place: string;
  player: string;
  now: string;
  fit: Record<Fit, string>;
  /** The destination groups of the players who are not in the squad. */
  groups: { reserve: string; u19: string };
  reasons: Record<PlacementReason, string>;
  unavailableReasons: { loanedOut: string; injured: string; banned: string };
  empty: string;
  rulesTitle: string;
  rules: string[];
  loading: string;
  sheetTitle: string;
  benchTitle: (size: number) => string;
  benchSize: string;
  benchSizeTitle: string;
  seat: (n: number) => string;
  autoSeat: string;
  covers: (place: string) => string;
  manual: string;
  mainTitle: string;
  offBench: string;
  bestOf: string;
  subsTitle: string;
  tableTitle: string;
  sel: string;
  tactic: string;
  tacticTitle: string;
  positions: string;
  bestPosition: string;
  statusHead: string;
  status: { fit: string; injured: string; banned: string; loan: string };
  condition: string;
  conditionTitle: string;
  morale: string;
  cohesion: string;
  cohesionTitle: string;
  mainLeft: string;
  groupShort: { reserve: string; u19: string };
}

const en: LineupStrings = {
  intro:
    "Read only: nothing is written to the game. Laid out like a team sheet: the eleven starters, the bench with as many seats as the competition allows, then who goes to the reserve team and the under-19s. The club's 22 main players are the eleven starters and eleven replacements; any player of the club, from any team, can be put on the bench by hand.",
  formation: "Formation",
  auto: "Auto",
  autoTitle: "The formation that gives this squad the best eleven",
  autoChosen: (formation) => `Auto (${formation})`,
  fitTitle: (fit) => (fit === "main" ? "in his best position" : fit === "alt" ? "another position" : "out of position"),
  includeUnavailable: "Include the injured and the banned",
  starters: "Starting eleven",
  replacements: "Replacements, place by place",
  placements: "Everyone else",
  unavailable: "Not available",
  average: (value) => `average ${value}`,
  noPlayer: "Nobody left for this place",
  place: "Place",
  player: "Player",
  now: "Plays for",
  fit: { main: "", alt: "other position", out: "out of position" },
  groups: {
    reserve: "Send to the reserve team",
    u19: "Send to the under-19s",
  },
  reasons: {
    youth: `${rules.u19MaxAge} or younger`,
    prospect: `young with room to grow: potential well over the bench`,
    surplus: `well under the bench and ${rules.surplusMinAge}+: sell or release`,
    reserve: "under the bench",
  },
  unavailableReasons: { loanedOut: "on loan elsewhere", injured: "injured", banned: "banned" },
  empty: "This club has no players to pick from.",
  rulesTitle: "How it chooses",
  rules: [
    "Auto picks, among the formations offered, the one whose eleven has the best total score for this squad. The formation the game uses is not read yet: pick it by hand to match it.",
    "On the pitch, * marks a player in another position than his best, and a red outline a player out of position.",
    "Score for a place = current ability minus a cost: 0 in his best position, a few points for another position he is listed for or a neighbouring one, 30 when none fits (shown as out of position).",
    "The starters are the assignment with the best total score, not a place-by-place pick, so a versatile player is not wasted.",
    "The replacements are the same assignment over the players left: one for each place.",
    "The 22 main players are the eleven starters and the eleven replacements (one per place). The bench takes the best of the replacements, a goalkeeper first, up to the number of seats set above; a seat can be given to any player of the club instead.",
    `Of the rest, ${rules.u19MaxAge} or younger go to the under-19s; the others go to the reserve team, marked as a prospect (${rules.prospectMaxAge} or younger with potential ${rules.prospectPotentialMargin}+ over the replacements) or as a surplus (${rules.surplusMinAge}+ and ${rules.surplusMargin}+ under them).`,
    "The injured, the banned and players on loan elsewhere are left out unless the box above is ticked.",
  ],
  loading: "Reading the squad…",
  sheetTitle: "Team sheet",
  benchTitle: (size) => `Bench (${size})`,
  benchSize: "Substitutes allowed",
  benchSizeTitle: "How many players the competition lets you put on the bench",
  seat: (n) => `Sub ${n}`,
  autoSeat: "Auto (best available)",
  covers: (place) => `covers ${place}`,
  manual: "chosen by hand",
  mainTitle: "The 22 main players",
  offBench: "Main players left off the bench",
  bestOf: "Suggested",
  subsTitle: "Substitutes",
  tableTitle: "Squad",
  sel: "Sel",
  tactic: "Tactic level",
  tacticTitle: "How well he knows the team's tactic, in stars (the game's own figure, when it can be read)",
  positions: "Positions",
  bestPosition: "Best pos.",
  statusHead: "Status",
  status: { fit: "OK", injured: "Inj", banned: "Ban", loan: "Loan" },
  condition: "Cond.",
  conditionTitle: "Energy",
  morale: "Form",
  cohesion: "Coh.",
  cohesionTitle: "Cohesion with the club",
  mainLeft: "Choose",
  groupShort: { reserve: "Reserve", u19: "U19" },
};

const fr: LineupStrings = {
  intro:
    "Lecture seule : rien n'est écrit dans le jeu. Présenté comme une feuille de match : les 11 titulaires, le banc avec autant de places que la compétition en autorise, puis qui envoyer en réserve et en U19. Les 22 joueurs principaux du club sont les 11 titulaires et 11 remplaçants ; n'importe quel joueur du club, de n'importe quelle équipe, peut être mis sur le banc à la main.",
  formation: "Formation",
  auto: "Auto",
  autoTitle: "La formation qui donne le meilleur onze avec cet effectif",
  autoChosen: (formation) => `Auto (${formation})`,
  fitTitle: (fit) => (fit === "main" ? "à son meilleur poste" : fit === "alt" ? "autre poste" : "hors poste"),
  includeUnavailable: "Inclure les blessés et les suspendus",
  starters: "Les 11 titulaires",
  replacements: "Les 11 remplaçants, poste par poste",
  placements: "Les autres joueurs",
  unavailable: "Indisponibles",
  average: (value) => `moyenne ${value}`,
  noPlayer: "Personne de disponible pour ce poste",
  place: "Poste",
  player: "Joueur",
  now: "Joue en",
  fit: { main: "", alt: "autre poste", out: "hors poste" },
  groups: {
    reserve: "À envoyer en réserve",
    u19: "À envoyer en U19",
  },
  reasons: {
    youth: `${rules.u19MaxAge} ans ou moins`,
    prospect: "jeune avec une marge : potentiel nettement au-dessus du banc",
    surplus: `nettement sous le banc et ${rules.surplusMinAge} ans ou plus : à vendre ou libérer`,
    reserve: "sous le niveau du banc",
  },
  unavailableReasons: { loanedOut: "prêté ailleurs", injured: "blessé", banned: "suspendu" },
  empty: "Ce club n'a aucun joueur à choisir.",
  rulesTitle: "La logique",
  rules: [
    "Auto choisit, parmi les formations proposées, celle dont le onze a le meilleur score total pour cet effectif. La formation utilisée en jeu n'est pas encore lue : choisissez-la à la main pour qu'elle corresponde.",
    "Sur le terrain, * signale un joueur à un autre poste que son meilleur, et un contour rouge un joueur hors poste.",
    "Score pour un poste = niveau actuel (CA) moins un coût : 0 à son meilleur poste, quelques points pour un autre poste de sa liste ou un poste voisin, 30 si aucun ne convient (affiché « hors poste »).",
    "Les titulaires sont l'affectation au meilleur score total, pas un choix poste par poste : un joueur polyvalent n'est pas gaspillé.",
    "Les remplaçants sont la même affectation sur les joueurs restants : un pour chaque poste.",
    "Les 22 joueurs principaux sont les 11 titulaires et les 11 remplaçants (un par poste). Le banc prend les meilleurs remplaçants, un gardien d'abord, jusqu'au nombre de places réglé ci-dessus ; une place peut être donnée à n'importe quel joueur du club à la place.",
    `Parmi les autres, ${rules.u19MaxAge} ans ou moins vont en U19 ; les autres vont en réserve, notés « prospect » (${rules.prospectMaxAge} ans ou moins et potentiel (PA) au moins ${rules.prospectPotentialMargin} points au-dessus des remplaçants) ou « surplus » (${rules.surplusMinAge} ans ou plus et au moins ${rules.surplusMargin} points sous eux).`,
    "Les blessés, les suspendus et les joueurs prêtés ailleurs sont écartés, sauf si la case ci-dessus est cochée.",
  ],
  loading: "Lecture de l'effectif…",
  sheetTitle: "Feuille de match",
  benchTitle: (size) => `Banc (${size})`,
  benchSize: "Remplaçants autorisés",
  benchSizeTitle: "Le nombre de joueurs que la compétition permet de mettre sur le banc",
  seat: (n) => `Remplaçant ${n}`,
  autoSeat: "Auto (meilleur disponible)",
  covers: (place) => `couvre ${place}`,
  manual: "choisi à la main",
  mainTitle: "Les 22 joueurs principaux",
  offBench: "Joueurs principaux hors du banc",
  bestOf: "Suggestions",
  subsTitle: "Remplaçants",
  tableTitle: "Effectif",
  sel: "Sél",
  tactic: "Niveau pour la tactique",
  tacticTitle: "À quel point il connaît la tactique de l'équipe, en étoiles (le chiffre du jeu, quand il est lisible)",
  positions: "Postes",
  bestPosition: "Meilleur poste",
  statusHead: "Statut",
  status: { fit: "Dispo", injured: "Bls", banned: "Sus", loan: "Prêt" },
  condition: "Condition",
  conditionTitle: "Énergie",
  morale: "Forme",
  cohesion: "EdE",
  cohesionTitle: "Esprit d'équipe : cohésion avec le club",
  mainLeft: "Choisir",
  groupShort: { reserve: "Réserve", u19: "U19" },
};

export const lineupText: LineupStrings = locale === "fr" ? fr : en;
