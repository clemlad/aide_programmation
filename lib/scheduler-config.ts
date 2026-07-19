// Configuration partagée entre la génération automatique (lib/scheduler.ts) et la
// validation des placements manuels (app/api/placements/*). Objectif V9 :
// "la programmation manuelle et automatique doivent utiliser les mêmes règles
// métiers" — donc une seule définition des blocs/horaires/événements, importée
// des deux côtés, plutôt que deux copies qui finiraient par diverger.
//
// Pas d'import Prisma ici : reste utilisable par le générateur (server-only) et,
// si besoin plus tard, par le client pour prévisualiser les contraintes.

import { heureVersMinutes, MINUTES_JOUR } from "@/lib/planning-utils";

export type Jour = "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI" | "DIMANCHE" | "LUNDI" | "MARDI";
export const JOURS: Jour[] = ["MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE", "LUNDI", "MARDI"];

export const NB_SALLES = 2;

export type NomBloc = "matin" | "aprem" | "soir1" | "soir2";

// Horaires de référence : [Salle 1, Salle 2] pour chaque bloc, dans l'ordre chronologique.
export const BLOCS: { nom: NomBloc; horaires: [string, string] }[] = [
  { nom: "matin", horaires: ["11:00", "11:00"] },
  { nom: "aprem", horaires: ["15:30", "15:45"] },
  { nom: "soir1", horaires: ["18:00", "18:15"] },
  { nom: "soir2", horaires: ["20:45", "21:00"] },
];

// Décalages essayés dans cet ordre de préférence : horaire de référence d'abord,
// puis les plus proches. Pas de 15 min, jusqu'à 30 min dans chaque sens.
export const OFFSETS_MINUTES = [0, -15, 15, -30, 30];
export const AJUSTEMENT_MAX = 30;

// --- Événements spéciaux -----------------------------------------------------
// Modèle générique (jour × bloc × salle optionnelle) permettant de :
//  - remplacer une seule salle OU les deux (`salles` absent = les deux),
//  - remplacer un ou plusieurs blocs (`blocsConcernes`),
//  - imposer un horaire (`heureDebut`) ou simplement réserver la salle sans
//    film (`reserve: true`, ex: avant-première),
//  - restreindre le public (`publicAutorise`),
//  - durer un ou plusieurs jours (`jours`).
// Pour ajouter un nouvel événement : une entrée dans EVENEMENTS_SPECIAUX, rien
// d'autre à modifier dans l'algorithme (auto ou manuel).
export type EvenementSpecial = {
  id: string;
  nom: string;
  jours: Jour[];
  blocsConcernes: NomBloc[];
  salles?: number[]; // absent = les 2 salles
  heureDebut?: string; // remplace l'horaire de référence ; absent = horaire de référence normal conservé
  reserve?: boolean; // true = salle bloquée pour l'algorithme automatique, aucun film n'y est placé
  publicAutorise?: "TOUS_PUBLIC"; // seule restriction gérée pour l'instant : classification null
  heuresIdentiquesAutorisees?: boolean; // défaut : true dès que l'événement s'applique aux 2 salles
  actif: boolean;
};

export const EVENEMENTS_SPECIAUX: EvenementSpecial[] = [
  {
    id: "cine-ptit-dej",
    nom: "Ciné P'tit Déj",
    jours: ["JEUDI"],
    blocsConcernes: ["matin"],
    heureDebut: "10:30",
    publicAutorise: "TOUS_PUBLIC",
    heuresIdentiquesAutorisees: true,
    actif: true,
  },
  {
    // Exemple donné dans le cahier des charges V9 pour illustrer la réservation
    // d'une seule salle. Désactivé par défaut (actif: false) : passe-le à true
    // le(s) vendredi(s) concerné(s), ou remplace par un vrai événement.
    id: "avant-premiere-salle1",
    nom: "Avant-première (Salle 1 réservée)",
    jours: ["VENDREDI"],
    blocsConcernes: ["soir1", "soir2"],
    salles: [0],
    reserve: true,
    actif: false,
  },
];

/** Événement actif pour un (jour, bloc, salle) donné, s'il y en a un. */
export function evenementPourBlocSalle(jour: Jour, bloc: NomBloc, salleIndex: number): EvenementSpecial | null {
  return (
    EVENEMENTS_SPECIAUX.find(
      e =>
        e.actif &&
        e.jours.includes(jour) &&
        e.blocsConcernes.includes(bloc) &&
        (!e.salles || e.salles.includes(salleIndex))
    ) ?? null
  );
}

/** Un film tous publics est-il/n'est-il pas admis compte tenu d'un événement (ou de l'absence d'événement) ? */
export function filmRespecteEvenement(classification: string | null | undefined, event: EvenementSpecial | null): boolean {
  if (!event) return true;
  if (event.reserve) return false; // salle réservée : aucun film, quel qu'il soit
  if (event.publicAutorise === "TOUS_PUBLIC") return !classification;
  return true;
}

/**
 * Fenêtres (en minutes depuis minuit) durant lesquelles un événement s'applique à
 * une salle donnée, un jour donné — utilisé pour valider un placement MANUEL
 * (heure libre à la minute) contre les mêmes événements que le générateur
 * automatique. La fenêtre d'un bloc va de (horaire de référence - AJUSTEMENT_MAX)
 * jusqu'au début du bloc suivant (ou fin de journée pour le dernier bloc).
 */
export function fenetresEvenements(
  jour: Jour,
  salleIndex: number
): { debut: number; fin: number; event: EvenementSpecial }[] {
  const fenetres: { debut: number; fin: number; event: EvenementSpecial }[] = [];
  for (let i = 0; i < BLOCS.length; i++) {
    const bloc = BLOCS[i];
    const event = evenementPourBlocSalle(jour, bloc.nom, salleIndex);
    if (!event) continue;
    const heureBase = heureVersMinutes(event.heureDebut ?? bloc.horaires[salleIndex]);
    const blocSuivant = BLOCS[i + 1];
    const fin = blocSuivant ? heureVersMinutes(blocSuivant.horaires[salleIndex]) : MINUTES_JOUR;
    fenetres.push({ debut: heureBase - AJUSTEMENT_MAX, fin, event });
  }
  return fenetres;
}

/** Les deux salles peuvent-elles démarrer à la même heure pour ce bloc, ce jour ? (matin, ou événement qui l'autorise explicitement) */
export function heureIdentiqueAutorisee(jour: Jour, bloc: NomBloc): boolean {
  if (bloc === "matin") return true;
  const e0 = evenementPourBlocSalle(jour, bloc, 0);
  const e1 = evenementPourBlocSalle(jour, bloc, 1);
  return !!e0 && e0 === e1 && (e0.heuresIdentiquesAutorisees ?? true);
}
