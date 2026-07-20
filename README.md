# Programmation cinéma

Application Next.js + Prisma/Postgres pour programmer manuellement le planning
d'un cinéma (2 salles), sous forme de frise horaire glisser-déposer.

## Structure du projet
- `prisma/schema.prisma` — modèle de données : `Film` et `Placement` uniquement.
- `lib/planning-utils.ts` — fonctions pures partagées (conversion d'heures,
  détection de chevauchement) entre le client (frise) et les routes API.
- `lib/prisma.ts` — client Prisma singleton
- `app/api/films/` — CRUD films
- `app/api/placements/` — CRUD des séances placées manuellement
- `app/films/` — gestion des films (titre, durée, classification)
- `app/programmation/` — unique page de planification : frise horaire, 2 salles, glisser-déposer

Il n'y a plus de génération automatique ni de page « Générer ». Toute la
programmation se fait à la main dans l'onglet Programmation.

## Mise en place

### 1. Installer et lancer en local
```powershell
npm install
npm run dev
```

### 2. Base de données (Neon via Vercel, ou toute base Postgres)
```powershell
npx prisma migrate dev
```
Si tu repars d'une base v9 existante, la migration `v10_suppression_generation`
est **destructive** : elle supprime la table `Seance` (résultat de l'ancienne
génération auto) et la colonne `Film.seancesParSemaine`. `Placement` (programmation
manuelle) n'est pas touché.

### 3. GitHub → Vercel
Push sur GitHub, importer le projet sur Vercel (Root Directory vide, Framework
Preset = Next.js), `DATABASE_URL` injecté par l'intégration Neon (ou définie
manuellement dans les variables d'environnement du projet Vercel).

**Important pour le déploiement** : `npm run build` ne fait que `prisma generate`
(génère le client TypeScript), il n'applique **pas** les migrations sur la base
de production. Avant — ou juste après — le premier déploiement Vercel avec ce
schéma, exécute une fois, avec `DATABASE_URL` pointant vers la base de prod :
```powershell
npx prisma migrate deploy
```
Sans cette étape, l'app déployée pointera vers une base dont le schéma ne
correspond pas au code (colonne/table encore présentes ou manquantes) et les
routes `/api/films` et `/api/placements` échoueront.

## Comment fonctionne la programmation

- 2 salles fixes.
- N'importe quel film peut être placé à n'importe quelle heure, dans n'importe
  quelle salle, n'importe quel jour — tous les jours sont traités de la même
  façon (aucune exception, aucun horaire imposé).
- Seule contrainte : deux films ne peuvent pas se chevaucher dans une même
  salle. Un film peut commencer exactement à la minute où le précédent se
  termine (pas de marge minimale imposée).
- Les séances sont réparties sur 2 semaines indépendantes (1 et 2), chacune
  avec ses propres placements.

## Points ouverts
- Cascade de suppression toujours active sur `Placement` : retirer un film
  retire ses séances déjà placées.
- Pas de limite sur le nombre de fois qu'un film peut être placé (plus de
  quota) : c'est voulu, la contrainte est désormais purement horaire.
