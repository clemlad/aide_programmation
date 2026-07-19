-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "jour" "Jour" NOT NULL,
    "salleIndex" INTEGER NOT NULL,
    "heureDebut" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filmId" TEXT NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Placement_jour_salleIndex_idx" ON "Placement"("jour", "salleIndex");

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "Film"("id") ON DELETE CASCADE ON UPDATE CASCADE;
