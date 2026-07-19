import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

/** seancesParSemaine est obligatoire (V9) : entier >= 1. Retourne un message d'erreur ou null. */
function validerSeancesParSemaine(valeur: unknown): string | null {
  const n = Number(valeur);
  if (valeur === undefined || valeur === null || valeur === "" || !Number.isInteger(n) || n < 1) {
    return "Le nombre de séances par semaine est obligatoire et doit être un entier supérieur ou égal à 1.";
  }
  return null;
}

export async function GET() {
  try {
    const films = await prisma.film.findMany({ orderBy: { titre: "asc" } });
    return NextResponse.json(films);
  } catch (err) {
    console.error("GET /api/films", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { titre, dureeMinutes, classification, seancesParSemaine } = await req.json();
    if (!titre || !dureeMinutes) {
      return NextResponse.json({ erreur: "Titre et durée requis." }, { status: 400 });
    }
    const erreurQuota = validerSeancesParSemaine(seancesParSemaine);
    if (erreurQuota) {
      return NextResponse.json({ erreur: erreurQuota }, { status: 400 });
    }
    const film = await prisma.film.create({
      data: {
        titre,
        dureeMinutes: Number(dureeMinutes),
        classification: classification || null,
        seancesParSemaine: Number(seancesParSemaine),
      },
    });
    return NextResponse.json(film, { status: 201 });
  } catch (err) {
    console.error("POST /api/films", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, titre, dureeMinutes, classification, seancesParSemaine } = await req.json();
    if (!id) return NextResponse.json({ erreur: "id requis." }, { status: 400 });

    if (seancesParSemaine !== undefined) {
      const erreurQuota = validerSeancesParSemaine(seancesParSemaine);
      if (erreurQuota) {
        return NextResponse.json({ erreur: erreurQuota }, { status: 400 });
      }
    }

    const film = await prisma.film.update({
      where: { id },
      data: {
        ...(titre !== undefined ? { titre } : {}),
        ...(dureeMinutes !== undefined ? { dureeMinutes: Number(dureeMinutes) } : {}),
        ...(classification !== undefined ? { classification: classification || null } : {}),
        ...(seancesParSemaine !== undefined ? { seancesParSemaine: Number(seancesParSemaine) } : {}),
      },
    });
    return NextResponse.json(film);
  } catch (err) {
    console.error("PATCH /api/films", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.film.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/films", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 400 });
  }
}
