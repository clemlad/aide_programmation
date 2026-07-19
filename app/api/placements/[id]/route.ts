import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, MINUTES_JOUR } from "@/lib/planning-utils";
import { fenetresEvenements, filmRespecteEvenement } from "@/lib/scheduler-config";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
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

    if (heureDebut < 0 || heureDebut + duree > MINUTES_JOUR) {
      return NextResponse.json(
        { erreur: `"${existant.film.titre}" dépasserait minuit à cette heure de début.` },
        { status: 400 }
      );
    }

    // Mêmes règles que la création : événements spéciaux d'abord.
    const fin = heureDebut + duree;
    for (const fenetre of fenetresEvenements(existant.jour as any, salleIndex)) {
      const chevauche = heureDebut < fenetre.fin && fenetre.debut < fin;
      if (!chevauche) continue;
      if (!filmRespecteEvenement(existant.film.classification, fenetre.event)) {
        const msg = fenetre.event.reserve
          ? `Cette salle est réservée par l'événement "${fenetre.event.nom}" à cet horaire.`
          : `Seuls les films tous publics sont autorisés à cet horaire (événement "${fenetre.event.nom}").`;
        return NextResponse.json({ erreur: msg }, { status: 409 });
      }
    }

    const autres = await prisma.placement.findMany({
      where: { semaine: existant.semaine, jour: existant.jour, salleIndex, NOT: { id: existant.id } },
      include: { film: true },
    });
    const conflit = trouverConflit(
      autres.map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
      { heureDebut, dureeMinutes: duree }
    );
    if (conflit) {
      const filmConflit = autres.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
      return NextResponse.json(
        { erreur: `"${existant.film.titre}" est trop proche de "${filmConflit}" dans cette salle (marge minimale non respectée).` },
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
