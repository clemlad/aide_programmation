import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trouverConflit, MINUTES_JOUR } from "@/lib/planning-utils";
import { fenetresEvenements, filmRespecteEvenement, type Jour } from "@/lib/scheduler-config";

function messageErreur(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Erreur inconnue côté serveur.";
}

/**
 * Un événement spécial actif sur ce (jour, salle) empêche-t-il ce placement ?
 * Retourne un message d'erreur si oui, null sinon. Utilise exactement la même
 * config (lib/scheduler-config.ts) que le générateur automatique, pour que les
 * deux modes appliquent les mêmes règles (cahier des charges V9).
 */
function conflitEvenement(
  jour: Jour,
  salleIndex: number,
  heureDebut: number,
  dureeMinutes: number,
  classification: string | null
): string | null {
  const fin = heureDebut + dureeMinutes;
  for (const fenetre of fenetresEvenements(jour, salleIndex)) {
    const chevauche = heureDebut < fenetre.fin && fenetre.debut < fin;
    if (!chevauche) continue;
    if (!filmRespecteEvenement(classification, fenetre.event)) {
      return fenetre.event.reserve
        ? `Cette salle est réservée par l'événement "${fenetre.event.nom}" à cet horaire.`
        : `Seuls les films tous publics sont autorisés à cet horaire (événement "${fenetre.event.nom}").`;
    }
  }
  return null;
}

// GET /api/placements?semaine=1&jour=JEUDI
//   - semaine (1 ou 2) : obligatoire en pratique, défaut 1 si absent.
//   - jour : optionnel. Si absent, renvoie TOUTE la semaine (les 7 jours), ce qui
//     sert au calcul des compteurs de séances restantes côté client (le compteur
//     porte sur la semaine entière, pas sur un jour précis).
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

// POST { semaine, jour, salleIndex, heureDebut, filmId } → place un nouveau film sur la frise
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

    if (heureDebut < 0 || heureDebut + film.dureeMinutes > MINUTES_JOUR) {
      return NextResponse.json({ erreur: `"${film.titre}" dépasserait minuit à cette heure de début.` }, { status: 400 });
    }

    // Priorité 1 : événements spéciaux (réservation de salle / restriction de public).
    const erreurEvenement = conflitEvenement(jour, salleIndex, heureDebut, film.dureeMinutes, film.classification);
    if (erreurEvenement) {
      return NextResponse.json({ erreur: erreurEvenement }, { status: 409 });
    }

    // Priorité 2 : quota hebdomadaire jamais dépassé, tous jours confondus, pour cette semaine.
    const nbDejaPlace = await prisma.placement.count({ where: { semaine, filmId } });
    if (nbDejaPlace >= film.seancesParSemaine) {
      return NextResponse.json(
        { erreur: `"${film.titre}" a déjà atteint son quota de ${film.seancesParSemaine} séance(s) pour la semaine ${semaine}.` },
        { status: 409 }
      );
    }

    // Priorités 3-4 : marge minimale + pas de chevauchement (trouverConflit applique
    // MARGE_MIN_ENTRE_FILMS par défaut — même règle que le générateur automatique).
    const existants = await prisma.placement.findMany({
      where: { semaine, jour, salleIndex },
      include: { film: true },
    });
    const conflit = trouverConflit(
      existants.map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes })),
      { heureDebut, dureeMinutes: film.dureeMinutes }
    );
    if (conflit) {
      const filmConflit = existants.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
      return NextResponse.json(
        { erreur: `"${film.titre}" est trop proche de "${filmConflit}" dans cette salle (marge minimale non respectée).` },
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
