import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, MINUTES_JOUR } from "@/lib/planning-utils";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

// PATCH { salleIndex?, heureDebut? } → déplace une séance déjà placée (le jour ne change pas ici :
// on supprime/recrée depuis l'UI pour changer de jour, plus simple à raisonner)
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

    if (heureDebut < 0 || heureDebut + duree > MINUTES_JOUR) {
      return NextResponse.json(
        { erreur: `"${existant.film.titre}" dépasserait minuit à cette heure de début.` },
        { status: 400 }
      );
    }

    const autres = await prisma.placement.findMany({
      where: { jour: existant.jour, salleIndex, NOT: { id: existant.id } },
      include: { film: true },
    });
    const conflit = trouverConflit(
      autres.map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
      { heureDebut, dureeMinutes: duree }
    );
    if (conflit) {
      const filmConflit = autres.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
      return NextResponse.json(
        { erreur: `Chevauchement avec "${filmConflit}" dans cette salle à ce moment-là.` },
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
