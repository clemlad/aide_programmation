// Moteur de génération automatique du planning (v6)
//
// Modèle : 4 blocs fixes par jour et par salle (matin, aprem, soir1, soir2),
// UN SEUL FILM par (jour, salle, bloc) — pas d'enchaînement libre à l'intérieur d'un bloc.
//
// Ajustement d'horaire : si l'horaire de base d'un bloc est trop proche de la fin du
// film du bloc précédent (même salle, même jour), on décale de 15 min ; si ça ne
// suffit toujours pas, de 30 min. Le plus petit décalage suffisant est toujours choisi.
//
// Classification :
// - Un film "tous publics" (classification null) ne peut jamais jouer sur le bloc
//   "soir2" (dernière séance du soir).
// - Les blocs du soir (soir1, soir2) sont prioritaires pour les films classifiés
//   (12/16/18) ; les blocs de jour (matin, aprem) sont prioritaires pour les films
//   tous publics. C'est une PRÉFÉRENCE, pas une exclusion : si aucun film approprié
//   n'a de quota restant sur un bloc donné, un film moins "approprié" peut y être
//   placé pour honorer une forte demande de séances.

export type Jour = "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI" | "DIMANCHE" | "LUNDI" | "MARDI";
const JOURS: Jour[] = ["MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE", "LUNDI", "MARDI"];

const NB_SALLES = 2;

// Horaires de base : [Salle 1, Salle 2] pour chaque bloc, dans l'ordre chronologique.
const BLOCS: { nom: string; horaires: [string, string] }[] = [
  { nom: "matin", horaires: ["11:00", "11:00"] },
  { nom: "aprem", horaires: ["15:30", "15:45"] },
  { nom: "soir1", horaires: ["18:00", "18:15"] },
  { nom: "soir2", horaires: ["20:45", "21:00"] },
];

const DECALAGES_MINUTES = [0, 15, 30]; // essayés dans cet ordre ; le premier qui convient est retenu
const MARGE_SOUHAITEE_MIN = 15; // battement désiré entre la fin d'un film et le début du suivant — [Guessing], à ajuster si besoin

export type FilmAvecQuota = {
  id: string;
  titre: string;
  dureeMinutes: number;
  nbSeancesSouhaite: number;
  classification?: string; // absent/null = tous publics ; sinon "12", "16", "18"
};

export type SeanceGeneree = {
  filmId: string;
  salleIndex: number;
  jour: Jour;
  blocNom: string;
  heureDebut: string;
  semaine: string;
};

export type FilmNonComplet = {
  filmId: string;
  titre: string;
  seancesRestantes: number;
};

export type ResultatGeneration = {
  seances: SeanceGeneree[];
  filmsNonComplets: FilmNonComplet[];
};

function heureEnMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}
function minutesEnHeure(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function estTousPublics(film: FilmAvecQuota): boolean {
  return !film.classification;
}

/** Un film tous publics ne peut jamais jouer sur le bloc "soir2". */
function filmEligible(film: FilmAvecQuota, nomBloc: string): boolean {
  if (nomBloc === "soir2" && estTousPublics(film)) return false;
  return true;
}

/** 0 = créneau idéal pour ce film, 1 = acceptable seulement si rien de mieux n'est disponible. */
function scoreAppropriateness(film: FilmAvecQuota, nomBloc: string): number {
  const estSoir = nomBloc === "soir1" || nomBloc === "soir2";
  if (estSoir) return estTousPublics(film) ? 1 : 0;
  return estTousPublics(film) ? 0 : 1;
}

export function genererPlanning(
  films: FilmAvecQuota[],
  semaines: string[]
): ResultatGeneration {
  if (films.length === 0) throw new Error("Aucun film fourni.");

  const seancesPlaceesParFilm = new Map<string, number>(films.map(f => [f.id, 0]));
  const seances: SeanceGeneree[] = [];

  function choisirFilm(nomBloc: string): FilmAvecQuota | null {
    const candidats = films
      .filter(f => filmEligible(f, nomBloc))
      .filter(f => (seancesPlaceesParFilm.get(f.id) ?? 0) < f.nbSeancesSouhaite)
      .sort((a, b) => {
        const scoreA = scoreAppropriateness(a, nomBloc);
        const scoreB = scoreAppropriateness(b, nomBloc);
        if (scoreA !== scoreB) return scoreA - scoreB; // le plus approprié d'abord
        const restantA = a.nbSeancesSouhaite - (seancesPlaceesParFilm.get(a.id) ?? 0);
        const restantB = b.nbSeancesSouhaite - (seancesPlaceesParFilm.get(b.id) ?? 0);
        return restantB - restantA; // à égalité d'à-propos, le plus en retard sur son quota d'abord
      });
    return candidats[0] ?? null;
  }

  for (const semaine of semaines) {
    for (const jour of JOURS) {
      for (let salleIndex = 0; salleIndex < NB_SALLES; salleIndex++) {
        let finFilmPrecedent: number | null = null; // minutes depuis minuit, dans cette salle/jour

        for (const bloc of BLOCS) {
          const horaireBase = heureEnMinutes(bloc.horaires[salleIndex]);

          // Choisit le plus petit décalage (0, 15 ou 30 min) qui respecte la marge
          // souhaitée par rapport à la fin du film précédent dans cette salle.
          let horaireChoisi: number | null = null;
          for (const decalage of DECALAGES_MINUTES) {
            const candidat = horaireBase + decalage;
            if (finFilmPrecedent === null || candidat - finFilmPrecedent >= MARGE_SOUHAITEE_MIN) {
              horaireChoisi = candidat;
              break;
            }
          }
          if (horaireChoisi === null) continue; // même +30 min ne suffit pas : bloc laissé vide ce jour-là

          const film = choisirFilm(bloc.nom);
          if (!film) continue; // aucun film éligible avec du quota restant : bloc laissé vide

          seances.push({
            filmId: film.id,
            salleIndex,
            jour,
            blocNom: bloc.nom,
            heureDebut: minutesEnHeure(horaireChoisi),
            semaine,
          });
          seancesPlaceesParFilm.set(film.id, (seancesPlaceesParFilm.get(film.id) ?? 0) + 1);
          finFilmPrecedent = horaireChoisi + film.dureeMinutes;
        }
      }
    }
  }

  const filmsNonComplets: FilmNonComplet[] = films
    .map(f => ({
      filmId: f.id,
      titre: f.titre,
      seancesRestantes: f.nbSeancesSouhaite - (seancesPlaceesParFilm.get(f.id) ?? 0),
    }))
    .filter(f => f.seancesRestantes > 0);

  return { seances, filmsNonComplets };
}
