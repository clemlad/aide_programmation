-- CreateEnum
CREATE TYPE "Jour" AS ENUM ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE');

-- CreateTable
CREATE TABLE "Film" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "publicCible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Film_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salle" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloc" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "Bloc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlocHoraireDefaut" (
    "id" TEXT NOT NULL,
    "blocId" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,

    CONSTRAINT "BlocHoraireDefaut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionHoraire" (
    "id" TEXT NOT NULL,
    "jour" "Jour" NOT NULL,
    "blocId" TEXT NOT NULL,
    "salleId" TEXT,
    "heureDebut" TEXT,
    "publicRequis" TEXT,
    "periodeDebut" TEXT,
    "periodeFin" TEXT,

    CONSTRAINT "ExceptionHoraire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semaine" (
    "id" TEXT NOT NULL,
    "anneeIso" INTEGER NOT NULL,
    "numeroIso" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Semaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seance" (
    "id" TEXT NOT NULL,
    "jour" "Jour" NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "genereAuto" BOOLEAN NOT NULL DEFAULT true,
    "filmId" TEXT NOT NULL,
    "salleId" TEXT NOT NULL,
    "blocId" TEXT NOT NULL,
    "semaineId" TEXT NOT NULL,

    CONSTRAINT "Seance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bloc_ordre_key" ON "Bloc"("ordre");

-- CreateIndex
CREATE UNIQUE INDEX "BlocHoraireDefaut_blocId_salleId_key" ON "BlocHoraireDefaut"("blocId", "salleId");

-- CreateIndex
CREATE UNIQUE INDEX "Semaine_anneeIso_numeroIso_key" ON "Semaine"("anneeIso", "numeroIso");

-- CreateIndex
CREATE UNIQUE INDEX "Seance_salleId_jour_semaineId_heureDebut_key" ON "Seance"("salleId", "jour", "semaineId", "heureDebut");

-- AddForeignKey
ALTER TABLE "BlocHoraireDefaut" ADD CONSTRAINT "BlocHoraireDefaut_blocId_fkey" FOREIGN KEY ("blocId") REFERENCES "Bloc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlocHoraireDefaut" ADD CONSTRAINT "BlocHoraireDefaut_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionHoraire" ADD CONSTRAINT "ExceptionHoraire_blocId_fkey" FOREIGN KEY ("blocId") REFERENCES "Bloc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "Film"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_salleId_fkey" FOREIGN KEY ("salleId") REFERENCES "Salle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_blocId_fkey" FOREIGN KEY ("blocId") REFERENCES "Bloc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_semaineId_fkey" FOREIGN KEY ("semaineId") REFERENCES "Semaine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
