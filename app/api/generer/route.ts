import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererPlanning, type FilmAvecQuota } from "@/lib/scheduler";

type SemaineDemandee = { anneeIso: number; numeroIso: number };

export async function POST(req: Request) {
  const body = await req.json();
  const filmsQuota: { filmId: string; nbSeancesSouhaite: number }[] = body.films ?? [];
  const semainesDemandees: SemaineDemandee[] = body.semaines ?? [];

  if (filmsQuota.length === 0) {
    return NextResponse.json({ erreur: "Aucun film sélectionné." }, { status: 400 });
  }
  if (semainesDemandees.length === 0) {
    return NextResponse.json({ erreur: "Aucune semaine sélectionnée." }, { status: 400 });
  }

  const filmsDb = await prisma.film.findMany({ where: { id: { in: filmsQuota.map(f => f.filmId) } } });

  const films: FilmAvecQuota[] = filmsDb.map(f => ({
    id: f.id,
    titre: f.titre,
    dureeMinutes: f.dureeMinutes,
    nbSeancesSouhaite: filmsQuota.find(fq => fq.filmId === f.id)?.nbSeancesSouhaite ?? 0,
    classification: f.classification ?? undefined,
  }));

  const semaineCles: string[] = [];
  const semaineIdParCle = new Map<string, string>();
  for (const s of semainesDemandees) {
    const cle = `${s.anneeIso}-S${s.numeroIso}`;
    semaineCles.push(cle);
    const semaine = await prisma.semaine.upsert({
      where: { anneeIso_numeroIso: { anneeIso: s.anneeIso, numeroIso: s.numeroIso } },
      update: {},
      create: { anneeIso: s.anneeIso, numeroIso: s.numeroIso },
    });
    semaineIdParCle.set(cle, semaine.id);
  }

  let resultat;
  try {
    resultat = genererPlanning(films, semaineCles);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur pendant la génération.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }

  await prisma.seance.deleteMany({
    where: { semaineId: { in: Array.from(semaineIdParCle.values()) }, genereAuto: true },
  });

  await prisma.seance.createMany({
    data: resultat.seances.map(s => ({
      jour: s.jour,
      heureDebut: s.heureDebut,
      filmId: s.filmId,
      salleIndex: s.salleIndex,
      blocNom: s.blocNom,
      semaineId: semaineIdParCle.get(s.semaine)!,
      genereAuto: true,
    })),
  });

  return NextResponse.json({ seances: resultat.seances, filmsNonComplets: resultat.filmsNonComplets });
}
