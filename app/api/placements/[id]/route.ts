import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, decalerCreneaux, jourPrecedent, jourSuivant, MINUTES_JOUR, type Jour } from "@/lib/planning-utils";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

/** Voir app/api/placements/route.ts pour le détail : ramène les créneaux d'un
 * jour voisin (veille/lendemain) dans le référentiel du jour candidat, pour
 * détecter les chevauchements qui débordent après minuit. */
async function creneauxVoisins(semaine: number, jour: Jour, salleIndex: number, offsetMinutes: number, ignorerId?: string) {
  const placements = await prisma.placement.findMany({ where: { semaine, jour, salleIndex }, include: { film: true } });
  return decalerCreneaux(
    placements.filter(p => p.id !== ignorerId).map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
    offsetMinutes
  );
}

// PATCH { salleIndex?, heureDebut? } → déplace une séance déjà placée (le jour et
// la semaine ne changent pas ici : on supprime/recrée depuis l'UI pour ça).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const existant = await prisma.placement.findUnique({ where: { id: params.id }, include: { film: true } });
    if (!existant) {
      return NextResponse.json({ erreur: "Cette séance n'existe plus." }, { status: 404 });
    }

    const salleIndex = body.salleIndex ?? existant.salleIndex;
    const heureDebut = body.heureDebut ?? existant.heureDebut;
    const duree = existant.film.dureeMinutes;
    const jour = existant.jour as Jour;

    if (heureDebut < 0) {
      return NextResponse.json(
        { erreur: `Heure de début invalide pour "${existant.film.titre}".` },
        { status: 400 }
      );
    }

    const [creneauxJour, creneauxVeille, creneauxLendemain] = await Promise.all([
      creneauxVoisins(existant.semaine, jour, salleIndex, 0, existant.id),
      creneauxVoisins(existant.semaine, jourPrecedent(jour), salleIndex, -MINUTES_JOUR),
      creneauxVoisins(existant.semaine, jourSuivant(jour), salleIndex, MINUTES_JOUR),
    ]);
    const conflit = trouverConflit([...creneauxJour, ...creneauxVeille, ...creneauxLendemain], { heureDebut, dureeMinutes: duree });
    if (conflit) {
      const placementConflit = await prisma.placement.findUnique({ where: { id: conflit.id }, include: { film: true } });
      return NextResponse.json(
        { erreur: `"${existant.film.titre}" chevauche "${placementConflit?.film.titre ?? "une autre séance"}" dans cette salle.` },
        { status: 409 }
      );
    }

    const placement = await prisma.placement.update({
      where: { id: existant.id },
      data: { salleIndex, heureDebut },
      include: { film: true },
    });
    return NextResponse.json(placement);
  } catch (err) {
    console.error("PATCH /api/placements/[id]", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.placement.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/placements/[id]", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}
