// Moteur de génération automatique du planning (v3)
//
// Règles :
// - Chaque bloc a un horaire de départ par défaut PROPRE À CHAQUE SALLE
//   (ex: bloc "aprem" -> Salle 1 = 15:30, Salle 2 = 15:45).
// - Des exceptions (jour + période de l'année, éventuellement salle) peuvent
//   changer l'heure de départ d'un bloc et/ou imposer un public cible
//   (ex: jeudi en été, bloc matin à 10h30, films enfants uniquement).
// - À l'intérieur d'un bloc, les séances s'enchaînent selon la durée réelle
//   des films + marge, jusqu'au début du bloc suivant DANS LA MÊME SALLE.
//   Le dernier bloc du jour n'a pas de limite : le dernier film se termine
//   quand il se termine.
// - Chaque film a un quota de séances souhaité, réparti sur l'ensemble de la
//   génération (priorité aux films les plus en retard sur leur quota).

export type Jour =
  | "LUNDI" | "MARDI" | "MERCREDI" | "JEUDI"
  | "VENDREDI" | "SAMEDI" | "DIMANCHE";

const JOURS: Jour[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

export type FilmAvecQuota = {
  id: string;
  titre: string;
  dureeMinutes: number;
  nbSeancesSouhaite: number;
  publicCible?: string; // ex: "ENFANT"
};

export type Bloc = {
  id: string;
  nom: string;
  ordre: number;
};

// Horaire par défaut d'un bloc, propre à une salle.
export type HoraireDefaut = {
  blocId: string;
  salleIndex: number;
  heureDebut: string; // "HH:mm"
};

// Exception ponctuelle (jour + période éventuelle), applicable à une salle ou à toutes.
export type ExceptionHoraire = {
  jour: Jour;
  blocId: string;
  salleIndex?: number;     // absent = toutes les salles
  heureDebut?: string;     // absent = pas de changement d'horaire
  publicRequis?: string;   // restreint les films éligibles sur ce bloc/jour
  periodeDebut?: string;   // "MM-DD"
  periodeFin?: string;     // "MM-DD"
};

export type SeanceGeneree = {
  filmId: string;
  salleIndex: number;
  jour: Jour;
  blocId: string;
  heureDebut: string;
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

/** "MM-DD" de la date courante tombe-t-il dans [debut, fin] ? Gère le cas où la période chevauche l'année (ex: 12-15 -> 01-15). */
function dansLaPeriode(dateMD: string, debut?: string, fin?: string): boolean {
  if (!debut || !fin) return true;
  if (debut <= fin) return dateMD >= debut && dateMD <= fin;
  return dateMD >= debut || dateMD <= fin; // période à cheval sur le nouvel an
}

/** Trouve l'exception applicable (jour + salle + période), s'il y en a une, la plus spécifique en priorité (salle explicite > toutes salles). */
function trouverException(
  exceptions: ExceptionHoraire[],
  jour: Jour,
  blocId: string,
  salleIndex: number,
  dateMD: string
): ExceptionHoraire | null {
  const candidates = exceptions.filter(
    e =>
      e.jour === jour &&
      e.blocId === blocId &&
      (e.salleIndex === undefined || e.salleIndex === salleIndex) &&
      dansLaPeriode(dateMD, e.periodeDebut, e.periodeFin)
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.salleIndex !== undefined ? -1 : 1)); // salle explicite d'abord
  return candidates[0];
}

export function genererPlanning(
  films: FilmAvecQuota[],
  nbSalles: number,
  blocs: Bloc[],
  horairesDefaut: HoraireDefaut[],
  exceptions: ExceptionHoraire[],
  semaines: string[],
  dateReferenceParSemaine: Record<string, string>, // semaine -> "MM-DD" représentative, pour évaluer les exceptions saisonnières
  margeMinutes = 20
): ResultatGeneration {
  if (films.length === 0) throw new Error("Aucun film fourni.");
  if (blocs.length === 0) throw new Error("Aucun bloc horaire fourni.");

  const blocsTries = [...blocs].sort((a, b) => a.ordre - b.ordre);
  const seancesPlaceesParFilm = new Map<string, number>(films.map(f => [f.id, 0]));
  const seances: SeanceGeneree[] = [];

  function choisirFilm(minutesDispo: number | null, publicRequis?: string): FilmAvecQuota | null {
    const candidats = films
      .filter(f => (seancesPlaceesParFilm.get(f.id) ?? 0) < f.nbSeancesSouhaite)
      .filter(f => !publicRequis || f.publicCible === publicRequis)
      .filter(f => minutesDispo === null || f.dureeMinutes + margeMinutes <= minutesDispo)
      .sort((a, b) => {
        const restantA = a.nbSeancesSouhaite - (seancesPlaceesParFilm.get(a.id) ?? 0);
        const restantB = b.nbSeancesSouhaite - (seancesPlaceesParFilm.get(b.id) ?? 0);
        return restantB - restantA;
      });
    return candidats[0] ?? null;
  }

  function heureDefautBloc(blocId: string, salleIndex: number): string {
    const h = horairesDefaut.find(h => h.blocId === blocId && h.salleIndex === salleIndex);
    if (!h) throw new Error(`Aucun horaire par défaut pour le bloc ${blocId} / salle ${salleIndex}.`);
    return h.heureDebut;
  }

  for (const semaine of semaines) {
    const dateMD = dateReferenceParSemaine[semaine] ?? "01-01";

    for (const jour of JOURS) {
      for (let salleIndex = 0; salleIndex < nbSalles; salleIndex++) {
        for (let bi = 0; bi < blocsTries.length; bi++) {
          const bloc = blocsTries[bi];
          const blocSuivant = blocsTries[bi + 1];

          const exception = trouverException(exceptions, jour, bloc.id, salleIndex, dateMD);
          const heureDepart = exception?.heureDebut ?? heureDefautBloc(bloc.id, salleIndex);
          const publicRequis = exception?.publicRequis;

          // Limite = début du bloc suivant DANS LA MÊME SALLE (ou pas de limite si dernier bloc).
          const limiteMinutes = blocSuivant
            ? heureEnMinutes(heureDefautBloc(blocSuivant.id, salleIndex))
            : null;

          let curseurMinutes = heureEnMinutes(heureDepart);

          while (true) {
            const dispo = limiteMinutes === null ? null : limiteMinutes - curseurMinutes;
            const film = choisirFilm(dispo, publicRequis);
            if (!film) break;

            seances.push({
              filmId: film.id,
              salleIndex,
              jour,
              blocId: bloc.id,
              heureDebut: minutesEnHeure(curseurMinutes),
            });

            seancesPlaceesParFilm.set(film.id, (seancesPlaceesParFilm.get(film.id) ?? 0) + 1);
            curseurMinutes += film.dureeMinutes + margeMinutes;
          }
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
