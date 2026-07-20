-- v10 : suppression complète de la génération automatique.
-- Destructif : la table "Seance" (résultat de l'ancienne génération auto) et
-- la colonne "Film.seancesParSemaine" (quota hebdomadaire) sont supprimées.
-- Sans conséquence sur "Placement" (programmation manuelle), qui n'est pas touché.

-- DropForeignKey
ALTER TABLE "Seance" DROP CONSTRAINT "Seance_filmId_fkey";

-- DropTable
DROP TABLE "Seance";

-- AlterTable
ALTER TABLE "Film" DROP COLUMN "seancesParSemaine";
