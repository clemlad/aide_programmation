# Programmation cinéma — base du projet

## Ce qui est fourni ici
- `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx` — squelette Next.js minimal qui affiche réellement une page (sans ça, Vercel build sans rien à servir et renvoie 404)
- `prisma/schema.prisma` — modèle de données (Film, Salle, Bloc, BlocHoraireDefaut, ExceptionHoraire, Semaine, Séance)
- `lib/scheduler.ts` — algorithme de placement automatique (quotas par film, blocs par salle, exceptions jour/saison)

Il manque encore : les pages "Réglages" et "Générer", l'API qui appelle `genererPlanning`, et la connexion réelle à la base de données.

## Étapes de mise en place

### 1. Récupérer le projet
Copie tous les fichiers fournis (`package.json`, `tsconfig.json`, `next.config.mjs`, `app/`, `prisma/`, `lib/`) dans un dossier, puis :
```bash
cd cinema-scheduler
npm install
npm run dev
```
Va sur `http://localhost:3000` — tu dois voir la page "Programmation cinéma" s'afficher. Si oui, le squelette est sain avant même de toucher à Vercel.

### 2. Pousser sur GitHub
```bash
git init
git add .
git commit -m "init: schéma + moteur de planning"
gh repo create cinema-scheduler --private --source=. --push
# ou manuellement: créer le repo sur github.com puis git remote add origin ... && git push
```

### 3. Créer le projet sur Vercel
1. Sur vercel.com → **Add New → Project** → importer le repo GitHub.
2. **Vérifie "Root Directory"** dans les paramètres d'import : si `package.json` n'est pas à la racine du repo (ex: il est dans un sous-dossier `cinema-scheduler/`), Vercel doit pointer dessus explicitement, sinon build vide → 404 à nouveau.
3. Ne clique pas encore sur Deploy — va d'abord à l'étape 4.

### 4. Ajouter la base Postgres (persistance)
1. Dans le projet Vercel → onglet **Storage** → **Create Database** → **Postgres** (Neon).
2. Vercel injecte automatiquement `DATABASE_URL` (et variantes) dans les variables d'environnement du projet — tu n'as rien à copier-coller.

### 5. Adapter le build pour Prisma
Dans `package.json`, ajoute :
```json
"scripts": {
  "postinstall": "prisma generate",
  "build": "prisma migrate deploy && next build"
}
```
`prisma migrate deploy` applique les migrations en prod à chaque déploiement. En local, génère la première migration avec :
```bash
npx prisma migrate dev --name init
```
et commit le dossier `prisma/migrations` généré — Vercel en a besoin pour `migrate deploy`.

### 6. Déployer
Reviens sur Vercel → **Deploy**. Chaque `git push` sur la branche principale redéploie automatiquement ensuite.

## Modèle v3 — ce qui a changé
- Chaque bloc a un horaire de départ par défaut **propre à chaque salle** (`BlocHoraireDefaut`), pas un horaire partagé.
- Table `ExceptionHoraire` : couvre les cas type "jeudi en été, bloc matin à 10h30, films enfants uniquement" sans coder de cas particulier en dur — n'importe quel (jour, bloc, période, salle) peut avoir sa propre exception d'horaire et/ou de public cible.
- Plus de plafond de fermeture : le dernier bloc du jour s'enchaîne jusqu'à épuisement des quotas, sans heure limite.
- Le champ `Seance.genereAuto` (déjà présent) permet de distinguer une séance générée automatiquement d'une séance décalée manuellement ensuite (ton cas "on pousse de 15 min pour laisser finir la séance d'avant") — l'algo ne gère pas cet ajustement automatiquement, c'est une correction humaine post-génération.

## Réglages vs saisie à chaque génération
Ce qui devrait être un **réglage persistant** (configuré une fois, modifié rarement) :
- Salles, blocs (matin/aprem/soir1/soir2), horaires par défaut par salle
- Exceptions jour/saison

Ce qui est **saisi à chaque génération** :
- Films disponibles + durée + quota de séances souhaité par film
- Semaine(s) à programmer

## Points à trancher avant d'aller plus loin
1. **Marge entre séances** : fixée à 20 min dans `scheduler.ts` (constante `margeMinutes`) — à confirmer.
2. **Formulaire / pages** : pas encore construit. Prochaine étape logique : (a) une page "Réglages" pour salles/blocs/horaires/exceptions, (b) une page "Générer" pour films/quotas/semaines qui appelle `genererPlanning` et affiche le tableau + les `filmsNonComplets`.
