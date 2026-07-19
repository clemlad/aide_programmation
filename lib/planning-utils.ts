// Fonctions pures partagées entre le client (drag & drop), les routes API et le
// générateur automatique (lib/scheduler.ts). Aucun import Prisma ici : ce fichier
// doit rester utilisable côté navigateur.

export const MINUTES_JOUR = 24 * 60; // 1440

// Marge minimale (en minutes) entre la fin d'une séance et le début de la
// suivante, dans une même salle. Source unique de vérité : utilisée à la fois
// par la programmation manuelle (frise, API /api/placements) et par le
// générateur automatique (lib/scheduler.ts), pour garantir que les deux modes
// appliquent exactement la même règle métier (cahier des charges V9, §"Marge
// entre les films" + §"Vérifications à effectuer").
export const MARGE_MIN_ENTRE_FILMS = 15;

/** Convertit "HH:mm" en minutes depuis minuit. */
export function heureVersMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

/** Convertit des minutes depuis minuit en "HH:mm". */
export function minutesVersHeure(minutes: number): string {
  const m = ((minutes % MINUTES_JOUR) + MINUTES_JOUR) % MINUTES_JOUR;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Formate une durée en minutes en "1 h 35" / "45 min" / "2 h". */
export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Deux créneaux [aDebut, aFin) et [bDebut, bFin) sont-ils en conflit, en tenant
 * compte d'une marge minimale obligatoire entre eux (pas seulement d'un
 * chevauchement strict) ? `marge` par défaut = MARGE_MIN_ENTRE_FILMS.
 */
export function seChevauchent(
  aDebut: number,
  aFin: number,
  bDebut: number,
  bFin: number,
  marge: number = MARGE_MIN_ENTRE_FILMS
): boolean {
  return aDebut < bFin + marge && bDebut < aFin + marge;
}

export type CreneauOccupe = { id: string; heureDebut: number; dureeMinutes: number };

/**
 * Cherche un créneau de la liste qui entre en conflit avec le candidat (en tenant
 * compte de la marge minimale). `candidat.id` (s'il existe) est ignoré dans la
 * comparaison, pour permettre de vérifier le déplacement d'une séance déjà placée
 * sans qu'elle se bloque elle-même.
 */
export function trouverConflit(
  placements: CreneauOccupe[],
  candidat: { id?: string; heureDebut: number; dureeMinutes: number },
  marge: number = MARGE_MIN_ENTRE_FILMS
): CreneauOccupe | null {
  const finCandidat = candidat.heureDebut + candidat.dureeMinutes;
  for (const p of placements) {
    if (candidat.id && p.id === candidat.id) continue;
    const finP = p.heureDebut + p.dureeMinutes;
    if (seChevauchent(candidat.heureDebut, finCandidat, p.heureDebut, finP, marge)) return p;
  }
  return null;
}

/**
 * Lit le JSON d'une réponse fetch sans jamais lever d'exception : si le corps est vide
 * ou invalide (ex: crash serveur qui a coupé la réponse), retourne null au lieu de planter.
 */
export async function lireJsonSecurise<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Couleur déterministe (même film = même couleur partout) dérivée de l'id du film. */
export function couleurFilm(filmId: string): string {
  let hash = 0;
  for (let i = 0; i < filmId.length; i++) {
    hash = (hash * 31 + filmId.charCodeAt(i)) >>> 0;
  }
  const teinte = hash % 360;
  return `hsl(${teinte}, 62%, 50%)`;
}
