// The text of the reserve and youth teams' managers box of the Staff tab (see `TeamManagers.tsx`). French and English
// only: the other languages of the app show the English.

import { locale } from "./i18n";

interface TeamManagersStrings {
  title: string;
  intro: string;
  noManager: string;
  choose: string;
  appoint: string;
  remove: string;
  noCoach: string;
  appointed: (name: string, team: string) => string;
  removed: (team: string) => string;
  held: string;
  undo: string;
}

const en: TeamManagersStrings = {
  title: "Reserve and youth team managers",
  intro:
    "Name one of the club's coaches manager of its reserve team or under-19s, or take him out again. Experimental: this writes where the game keeps each team's manager, as for the first team; check it in the game, and Undo takes it back. A coach who runs a team is kept there when the other staff are moved or released: remove him first.",
  noManager: "No manager",
  choose: "Pick a coach…",
  appoint: "Name manager",
  remove: "Remove",
  noCoach: "No coach left to name",
  appointed: (name, team) => `${name} now manages the ${team}.`,
  removed: (team) => `The ${team} has no manager now.`,
  held: "manages a team",
  undo: "Undo",
};

const fr: TeamManagersStrings = {
  title: "Entraîneurs de la réserve et des équipes de jeunes",
  intro:
    "Nomme un des entraîneurs du club à la tête de la réserve ou des U19, ou retire-le. Expérimental : ça écrit là où le jeu garde l'entraîneur de chaque équipe, comme pour l'équipe première ; vérifie dans le jeu, et Annuler remet comme avant. Un entraîneur qui dirige une équipe y reste quand le reste du staff est déplacé ou libéré : retire-le d'abord.",
  noManager: "Pas d'entraîneur",
  choose: "Choisir un entraîneur…",
  appoint: "Nommer",
  remove: "Retirer",
  noCoach: "Plus d'entraîneur à nommer",
  appointed: (name, team) => `${name} dirige maintenant ${team}.`,
  removed: (team) => `${team} n'a plus d'entraîneur.`,
  held: "dirige une équipe",
  undo: "Annuler",
};

export const teamManagersText: TeamManagersStrings = locale === "fr" ? fr : en;
