# Base de données française FM27 (indépendante de l'éditeur live)

Objectif : une base FM27 couvrant toute la pyramide française, jusqu'au Départemental, pour démarrer une carrière dans un club de district. Les données vivent dans des CSV relisibles ; un générateur les compile vers le format que lira l'éditeur de données officiel du jeu.

## Ce qui est établi / pas établi

- Établi : l'éditeur live (ce dépôt) ne peut ni créer de clubs ni de ligues ; il modifie la mémoire d'entités existantes. Voir `docs/roadmap.md`.
- Établi (FM26) : le Pre-Game Editor officiel crée clubs et ligues, avant une nouvelle partie (source : footballmanagerblog.org, article sur les éditeurs de FM26).
- NON vérifié pour FM27 : existence et format exact du Pre-Game Editor, extension des fichiers, nombre de niveaux de ligue supportés par le moteur. Les pages SI Forums et sortitoutsi n'ont pas pu être lues depuis cet environnement.
- NON vérifié : ce que FRMO (le mod français existant) contient pour FM27. Son contenu ne sera pas copié sans accord de ses auteurs ; ici on repart des sources publiques (FFF, ligues, districts).
- Le jeu de base contient déjà plusieurs centaines de clubs français (joueurs répartis sur ~1000 clubs dans `players-2026-09-10.json`, jusqu'au bas de la pyramide semi-pro). Le trou à combler est : Régional 2-3 et Départemental.

## Architecture des données

Dossier `france-db/data/`, une table par fichier, clés stables en texte (`slug`) :

| Fichier | Contenu | Clé |
|---|---|---|
| `pyramide.csv` | niveaux (L1 à Départemental 4), nb de groupes, nb de clubs/groupe, montées/descentes, type de compétition | `level` |
| `ligues_regionales.csv` | ligues régionales FFF, siège, districts rattachés | `ligue_id` |
| `districts.csv` | ~90 districts, ligue de rattachement, département | `district_id` |
| `competitions.csv` | championnats par groupe et saison (nom, niveau, ligue/district, format) | `comp_id` |
| `clubs.csv` | nom, ville, année de fondation, couleurs, district, `comp_id` actuel, réputation, installations | `club_id` |
| `stades.csv` | nom, ville, capacité, surface, club résident | `stade_id` |
| `regles.csv` | règles par compétition : barrages, accessions, relégations, repêchages, équipes réserves, montée des équipes B bloquée, etc. | `regle_id` |
| `coupes.csv` | Coupe de France (tours, entrée des niveaux, tirage), coupes régionales et de district | `coupe_id` |

Références par id uniquement (pas de noms recopiés). Un script de validation vérifie : un club = un stade ou NULL, chaque groupe a le bon nombre de clubs, chaque montée/descente a une cible.

## Particularités françaises à modéliser

1. Pyramide : L1 (18), L2 (18), National 1 (18), National 2 (4 poules de 16), National 3 (12 poules de 14), Régional 1 / 2 / 3 par ligue, puis Départemental 1-4 par district. Les effectifs réels de poules varient selon la ligue et la saison : à relever dans les textes de chaque ligue.
2. Montées/descentes : tables de passage entre niveaux dépendant de la ligue ; équipes réserves exclues de la montée dans les championnats nationaux ; repêchages selon les descentes d'en haut.
3. Coupe de France : entrée par tours selon le niveau, tirage par ligue, clubs d'outre-mer.
4. Statuts : pro / semi-pro / amateur, DNCG pour L1-L2-N1, obligation statut des joueurs en National.
5. Format de saison : août à mai pour les régionaux, calendrier propre au Départemental.

## Chaîne de génération

1. `france-db/data/*.csv` (source de vérité, relue à la main).
2. `tools/france_db/validate.py` (à écrire) : contrôles d'intégrité.
3. `tools/france_db/build.py` (à écrire) : convertit vers l'import de l'éditeur de données, une fois le format confirmé.
4. Réutilisation du dossier projet : `players-*.json` donne la liste des clubs déjà présents et les nationalités, pour éviter les doublons de noms ; `grenoble/` ne sert qu'à tester l'import.

## Bloquants

1. Confirmer que le Pre-Game Editor FM27 est installé chez Many, et obtenir un export/échantillon de ses fichiers (ou des captures) : sans cela, impossible de produire le fichier final.
2. Savoir si le moteur accepte une pyramide aussi profonde (Départemental) dans une nouvelle compétition, ou s'il faut fusionner des niveaux.
3. Sources fiables par ligue : les listes de clubs du Départemental sont sur les sites des districts ; collecte lourde (~15 000 clubs en France), à faire par ligue, commençant par l'Isère puisque la carrière démarre au niveau départemental.
4. Décision de Many : couvrir tout le territoire d'un coup ou une ligue pilote (Auvergne-Rhône-Alpes, Isère) d'abord. Recommandation : pilote.

## Prochaines étapes

- Valider le plan avec Many.
- Remplir `districts.csv` pour toute la France (liste publique, ~90 lignes).
- Pilote Isère : collecter les clubs D1-D4 depuis le site du district, remplir `clubs.csv`.
- Écrire `validate.py`, puis `build.py` après obtention du format.
