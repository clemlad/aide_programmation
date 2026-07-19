# V9 — à lire avant d'appliquer

Cette version part de la V8 déjà livrée (deux semaines indépendantes, Accueil
supprimé). Elle ajoute : marge configurable partagée manuel/auto, événements
spéciaux par salle, quota obligatoire.

## Fichiers NOUVEAUX
- `lib/scheduler-config.ts` — blocs, horaires, événements spéciaux : la config
  unique importée à la fois par le générateur automatique ET par l'API de
  programmation manuelle (`app/api/placements/*`), pour garantir des règles
  métier identiques des deux côtés (demande explicite du cahier des charges).

## Fichiers REMPLACÉS
- `lib/planning-utils.ts` — ajout de `MARGE_MIN_ENTRE_FILMS` (15 min par défaut,
  à changer ici si besoin d'une autre valeur) et prise en compte de cette marge
  dans `seChevauchent`/`trouverConflit`. C'est la fonction utilisée à la fois par
  la frise (drag & drop) et par le générateur — un seul endroit à modifier pour
  changer la marge partout.
- `lib/scheduler.ts` — consomme `scheduler-config.ts`, gère les événements par
  salle et la réservation (`reserve: true`).
- `prisma/schema.prisma` — `Film.seancesParSemaine` n'a plus de `@default(0)`.
- `prisma/migrations/20260719150000_v9_marge_evenements_quota_obligatoire/migration.sql`
- `app/api/films/route.ts` — quota obligatoire (entier ≥ 1), validé côté serveur.
- `app/films/page.tsx` — champ quota marqué requis côté formulaire.
- `app/api/placements/route.ts` et `app/api/placements/[id]/route.ts` — vérifient
  désormais les événements spéciaux (réservation de salle / restriction de
  public) et appliquent la marge partagée avant d'accepter un placement manuel.

## Fichiers INCHANGÉS depuis la V8 (toujours valables)
- `app/generer/page.tsx`, `app/programmation/page.tsx`, `app/page.tsx`,
  `app/layout.tsx` — aucune modification nécessaire : ils héritent
  automatiquement de la marge et des événements via les fonctions partagées.

## Comment ajouter un nouvel événement spécial
Une seule entrée à ajouter dans `EVENEMENTS_SPECIAUX` (`lib/scheduler-config.ts`) :
```ts
{
  id: "mon-evenement",
  nom: "Nom affiché dans les messages d'erreur",
  jours: ["VENDREDI"],           // un ou plusieurs jours
  blocsConcernes: ["soir1"],     // un ou plusieurs blocs
  salles: [0],                   // optionnel : absent = les 2 salles
  heureDebut: "19:00",           // optionnel : absent = horaire de référence gardé
  reserve: true,                 // optionnel : bloque la salle, aucun film
  publicAutorise: "TOUS_PUBLIC", // optionnel
  actif: true,
}
```
Rien d'autre à toucher : le générateur automatique et l'API de placement manuel
le prennent en compte immédiatement.

## Après copie
```powershell
npx prisma migrate dev --name v9_marge_evenements_quota_obligatoire
npx prisma generate
npm run dev
```

## Limites connues / points à trancher
- [Guessing] La fenêtre d'application d'un événement en mode manuel (fonction
  `fenetresEvenements`) est approximée par les bornes du bloc concerné
  (horaire de référence − 30 min jusqu'au début du bloc suivant). Un placement
  manuel très en dehors de ces bornes ne sera pas soumis à la règle de
  l'événement, même s'il tombe le bon jour. À resserrer si besoin.
- Les films déjà existants avec `seancesParSemaine = 0` (hérités de la V8) ne
  sont pas corrigés automatiquement par la migration — repasse dans l'onglet
  Films pour leur donner un quota ≥ 1, sinon ils seront silencieusement exclus
  de la génération automatique et de la palette de programmation manuelle.
- La marge de 15 min est une constante unique pour tout le cinéma, pas
  configurable par salle ou par bloc — dis-le-moi si tu as besoin de plus fin.
