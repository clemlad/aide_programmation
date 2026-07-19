import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererPlanning, type FilmAvecQuota } from "@/lib/scheduler";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

// POST { filmIds?: string[] } → génère les 2 semaines indépendantes à partir des
// quotas définis sur chaque Film (seancesParSemaine). Si filmIds est fourni, seuls
// ces films participent (permet d'exclure temporairement un film sans toucher à
// son quota dans l'onglet Films) ; sinon tous les films avec un quota > 0 participent.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filmIds: string[] | undefined = body.filmIds;

    const filmsDb = await prisma.film.findMany({
      where: {
        ...(filmIds ? { id: { in: filmIds } } : {}),
        seancesParSemaine: { gt: 0 },
      },
    });

    if (filmsDb.length === 0) {
      return NextResponse.json(
        { erreur: "Aucun film avec un quota de séances par semaine défini (voir l'onglet Films)." },
        { status: 400 }
      );
    }

    const films: FilmAvecQuota[] = filmsDb.map(f => ({
      id: f.id,
      titre: f.titre,
      dureeMinutes: f.dureeMinutes,
      seancesParSemaine: f.seancesParSemaine,
      classification: f.classification,
    }));

    let resultat;
    try {
      resultat = genererPlanning(films);
    } catch (err) {
      return NextResponse.json({ erreur: messageErreur(err) }, { status: 400 });
    }

    // Remplace toute génération automatique précédente (les 2 semaines sont régénérées ensemble).
    await prisma.seance.deleteMany({ where: { genereAuto: true } });
    await prisma.seance.createMany({
      data: resultat.seances.map(s => ({
        semaine: s.semaine,
        jour: s.jour,
        heureDebut: s.heureDebut,
        filmId: s.filmId,
        salleIndex: s.salleIndex,
        blocNom: s.blocNom,
        genereAuto: true,
      })),
    });

    return NextResponse.json({ seances: resultat.seances, filmsNonComplets: resultat.filmsNonComplets });
  } catch (err) {
    console.error("POST /api/generer", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const seances = await prisma.seance.findMany({ where: { genereAuto: true }, include: { film: true } });
    return NextResponse.json(seances);
  } catch (err) {
    console.error("GET /api/generer", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}
