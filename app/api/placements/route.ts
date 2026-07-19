import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, MINUTES_JOUR } from "@/lib/planning-utils";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

// GET /api/placements?jour=JEUDI  → séances placées à la main pour ce jour (toutes salles)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jour = searchParams.get("jour");

    const placements = await prisma.placement.findMany({
      where: jour ? { jour: jour as any } : undefined,
      include: { film: true },
      orderBy: { heureDebut: "asc" },
    });
    return NextResponse.json(placements);
  } catch (err) {
    console.error("GET /api/placements", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

// POST { jour, salleIndex, heureDebut, filmId } → place un nouveau film sur la frise
export async function POST(req: Request) {
  try {
    const { jour, salleIndex, heureDebut, filmId } = await req.json();

    if (!jour || salleIndex === undefined || heureDebut === undefined || !filmId) {
      return NextResponse.json({ erreur: "jour, salleIndex, heureDebut et filmId sont requis." }, { status: 400 });
    }

    const film = await prisma.film.findUnique({ where: { id: filmId } });
    if (!film) {
      return NextResponse.json({ erreur: "Ce film n'existe pas (ou plus)." }, { status: 404 });
    }

    if (heureDebut < 0 || heureDebut + film.dureeMinutes > MINUTES_JOUR) {
      return NextResponse.json(
        { erreur: `"${film.titre}" dépasserait minuit à cette heure de début.` },
        { status: 400 }
      );
    }

    const existants = await prisma.placement.findMany({
      where: { jour, salleIndex },
      include: { film: true },
    });
    const conflit = trouverConflit(
      existants.map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
      { heureDebut, dureeMinutes: film.dureeMinutes }
    );
    if (conflit) {
      const filmConflit = existants.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
      return NextResponse.json(
        { erreur: `Chevauchement avec "${filmConflit}" dans cette salle à ce moment-là.` },
        { status: 409 }
      );
    }

    const placement = await prisma.placement.create({
      data: { jour, salleIndex, heureDebut, filmId },
      include: { film: true },
    });
    return NextResponse.json(placement, { status: 201 });
  } catch (err) {
    console.error("POST /api/placements", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}
