# V10 — à lire avant d'appliquer

Cette version part de la V9. Elle supprime intégralement la génération
automatique, les événements spéciaux, les quotas hebdomadaires et la marge
minimale entre films. L'application ne fait plus que de la programmation
manuelle.

## Fichiers SUPPRIMÉS
- `app/generer/` (page) et `app/api/generer/route.ts` — onglet Générer et son API.
- `lib/scheduler.ts` — moteur de génération automatique.
- `lib/scheduler-config.ts` — blocs/horaires de référence/événements spéciaux
  (Ciné P'tit Déj, réservations de salle, restrictions de public par jour).
- `scheduler.ts` (racine du repo) — ancienne version (v3) du moteur, déjà morte
  et non importée nulle part ; doublon de l'ancien `lib/scheduler.ts`.
- `prisma/seed.mjs` — déjà mort depuis la v8 (référence des tables `Salle`,
  `Bloc`, etc. qui n'existent plus).
- Modèle Prisma `Seance` (ne servait qu'au résultat de la génération auto).
- Champ Prisma `Film.seancesParSemaine`.
- Constante `MARGE_MIN_ENTRE_FILMS` et le paramètre `marge` dans
  `seChevauchent`/`trouverConflit` (`lib/planning-utils.ts`) : deux séances
  peuvent désormais s'enchaîner sans battement.

## Fichiers REMPLACÉS
- `prisma/schema.prisma` — plus que `Film` (sans quota) et `Placement`.
- `prisma/migrations/20260720100000_v10_suppression_generation/migration.sql`
  — **destructif** : `DROP TABLE "Seance"` + `ALTER TABLE "Film" DROP COLUMN
  "seancesParSemaine"`. `Placement` n'est pas touché.
- `lib/planning-utils.ts` — `seChevauchent`/`trouverConflit` ne vérifient plus
  qu'un chevauchement strict (bDebut === aFin est valide).
- `app/api/films/route.ts`, `app/films/page.tsx` — plus de champ/validation de quota.
- `app/api/placements/route.ts`, `app/api/placements/[id]/route.ts` — plus de
  vérification d'événement spécial ni de marge ; seul le chevauchement est
  contrôlé.
- `app/programmation/page.tsx` — plus d'affichage "X / Y séances restantes",
  plus de désactivation de la palette quand le quota est atteint (il n'y en a
  plus). La page charge désormais les placements du jour sélectionné
  directement (`GET /api/placements?semaine=&jour=`) au lieu de charger toute
  la semaine pour recalculer un compteur qui n'existe plus.
- `app/layout.tsx` — lien "Générer" retiré de la navigation.
- `README.md` — mis à jour.
- `app/globals.css` — règles `.grille-affiche` / `.horaire-matin` /
  `.horaire-normal` retirées (n'étaient utilisées que par la page Générer).

## Fichiers INCHANGÉS depuis la V9
- `app/page.tsx` (redirection vers `/films`), `lib/prisma.ts`, `tsconfig.json`,
  `next.config.mjs`, `.gitignore`, `package.json`/`package-lock.json`.

## Après copie
```powershell
npx prisma migrate dev --name v10_suppression_generation
npx prisma generate
npm run dev
```

## Déploiement Vercel
Le script `build` (`prebuild` → `prisma generate`) ne fait **que** générer le
client Prisma ; il n'exécute pas les migrations. `postinstall` fait aussi
`prisma generate`, jamais `migrate deploy`. Sur une base de prod déjà en V9
(Neon ou autre), lance manuellement, une seule fois, avec `DATABASE_URL` de
prod :
```powershell
npx prisma migrate deploy
```
avant de considérer le déploiement fonctionnel — sinon les routes API
échoueront contre un schéma désynchronisé (colonne/table absente côté code,
encore présente côté base, ou l'inverse).

## Limites connues / points à trancher
- Il n'y a plus de garde-fou empêchant de placer le même film 50 fois dans la
  même salle le même jour tant que ça ne chevauche rien — c'est le
  comportement demandé (plus de quota), mais à confirmer si ce n'était pas
  voulu pour un usage réel.
- La migration V10 est destructive sur `Seance` : si des séances générées
  automatiquement doivent être conservées comme archive, exporte-les avant
  d'appliquer la migration.
