-- CreateEnum
CREATE TYPE "Jour" AS ENUM ('MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE', 'LUNDI', 'MARDI');

-- CreateTable
CREATE TABLE "Film" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "classification" TEXT,
    "seancesParSemaine" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Film_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seance" (
    "id" TEXT NOT NULL,
    "semaine" INTEGER NOT NULL,
    "jour" "Jour" NOT NULL,
    "salleIndex" INTEGER NOT NULL,
    "blocNom" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "genereAuto" BOOLEAN NOT NULL DEFAULT true,
    "filmId" TEXT NOT NULL,

    CONSTRAINT "Seance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "semaine" INTEGER NOT NULL DEFAULT 1,
    "jour" "Jour" NOT NULL,
    "salleIndex" INTEGER NOT NULL,
    "heureDebut" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filmId" TEXT NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seance_semaine_salleIndex_blocNom_jour_key" ON "Seance"("semaine", "salleIndex", "blocNom", "jour");

-- CreateIndex
CREATE INDEX "Placement_semaine_jour_salleIndex_idx" ON "Placement"("semaine", "jour", "salleIndex");

-- AddForeignKey
ALTER TABLE "Seance" ADD CONSTRAINT "Seance_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "Film"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "Film"("id") ON DELETE CASCADE ON UPDATE CASCADE;
