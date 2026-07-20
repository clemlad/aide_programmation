import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, decalerCreneaux, jourPrecedent, jourSuivant, MINUTES_JOUR, type Jour } from "@/lib/planning-utils";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

/**
 * Créneaux occupés dans une salle, pour un jour donné, ramenés dans le
 * référentiel du jour candidat (offset 0 = même jour, -1440 = veille,
 * +1440 = lendemain). Nécessaire car un film peut déborder après minuit
 * (plus de garde-fou 24h) : sans ça, un film placé la veille à 23h00 pour 3h
 * et un film placé le lendemain à 00h30 dans la même salle ne seraient jamais
 * comparés entre eux, alors qu'ils se chevauchent réellement.
 */
async function creneauxVoisins(semaine: number, jour: Jour, salleIndex: number, offsetMinutes: number) {
  const placements = await prisma.placement.findMany({ where: { semaine, jour, salleIndex }, include: { film: true } });
  return decalerCreneaux(
    placements.map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
    offsetMinutes
  );
}

// GET /api/placements?semaine=1&jour=JEUDI
//   - semaine (1 ou 2) : obligatoire en pratique, défaut 1 si absent.
//   - jour : optionnel. Si absent, renvoie TOUTE la semaine (les 7 jours).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const semaine = Number(searchParams.get("semaine") ?? "1");
    const jour = searchParams.get("jour");

    const placements = await prisma.placement.findMany({
      where: { semaine, ...(jour ? { jour: jour as any } : {}) },
      include: { film: true },
      orderBy: { heureDebut: "asc" },
    });
    return NextResponse.json(placements);
  } catch (err) {
    console.error("GET /api/placements", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}

// POST { semaine, jour, salleIndex, heureDebut, filmId } → place un nouveau film sur la frise.
// Seule contrainte : ne pas chevaucher un autre film déjà placé dans la même salle,
// y compris un débordement après minuit venant de la veille ou vers le lendemain.
export async function POST(req: Request) {
  try {
    const { semaine, jour, salleIndex, heureDebut, filmId } = await req.json();

    if (!semaine || !jour || salleIndex === undefined || heureDebut === undefined || !filmId) {
      return NextResponse.json({ erreur: "semaine, jour, salleIndex, heureDebut et filmId sont requis." }, { status: 400 });
    }

    const film = await prisma.film.findUnique({ where: { id: filmId } });
    if (!film) {
      return NextResponse.json({ erreur: "Ce film n'existe pas (ou plus)." }, { status: 404 });
    }

    if (heureDebut < 0) {
      return NextResponse.json({ erreur: `Heure de début invalide pour "${film.titre}".` }, { status: 400 });
    }

    const [creneauxJour, creneauxVeille, creneauxLendemain] = await Promise.all([
      creneauxVoisins(semaine, jour, salleIndex, 0),
      creneauxVoisins(semaine, jourPrecedent(jour), salleIndex, -MINUTES_JOUR),
      creneauxVoisins(semaine, jourSuivant(jour), salleIndex, MINUTES_JOUR),
    ]);
    const conflit = trouverConflit([...creneauxJour, ...creneauxVeille, ...creneauxLendemain], {
      heureDebut,
      dureeMinutes: film.dureeMinutes,
    });
    if (conflit) {
      const placementConflit = await prisma.placement.findUnique({ where: { id: conflit.id }, include: { film: true } });
      return NextResponse.json(
        { erreur: `"${film.titre}" chevauche "${placementConflit?.film.titre ?? "une autre séance"}" dans cette salle.` },
        { status: 409 }
      );
    }

    const placement = await prisma.placement.create({
      data: { semaine, jour, salleIndex, heureDebut, filmId },
      include: { film: true },
    });
    return NextResponse.json(placement, { status: 201 });
  } catch (err) {
    console.error("POST /api/placements", err);
    return NextResponse.json({ erreur: messageErreur(err) }, { status: 500 });
  }
}
