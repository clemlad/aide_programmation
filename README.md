# Programmation cinéma

Application Next.js + Prisma/Postgres pour générer automatiquement le planning hebdomadaire d'un cinéma (2 salles, 4 blocs horaires fixes par jour) sous forme de tableau jour × film.

## Structure du projet
- `prisma/schema.prisma` — modèle de données : seulement `Film`, `Semaine`, `Seance`. Salles et horaires ne sont plus des tables — ce sont des constantes dans le code.
- `lib/scheduler.ts` — algorithme de placement automatique. **C'est le seul endroit où salles/blocs/horaires sont définis** (constantes `BLOCS`, `NB_SALLES` en tête de fichier).
- `lib/prisma.ts` — client Prisma singleton
- `app/api/films/` — CRUD films
- `app/api/generer/` — génère et sauvegarde le planning
- `app/generer/` — unique page d'usage : films, quotas de séances, semaines, tableau résultat

Il n'y a plus de page "Réglages". Pour changer les horaires de base, les salles ou les blocs, il faut éditer les constantes en haut de `lib/scheduler.ts` directement.

## Mise en place

### 1. Installer et lancer en local
```powershell
npm install
npm run dev
```

### 2. Base de données (Neon via Vercel)
```powershell
npx prisma migrate dev --name v6_suppression_reglages
```
**Attention** : cette migration supprime les tables `Salle`, `Bloc`, `BlocHoraireDefaut`, `ExceptionHoraire` et change la structure de `Seance`. Si tu as des séances de test déjà générées avec l'ancien modèle, elles seront perdues — sans conséquence si c'est encore un environnement de dev.

### 3. GitHub → Vercel
Inchangé par rapport aux étapes précédentes : push sur GitHub, importer le projet sur Vercel (Root Directory vide, Framework Preset = Next.js), `DATABASE_URL` injecté par l'intégration Neon.

## Comment fonctionne la génération

**Horaires de base** (dans `lib/scheduler.ts`, constante `BLOCS`) :
| Bloc | Salle 1 | Salle 2 |
|---|---|---|
| matin | 11h00 | 11h00 |
| aprem | 15h30 | 15h45 |
| soir1 | 18h00 | 18h15 |
| soir2 | 20h45 | 21h00 |

Un seul film par (jour, salle, bloc) — pas d'enchaînement libre à l'intérieur d'un bloc.

**Ajustement automatique** : si l'horaire de base d'un bloc est trop proche de la fin du film du bloc précédent (même salle, même jour), l'horaire est décalé de +15 min ; si ça ne suffit toujours pas, +30 min. Le plus petit décalage suffisant est toujours choisi. Marge de battement désirée : 15 min (constante `MARGE_SOUHAITEE_MIN`, **[Guessing]**, à ajuster si ce n'est pas la bonne valeur).

**Classification et créneaux** :
- Un film "tous publics" ne joue jamais sur le bloc `soir2` (dernière séance du soir).
- Les blocs du soir (`soir1`, `soir2`) sont prioritaires pour les films classifiés (12/16/18) ; les blocs de jour (`matin`, `aprem`) sont prioritaires pour les films tous publics.
- C'est une préférence, pas une règle stricte : si aucun film approprié n'a de quota restant sur un bloc, un film moins approprié peut y être placé pour honorer une forte demande de séances.

## Points encore ouverts
- Marge de battement (15 min) et paliers de décalage (0/15/30) non exposés dans l'UI — modifiables seulement dans le code.
- Pas de gestion des événements spéciaux ("Ciné P'tit Dej"), ni de l'exception saisonnière (jeudi été / films enfants) présente dans une version précédente — supprimée avec Réglages. À recoder en dur dans `scheduler.ts` si toujours nécessaire.
- Cascade de suppression toujours active sur `Seance` : retirer un film retire ses séances déjà générées.
