# v8 — à lire avant d'appliquer

## Fichiers à SUPPRIMER de ton repo
- `app/page.tsx` (Accueil) → remplacé par la version fournie ici (redirection).
- `prisma/seed.mjs` → déjà mort (référence `prisma.salle`, `prisma.bloc`, etc. qui
  n'existent plus dans ton `schema.prisma` v7). Les événements spéciaux vivent
  maintenant dans `lib/scheduler.ts` (`EVENEMENTS_SPECIAUX`), en code.
- Le dossier `migrations/` à la racine (celui contenant `20260717091919_init`)
  semble être un doublon orphelin de `prisma/migrations/` — Prisma ne lit que
  `prisma/migrations/` par défaut. Vérifie avant de le supprimer, mais tel quel
  il n'est probablement jamais exécuté.

## Fichiers à AJOUTER / REMPLACER
Tous les fichiers de ce dossier, aux mêmes chemins relatifs :
- `prisma/schema.prisma` (remplace)
- `prisma/migrations/20260719130000_v8_semaines_quotas/migration.sql` (ajoute)
- `lib/scheduler.ts` (remplace)
- `app/api/generer/route.ts` (remplace)
- `app/generer/page.tsx` (remplace)
- `app/api/films/route.ts` (remplace)
- `app/films/page.tsx` (remplace)
- `app/page.tsx` (remplace, voir suppression ci-dessus)
- `app/layout.tsx` (remplace)
- `app/api/placements/route.ts` (remplace)
- `app/api/placements/[id]/route.ts` (remplace)
- `app/programmation/page.tsx` (remplace)

## Après copie
```powershell
npx prisma migrate dev --name v8_semaines_quotas
npx prisma generate
npm run dev
```
La migration est **destructive** : elle supprime la table `Semaine` et recrée
`Seance` sans `semaineId`. Toute séance déjà générée automatiquement est perdue.
Sans conséquence en dev (comme la migration précédente).

## Ce qui n'a PAS été implémenté (limites connues, à discuter si besoin)
- Un événement spécial ne peut remplacer qu'un bloc ENTIER (les 2 salles à la
  fois). Le cas "réserver une seule salle" mentionné dans le cahier des charges
  n'est pas géré — extension prévue dans `EvenementSpecial` (ajouter un champ
  `salleIndex?: number`).
- Le regroupement "Après-midi : 15h30/15h45/18h00/18h15" a été interprété comme
  les blocs `aprem`+`soir1` existants réunis (aucune valeur d'horaire changée).
  À confirmer.
- Aucune marge de battement minimale n'est imposée entre deux films d'une même
  salle au-delà du non-chevauchement strict (`MARGE_MIN_ENTRE_FILMS = 0` dans
  `lib/scheduler.ts`) — à ajuster si tu veux un temps de nettoyage garanti.
