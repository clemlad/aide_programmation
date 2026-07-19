// Moteur de génération automatique du planning (v9)
//
// Changements v9 par rapport à v8 :
// - Les blocs/horaires/événements ne sont plus définis ici : ils viennent de
//   lib/scheduler-config.ts, PARTAGÉ avec la validation des placements manuels
//   (app/api/placements/*). Objectif : une seule règle métier, pas deux copies
//   qui divergent (cahier des charges V9, "mêmes règles métiers").
// - La marge minimale entre deux films d'une même salle vient de
//   lib/planning-utils.ts (MARGE_MIN_ENTRE_FILMS), pour la même raison.
// - Les événements spéciaux peuvent maintenant s'appliquer à une seule salle et/ou
//   réserver une salle sans y placer de film (`reserve: true`).
//
// Priorités respectées, dans cet ordre (cahier des charges V9) :
//   1. Événements spéciaux         2. Quotas hebdomadaires (jamais dépassés)
//   3. Marge minimale entre films  4. Durée des films (pas de chevauchement)
//   5. Contraintes des salles (pas de départ simultané, sauf exception)
//   6. Horaires de référence       7. Ajustement minimal si nécessaire
//   8. Répartition intelligente sur la semaine
//
// Note d'implémentation : les règles 2 à 5 ne sont pas séquentielles au sens où
// l'algorithme les appliquerait l'une après l'autre — elles portent sur deux axes
// indépendants (QUEL film vs QUAND) et sont donc appliquées simultanément :
// l'horaire est déterminé par la marge/les salles (règles 3-5), le film par le
// quota (règle 2). Aucune des deux ne peut être violée, il n'y a donc pas
// d'arbitrage réel à faire entre elles dans ce modèle.

import { heureVersMinutes, minutesVersHeure, MARGE_MIN_ENTRE_FILMS } from "@/lib/planning-utils";
import {
  JOURS,
  NB_SALLES,
  BLOCS,
  OFFSETS_MINUTES,
  evenementPourBlocSalle,
  filmRespecteEvenement,
  heureIdentiqueAutorisee,
  type Jour,
  type NomBloc,
} from "@/lib/scheduler-config";

export type { Jour };

export type FilmAvecQuota = {
  id: string;
  titre: string;
  dureeMinutes: number;
  seancesParSemaine: number;
  classification?: string | null;
};

export type SeanceGeneree = {
  filmId: string;
  salleIndex: number;
  jour: Jour;
  blocNom: string;
  heureDebut: string;
  semaine: number; // 1 ou 2
};

export type FilmNonComplet = {
  filmId: string;
  titre: string;
  semaine: number;
  seancesRestantes: number;
};

export type ResultatGeneration = {
  seances: SeanceGeneree[];
  filmsNonComplets: FilmNonComplet[];
};

function estTousPublics(film: FilmAvecQuota): boolean {
  return !film.classification;
}

/** Un film tous publics ne joue jamais sur le bloc "soir2" (règle héritée, conservée car non contredite en V9). */
function filmEligibleBloc(film: FilmAvecQuota, nomBloc: NomBloc): boolean {
  if (nomBloc === "soir2" && estTousPublics(film)) return false;
  return true;
}

/** 0 = créneau idéal pour ce film, 1 = acceptable seulement si rien de mieux n'a de quota restant. */
function scoreAppropriateness(film: FilmAvecQuota, nomBloc: NomBloc): number {
  const estSoir = nomBloc === "soir1" || nomBloc === "soir2";
  if (estSoir) return estTousPublics(film) ? 1 : 0;
  return estTousPublics(film) ? 0 : 1;
}

/** Génère la programmation d'UNE semaine indépendante (quotas remis à zéro à l'entrée). */
function genererUneSemaine(
  films: FilmAvecQuota[],
  numeroSemaine: number
): { seances: SeanceGeneree[]; quotasRestants: Map<string, number> } {
  const quotasRestants = new Map<string, number>(films.map(f => [f.id, f.seancesParSemaine]));
  const seances: SeanceGeneree[] = [];

  function choisirFilm(nomBloc: NomBloc, event: ReturnType<typeof evenementPourBlocSalle>): FilmAvecQuota | null {
    const candidats = films
      .filter(f => filmEligibleBloc(f, nomBloc))
      .filter(f => filmRespecteEvenement(f.classification, event))
      .filter(f => (quotasRestants.get(f.id) ?? 0) > 0) // priorité 2 : jamais de film sans quota restant
      .sort((a, b) => {
        const scoreA = scoreAppropriateness(a, nomBloc);
        const scoreB = scoreAppropriateness(b, nomBloc);
        if (scoreA !== scoreB) return scoreA - scoreB;
        const restantA = (quotasRestants.get(a.id) ?? 0) / Math.max(1, a.seancesParSemaine);
        const restantB = (quotasRestants.get(b.id) ?? 0) / Math.max(1, b.seancesParSemaine);
        return restantB - restantA; // le plus en retard sur son quota d'abord
      });
    return candidats[0] ?? null;
  }

  for (const jour of JOURS) {
    // Réinitialisé à chaque jour : la chaîne de films d'une salle ne s'étend jamais d'un jour sur l'autre.
    const finFilmPrecedent: [number | null, number | null] = [null, null];

    for (const bloc of BLOCS) {
      const identiqueOk = heureIdentiqueAutorisee(jour, bloc.nom);
      let heureChoisieSalle0: number | null = null;

      for (let salleIndex = 0; salleIndex < NB_SALLES; salleIndex++) {
        const event = evenementPourBlocSalle(jour, bloc.nom, salleIndex);

        if (event?.reserve) {
          continue; // priorité 1 : salle réservée par un événement, aucun film n'y est placé
        }

        const heureBase = heureVersMinutes(event?.heureDebut ?? bloc.horaires[salleIndex]);
        const precedent = finFilmPrecedent[salleIndex];

        let heureChoisie: number | null = null;
        for (const offset of OFFSETS_MINUTES) {
          const candidat = heureBase + offset;
          if (precedent !== null && candidat - precedent < MARGE_MIN_ENTRE_FILMS) continue; // priorité 3 : marge minimale
          if (!identiqueOk && salleIndex === 1 && heureChoisieSalle0 !== null && candidat === heureChoisieSalle0) {
            continue; // priorité 5 : interdit que les 2 salles démarrent en même temps
          }
          heureChoisie = candidat;
          break;
        }
        if (heureChoisie === null) continue; // aucun horaire valable : bloc laissé vide pour cette salle

        const film = choisirFilm(bloc.nom, event);
        if (!film) continue; // aucun film éligible avec du quota restant

        seances.push({
          filmId: film.id,
          salleIndex,
          jour,
          blocNom: bloc.nom,
          heureDebut: minutesVersHeure(heureChoisie),
          semaine: numeroSemaine,
        });
        quotasRestants.set(film.id, (quotasRestants.get(film.id) ?? 0) - 1);
        finFilmPrecedent[salleIndex] = heureChoisie + film.dureeMinutes; // priorité 4 : durée du film respectée
        if (salleIndex === 0) heureChoisieSalle0 = heureChoisie;
      }
    }
  }

  return { seances, quotasRestants };
}

export function genererPlanning(films: FilmAvecQuota[]): ResultatGeneration {
  if (films.length === 0) throw new Error("Aucun film fourni.");

  const toutesLesSeances: SeanceGeneree[] = [];
  const filmsNonComplets: FilmNonComplet[] = [];

  // Deux semaines totalement indépendantes : chaque appel repart d'une Map de
  // quotas neuve (genererUneSemaine), donc les quotas "reviennent automatiquement"
  // à leur valeur d'origine pour la semaine 2 — rien à réinitialiser à la main.
  for (const numeroSemaine of [1, 2]) {
    const { seances, quotasRestants } = genererUneSemaine(films, numeroSemaine);
    toutesLesSeances.push(...seances);
    for (const f of films) {
      const restantes = quotasRestants.get(f.id) ?? 0;
      if (restantes > 0) {
        filmsNonComplets.push({ filmId: f.id, titre: f.titre, semaine: numeroSemaine, seancesRestantes: restantes });
      }
    }
  }

  return { seances: toutesLesSeances, filmsNonComplets };
}
