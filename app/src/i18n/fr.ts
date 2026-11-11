// The French text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), in the football
// French of France, whose conventions the dates and numbers follow too (see `index.ts`). It addresses the user as
// "vous". The comments in `en.ts` say what each string is for.
//
// French puts the singular for 0 and 1 ("0 modification", "1 modification") and agrees the words after a count with
// its noun, so the sentences with a count are written out for one and for many.

import type { Entity } from "../types";
import type { CheckKey, ExportEntity, ExportFormat, GraphicsCounts, MassOperationKind, MassPreview, PlayerSort, SquadSort, StaffSort, Storefront } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("fr-FR");
const percents = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12 345". */
const format = (value: number) => numbers.format(value);

/** "Aucune modification", "1 modification", "3 modifications". */
const changeCount = (count: number) =>
  count === 0 ? "Aucune modification" : count === 1 ? "1 modification" : `${format(count)} modifications`;

/** "1 modification appliquée", "3 modifications appliquées": a count of changes with the word that agrees. */
const nChanges = (count: number, one: string, many: string) =>
  count === 1 ? `1 modification ${one}` : `${format(count)} modifications ${many}`;

/** "1 joueur", "12 joueurs". */
const playerCount = (count: number) => (count === 1 ? "1 joueur" : `${format(count)} joueurs`);

/** "1 valeur laissée telle quelle", "12 valeurs laissées telles quelles". */
const valuesLeftAlone = (count: number) =>
  count === 1 ? "1 valeur laissée telle quelle" : `${format(count)} valeurs laissées telles quelles`;

/** "237 joueurs", "1 membre du staff", "12 clubs". */
const entityCount: Record<Entity, (count: number) => string> = {
  player: (count) => (count === 1 ? "1 joueur" : `${format(count)} joueurs`),
  staff: (count) => (count === 1 ? "1 membre du staff" : `${format(count)} membres du staff`),
  club: (count) => (count === 1 ? "1 club" : `${format(count)} clubs`),
};

const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Joueur star",
  2: "Joueur important",
  3: "Titulaire régulier",
  4: "Joueur de l'effectif",
  5: "Remplaçant décisif",
  7: "Joueur marginal",
  9: "Joker de secours",
  10: "Jeune espoir en vue",
  11: "Espoir pour l'avenir",
  13: "Jeune",
  14: "Habitué de l'équipe B",
  15: "Gardien numéro un",
  16: "Gardien de coupe",
  17: "Gardien de coupe nationale",
  20: "Gardien remplaçant",
  21: "Gardien de secours",
  22: "Surnuméraire",
};

const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Contrat à temps partiel",
  1: "Contrat à temps plein",
  2: "Contrat amateur",
  3: "Contrat jeune",
  4: "Sans contrat",
  10: "Contrat senior au salaire minimum",
  11: "Contrat senior",
};

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(fr, key ?? "");

/** What a check is about, from the key a failure gives, with a capital: "Les contrats". */
const checkName = (key: string | undefined) => {
  const name = (fr.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const errors: ErrorTexts = {
  "edit.unknownField": (p) => `Il n'y a pas de champ modifiable « ${p.field} » ici.`,
  "edit.outOfRange": (p) => `${p.value} n'est pas une valeur valide pour ${field(p.field)} : le champ accepte de ${p.min} à ${p.max}.`,
  "edit.notADate": (p) => `${p.value} n'est pas une date valide pour ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} ne fait pas partie des valeurs acceptées par ${field(p.field)}.`,
  "edit.taken": (p) => `Le numéro ${p.value} est déjà pris : ${p.name ?? `le joueur d'UID ${p.uid}`} le porte.`,
  "edit.unsupported": (p) => `${field(p.field)} ne peut pas être modifié ainsi : ${p.reason}.`,
  "edit.noRecord": (p) => `${field(p.field)} ne peut pas être modifié ici : son enregistrement est absent ou incohérent.`,
  "edit.unset": (p) => `${field(p.field)} n'est pas renseigné dans le jeu, il a donc été laissé tel quel.`,
  "edit.implausible": (p) => `${field(p.field)} vaut ${p.value}, ce qu'il ne peut pas contenir ; laissé tel quel par sécurité.`,
  "edit.notApplied": (p) => `${field(p.field)} : ${p.wrote} écrit mais ${p.read} relu.`,
  "edit.conflict": (p) => `${field(p.field)} vaut maintenant ${p.found} et non ${p.expected} : le jeu l'a modifié entre-temps.`,
  "move.outOfRange": (p) => `${p.value} n'est pas une valeur valide pour ${field(p.field)} : le champ accepte de ${p.min} à ${p.max}.`,
  "export.failed": (p) => `Impossible d'écrire le fichier : ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor n'a pas le droit d'écrire dans ${p.folder}. Si macOS a demandé l'accès à votre dossier Documents, ` +
    "autorisez-le dans Réglages Système › Confidentialité et sécurité › Fichiers et dossiers, puis exportez à nouveau.",
  "export.openFailed": (p) => `Impossible de l'ouvrir : ${p.reason}`,
  "guard.unknownBuild": () =>
    "FMLibreEditor n'a pas été vérifié avec cette version du jeu : il n'y écrit donc pas. « Modifier quand même », " +
    "dans l'avis en haut de la fenêtre, active la modification.",
  "guard.failed": (p) =>
    `${checkName(p.check)} ne correspond(ent) pas à cette version du jeu : FMLibreEditor les laisse inchangé(e)s.`,
  "memory.noBridge": () =>
    "macOS ne laisse pas FMLibreEditor accéder au jeu : le jeu a été lancé sans le pont FMLibreEditor. Installez " +
    "le pont, puis relancez le jeu depuis Steam.",
  "staff.directorTaken": (p) =>
    `${p.name ?? "Quelqu'un d'autre"} est déjà directeur sportif du club. Donnez un autre poste à ce membre du staff ` +
    `ou déplacez d'abord ${p.name ?? "cette personne"}.`,
  "staff.managerTaken": (p) =>
    `${p.name ?? "Quelqu'un d'autre"} est déjà l'entraîneur du club. Donnez un autre poste à ce membre du staff ou ` +
    `déplacez d'abord ${p.name ?? "cette personne"}.`,
  "staff.yourClub": () =>
    "Vous dirigez ce club. Donnez un autre poste à ce membre du staff : FMLibreEditor ne prend jamais votre place.",
  "staff.noJob": () => "Choisissez le poste qu'il ou elle occupe au club.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Ce club n'a aucun staff : le jeu n'en garde pas dans les clubs des championnats non jouables de cette sauvegarde."
      : "Aucun membre du staff de ce club n'a de contrat complet servant de modèle pour en créer un nouveau.",
  "scout.noClub": () => "Vous ne dirigez aucun club dans cette sauvegarde : il n'y a personne pour qui recruter.",
  "scout.noTactic": (p) => `Impossible de lire la tactique de ${p.club} dans le jeu.`,
  "scout.notPlaced": () => "Le joueur n'occupe aucun poste de la tactique.",
  "scout.unknownRole": (p) => `L'éditeur ne connaît pas le rôle ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam est ouvert : les options de lancement de FM27 n'ont pas été modifiées, mais le pont est installé. Quittez " +
    "Steam et réessayez, ou saisissez vous-même l'option de lancement dans Steam.",
};

const CLAUSE_NAMES_FR: Partial<Record<number, string>> = {
  0: "Clause libératoire (indemnité minimale)",
  1: "Clause libératoire en cas de relégation",
  2: "Clause libératoire en cas de non-promotion",
  3: "Augmentation salariale annuelle",
  4: "Augmentation salariale en cas de promotion",
  5: "Baisse salariale en cas de relégation",
  6: "Clause libératoire pour un poste de staff",
  8: "Pourcentage sur la revente",
  9: "Pourcentage sur le bénéfice de la revente",
  10: "Prime de buts par palier sur la saison",
  11: "Prolongation d'un an après un nombre de matchs de championnat (dernière saison)",
  12: "Clause du joueur le mieux payé",
  13: "Salaire après un nombre de matchs de championnat avec le club",
  14: "Augmentation salariale en cas de promotion en première division",
  15: "Baisse salariale en cas de relégation de première division",
  16: "Clause libératoire (indemnité minimale, clubs étrangers)",
  17: "Clause libératoire (indemnité minimale, clubs nationaux de division supérieure)",
  18: "Clause libératoire (indemnité minimale, clubs nationaux)",
  19: "Salaire après un nombre de sélections",
  20: "Pourcentage du salaire payé par un sponsor",
  21: "Pourcentage des recettes de billetterie versé au joueur",
  22: "Prolongation optionnelle par le club",
  23: "Renonciation à l'indemnité du club pour un poste d'entraîneur",
  25: "Prolongation d'un an après un nombre de matchs (promotion lors de la dernière saison)",
  26: "Prolongation d'un an après un nombre de matchs (maintien lors de la dernière saison)",
  27: "Clause libératoire (indemnité minimale, clubs de Ligue des champions)",
  28: "Clause de contrat garanti MLS",
  29: "Prolongation de contrat après une promotion",
  30: "Clause libératoire en cas de blessure",
  31: "Clause libératoire (indemnité minimale, clubs d'une compétition continentale)",
  32: "Prime de match joué",
  33: "Prime de but",
  34: "Prime de match sans but encaissé",
  37: "Prime de sélection",
  38: "Prime de remplaçant non utilisé",
  39: "Prime de passe décisive",
  40: "Prime de passes décisives par palier sur la saison",
  41: "Prime de buts et passes décisives cumulés par palier sur la saison",
  54: "Non affiché dans le jeu (54)",
  55: "Clause libératoire active en cas de relégation",
  56: "Clause libératoire active en cas de non-promotion",
  58: "Non affiché dans le jeu (58)",
  63: "Non affiché dans le jeu (63)",
};

const CONCERN_MOTIVES_FR: Partial<Record<number, string>> = {
  596: "Écarté de la liste d'une compétition",
  808: "Estime qu'un coéquipier est traité injustement",
  926: "Ne croit pas qu'un coéquipier mérite le temps de jeu qu'il réclame",
};

const TRAIT_NAMES_FR: readonly string[] = [
  "Court avec le ballon sur le côté gauche",
  "Court avec le ballon sur le côté droit",
  "Court avec le ballon dans l'axe",
  "Pénètre dans la surface adverse",
  "S'engouffre dans les intervalles",
  "Se projette vers l'avant dès que possible",
  "Joue des passes courtes et simples",
  "Tente souvent des passes décisives",
  "Tire de loin",
  "Tire puissamment",
  "Place ses tirs",
  "Frappe en effet",
  "Aime contourner le gardien",
  "Aime tenter de piéger le hors-jeu",
  "Utilise l'extérieur du pied",
  "Marque son adversaire de près",
  "Provoque ses adversaires",
  "Conteste les décisions des arbitres",
  "Joue dos au but",
  "Redescend chercher le ballon",
  "Joue des une-deux",
  "Aime lober le gardien",
  "Impose le tempo",
  "Tente des retournés acrobatiques",
  "Cherche la passe plutôt que de tenter sa chance",
  "Ne joue pas de passes en profondeur",
  "Casse le rythme du jeu",
  "Pousse le ballon au-delà de l'adversaire",
  "Passe le ballon sur son pied droit avant de dribbler",
  "Passe le ballon sur son pied gauche avant de dribbler",
  "Garde le ballon trop longtemps",
  "Arrive en retard dans la surface adverse",
  "Essaie de se sortir des situations difficiles en jouant",
  "Reste toujours en retrait",
  "Évite d'utiliser son mauvais pied",
  "Tente des gestes techniques",
  "Tente des coups francs lointains",
  "Se jette dans les tacles",
  "Ne se jette pas dans les tacles",
  "Repique dans l'axe",
  "Colle à la ligne",
  "Chauffe le public",
  "Tente des frappes du premier temps",
  "Tente des passes longues",
  "Aime recevoir le ballon dans les pieds",
  "Frappe les coups francs avec puissance",
  "Aime éliminer son vis-à-vis plusieurs fois",
  "Aime renverser le jeu sur l'autre flanc",
  "Prendra sa retraite au sommet",
  "Jouera au football le plus longtemps possible",
  "Possède une longue touche tendue",
  "Court souvent avec le ballon",
  "Court rarement avec le ballon",
  "S'efforce d'améliorer son mauvais pied",
  "Point de fixation statique",
  "Utilise les longues touches pour lancer des contre-attaques",
  "S'abstient de tenter des tirs lointains",
  "Repique dans l'axe depuis l'aile gauche",
  "Repique dans l'axe depuis l'aile droite",
  "Centre tôt",
  "Sort le ballon de la défense",
  "Joue le ballon au pied",
];

export const fr: Strings = {
  attributes: {
    // Technique
    corners: "Corners",
    crossing: "Centres",
    dribbling: "Dribble",
    finishing: "Finition",
    first_touch: "Première touche",
    free_kicks: "Coups francs",
    heading: "Jeu de tête",
    long_shots: "Tirs de loin",
    long_throws: "Longues touches",
    marking: "Marquage",
    passing: "Passes",
    penalty_taking: "Penalties",
    tackling: "Tacles",
    technique: "Technique",
    // Mental
    aggression: "Agressivité",
    anticipation: "Anticipation",
    bravery: "Courage",
    composure: "Sang-froid",
    concentration: "Concentration",
    decisions: "Décisions",
    determination: "Détermination",
    flair: "Créativité",
    leadership: "Leadership",
    off_the_ball: "Appels de balle",
    positioning: "Placement",
    teamwork: "Collectif",
    vision: "Vision du jeu",
    work_rate: "Volume de jeu",
    // Physique
    acceleration: "Accélération",
    agility: "Agilité",
    balance: "Équilibre",
    jumping_reach: "Détente",
    natural_fitness: "Condition physique naturelle",
    pace: "Vitesse",
    stamina: "Endurance",
    strength: "Puissance",
    // Gardien (première touche et passes sont communes avec la technique)
    aerial_reach: "Jeu aérien",
    command_of_area: "Autorité dans la surface",
    communication: "Communication",
    eccentricity: "Excentricité",
    handling: "Prise de balle",
    kicking: "Jeu au pied",
    one_on_ones: "Un contre un",
    punching: "Poings (tendance)",
    reflexes: "Réflexes",
    rushing_out: "Sorties (tendance)",
    throwing: "Relance à la main",
    // Cachés
    consistency: "Régularité",
    dirtiness: "Jeu dur",
    important_matches: "Matchs importants",
    injury_proneness: "Propension aux blessures",
    versatility: "Polyvalence",
    // Pieds
    left_foot: "Pied gauche",
    right_foot: "Pied droit",
  },

  staffAttributes: {
    // Coaching
    attacking: "Attaque",
    defending: "Défense",
    fitness: "Préparation physique",
    goalkeeping: "Gardiens",
    possession: "Possession",
    set_pieces: "Coups de pied arrêtés",
    tactical: "Tactique",
    technical: "Technique",
    working_with_youngsters: "Travail avec les jeunes",
    // Mental
    authority: "Autorité",
    determination: "Détermination",
    motivating: "Motivation",
    people_management: "Gestion humaine",
    // Connaissances
    data_analysis: "Analyse de données",
    judging_ability: "Évaluation du niveau des joueurs",
    judging_potential: "Évaluation du potentiel des joueurs",
    judging_staff: "Évaluation du staff",
    negotiating: "Négociation",
    tactical_knowledge: "Connaissances tactiques",
    // Médical
    physiotherapy: "Kinésithérapie",
    sports_science: "Sciences du sport",
  },

  personality: {
    adaptability: "Adaptabilité",
    ambition: "Ambition",
    loyalty: "Loyauté",
    pressure: "Gestion de la pression",
    professionalism: "Professionnalisme",
    sportsmanship: "Esprit sportif",
    temperament: "Tempérament",
    controversy: "Polémique",
  },

  positions: {
    gk: "GK",
    sw: "SW",
    dl: "DL",
    dc: "DC",
    dr: "DR",
    dm: "DM",
    ml: "ML",
    mc: "MC",
    mr: "MR",
    aml: "AML",
    amc: "AMC",
    amr: "AMR",
    st: "ST",
    wbl: "WBL",
    wbr: "WBR",
  },

  clubFacilities: {
    training: "Entraînement",
    youth_facilities: "Installations des jeunes",
    youth_coaching: "Encadrement des jeunes",
    youth_recruitment: "Recrutement des jeunes",
    corporate: "Entreprises",
  },

  supporterTraits: {
    loyalty: "Loyauté",
    passion: "Passion",
    patience: "Patience",
    affluence: "Aisance financière",
    temperament: "Tempérament",
    expectations: "Attentes",
  },

  supporterMix: {
    hardcore: "Ultras",
    core: "Fidèles",
    family: "Familles",
    fair_weather: "Supporters de circonstance",
    corporate: "Entreprises",
    casual: "Occasionnels",
  },

  jobs: {
    1: "Joueur",
    2: "Entraîneur",
    4: "Président du conseil",
    6: "Dirigeant",
    10: "Directeur sportif",
    12: "Kinésithérapeute",
    14: "Recruteur",
    16: "Entraîneur principal",
    20: "Entraîneur adjoint",
    22: "Entraîneur des coups de pied arrêtés",
    26: "Préparateur physique",
    34: "Entraîneur des gardiens",
    38: "Médecin-chef",
    40: "Responsable des sciences du sport",
    44: "Responsable du recrutement",
    46: "Médecin",
    48: "Spécialiste des sciences du sport",
    50: "Kinésithérapeute en chef",
    58: "Analyste du recrutement",
    60: "Analyste de la performance",
    62: "Responsable de l'analyse de la performance",
    64: "Responsable de la formation",
    66: "Propriétaire",
    70: "Président",
    86: "Responsable des prêts",
    88: "Directeur technique",
  },

  fields: {
    current_ability: "Capacité actuelle",
    potential_ability: "Capacité potentielle",
    height: "Taille (cm)",
    date_of_birth: "Date de naissance",
    asking_price: "Prix demandé",
    nation: "Nationalité",
    "reputation.home": "Réputation nationale",
    "reputation.current": "Réputation actuelle",
    "reputation.world": "Réputation mondiale",
    "international.caps": "Sélections",
    "international.goals": "Buts en sélection",
    "international.u21_caps": "Sélections espoirs",
    "international.u21_goals": "Buts espoirs",
    condition: "Énergie",
    match_sharpness: "Rythme de match",
    jadedness: "Lassitude",
    morale: "Moral",
    "contract.wage": "Salaire hebdomadaire",
    "contract.loyalty_bonus": "Prime de fidélité hebdomadaire",
    "contract.happiness": "Satisfaction",
    "contract.playing_time_happiness": "Satisfaction du temps de jeu",
    "contract.unhappiness": "Motifs de mécontentement",
    "contract.expires": "Fin de contrat",
    "contract.squad_number": "Numéro",
    "contract.squad_status": "Statut dans l'effectif",
    "contract.transfer_listed": "Sur la liste des transferts",
    "contract.loan_listed": "Sur la liste des prêts",
    "loan.expires": "Fin du prêt",
    "loan.option_fee": "Option d'achat",
    "contract.job": "Poste",
    "tie.nationality": "Nationalité secondaire",
    "tie.trainedInNation": "Formé dans le pays",
    "tie.trainedAtClub": "Formé au club",
    "tie.workPermit": "Sans permis de travail requis en",
    club: "Club",
    injuries: "Blessures",
    bans: "Suspensions",
    retirement: "Retraite",
    clause: "Clause du contrat",
    "clause.amount": "Montant de la clause",
    "clause.condition": "Condition de la clause",
    captain: "Capitaine",
    vice_captain: "Vice-capitaine",
    reputation: "Réputation",
    "facilities.training": "Installations d'entraînement",
    "facilities.youth_facilities": "Installations des jeunes",
    "facilities.youth_coaching": "Encadrement des jeunes",
    "facilities.youth_recruitment": "Recrutement des jeunes",
    "facilities.corporate": "Installations pour entreprises",
    "finance.balance": "Solde",
    "finance.transfer_budget": "Budget transferts",
    "finance.wage_budget": "Budget salarial",
    "finance.total_wage_budget": "Budget salarial total",
    "stadium.capacity": "Capacité du stade",
    "stadium.name": "Nom du stade",
    "stadium.seating": "Places assises",
    "stadium.used": "Capacité utilisée",
    "stadium.expansion": "Capacité d'agrandissement",
  },

  profile: {
    close: "Fermer le profil",
    loading: "Chargement du profil…",
    resize: "Redimensionner le panneau du profil",
    resizeHint: "Faites glisser pour élargir ou rétrécir le panneau ; double-clic pour le réinitialiser",
    none: "—",

    // En-tête
    freeAgent: "Sans club",
    born: "Né(e) le",
    height: (cm: number) => `${cm} cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Capacité actuelle",
    currentAbilityShort: "CA",
    potentialAbility: "Capacité potentielle",
    potentialAbilityShort: "PA",
    potentialRange: "Potentiel défini comme une fourchette",

    // Attributs
    technical: "Technique",
    goalkeeping: "Gardien",
    mental: "Mental",
    physical: "Physique",
    hidden: "Cachés",
    feet: "Pieds",
    personality: "Personnalité",
    raw: (raw: number, scale = 100) => `brut ${raw} / ${scale}`,
    lowerIsBetter: "plus c'est bas, mieux c'est",
    age: (age: number) => `${age} ans`,

    // Postes
    positions: "Postes",
    positionsSummary: (best: string) => `Aptitude aux postes : ${best}`,
    positionRatings: "Aptitude aux postes",
    positionTiers: {
      natural: "Naturel",
      accomplished: "Accompli",
      competent: "Compétent",
      unconvincing: "Peu convaincant",
      ineffective: "Inefficace",
    },
    positionTooltip: (position: string, rating: number, tier: string) => `${position} · ${rating} · ${tier}`,

    // Contrat
    contract: "Contrat",
    wage: "Salaire hebdomadaire",
    wageNote: (converted: boolean): string =>
      converted
        ? "le jeu compte en livres ; affiché au taux de change de FM"
        : "le jeu compte en livres ; une autre devise se choisit dans les réglages",
    signed: "Signé",
    expires: "Expire",
    joined: "Arrivé",
    squadStatus: "Statut dans l'effectif",
    squadStatusName: (status: number) => SQUAD_STATUSES[status] ?? `Statut ${status}`,
    contractType: "Type de contrat",
    contractTypeName: (code: number) => CONTRACT_TYPES[code] ?? `Type ${code}`,
    squadNumber: "Numéro",
    transferListed: "Sur la liste des transferts",
    loanListed: "Sur la liste des prêts",

    // Carrière
    career: "Carrière",
    internationalCaps: "Sélections",
    internationalGoals: "Buts en sélection",
    u21Caps: "Sélections espoirs",
    u21Goals: "Buts espoirs",
    askingPrice: "Prix demandé",
    notSet: "Non défini",
    reputation: "Réputation",
    reputationHome: "Nationale",
    reputationCurrent: "Actuelle",
    reputationWorld: "Mondiale",
    retirement: "Retraite",
    retires: "Prévoit de prendre sa retraite",
    noRetirement: "Le jeu n'a pas prévu sa retraite",
    keepPlaying: "Empêcher la retraite",
    keepingPlaying: "En cours…",
    keepPlayingTitle:
      "Retire sa retraite des plans du jeu et lui donne la particularité « Jouera au football le plus longtemps possible » à la place de « Prendra sa retraite au sommet » ; Modifications peut l'annuler",

    // Médical
    morale: (value: number) => `${value} / 20`,
    traits: "Particularités",
    noTraits: "Aucune particularité",
    traitName: (bit: number) => TRAIT_NAMES_FR[bit] ?? `Particularité ${bit}`,
    unhappiness: "Mécontentement",
    noUnhappiness: "Rien ne le rend mécontent",
    removeUnhappiness: "Tout retirer",
    removingUnhappiness: "Retrait…",
    removeUnhappinessTitle: "Retire tous ses motifs de mécontentement, comme « Remove all » de FMRTE ; Modifications peut l'annuler",
    concernSince: (date: string) => `depuis le ${date}`,
    concernKind: (kind: number) => (kind === 1 ? "Inquiet" : kind === 2 ? "Interne" : `Type ${kind}`),
    concernMotive: (motive: number) => CONCERN_MOTIVES_FR[motive] ?? `Motif ${motive}`,
    clauses: "Primes et clauses",
    noClauses: "Aucune prime ni clause",
    loyaltyBonus: "Prime de fidélité",
    happiness: "Satisfaction",
    playingTimeHappiness: "Satisfaction du temps de jeu",
    moodTitle: "Comme l'affiche FMRTE, de -100 à 100 ; le jeu l'affiche en mots",
    clauseName: (kind: number) => CLAUSE_NAMES_FR[kind] ?? `Clause ${kind}`,
    loan: "Prêt",
    loanAt: "Prêté à",
    loanParent: "Appartient à",
    loanFrom: "Depuis le",
    loanUntil: "Jusqu'au",
    loanNumber: "Numéro sur place",
    recall: "Rappeler de prêt",
    recallTitle: "Le ramène dans son club : le prêt se termine aujourd'hui. Demande confirmation avant toute modification",
    recallAgain: "Rappeler à nouveau",
    makePermanent: "Rendre définitif",
    makePermanentTitle: "Le garde au club où il est prêté, sous contrat avec lui. Demande confirmation avant toute modification",
    recalledWaiting: "Rappelé · retour en attente",
    endsTodayWaiting: "Se termine aujourd'hui · retour en attente",
    pendingTitle: (parent: string) =>
      `Aujourd'hui est le dernier jour du prêt : passez un jour dans le jeu et il est de retour à ${parent}.`,
    endPassed: (date: string) =>
      `Le prêt devait se terminer le ${date}, mais le jeu ne l'a pas ramené. Rappelez-le à nouveau, puis passez un jour.`,
    loanCanRecall: "Peut être rappelé",
    loanCanRecallTitle: "Si son club peut le rappeler dans le jeu. Rappeler de prêt fonctionne ici dans tous les cas",
    loanCanTerminate: "Peut être interrompu",
    loanCupMatches: "Joue les matchs de coupe",
    loanAgainstClub: "Joue contre son club",
    loanOptionFee: "Option d'achat",
    loanOptionFeeTitle: "L'indemnité pour laquelle le club qui l'a en prêt peut le recruter définitivement",
    loanMonthlyFee: "Loyer mensuel",
    loanMonthlyFeeTitle: "Ce que le club qui l'a en prêt verse à son club pour chaque mois où il joue",
    loanUnusedFee: "Loyer mensuel s'il ne joue pas",
    loanUnusedFeeTitle: "Ce que le club qui l'a en prêt verse à son club pour chaque mois où il n'est pas utilisé",
    clauseCondition: (kind: number, value: number) => {
      switch (kind) {
        case 10:
          return value === 1 ? "1 but" : `${value} buts`;
        case 40:
          return value === 1 ? "1 passe décisive" : `${value} passes décisives`;
        case 41:
          return `${value} buts et passes décisives`;
        case 19:
          return value === 1 ? "1 sélection" : `${value} sélections`;
        case 11:
        case 13:
        case 25:
        case 26:
          return value === 1 ? "1 match de championnat" : `${value} matchs de championnat`;
        case 22:
        case 29:
          return value === 1 ? "1 an" : `${value} ans`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value} %`;
        default:
          return String(value);
      }
    },
    clauseExpires: (date: string) => `expire le ${date}`,
    clauseExpiresAfter: (days: number) =>
      days === 1 ? "expire 1 jour après la signature" : `expire ${format(days)} jours après la signature`,
    clauseProfitShare: (percent: string, amount: string) => `${percent} du bénéfice au-delà de ${amount}`,
    clauseWage: (amount: string) => `${amount} par semaine`,
    moraleTitle: "Le jeu affiche le moral comme la satisfaction générale du joueur : content à 10, plutôt heureux à 11, extrêmement heureux à 15 et 20",
    jadednessTitle: "À quel point le jeu a usé le joueur, ce que le repos enlève : -500 signifie parfaitement reposé, et plus la valeur est haute, plus il a besoin de repos",
    noInjuries: "Aucune blessure",
    unknownInjury: "Blessure inconnue",
    injuryStarted: (date: string) => `Depuis le ${date}`,
    injuryBack: (dates: string) => `Retour prévu ${dates}`,
    heal: "Soigner",
    healTitle: "Soigne toutes les blessures de ce joueur dans le jeu",
    noBans: "Aucune suspension",
    banMatches: (matches: number) => (matches === 1 ? "1 match" : `${format(matches)} matchs`),
    banStarted: (date: string) => `À partir du ${date}`,
    liftBans: "Lever",
    liftBansTitle: "Lève toutes les suspensions de ce joueur dans le jeu",

    // Au-dessus des attributs, en lecture
    maxAttributes: "Attributs au maximum",
    bulkSet: "Mettre à",
    bulkAll: "Tous les attributs",
    bulkTitle: "Remplit les champs ci-dessous avec cette valeur ; rien n'est écrit avant Appliquer",
    maxAttributesTitle: "Met tous les attributs de ce joueur au maximum : 20, et 1 pour la propension aux blessures et le jeu dur",
    maxAttributesDone: (count: number) =>
      count === 0 ? "Tous les attributs sont déjà au maximum" : nChanges(count, "écrite", "écrites"),
    maxAttributesUndone: (count: number) => (count === 0 ? "Rien n'a été annulé" : nChanges(count, "annulée", "annulées")),
    undoMax: "Annuler",
    undoMaxTitle: "Réécrit ses anciens attributs dans le jeu",
    freezeAttributes: "Figer les attributs",
    freezeAttributesNote:
      "Tant que l'application est ouverte et connectée, ses attributs ne baissent pas : ce que le jeu enlève est remis, " +
      "et les progrès comptent toujours. L'application s'en souvient pour cette sauvegarde et les fige à nouveau à la connexion.",
    maxStaffAttributesTitle: "Met tous les attributs de ce membre du staff au maximum : 20",
    undoMaxStaffTitle: "Réécrit les anciens attributs dans le jeu",
    freezeStaffAttributesNote:
      "Tant que l'application est ouverte et connectée, ses attributs ne baissent pas : ce que le jeu enlève est remis, " +
      "et les progrès comptent toujours. L'application s'en souvient pour cette sauvegarde et les fige à nouveau à la connexion.",
    freezeFitness: "Figer énergie et rythme",
    freezeFitnessNote:
      "Tant que l'application est ouverte et connectée, son énergie et son rythme de match ne baissent pas : ce que le " +
      "jeu enlève est remis, et les gains comptent toujours, donc à 100 % il y reste. L'application s'en souvient pour cette sauvegarde.",
    freezePositions: "Figer",
    freezePositionsInfo: "À quoi sert de figer les postes ?",
    freezePositionsNote:
      "Tant que l'application est ouverte et connectée, ses aptitudes aux postes restent telles quelles : il n'apprend " +
      "pas de nouveau poste et ses notes ne montent ni ne baissent. L'application s'en souvient pour cette sauvegarde.",

    // Staff
    you: "Vous",
    youTitle: "L'entraîneur que vous dirigez dans cette sauvegarde",
    id: "ID",
    job: "Poste",
    changeJob: "Changer de poste",
    changeJobTitle: "Donne un autre poste à ce membre du staff dans son club, dans le jeu",
    newJob: "Nouveau poste",
    applyJob: "Appliquer",
    cancelJob: "Annuler",
    unemployed: "Sans emploi",
    coaching: "Coaching",
    knowledge: "Connaissances",
    medical: "Médical",
    playerCoach: (job: string) => `${job} (joueur-entraîneur)`,
    unknownJob: (code: number) => `Poste ${code}`,
  },

  playerList: {
    nav: "Joueurs",
    count: (total: number) => `${format(total)} joueurs`,
    search: "Rechercher un joueur par nom ou UID",
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} joueurs`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · affichage des ${shown} meilleurs par capacité actuelle`
        : `${count} · affichage des ${shown} premiers par ${sorted.by}, ordre ${sorted.ascending ? "croissant" : "décroissant"}`;
    },
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Aucun joueur ne correspond à ces filtres." : "Aucun joueur trouvé.";
      }
      return filtered ? `Aucun joueur ne correspond à « ${query} » avec ces filtres.` : `Aucun joueur ne correspond à « ${query} ».`;
    },
    columns: {
      name: "Nom",
      age: "Âge",
      positions: "Postes",
      nation: "Nation",
      club: "Club",
      contractExpires: "Contrat",
      born: "Naissance",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    } satisfies Record<PlayerSort | "positions" | "born" | "uid", string>,
    sortBy: (by: string) => `Trier par ${by}`,
    sortNames: {
      currentAbility: "capacité actuelle",
      potentialAbility: "capacité potentielle",
      age: "âge",
      name: "nom",
      nation: "nation",
      club: "club",
      contractExpires: "fin de contrat",
    } satisfies Record<PlayerSort, string>,
    filters: {
      toggle: "Filtres",
      toggleActive: (count: number) => `Filtres, ${count} actif(s)`,
      clear: "Effacer",
      any: "Tous",
      position: "Poste",
      gender: "Genre",
      men: "Hommes",
      women: "Femmes",
      age: "Âge",
      minAge: "Âge minimum",
      maxAge: "Âge maximum",
      minPlaceholder: "Min",
      maxPlaceholder: "Max",
      minCurrentAbility: "CA min",
      minCurrentAbilityTitle: "Capacité actuelle minimale",
      minPotentialAbility: "PA min",
      minPotentialAbilityTitle: "Capacité potentielle minimale",
      abilityPlaceholder: "1–200",
      nation: "Nation",
      club: "Club",
      freeAgentsOnly: "Sans club uniquement",
      contractEndsBy: "Contrat se terminant avant le",
      transferListedOnly: "Sur la liste des transferts uniquement",
      loanListedOnly: "Sur la liste des prêts uniquement",
      attributes: {
        heading: "Attributs",
        attribute: "Attribut",
        pick: "Choisir un attribut",
        min: (name: string) => (name ? `${name} au moins` : "Au moins"),
        max: (name: string) => (name ? `${name} au plus` : "Au plus"),
        add: "Ajouter un attribut",
        remove: (name: string) => (name ? `Retirer ${name}` : "Retirer cette ligne"),
      },
      saved: {
        save: "Enregistrer",
        saveTitle: "Enregistre sous un nom les filtres et le tri en cours",
        name: "Nom du filtre enregistré",
        namePlaceholder: "Nom du filtre",
        ok: "OK",
        cancel: "Annuler",
        select: "Filtres enregistrés",
        delete: "Supprimer",
        deleteTitle: (name: string) => `Supprimer le filtre enregistré : ${name}`,
        replaceQuestion: (name: string) => `Un filtre enregistré nommé « ${name} » existe déjà. Le remplacer ?`,
        replace: "Remplacer",
        full: (max: number) =>
          `Jusqu'à ${max} filtres peuvent être enregistrés. Supprimez-en un d'abord, ou reprenez le nom d'un filtre enregistré pour le remplacer.`,
      },
    },
  },

  staffList: {
    nav: "Staff",
    count: (total: number) => `${format(total)} membres du staff`,
    search: "Rechercher un membre du staff par nom ou ID",
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} membres du staff`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · affichage des ${shown} meilleurs par capacité actuelle`
        : `${count} · affichage des ${shown} premiers par ${sorted.by}, ordre ${sorted.ascending ? "croissant" : "décroissant"}`;
    },
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Aucun membre du staff ne correspond à ces filtres." : "Aucun membre du staff trouvé.";
      }
      return filtered
        ? `Aucun membre du staff ne correspond à « ${query} » avec ces filtres.`
        : `Aucun membre du staff ne correspond à « ${query} ».`;
    },
    columns: {
      name: "Nom",
      age: "Âge",
      job: "Poste",
      club: "Club",
      nation: "Nation",
      born: "Naissance",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    } satisfies Record<StaffSort | "job" | "born" | "id", string>,
    sortBy: (by: string) => `Trier par ${by}`,
    sortNames: {
      currentAbility: "capacité actuelle",
      potentialAbility: "capacité potentielle",
      age: "âge",
      name: "nom",
      nation: "nation",
      club: "club",
    } satisfies Record<StaffSort, string>,
    filters: {
      job: "Poste",
      anyJob: "Tous",
      unemployedOnly: "Sans emploi uniquement",
    },
  },

  clubProfile: {
    womensClub: "Club féminin",
    founded: (year: number) => `Fondé en ${year}`,
    reputationShort: "REP",
    reputationTitle: "Réputation",

    tabsLabel: "Sections du club",
    tabs: { overview: "Aperçu", squad: "Effectif", stadium: "Stade" },
    squadLocked: "Terminez la modification pour ouvrir l'effectif",

    facilities: "Installations",

    supporters: "Supporters",
    supporterMix: "Répartition des supporters",
    percent: (value: number) => `${percents.format(value)} %`,
    mixTooltip: (kind: string, percent: string) => `${kind} · ${percent}`,

    finances: "Finances",
    balance: "Solde",
    transferBudget: "Budget transferts",
    wageBudget: "Budget salarial (dépensé)",
    totalWageBudget: "Budget salarial total",
    ticketPrice: "Prix moyen du billet",
    perWeek: "par semaine",
    noFinances: "FM ne garde les finances que des clubs des championnats joués.",
    freeze: "Figer l'argent",
    freezeNote:
      "Tant que l'application est ouverte et connectée, le solde ne baisse pas : ce que le jeu enlève est remis, et " +
      "les revenus comptent toujours. L'application s'en souvient pour cette sauvegarde et le fige à nouveau à la connexion.",

    stadium: "Stade",
    capacity: "Capacité",
    seating: "Places assises",
    used: "Utilisée",
    usedAll: "Toute",
    usedTitle: "La part de la capacité que le jeu laisse entrer, quand il la limite (par exemple quand des places sont fermées) ; 0 signifie toute la capacité",
    expansion: "Peut passer à",
    noStadium: "Le stade n'a pas pu être lu pour ce club.",
    stadiumName: "Nom",
    rename: "Renommer",
    renameTitle: "Donne un autre nom au stade ; il est écrit tout de suite et Modifications peut l'annuler",
    renameInfoLabel: "Comment fonctionne le renommage ?",
    renameInfo:
      "Le jeu ne garde aucun nom de stade dans ses sauvegardes : il les reprend de sa base de données à chaque " +
      "chargement. FMLibreEditor retient donc le nouveau nom pour cette sauvegarde et le redonne en quelques " +
      "secondes à chaque chargement, tant que l'application est ouverte et connectée. Si le jeu charge la sauvegarde " +
      "alors que l'application est fermée, il affiche son propre nom jusqu'à la prochaine connexion. Pour revenir à " +
      "l'ancien nom, annulez le renommage dans Modifications ou renommez le stade.",
    saveName: "Enregistrer",
    renaming: "Enregistrement…",
    cancelRename: "Annuler",
    nameLength: (bytes: number, min: number, max: number) =>
      min <= 1
        ? `${bytes} sur au plus ${max} caractères (une lettre accentuée compte pour deux)`
        : `${bytes} caractères : de ${min} à ${max}, pour tenir là où le jeu garde le nom (une lettre accentuée compte pour deux)`,
    nameShared: (holders: number) =>
      `${holders} éléments du jeu partagent ce nom : il ne peut pas être changé pour le stade seul`,

    info: "Infos du club",
    seasonTickets: "Abonnements",
    socialMedia: "Abonnés sur les réseaux sociaux",
  },

  clubList: {
    nav: "Clubs",
    count: (total: number) => `${format(total)} clubs`,
    search: "Rechercher un club par nom ou UID",
    summary: (total: number, shown: number) =>
      total > shown
        ? `${format(total)} clubs · affichage des ${shown} meilleurs par réputation`
        : `${format(total)} clubs`,
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Aucun club ne correspond à ce filtre." : "Aucun club trouvé.";
      }
      return filtered ? `Aucun club ne correspond à « ${query} » avec ce filtre.` : `Aucun club ne correspond à « ${query} ».`;
    },
    women: "Féminin",
    columns: {
      name: "Nom",
      reputation: "Réputation",
      founded: "Fondation",
      uid: "UID",
    },
    filters: {
      kind: "Clubs à afficher",
      all: "Tous les clubs",
      men: "Clubs masculins",
      women: "Clubs féminins",
    },
  },

  app: {
    stage: "bêta",
    settingsLabel: "Réglages",
    languageLabel: "Langue",
    currencyLabel: "Devise",

    noteEditable: "Les modifications n'arrivent dans le jeu que lorsque vous les appliquez. Sauvegardez d'abord votre partie.",
    noteReadOnly: "Lecture seule : Windows n'a pas laissé FMLibreEditor écrire dans le jeu.",
    noteUnknownBuild: "Lecture seule : cette version du jeu est nouvelle pour FMLibreEditor.",
    noteNotConnected: "Rien ne change dans le jeu tant que vous ne modifiez pas et n'appliquez pas.",

    notConnected: "Non connecté",
    previewTag: "aperçu navigateur · données d'exemple",
    noDate: "Pas de date en jeu",
    noDateTitle:
      "FMLibreEditor n'a pas pu lire la date en jeu dans cette version du jeu : les âges ne sont donc pas affichés et " +
      "les filtres d'âge ne trouvent personne. Cherchez des mises à jour.",
    reload: "Recharger les données",
    refresh: "Actualiser",
    detecting: "Recherche de Football Manager…",
    connecting: "Lecture des joueurs, du staff et des clubs…",
    reloading: "Rechargement des joueurs, du staff et des clubs…",

    refrozen: {
      title: "Figé à nouveau comme la dernière fois",
      waitingTitle: "Ce qui était figé attend pour l'instant",
      players: (names: string) => `Attributs : ${names}`,
      staff: (names: string) => `Attributs du staff : ${names}`,
      clubs: (names: string) => `Argent : ${names}`,
      fitness: (names: string) => `Énergie et rythme : ${names}`,
      positions: (names: string) => `Postes : ${names}`,
      stadiums: (names: string) => `Noms de stades : ${names}`,
      more: (count: number) => `et ${format(count)} de plus`,
      waiting: (count: number) =>
        `${count === 1 ? "1 élément est retenu mais n'est" : `${format(count)} éléments sont retenus mais ne sont`} pas figé(s) pour l'instant : FMLibreEditor ne peut pas encore ` +
        "écrire dans cette version du jeu.",
      dismiss: "Fermer",
    },

    freezeInfo: {
      label: "Comment fonctionne le gel ?",
      note:
        "Figer ne change pas le jeu pour de bon : toutes les 2 secondes, FMLibreEditor remet ce que le jeu a enlevé. " +
        "Cela ne marche donc que tant que l'application est ouverte et connectée ; fermez-la et le jeu les modifie à " +
        "nouveau. L'application retient ce qui est figé dans cette sauvegarde et le fige à nouveau à la prochaine connexion.",
    },

    connect: {
      title: "Se connecter à Football Manager 27",
      intro: "FMLibreEditor lit la mémoire du jeu pendant qu'il tourne. Lancez le jeu et chargez une sauvegarde, puis connectez-vous.",
      notRunning: "Football Manager 27 n'est pas lancé.",
      openFailed: (error: string) => `Impossible d'ouvrir le jeu : ${error}`,
      game: "Jeu",
      gameData: "Données du jeu",
      loaded: "Chargées",
      stillLoading: "Chargement en cours ; attendez le menu principal",
      process: "Processus",
      pid: (pid: number) => `pid ${pid}`,
      several: "Plusieurs copies du jeu sont lancées ; la première est utilisée.",
      button: "Se connecter et lire joueurs, staff et clubs",

      bridge: {
        title: "Le pont (macOS)",
        intro:
          "macOS ne laisse aucune application entrer dans la mémoire d'une autre : FM27 doit donc la confier lui-même. " +
          "Il le fait dès qu'il charge le pont de FMLibreEditor : une petite bibliothèque qui n'accroche ni ne change " +
          "rien dans le jeu et ne donne sa mémoire qu'à cette application. Une option de lancement dans Steam fait " +
          "charger le pont à FM27.",
        library: "Pont",
        installed: "Installé",
        missing: "Non installé",
        launchOption: "Option de lancement",
        set: "Définie dans Steam",
        notSet: "Non définie",
        ready: "Installé. Lancez FM27 depuis Steam (quittez-le puis relancez-le s'il tourne), chargez une sauvegarde, puis connectez-vous.",
        steamRunning:
          "Steam est ouvert et garde les options de lancement tant qu'il l'est. Quittez Steam pour que l'option soit " +
          "définie à votre place, ou saisissez-la vous-même dans Steam.",
        setUp: "Installer le pont",
        remove: "Retirer le pont",
        manual: "Ou, dans Steam, faites un clic droit sur Football Manager 27 › Propriétés › Général › Options de lancement, et saisissez :",
        copy: "Copier",
        copied: "Copié",
      },
    },
  },

  graphics: {
    reading: "Lecture des packs graphiques…",
    summary: ({ clubLogos, flags, faces }: Pick<GraphicsCounts, "clubLogos" | "flags" | "faces">) =>
      `Graphismes : ${format(clubLogos)} logo${clubLogos > 1 ? "s" : ""} de club · ` +
      `${format(flags)} drapeau${flags > 1 ? "x" : ""} · ${format(faces)} visage${faces > 1 ? "s" : ""}`,
    none: "Aucun pack graphique trouvé",
    noneHint: "Les packs de logos et de visages vont dans le dossier graphics de FM27.",
  },

  compatibility: {
    unknownBuild: (game: string) => `FMLibreEditor n'a pas encore été vérifié avec ${game}`,
    unknownBuildText:
      "Le jeu a probablement été mis à jour. FMLibreEditor a trouvé les données du jeu et les a vérifiées, mais il " +
      "n'écrit pas dans une version qu'il n'a pas testée tant que vous ne l'y autorisez pas. Une nouvelle version de " +
      "FMLibreEditor suit en général sous quelques jours.",
    allowedText: "La modification est activée pour cette session, dans la mesure où les vérifications le permettent. Gardez une sauvegarde de votre partie.",
    failedTitle: "Certaines données du jeu ne correspondent pas",
    reloadHint: "Si une sauvegarde était encore en cours de chargement, Recharger les données vérifie à nouveau.",
    noDate: "La date en jeu ne correspond pas : aucun âge n'est donc affiché.",
    failed: (names: string) => `Laissé en lecture seule : ${names}.`,
    join: (names: string[]) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`,
    allow: "Modifier quand même",
    allowTitle: "Active la modification jusqu'à la fermeture de FMLibreEditor ou à une nouvelle connexion. Sauvegardez d'abord votre partie.",
  },

  checks: {
    gameDate: "la date en jeu",
    players: "les détails des joueurs",
    positions: "les postes",
    attributes: "les attributs",
    personality: "la personnalité",
    liveValues: "l'énergie, le rythme de match, la lassitude et le moral",
    contracts: "les contrats",
    teams: "les équipes",
    staff: "le staff",
    clubs: "les clubs",
  } satisfies Record<CheckKey, string>,

  update: {
    available: (version: string) => `FMLibreEditor ${version} est disponible`,
    youHave: (version: string) => `Vous avez la ${version}.`,
    download: "Télécharger",
    install: "Mettre à jour",
    installTitle: "Télécharge et installe la nouvelle version ; FMLibreEditor se ferme et se rouvre avec elle",
    preparing: "Préparation…",
    downloading: (percent: number | null) => (percent === null ? "Téléchargement…" : `Téléchargement… ${percent} %`),
    installing: "Installation : FMLibreEditor se ferme et se rouvre avec la nouvelle version.",
    installFailed: (reason: string) => `Mise à jour impossible : ${reason}. Téléchargez-la plutôt depuis sa page.`,
    notInstallable: "Cette version ne peut pas être installée d'ici. Téléchargez-la plutôt depuis sa page.",
    later: "Plus tard",
    check: "Chercher des mises à jour",
    checking: "Recherche de mises à jour…",
    upToDate: "Vous avez la dernière version.",
    failed: "Impossible de chercher des mises à jour.",
  },

  edit: {
    unknownNation: "Nation inconnue",
    edit: "Modifier",
    editTitle: "Change les valeurs de ce profil dans le jeu",
    startFailed: (reason: string) => `Impossible de commencer la modification : ${reason}`,
    positionRating: (position: string) => `Aptitude ${position}`,
    was: (value: string) => `avant : ${value}`,
    invalid: (min: number, max: number) => `Saisissez un nombre entier de ${min} à ${max}`,
    invalidDate: (from: string, to: string) => `Saisissez une date du ${from} au ${to}`,
    invalidMoney: (from: string, to: string) => `Saisissez un montant entier de ${from} à ${to}`,
    invalidPercentage: (from: string, to: string) => `Saisissez un pourcentage entier de ${from} à ${to}`,
    percent: "%",
    yes: "Oui",
    no: "Non",
    none: "aucun",

    footer: "Modification",
    changes: changeCount,
    invalidCount: (count: number) => `${count} invalide(s)`,
    review: "Revoir",
    reviewList: "Modifications à appliquer",
    discard: "Abandonner",
    apply: "Appliquer",
    applying: "Application…",
    applyBlocked: "Corrigez d'abord les valeurs invalides",
    done: "Terminé",
    confirmDiscard: (count: number) => `Abandonner ${nChanges(count, "modification", "modifications")} ?`,
    keepEditing: "Continuer à modifier",

    applied: (count: number) => nChanges(count, "appliquée", "appliquées"),
    nothingToChange: "Rien à changer : le jeu a déjà ces valeurs.",
    refused: (label: string, reason: string) => `${label} : ${reason}`,
    rereadFailed: (reason: string) => `Impossible de relire les valeurs : ${reason}`,
    dismiss: "Fermer",
  },

  changes: {
    nav: "Modifications",
    title: "Modifications de cette session",
    hint: "Les plus récentes d'abord. Une modification ne peut être annulée que tant que le jeu garde la valeur qu'elle a écrite.",
    continueHint: "Le jeu n'affiche une modification qu'une fois qu'il a avancé : appuyez sur Continuer dans le jeu.",
    swappedWith: (name: string) => `Échangé avec ${name}`,
    released: (name: string) => `${name} libéré(e)`,
    fee: (amount: string) => `Indemnité ${amount}`,
    optionRemoved: (amount: string) => `Option d'achat (${amount}) supprimée`,
    healed: (count: number) => (count === 1 ? "1 blessure soignée" : `${format(count)} blessures soignées`),
    lifted: (count: number) => (count === 1 ? "1 suspension levée" : `${format(count)} suspensions levées`),
    keptPlaying: (date: string | null) => (date === null ? "Continuera à jouer" : `Retraite du ${date} empêchée`),
    count: (total: number, undone: number) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${undone} annulée(s)`;
    },
    empty: "Aucune modification pour l'instant. Ouvrez un joueur, un membre du staff ou un club et choisissez Modifier, ou utilisez la modification en masse dans une liste.",
    columns: {
      time: "Heure",
      name: "Nom",
      field: "Champ",
      change: "Modification",
      status: "État",
    },
    kinds: { player: "Joueur", staff: "Staff", club: "Club" } satisfies Record<Entity, string>,
    stored: (change: string) => `stocké ${change}`,
    undone: (time: string) => `Annulée à ${time}`,
    undo: "Annuler",
    undoTitle: (label: string) => `Réécrit l'ancienne valeur de ${label} dans le jeu`,
    batch: "Modification en masse",
    batchCount: (total: number, remaining: number) =>
      remaining === 0
        ? `${changeCount(total)} · toutes annulées`
        : `${changeCount(total)} · ${format(remaining)} non annulée(s)`,
    showChanges: "Afficher les modifications",
    hideChanges: "Masquer les modifications",
    undoBatch: "Annuler la modification en masse",
    undoBatchTitle: (remaining: number) =>
      `Réécrit dans le jeu les anciennes valeurs de cette modification en masse (${format(remaining)} encore en place)`,

    pages: "Pages de la liste",
    batchPages: "Pages des modifications de cette modification en masse",
    previous: "Précédent",
    next: "Suivant",
    range: (first: number, last: number, total: number) => `${format(first)}–${format(last)} sur ${format(total)}`,
  },

  export: {
    button: "Exporter",
    buttonTitle: {
      player: "Écrit les joueurs de la liste dans un fichier CSV ou JSON, pour un tableur ou un script",
      club: "Écrit les clubs de la liste dans un fichier CSV ou JSON, pour un tableur ou un script",
    } satisfies Record<ExportEntity, string>,
    title: { player: "Exporter les joueurs", club: "Exporter les clubs" } satisfies Record<ExportEntity, string>,
    scope: (entity: ExportEntity, count: number) =>
      count === 0
        ? `Aucun ${entity === "player" ? "joueur" : "club"} ne correspond à la recherche et aux filtres.`
        : `${entityCount[entity](count)} : ce que sélectionnent la recherche et les filtres de la liste, dans son ordre.`,
    formatLabel: "Format",
    formats: {
      csv: "CSV, séparé par des virgules",
      csvSemicolon: "CSV, séparé par des points-virgules",
      json: "JSON",
    } satisfies Record<ExportFormat, string>,
    formatHints: {
      csv: "Pour la plupart des tableurs et des scripts",
      csvSemicolon: "Pour Excel quand les décimales s'écrivent avec une virgule : en français, en espagnol ou en allemand par exemple",
      json: {
        player: "Pour les scripts : postes, attributs et personnalité sous forme d'objets distincts",
        club: "Pour les scripts : supporters, installations, stade et finances sous forme d'objets distincts",
      } satisfies Record<ExportEntity, string>,
    },
    contents: {
      player:
        "Capacités, postes et aptitudes aux postes de chaque joueur, attributs sur l'échelle 1–20 (les cachés " +
        "aussi), personnalité, réputation, sélections, et contrat avec ses clauses, avec la date en jeu. L'argent est " +
        "en livres, comme le jeu le garde. Rien ne change dans le jeu.",
      club:
        "Réputation de chaque club, année de fondation, abonnements, abonnés sur les réseaux sociaux, répartition et " +
        "traits des supporters, installations, stade et finances : solde, budget transferts, masse salariale " +
        "hebdomadaire et budget salarial, et prix du billet, avec la date en jeu. FM ne garde les finances que des " +
        "clubs des championnats joués. L'argent est en livres, comme le jeu le garde. Rien ne change dans le jeu.",
    } satisfies Record<ExportEntity, string>,
    export: "Exporter",
    exporting: "Export…",
    done: (entity: ExportEntity, count: number, file: string) => `${entityCount[entity](count)} exporté(s) vers ${file}`,
    folder: (folder: string) => `dans ${folder}`,
    skipped: (entity: ExportEntity, count: number) =>
      `${entityCount[entity](count)} ${count === 1 ? "a changé" : "ont changé"} dans le jeu pendant la lecture et ` +
      `${count === 1 ? "a été écarté" : "ont été écartés"}.`,
    open: "Ouvrir",
    openTitle: "Ouvre le fichier avec l'application que votre système utilise pour lui",
    show: "Afficher dans le dossier",
    showTitle: "Affiche le fichier dans son dossier",
    close: "Fermer",
  },

  massEdit: {
    button: "Modification en masse",
    buttonTitle: "Change des valeurs de tout ce que montre la liste, avec un aperçu d'abord",
    title: {
      player: "Modification en masse des joueurs",
      staff: "Modification en masse du staff",
      club: "Modification en masse des clubs",
    } satisfies Record<Entity, string>,

    scope: (entity: Entity, total: number) =>
      `Les ${entityCount[entity](total)} que la liste montre actuellement (recherche et filtres)`,
    scopeAll: (shown: number) => `C'est chaque résultat, pas seulement les ${format(shown)} premières lignes à l'écran.`,
    scopeNone: (entity: Entity) =>
      `Aucun ${entity === "player" ? "joueur" : entity === "staff" ? "membre du staff" : "club"} ne correspond à la recherche et aux filtres : il n'y a rien à changer.`,
    scopeTooMany: (entity: Entity, total: number, limit: number) =>
      `Les ${entityCount[entity](total)} que montre la liste dépassent ce qu'une modification en masse accepte (${format(limit)}). ` +
      "Réduisez d'abord la recherche ou les filtres.",
    loadingFields: "Lecture des champs…",
    fieldsFailed: (reason: string) => `Impossible de lire les champs : ${reason}`,

    groups: {
      ability: "Capacité",
      technical: "Attributs techniques",
      mental: "Attributs mentaux",
      physical: "Attributs physiques",
      goalkeeping: "Attributs de gardien",
      hidden: "Attributs cachés",
      feet: "Pieds",
      coaching: "Attributs de coaching",
      knowledge: "Attributs de connaissances",
      medical: "Attributs médicaux",
      positions: "Postes",
      personality: "Personnalité",
      reputation: "Réputation",
      international: "International",
      contract: "Contrat",
      facilities: "Installations",
      finances: "Finances",
      stadium: "Stade",
      traits: "Particularités",
      health: "Médical",
      other: "Autre",
    },
    fieldsLabel: "Champs à modifier",
    row: (position: number) => `Modification ${position}`,
    field: "Champ",
    operation: "Opération",
    operations: { set: "Mettre à", add: "Ajouter", scale: "Échelle en %" } satisfies Record<MassOperationKind["op"], string>,
    values: { set: "Valeur", add: "Montant", scale: "Pourcentage" } satisfies Record<MassOperationKind["op"], string>,
    addTitle: "Ajouté à chaque valeur telle qu'affichée ; un nombre négatif retire",
    addPointsTitle: "Points de pourcentage ajoutés à chaque valeur (70 % plus 10 font 80 %) ; un nombre négatif retire",
    rangeHint: (min: number, max: number) => `${format(min)}–${format(max)}`,
    amountHint: (max: number) => `±${format(max)}`,
    ofCurrent: "% de l'actuel",
    percentTitle: "Un pourcentage de la valeur actuelle : 100 la garde, 110 l'augmente d'un dixième, 50 la divise par deux",
    invalidAdd: (min: number, max: number) => `Saisissez un nombre entier de ${format(min)} à ${format(max)}`,
    invalidPercent: (min: number, max: number) => `Saisissez un pourcentage entier de ${min} à ${max}`,
    dateSetOnly: "Une date ne peut qu'être définie",
    addField: "Ajouter un champ",
    addFieldFull: (max: number) => `Une modification en masse change jusqu'à ${max} champs`,
    remove: "Retirer ce champ",
    removeLast: "Une modification en masse a besoin d'au moins un champ",

    preview: "Aperçu",
    previewing: "Aperçu en cours…",
    previewBlocked: "Remplissez chaque champ avec une valeur valide pour obtenir l'aperçu",
    summary: (entity: Entity, preview: MassPreview) =>
      [
        preview.changes === 0
          ? "Aucune modification"
          : `${changeCount(preview.changes)} pour ${format(preview.targets - preview.unchanged)} sur ` +
            entityCount[entity](preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 a déjà ces valeurs"
            : `${format(preview.unchanged)} ont déjà ces valeurs`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Modifications que ferait la modification en masse",
    columns: { name: "Nom", field: "Champ", change: "Modification", reason: "Raison" },
    more: (count: number) => `et ${format(count)} de plus`,
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Valeurs que la modification en masse laisse telles quelles",

    apply: "Appliquer",
    applying: "Application…",
    applyTitle: (changes: number) => `Écrit ${changeCount(changes)} dans le jeu`,
    applyFirst: "Faites d'abord l'aperçu de la modification en masse",
    applyNothing: "L'aperçu ne contient aucune modification à écrire",
    hint: "Rien ne change dans le jeu avant d'appliquer.",
    applied: (count: number) => (count === 0 ? "Aucune modification écrite" : nChanges(count, "appliquée", "appliquées")),
    failure: (name: string, label: string, reason: string) => `${name} · ${label} : ${reason}`,
    undo: "Annuler cette modification en masse",
    undoing: "Annulation…",
    undoTitle: "Réécrit dans le jeu les anciennes valeurs de cette modification en masse",
    undone: (count: number) => (count === 0 ? "Rien n'a été annulé" : nChanges(count, "annulée", "annulées")),
    undoFailure: (who: string, reason: string) => `${who} : ${reason}`,
    changeNumber: (id: number) => `Modification ${id}`,
    close: "Fermer",
  },

  comparison: {
    compare: "Comparer",
    add: "Ajouter à la comparaison",
    remove: "Retirer de la comparaison",
    full: (max: number) => `Une comparaison contient jusqu'à ${max} joueurs. Retirez-en un pour ajouter celui-ci.`,

    trayLabel: "Joueurs à comparer",
    removePlayer: (name: string) => `Retirer de la comparaison : ${name}`,
    clear: "Vider",
    open: (count: number) => `Comparer (${count})`,

    title: "Comparaison",
    hint: "La meilleure valeur de chaque ligne est mise en évidence : la plus haute, ou la plus basse quand plus bas vaut mieux.",
    tooFew: "Ajoutez au moins deux joueurs pour les comparer.",
    loading: "Chargement des joueurs…",
    tableLabel: "Valeurs des joueurs comparés",
    highest: "la plus haute",
    lowest: "la plus basse",
    profile: "Profil",
    close: "Fermer",
  },

  move: {
    button: "Transférer",
    buttonTitle: "Transfère ce joueur vers un autre club dans le jeu, avec une indemnité si vous le souhaitez",

    title: "Transfert",
    from: "De",
    to: "Vers",

    modeLabel: "Transfert ou échange",
    modeMove: "Transfert vers un club",
    modeSwap: "Échange avec un joueur",

    searchLabel: "Rechercher le club vers lequel transférer",
    resultsLabel: "Clubs trouvés",
    searching: "Recherche de clubs…",
    searchFailed: (reason: string) => `Impossible de chercher les clubs : ${reason}`,
    more: (count: number) => `et ${format(count)} de plus ; saisissez du texte pour affiner la recherche`,
    change: "Choisir un autre club",

    feeHeading: "Indemnité",
    fee: "Indemnité de transfert",
    feeHint: "Laissez vide pour un transfert gratuit",
    feeInvalid: (max: string) => `Saisissez un montant entier, de 0 à ${max}`,
    pays: (club: string, fee: string, balance: string, budget: string | null) =>
      `${club} paie ${fee} : solde ${balance}${budget === null ? "" : `, budget transferts ${budget}`}`,
    receives: (club: string, fee: string, balance: string) => `${club} reçoit ${fee} : solde ${balance}`,
    noFinances: (club: string) => `${club} n'a pas de finances dans le jeu : son argent reste tel quel`,

    wageInvalid: "Saisissez un montant entier, 0 ou plus",
    expiresInvalid: "Saisissez une date",

    chooseClub: "Choisissez le club vers lequel transférer le joueur.",
    fixTerms: "Corrigez d'abord l'indemnité ou les valeurs du contrat.",
    checking: "Vérification du transfert…",
    route: (from: string, to: string) => `${from} → ${to}`,
    doesHeading: "Ce que fait le transfert",
    does: [
      "Rejoint l'équipe première du nouveau club",
      "Contrat daté de la date du jeu ; numéro supprimé",
      "Retiré des listes des transferts et des prêts",
      "Le salaire et la fin de contrat ne changent que si vous en indiquez de nouveaux",
      "L'indemnité est prélevée sur le solde et le budget transferts du club acheteur et versée au solde du club vendeur",
      "Un éventuel brassard de capitaine dans l'ancien club reste vacant",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Listé dans Modifications, où une seule annulation reprend le transfert et l'indemnité",
    ],

    noRoom: (club: string) => `${club} n'a plus de place dans son effectif.`,
    noRoomInfoLabel: "Pourquoi ?",
    noRoomInfo:
      "L'éditeur agrandit une liste d'effectif pleine quand il le peut, mais il ne peut pas agrandir celle-ci : un " +
      "joueur doit partir pour faire de la place.",
    noRoomNeed: (player: string, club: string) => `Pour que ${player} arrive, un joueur doit quitter ${club}.`,
    releaseChoice: "Libérer :",
    releasePickLabel: "Joueur à libérer",
    releaseOutcome: "→ devient joueur sans club",
    injuredTag: "blessé",
    captainTag: "capitaine",
    swapChoice: "En faire un échange :",
    swapChoiceOutcome: (club: string) => `ce joueur va à ${club}`,
    moveAndRelease: (name: string) => `Transférer et libérer ${name}`,
    makeRoomDoes: [
      "Rejoint l'équipe première du nouveau club, à la place du joueur libéré",
      "Le joueur libéré quitte toutes les équipes de ce club et son contrat prend fin : il est sans club",
      "Contrat daté de la date du jeu ; numéro supprimé",
      "Retiré des listes des transferts et des prêts",
      "Le salaire et la fin de contrat ne changent que si vous en indiquez de nouveaux",
      "L'indemnité est prélevée sur le solde et le budget transferts du club acheteur et versée au solde du club vendeur",
      "Un éventuel brassard de capitaine que l'un ou l'autre portait dans le club qu'il quitte reste vacant",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Listé dans Modifications comme une seule modification, où une seule annulation reprend le transfert, la libération et l'indemnité",
    ],

    swapTitle: "Échange avec un joueur",
    swapWith: "Échange avec",
    playerSearchLabel: "Rechercher le joueur avec qui échanger",
    playerSearch: "Rechercher parmi les joueurs de ce club par nom",
    playersLabel: "Joueurs trouvés",
    playersSearching: "Recherche de joueurs…",
    playersSearchFailed: (reason: string) => `Impossible de chercher les joueurs : ${reason}`,
    playersEmpty: (query: string) =>
      query === "" ? "Ce club n'a aucun joueur." : `Aucun joueur de ce club ne correspond à « ${query} ».`,
    changePlayer: "Choisir un autre joueur",

    swapContract: "Chaque joueur garde son propre contrat ; les salaires et fins de contrat ne changent pas.",
    staffButtonTitle: "Déplace ce membre du staff vers un autre club dans le jeu",
    staffChooseClub: "Choisissez le club vers lequel déplacer ce membre du staff.",
    staffContract: "Garde le poste, le salaire et la fin de contrat ; le contrat est daté de la date du jeu.",
    staffJob: "Poste",
    staffJobChoose: "Choisir un poste…",
    staffJobKept: (job: string) => `${job} (conservé)`,
    staffNewJob: "Prend le nouveau poste et garde le salaire et la fin de contrat ; le contrat est daté de la date du jeu.",
    staffDoes: [
      "Rejoint le nouveau club là où se trouve le poste : son service médical, d'entraînement ou de recrutement, ou " +
        "comme directeur sportif ou entraîneur, ce que ne prend pas un club qui en a déjà un",
      "Même salaire et même fin de contrat ; le contrat est daté de la date du jeu",
      "Un entraîneur qui quitte une équipe laisse sa place vacante, au club de la pourvoir ; le conseil d'administration est laissé au jeu",
      "Listé dans Modifications, où cela peut être annulé",
    ],
    staffSignButtonTitle: "Recrute ce membre du staff, sans club, pour un club dans le jeu",
    staffSignTitle: "Recruter un membre du staff",
    staffSignChooseClub: "Choisissez le club pour lequel le recruter.",
    staffSignChooseJob: "Choisissez le poste qu'il ou elle occupe au club.",
    staffSignTerms:
      "Laissez vide pour le salaire du membre du staff du club dont le poste ressemble le plus au sien, et un " +
      "contrat jusqu'à la fin de la saison prochaine.",
    staffSignRoute: (to: string) => `Sans club → ${to}`,
    staffSignContract: (wage: string, expires: string) => `Nouveau contrat : ${wage} par semaine jusqu'au ${expires}`,
    staffSignDoes: [
      "Rejoint le club là où se trouve le poste : son service, agrandi s'il est plein, ou comme directeur sportif ou " +
        "entraîneur s'il n'en a pas",
      "Un nouveau contrat à partir de la date du jeu, dans l'un des emplacements de contrat libres du jeu, comme le jeu en crée un",
      "Calqué sur le contrat du membre du staff du club ayant le même poste (sinon dans le même service, sinon " +
        "n'importe lequel) le plus proche de son niveau",
      "Votre salaire et votre fin de contrat, ou le salaire de ce contrat et la fin de la saison prochaine ; ni clauses ni primes",
      "Listé dans Modifications, où une seule annulation reprend tout",
    ],
    swapChooseClub: "Choisissez le club du joueur avec qui échanger.",
    swapChoosePlayer: "Choisissez le joueur avec qui échanger.",
    swapChecking: "Vérification de l'échange…",
    swapRoute: (player: string, from: string, to: string, other: string) =>
      `${player} : ${from} → ${to}\n${other} : ${to} → ${from}`,
    swapDoesHeading: "Ce que fait l'échange",
    swapDoes: [
      "Chacun rejoint l'équipe première du club de l'autre",
      "Contrats datés de la date du jeu ; numéros supprimés",
      "Les deux sont retirés des listes des transferts et des prêts",
      "Un éventuel brassard de capitaine dans leurs anciens clubs reste vacant",
      "Aucune indemnité n'est versée ; l'historique de carrière n'est pas mis à jour",
      "Listé dans Modifications comme une seule modification, qui annule les deux mouvements",
    ],

    signButtonTitle: "Recrute ce joueur sans club pour un club dans le jeu",
    signTitle: "Recruter un joueur sans club",
    signChooseClub: "Choisissez le club pour lequel recruter le joueur.",
    signChecking: "Vérification du recrutement…",
    signTerms:
      "Laissez vide pour le salaire du joueur du club le plus proche de son niveau, et un contrat jusqu'à la fin de " +
      "la saison prochaine.",
    signRoute: (to: string) => `Sans club → ${to}`,
    signContract: (wage: string, expires: string, status: string) =>
      `Nouveau contrat : ${wage} par semaine jusqu'au ${expires}, ${status}`,
    signDoesHeading: "Ce que fait le recrutement",
    signDoes: [
      "Rejoint l'équipe première du club ; une liste d'effectif pleine est agrandie",
      "Un nouveau contrat à partir de la date du jeu, dans l'un des emplacements de contrat libres du jeu, comme le jeu en crée un",
      "Calqué sur le contrat du joueur du club le plus proche de son niveau : même type de contrat et même statut dans l'effectif",
      "Votre salaire et votre fin de contrat, ou le salaire de ce joueur et la fin de la saison prochaine",
      "Ni numéro, ni prime de fidélité, ni clauses, ni primes",
      "L'historique des transferts du jeu ne le mentionne pas encore",
      "Listé dans Modifications, où une seule annulation reprend tout",
    ],
    signHint: "Rien ne change dans le jeu avant d'appuyer sur Recruter.",
    sign: "Recruter",
    signing: "Recrutement…",

    hint: "Rien ne change dans le jeu avant d'appuyer sur Transférer.",
    move: "Transférer",
    moving: "Transfert…",
    cancel: "Annuler",
    swapHint: "Rien ne change dans le jeu avant d'appuyer sur Échanger.",
    swap: "Échanger",
    swapping: "Échange…",
  },

  ties: {
    heading: "Nationalité et joueur formé localement",
    nationalities: "Nationalités secondaires",
    trainedInNation: "Formé dans le pays",
    trainedAtClub: "Formé au club",
    workPermit: "Sans permis de travail requis en",
    none: "Aucune",
    rules: {
      1: "Formé localement 15-21",
      2: "Formé localement 0-21",
      5: "Formé localement 15-21 (hors prêts)",
      10: "Formé localement 0-19 (1 an)",
    } as Readonly<Record<number, string>>,
    rule: (code: number) => `Règle de formation locale ${format(code)}`,

    change: "Modifier",
    changeTitle: "Modifie dans le jeu les nationalités secondaires et le statut de joueur formé localement de ce joueur",
    title: "Nationalité et joueur formé localement",
    hint: "Chaque modification est écrite dans le jeu tout de suite et listée dans Modifications, où elle peut être annulée.",
    full:
      "Le jeu a fait la liste de ce joueur juste assez grande pour ce qu'elle contient : une nationalité ou une " +
      "formation peut être changée ou retirée, mais pas ajoutée.",
    nationOf: (name: string) => `Nation à la place de ${name}`,
    ruleOf: (name: string) => `Règle de formation locale pour ${name}`,
    remove: "Retirer",
    removeTitle: (name: string) => `Retirer ${name}`,
    addNationality: "Ajouter une nationalité…",
    addNation: "Ajouter une nation…",
    addPermit: "Ajouter un pays sans permis nécessaire…",
    daysLeft: (days: number) => `${format(days)} jours restants`,
    permitInfoLabel: "À quoi cela sert-il ?",
    permitInfo:
      "Le jeu laisse les joueurs de l'Union européenne qui étaient en Angleterre ou en Écosse avant le Brexit y jouer " +
      "sans permis de travail, pendant un certain nombre de jours. Un joueur qui reçoit cela n'a pas non plus besoin " +
      "de permis pour jouer dans ce pays, pendant autant de jours qu'il en reste aux autres (dix ans quand personne " +
      "dans la sauvegarde ne l'a).",
    newRule: "Règle de formation locale de la nouvelle nation",
    add: "Ajouter",
    changeClub: "Changer de club",
    changeClubTitle: (name: string) => `Le faire former dans un autre club à la place de ${name}`,
    clubInsteadOf: (name: string) => `Club à la place de ${name}`,
    addClub: "Ajouter un club…",
    addClubTitle: "Le faire former dans un club de plus",
    newClub: "Nouveau club",
    pickAnother: "En choisir un autre",
    newClubRule: "Règle de formation locale du nouveau club",
    cancel: "Annuler",
    working: "Écriture dans le jeu…",
    close: "Fermer",
  },

  clauses: {
    change: "Modifier",
    changeTitle: "Modifie dans le jeu les primes et clauses de ce joueur",
    title: "Primes et clauses",
    hint: "Chaque modification est écrite dans le jeu tout de suite et listée dans Modifications, où elle peut être annulée.",
    full:
      "Le jeu a fait la liste de ce contrat juste assez grande pour ce qu'elle contient : une prime ou une clause " +
      "peut être changée ou retirée, mais une clause libératoire ne peut pas être ajoutée.",
    amountOf: (name: string) => `Montant de ${name}`,
    conditionOf: (name: string) => `Condition de ${name}`,
    save: "Enregistrer",
    remove: "Retirer",
    removeTitle: (name: string) => `Retirer ${name}`,
    addRelease: "Ajouter une clause libératoire",
    releaseAmount: "Montant de la nouvelle clause libératoire",
    add: "Ajouter",
    outOfRange: (max: string) => `Saisissez un nombre entier de 0 à ${max}.`,
    working: "Écriture dans le jeu…",
    close: "Fermer",
  },

  release: {
    button: "Libérer",
    buttonTitle: "Libère ce joueur de son club dans le jeu : il devient joueur sans club",

    title: "Libération",
    from: "Quitte",
    checking: "Vérification de la libération…",
    ready: (club: string) => `${club} → sans club`,
    doesHeading: "Ce que fait la libération",
    does: [
      "Quitte toutes les équipes du club et son contrat prend fin : un joueur sans club que n'importe quel club peut recruter",
      "Personne n'est payé",
      "Un éventuel brassard de capitaine dans le club reste vacant",
      "L'historique des transferts du jeu ne la mentionne pas",
      "Listé dans Modifications, où une seule annulation ramène le joueur avec le même contrat",
    ],

    hint: "Rien ne change dans le jeu avant d'appuyer sur Libérer.",
    release: "Libérer",
    releasing: "Libération…",
    cancel: "Annuler",
  },

  permanent: {
    title: "Rendre le prêt définitif",
    stays: "Reste à",
    leaves: "Quitte",
    checking: "Vérification…",
    doesHeading: "Ce que cela fait",
    does: [
      "Il reste là où il joue, désormais sous contrat avec ce club à partir d'aujourd'hui, aux conditions ci-dessus",
      "Il garde le numéro et le statut dans l'effectif qu'il y a",
      "Il quitte toutes les équipes de son propre club et le prêt prend fin",
      "L'historique des transferts du jeu ne le mentionne pas",
      "Listé dans Modifications comme un transfert, où une seule annulation remet le prêt",
    ],
    optionFee: (money: string) => `Rempli à partir de l'option d'achat du prêt : ${money}`,
    hint: "Rien ne change dans le jeu avant d'appuyer sur Rendre définitif.",
    confirm: "Rendre définitif",
    confirming: "En cours…",
    cancel: "Annuler",
  },

  recall: {
    title: "Rappeler de prêt",
    from: "Prêté à",
    to: "Retourne à",
    doesHeading: "Ce que fait le rappel",
    does: (parent: string) => [
      "Aujourd'hui devient le dernier jour du prêt : une fois la journée terminée, le jeu met lui-même fin au prêt",
      `Passez un jour dans le jeu et il est de retour à ${parent}`,
      "D'ici là, il est listé dans Modifications, où une annulation remet l'ancienne fin du prêt",
    ],
    termsHeading: "Dans le jeu",
    notRecallable: (parent: string) => `Le prêt ne permet pas à ${parent} de le rappeler`,
    notTerminable: "Le prêt ne peut pas être interrompu",
    worksAnyway: "Le rappel ici fonctionne quand même : il ne passe pas par le rappel du jeu, il déplace le dernier jour du prêt",
    dropsOption: (club: string, amount: string) =>
      `L'option d'achat de ${club} pour ${amount} est supprimée : sinon, à la fin du prêt, le jeu pourrait le vendre à ${club}`,
    hint: "Rien ne change dans le jeu avant d'appuyer sur Rappeler.",
    confirm: "Rappeler",
    confirming: "Rappel…",
    cancel: "Annuler",
  },

  squad: {
    teamsLabel: "Équipe",
    teams: {
      first: "Équipe première",
      b: "Équipe B",
      age: (limit: number) => `U${limit}`,
      other: (place: number) => `Équipe ${place}`,
    },
    noTeams: "Ce club n'a aucune équipe.",
    loading: "Lecture de l'effectif…",
    empty: "Aucun joueur dans cette équipe.",

    players: (count: number) => (count === 1 ? "1 joueur" : `${format(count)} joueurs`),
    averageAge: (age: string) => `âge moyen ${age}`,
    captains: (captain: string, viceCaptain: string) => `Capitaine : ${captain} · Vice-capitaine : ${viceCaptain}`,

    actionsLabel: "Actions sur toute l'équipe",
    healAll: (injured: number) => (injured === 0 ? "Tout soigner" : `Tout soigner (${format(injured)} blessé(s))`),
    healAllTitle: "Soigne toutes les blessures de tous les joueurs de cette équipe",
    healNone: "Personne n'est blessé dans cette équipe",
    liftAll: (banned: number) => (banned === 0 ? "Lever les suspensions" : `Lever les suspensions (${format(banned)} suspendu(s))`),
    liftAllTitle: "Lève toutes les suspensions de tous les joueurs de cette équipe",
    liftNone: "Personne n'est suspendu dans cette équipe",
    inspireAll: "Motiver tout le monde",
    inspireAllTitle: "Met le moral de tous les joueurs de cette équipe à 20, le maximum, et retire leurs motifs de mécontentement",
    refreshAll: "Tout régénérer",
    refreshAllTitle: "Met l'énergie et le rythme de match de tous les joueurs de cette équipe à 100 % et les repose complètement (lassitude -500)",
    maxAll: "Attributs au maximum",
    maxAllTitle:
      "Met tous les attributs de tous les joueurs de cette équipe au maximum : 20, et 1 pour la propension aux blessures et le jeu dur",
    hint: "Les actions couvrent tous les joueurs de la liste, y compris ceux prêtés. L'annulation est aussi dans la vue Modifications.",

    freezeLabel: "Figer toute l'équipe",
    freezeAttributes: "Figer les attributs",
    freezeAttributesTitle:
      "Tant que l'application est ouverte et connectée, les attributs de tous les joueurs de cette équipe ne baissent " +
      "pas : ce que le jeu enlève est remis, et les progrès comptent toujours",
    freezeFitness: "Figer énergie et rythme",
    freezeFitnessTitle:
      "Tant que l'application est ouverte et connectée, l'énergie et le rythme de match de tous les joueurs de cette " +
      "équipe ne baissent pas : ce que le jeu enlève est remis. Faites d'abord Tout régénérer pour les garder à 100 %",
    freezePositions: "Figer les postes",
    freezePositionsTitle:
      "Tant que l'application est ouverte et connectée, les aptitudes aux postes de tous les joueurs de cette équipe " +
      "restent telles quelles : une note que le jeu monte ou baisse est remise",
    frozenCount: (frozen: number, total: number) => `${format(frozen)} sur ${format(total)}`,
    freezeHint:
      "Figer couvre tous les joueurs de la liste et reste attaché à chacun où qu'il aille. L'application s'en " +
      "souvient pour cette sauvegarde.",
    frozeAttributes: (count: number) =>
      count === 0 ? "Leurs attributs étaient déjà figés" : `Attributs figés pour ${playerCount(count)}`,
    unfrozeAttributes: (count: number) => `Attributs libérés pour ${playerCount(count)}`,
    frozeFitness: (count: number) =>
      count === 0
        ? "Leur énergie et leur rythme étaient déjà figés"
        : `Énergie et rythme figés pour ${playerCount(count)}`,
    unfrozeFitness: (count: number) => `Énergie et rythme libérés pour ${playerCount(count)}`,
    frozePositions: (count: number) =>
      count === 0 ? "Leurs postes étaient déjà figés" : `Postes figés pour ${playerCount(count)}`,
    unfrozePositions: (count: number) => `Postes libérés pour ${playerCount(count)}`,

    written: (count: number) => nChanges(count, "écrite", "écrites"),
    refused: (name: string, reason: string) => `${name} : ${reason}`,
    undo: "Annuler",
    undoTitle: "Réécrit dans le jeu les anciennes valeurs de ces modifications",

    captainShort: "C",
    viceCaptainShort: "VC",
    menuLabel: (name: string) => `Brassard de ${name}`,
    menuTitle: "Brassard",
    makeCaptain: "Nommer capitaine",
    makeViceCaptain: "Nommer vice-capitaine",
    nowCaptain: (name: string) => `${name} est maintenant capitaine`,
    nowViceCaptain: (name: string) => `${name} est maintenant vice-capitaine`,
    noCaptain: "Personne n'est capitaine pour l'instant",
    noViceCaptain: "Personne n'est vice-capitaine pour l'instant",

    tableLabel: (team: string) => `Joueurs de ${team}`,
    openProfile: "Ouvrir le profil du joueur",
    columns: {
      name: "Nom",
      position: "Poste",
      age: "Âge",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "Énergie",
      matchSharpness: "Rythme",
      jadedness: "Lass.",
      morale: "Moral",
      actions: "Brassard",
    } satisfies Record<SquadSort | "actions", string>,
    sortBy: (by: string) => `Trier par ${by}`,
    sortNames: {
      name: "nom",
      position: "poste",
      age: "âge",
      currentAbility: "capacité actuelle",
      potentialAbility: "capacité potentielle",
      condition: "énergie",
      matchSharpness: "rythme de match",
      jadedness: "lassitude",
      morale: "moral",
    } satisfies Record<SquadSort, string>,

    injured: "Blessé",
    injuredTitle: (count: number) => (count === 1 ? "1 blessure" : `${format(count)} blessures`),
    banned: "Suspendu",
    bannedTitle: (count: number) => (count === 1 ? "1 suspension" : `${format(count)} suspensions`),
    onLoan: "Prêté",
    onLoanTitle: "Prêté à un autre club",
    loanee: "Prêt entrant",
    loaneeTitle: "Ici en prêt d'un autre club",
    elsewhere: "Ailleurs",
    elsewhereTitle: "Joue pour une autre équipe du club",
    frozen: "Figé",
    frozenTitle: (attributes: boolean, fitness: boolean, positions: boolean): string => {
      const frozen = [
        ...(attributes ? ["attributs"] : []),
        ...(fitness ? ["énergie", "rythme de match"] : []),
        ...(positions ? ["postes"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} et ${last}` : last;
      return `Figé : ${listed}`;
    },
  },

  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Boutique inconnue",
    } satisfies Record<Storefront, string>,
    steamBuild: (id: string) => `build ${id}`,
  },

  scouting: {
    nav: "Recrutement",
    reading: "Lecture de votre club…",
    refresh: "Actualiser",
    refreshTitle: "Relit le club depuis le jeu",
    searching: "Recherche…",
    none: "—",
    perWeek: "/sem.",
    openProfile: "Ouvrir le profil",
    freeAgent: "Sans club",
    loan: "Prêt",
    header: {
      transferBudget: "Budget transferts",
      wageRoom: "Marge salariale",
      wageBudget: "Budget salarial",
      squad: "Effectif",
      averageAge: "Âge moyen",
      players: (count: number) => (count === 1 ? "1 joueur" : `${format(count)} joueurs`),
    },
    tabs: {
      label: "Sections du recrutement",
      recommend: "Conseils de transfert",
      depth: "Profondeur d'effectif",
      departures: "Joueurs à laisser partir",
    },
    status: {
      missing: "Manquant",
      thin: "Juste",
      fine: "Correct",
      crowded: "Surchargé",
    },
    lines: {
      goalkeeper: "Gardien",
      centreBack: "Défenseur central",
      fullBack: "Latéral",
      wingBack: "Piston",
      defensiveMidfield: "Milieu défensif",
      centralMidfield: "Milieu central",
      attackingMidfield: "Milieu offensif",
      wide: "Ailier",
      striker: "Attaquant",
    },
    depthLines: {
      gk: "Gardiens",
      dc: "Défenseurs centraux",
      rightBack: "Latéraux droits",
      leftBack: "Latéraux gauches",
      dm: "Milieux défensifs",
      mc: "Milieux centraux",
      rightWing: "Ailiers droits",
      leftWing: "Ailiers gauches",
      amc: "Milieux offensifs",
      st: "Attaquants",
    } as Record<string, string>,
    positionTip: (line: string, count: number, target: number, status: string) =>
      `${line} : ${format(count)} dans l'effectif (en général ${format(target)}) — ${status}`,
    brief: {
      heading: "Que cherchez-vous ?",
      pitch: "Poste",
      legend: "Les points montrent l'état de l'effectif sur chaque ligne.",
      inPossession: "Avec le ballon",
      outOfPossession: "Sans le ballon",
      anyRole: "Tous — meilleur rôle pour chaque joueur",
      purpose: "Pour",
      filters: "Filtres",
      minAge: "Âge min",
      maxAge: "Âge max",
      maxFee: "Indemnité max",
      minProbability: "Probabilité",
      anyProbability: "Toutes",
      noFreeAgents: "Pas de joueurs sans club",
    },
    purposes: {
      firstTeam: "Équipe première",
      rotation: "Rotation",
      future: "Avenir",
      any: "Tous",
    },
    purposeTips: {
      firstTeam: "Meilleur que votre meilleur joueur à ce poste",
      rotation: "Aussi bon que votre deuxième choix, à un prix raisonnable",
      future: "21 ans ou moins, avec une marge de progression",
      any: "Tous ceux qui conviennent",
    },
    ask: {
      before: "Conseils pour ",
      after: "",
      anyRole: "meilleur rôle par joueur",
    },
    own: {
      heading: "Dans votre effectif",
      empty: "Personne dans votre effectif ne joue ici.",
      position: "Poste",
    },
    summary: (candidates: number, eligible: number, shown: number, purpose: string) =>
      `${format(candidates)} joueurs peuvent jouer ici · ${format(eligible)} correspondent à ${purpose} · ${format(shown)} recommandés`,
    how: {
      label: "Comment cette liste est-elle établie ?",
      note: (rule: string, count: string) =>
        `Le recruteur examine chaque joueur capable de jouer à ce poste (note de 10 ou plus à ce poste), en écartant les joueurs de votre propre club et ceux des autres entraîneurs humains. Parmi eux, il garde ceux qui ${rule}. Pour les 400 qui conviennent le mieux, il estime la probabilité que chacun vous rejoigne, puis recommande les ${count} meilleurs selon l'adéquation et la probabilité combinées. Ordre recommandé : 70 % d'adéquation et 30 % de probabilité, un peu moins pour les joueurs de plus de 30 ans ; Rotation pèse les deux de la même façon et Avenir compte aussi le potentiel. Cliquez sur le titre d'une colonne pour trier la liste ; # est l'ordre du recruteur.`,
    },
    purposeRules: {
      firstTeam: "conviennent mieux au poste que votre meilleur joueur à ce poste",
      rotation: "conviennent au moins aussi bien que votre deuxième choix",
      future: "ont 21 ans ou moins avec une marge de progression (potentiel d'au moins 15 de plus que la capacité)",
      any: "conviennent un tant soit peu",
    },
    sortBy: (by: string) => `Trier par ${by}`,
    sortNames: {
      rank: "l'ordre du recruteur",
      name: "nom",
      age: "âge",
      ca: "capacité actuelle",
      pa: "capacité potentielle",
      fit: "adéquation",
      probability: "probabilité",
      fee: "indemnité",
    },
    backToScoutOrder: "Revenir à l'ordre du recruteur",
    showMore: (count: number) => `Afficher ${format(count)} de plus`,
    playsFor: (club: string) => `joue pour ${club}`,
    empty: "Aucun conseil pour ce poste avec ces réglages. Essayez le but Tous ou des filtres plus larges.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "Joueur",
      age: "Âge",
      fit: "Adéq.",
      role: "Rôle",
      probability: "Probabilité",
      fee: "Indemnité est.",
      wage: "Salaire",
      note: "Note du recruteur",
      money: "Indemnité",
      value: "Valeur",
    },
    probabilityInfo:
      "La probabilité que le joueur rejoigne votre club — une estimation à partir de sa valeur, de son contrat, de son club et de sa réputation.",
    probabilityInfoLabel: "Qu'est-ce que la probabilité ?",
    fitTitle: (inPossession: string | null, outOfPossession: string | null, position: string) =>
      [
        inPossession !== null && `Avec le ballon : ${inPossession}`,
        outOfPossession !== null && `Sans le ballon : ${outOfPossession}`,
        `Poste : ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "L'adéquation utilise les pondérations d'attributs de l'éditeur pour chaque rôle ; indemnités, salaires et probabilités sont des estimations.",
    depth: {
      summary: (size: number, age: string | null, level: string) =>
        `${format(size)} joueurs${age === null ? "" : ` · âge moyen ${age}`} · capacité moyenne des onze meilleurs ${level}`,
      weak: "Sous le niveau de l'effectif",
      ageing: "Vieillissant",
      cover: (names: string) => `Peut aussi jouer ici : ${names}`,
      advice: "Obtenir des conseils",
      adviceTitle: "Conseils de transfert pour cette ligne",
      empty: "Personne",
      ability: "Capacité actuelle",
      more: (count: number) => `+${format(count)} de plus`,
      columns: {
        line: "Ligne",
        status: "État",
        count: "Joueurs",
        players: "Meilleurs d'abord (capacité)",
        cover: "Peut aussi jouer ici",
        age: "Âge moy.",
      },
      countTitle: (count: number, target: number) =>
        `${format(count)} joueurs dont le meilleur poste est sur cette ligne ; un effectif en compte en général ${format(target)}`,
      statusHelp: {
        missing: "Personne ne joue ici.",
        thin: "Moins qu'un effectif n'en compte en général ; les joueurs qui peuvent suppléer comptent pour moitié.",
        fine: "À peu près ce qu'un effectif compte en général.",
        crowded: "Deux joueurs ou plus au-delà de ce qu'un effectif compte en général.",
      },
      attention: "À surveiller :",
      allFine: "Toutes les lignes semblent équilibrées.",
    },
    departures: {
      intro: "Les joueurs que votre recruteur laisserait partir, les plus urgents d'abord.",
      filter: "Conseil",
      all: "Tous",
      empty: "Votre recruteur ne laisserait partir personne pour l'instant.",
      sortNames: {
        rank: "l'ordre du recruteur",
        name: "nom",
        age: "âge",
        ca: "capacité actuelle",
        pa: "capacité potentielle",
        value: "valeur",
        wage: "salaire",
        contract: "fin de contrat",
      },
      columns: {
        player: "Joueur",
        age: "Âge",
        ability: "Capacité",
        value: "Valeur",
        wage: "Salaire",
        contract: "Contrat jusqu'au",
        advice: "Conseil",
        reasons: "Raisons",
      },
      actions: { sell: "Vendre", loan: "Prêter", release: "Libérer" },
      rank: (line: string, rank: number) => `${line} · ${rank}${rank === 1 ? "er" : "e"}`,
    },
    roles: {
      bgk: "Gardien relanceur",
      ngk: "Gardien classique",
      sk: "Gardien libéro",
      lhk: "Gardien sur sa ligne",
      cb: "Défenseur central",
      bcb: "Défenseur central relanceur",
      ncb: "Défenseur central strict",
      acb: "Défenseur central avancé",
      ocb: "Défenseur central à dépassement",
      scb: "Défenseur central à l'attaque du ballon",
      ccb: "Défenseur central en couverture",
      wcb: "Défenseur central excentré",
      fb: "Latéral",
      ifb: "Latéral inversé",
      pfb: "Latéral pressing",
      hfb: "Latéral prudent",
      wb: "Piston",
      iwb: "Piston inversé",
      pwb: "Piston créateur",
      awb: "Piston avancé",
      hwb: "Piston prudent",
      dm: "Milieu défensif",
      hb: "Demi défensif",
      ddm: "Milieu défensif décroché",
      pdm: "Milieu défensif pressing",
      bbm: "Milieu de surface à surface",
      bbp: "Meneur de surface à surface",
      cm: "Milieu central",
      pcm: "Milieu central pressing",
      scm: "Milieu central de couverture",
      chm: "Milieu de couloir",
      wcm: "Milieu central excentré",
      ap: "Meneur de jeu offensif",
      am: "Milieu offensif",
      oam: "Milieu offensif de soutien",
      w: "Ailier",
      if: "Attaquant intérieur",
      pw: "Ailier créateur",
      wfd: "Attaquant de côté",
      tw: "Ailier de repli",
      iow: "Ailier intérieur de soutien",
      cfd: "Avant-centre",
      dlf: "Attaquant en retrait",
      p: "Renard des surfaces",
      tcf: "Avant-centre de repli",
      ocf: "Avant-centre de soutien",
    } as Record<string, string>,
    reasons: {
      listed: () => "Sur la liste des transferts",
      freeAgent: () => "Sans club",
      expiring: (value: string) => `Contrat se terminant dans ${value} jours`,
      releaseClause: (value: string) => `Clause libératoire ${value}`,
      fringe: () => "Pas titulaire dans son club",
      keyPlayer: () => "Joueur clé dans son club",
      unwanted: () => "Indésirable dans son club",
      overBudget: (value: string) => `${value} au-dessus de votre budget`,
      stretch: (value: string) => `Juste au-dessus du budget (+${value})`,
      wageHigh: (value: string) => `Salaire ${value}/sem. au-dessus de votre marge`,
      biggerClub: () => "Joue dans un plus grand club",
      smallerClub: () => "Joue dans un plus petit club",
      reputationGap: () => "Trop grand nom pour votre club",
      ambitious: () => "Ambitieux : accueillerait bien un cran de plus",
      notForSale: () => "Pas à vendre",
    } as Record<string, (value: string) => string>,
    departureReasons: {
      surplus: (value: string) => `Ligne surchargée (${value} joueurs)`,
      belowLevel: () => "Sous le niveau de l'effectif",
      ageing: (value: string) => `Prend de l'âge (${value})`,
      expiring: (value: string) => `Contrat se terminant dans ${value} jours`,
      highWage: (value: string) => `Salaire élevé pour son rôle (${value}/sem.)`,
      unhappy: () => "Mécontent",
      lowMorale: () => "Moral bas",
      blocked: () => "A besoin de jouer pour progresser",
      unwanted: () => "Statut dans l'effectif : indésirable",
      listed: () => "Déjà sur la liste des transferts",
    } as Record<string, (value: string) => string>,
  },

  errors,
};
