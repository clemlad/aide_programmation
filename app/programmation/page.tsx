"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { couleurFilm, formatDuree, minutesVersHeure, heureVersMinutes, trouverConflit, MINUTES_JOUR, lireJsonSecurise } from "@/lib/planning-utils";

type Film = { id: string; titre: string; dureeMinutes: number; classification: string | null; seancesParSemaine: number };
type Placement = {
  id: string;
  semaine: number;
  jour: string;
  salleIndex: number;
  heureDebut: number;
  film: Film;
};

const JOURS: { valeur: string; label: string }[] = [
  { valeur: "MERCREDI", label: "Mercredi" },
  { valeur: "JEUDI", label: "Jeudi" },
  { valeur: "VENDREDI", label: "Vendredi" },
  { valeur: "SAMEDI", label: "Samedi" },
  { valeur: "DIMANCHE", label: "Dimanche" },
  { valeur: "LUNDI", label: "Lundi" },
  { valeur: "MARDI", label: "Mardi" },
];

const NOMS_SALLES = ["Salle 1", "Salle 2"];
const REPERES_HEURES = Array.from({ length: 24 }, (_, i) => i); // 0..23

type DragInfo =
  | { type: "nouveau"; filmId: string; titre: string; dureeMinutes: number }
  | { type: "deplacement"; placementId: string; filmId: string; titre: string; dureeMinutes: number };

type Fantome = { salleIndex: number; heureDebut: number; dureeMinutes: number; titre: string; conflit: boolean } | null;

function minutesDepuisPosition(rect: DOMRect, clientX: number): number {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const brut = Math.round(ratio * MINUTES_JOUR);
  return Math.min(MINUTES_JOUR - 5, Math.max(0, Math.round(brut / 5) * 5));
}

export default function Programmation() {
  const [films, setFilms] = useState<Film[]>([]);
  const [semaine, setSemaine] = useState<1 | 2>(1);
  const [jour, setJour] = useState(JOURS[0].valeur);

  // Placements de TOUTE la semaine sélectionnée (7 jours) : sert à la fois à la
  // frise du jour courant (filtré côté client) et aux compteurs de séances
  // restantes, qui portent sur la semaine entière — voir cahier des charges §5 :
  // "les compteurs doivent conserver leurs valeurs" en changeant de jour.
  const [placementsSemaine, setPlacementsSemaine] = useState<Placement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [fantome, setFantome] = useState<Fantome>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [heureEdition, setHeureEdition] = useState("");

  const bandeRefs = useRef<(HTMLDivElement | null)[]>([null, null]);

  useEffect(() => {
    fetch("/api/films").then(r => r.json()).then(setFilms);
  }, []);

  async function chargerPlacementsSemaine(s: number) {
    setChargement(true);
    const res = await fetch(`/api/placements?semaine=${s}`);
    const p = await lireJsonSecurise<Placement[]>(res);
    if (!res.ok || !p) {
      setErreur((p as any)?.erreur ?? `Impossible de charger le planning de cette semaine (${res.status}).`);
      setPlacementsSemaine([]);
    } else {
      setPlacementsSemaine(p);
    }
    setChargement(false);
  }
  useEffect(() => {
    chargerPlacementsSemaine(semaine);
  }, [semaine]);

  const placementsJour = placementsSemaine.filter(p => p.jour === jour);

  function placementsSalle(salleIndex: number) {
    return placementsJour.filter(p => p.salleIndex === salleIndex);
  }

  function seancesRestantes(film: Film): number {
    const nbPlacees = placementsSemaine.filter(p => p.film.id === film.id).length;
    return Math.max(0, film.seancesParSemaine - nbPlacees);
  }

  function calculerConflit(salleIndex: number, heureDebut: number, dureeMinutes: number, ignorerId?: string) {
    const occupes = placementsSalle(salleIndex).map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes }));
    return trouverConflit(occupes, { id: ignorerId, heureDebut, dureeMinutes });
  }

  // --- Démarrage d'un glisser depuis la palette de films ---
  function debuterDragNouveau(e: DragEvent, film: Film) {
    if (seancesRestantes(film) <= 0) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", film.id);
    e.dataTransfer.effectAllowed = "copy";
    setDragInfo({ type: "nouveau", filmId: film.id, titre: film.titre, dureeMinutes: film.dureeMinutes });
  }

  // --- Démarrage d'un glisser depuis un bloc déjà placé ---
  function debuterDragDeplacement(e: DragEvent, p: Placement) {
    e.dataTransfer.setData("text/plain", p.id);
    e.dataTransfer.effectAllowed = "move";
    setDragInfo({ type: "deplacement", placementId: p.id, filmId: p.film.id, titre: p.film.titre, dureeMinutes: p.film.dureeMinutes });
  }

  function survolBande(e: DragEvent, salleIndex: number) {
    e.preventDefault();
    if (!dragInfo) return;
    const rect = bandeRefs.current[salleIndex]?.getBoundingClientRect();
    if (!rect) return;
    const heureDebut = minutesDepuisPosition(rect, e.clientX);
    const ignorerId = dragInfo.type === "deplacement" ? dragInfo.placementId : undefined;
    const depasseMinuit = heureDebut + dragInfo.dureeMinutes > MINUTES_JOUR;
    const conflit = !depasseMinuit && !!calculerConflit(salleIndex, heureDebut, dragInfo.dureeMinutes, ignorerId);
    setFantome({ salleIndex, heureDebut, dureeMinutes: dragInfo.dureeMinutes, titre: dragInfo.titre, conflit: conflit || depasseMinuit });
  }

  async function deposerSurBande(e: DragEvent, salleIndex: number) {
    e.preventDefault();
    if (!dragInfo) return;
    const rect = bandeRefs.current[salleIndex]?.getBoundingClientRect();
    const heureDebut = rect ? minutesDepuisPosition(rect, e.clientX) : 0;

    if (heureDebut + dragInfo.dureeMinutes > MINUTES_JOUR) {
      setErreur(`"${dragInfo.titre}" dépasserait minuit à cette heure de début — choisis une heure plus tôt.`);
      setDragInfo(null);
      setFantome(null);
      return;
    }

    const ignorerId = dragInfo.type === "deplacement" ? dragInfo.placementId : undefined;
    const conflit = calculerConflit(salleIndex, heureDebut, dragInfo.dureeMinutes, ignorerId);
    if (conflit) {
      const filmConflit = placementsJour.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
      setErreur(`Impossible de placer "${dragInfo.titre}" ici : chevauchement avec "${filmConflit}" dans ${NOMS_SALLES[salleIndex]}.`);
      setDragInfo(null);
      setFantome(null);
      return;
    }

    setErreur("");
    if (dragInfo.type === "nouveau") {
      const res = await fetch("/api/placements", {
        method: "POST",
        body: JSON.stringify({ semaine, jour, salleIndex, heureDebut, filmId: dragInfo.filmId }),
      });
      const d = await lireJsonSecurise(res);
      if (res.ok && d) {
        setPlacementsSemaine(prev => [...prev, d as Placement]); // décrémente le compteur (recalculé au rendu)
      } else {
        setErreur((d as any)?.erreur ?? `Impossible de placer ce film (${res.status}).`);
      }
    } else {
      // mise à jour optimiste
      setPlacementsSemaine(prev => prev.map(p => (p.id === dragInfo.placementId ? { ...p, salleIndex, heureDebut } : p)));
      const res = await fetch(`/api/placements/${dragInfo.placementId}`, {
        method: "PATCH",
        body: JSON.stringify({ salleIndex, heureDebut }),
      });
      if (!res.ok) {
        const d = await lireJsonSecurise(res);
        setErreur((d as any)?.erreur ?? `Impossible de déplacer ce film (${res.status}).`);
        chargerPlacementsSemaine(semaine); // annule la mise à jour optimiste en cas d'échec
      }
    }
    setDragInfo(null);
    setFantome(null);
  }

  function finDrag() {
    setDragInfo(null);
    setFantome(null);
  }

  async function supprimerPlacement(id: string) {
    setErreur("");
    setPlacementsSemaine(prev => prev.filter(p => p.id !== id)); // le compteur remonte automatiquement
    await fetch(`/api/placements/${id}`, { method: "DELETE" });
    if (editionId === id) setEditionId(null);
  }

  function ouvrirEdition(p: Placement) {
    setEditionId(p.id);
    setHeureEdition(minutesVersHeure(p.heureDebut));
    setErreur("");
  }

  async function validerEdition(p: Placement) {
    const heureDebut = heureVersMinutes(heureEdition);
    setErreur("");
    const res = await fetch(`/api/placements/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ heureDebut }),
    });
    const d = await lireJsonSecurise(res);
    if (res.ok && d) {
      setPlacementsSemaine(prev => prev.map(x => (x.id === p.id ? (d as Placement) : x)));
      setEditionId(null);
    } else {
      setErreur((d as any)?.erreur ?? "Heure invalide.");
    }
  }

  const filmsProgrammables = films.filter(f => f.seancesParSemaine > 0);

  return (
    <main>
      <h1>Programmation</h1>
      <p style={{ color: "var(--text-dim)" }}>
        Glisse un film depuis la palette vers l'une des deux salles. Glisse un film déjà placé pour le déplacer.
        Clique sur son horaire pour le régler précisément.
      </p>

      <div className="selecteur-jours" style={{ marginBottom: "0.5rem" }}>
        {[1, 2].map(s => (
          <button
            key={s}
            type="button"
            className={s === semaine ? "jour-actif" : "jour-inactif"}
            onClick={() => setSemaine(s as 1 | 2)}
          >
            Semaine {s}
          </button>
        ))}
      </div>

      <div className="selecteur-jours">
        {JOURS.map(j => (
          <button
            key={j.valeur}
            type="button"
            className={j.valeur === jour ? "jour-actif" : "jour-inactif"}
            onClick={() => setJour(j.valeur)}
          >
            {j.label}
          </button>
        ))}
      </div>

      {erreur && <div className="alerte">{erreur}</div>}

      <section className="panneau">
        <h2>Films disponibles — Semaine {semaine}</h2>
        {filmsProgrammables.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            Aucun film avec un quota de séances par semaine — règle-le dans l'onglet <a href="/films">Films</a>.
          </p>
        ) : (
          <div className="palette-films">
            {filmsProgrammables.map(f => {
              const restantes = seancesRestantes(f);
              return (
                <div
                  key={f.id}
                  className="carte-palette"
                  style={{ background: couleurFilm(f.id), opacity: restantes <= 0 ? 0.4 : 1 }}
                  draggable={restantes > 0}
                  onDragStart={e => debuterDragNouveau(e, f)}
                  onDragEnd={finDrag}
                  title={restantes <= 0 ? "Quota de la semaine atteint" : undefined}
                >
                  <span className="carte-palette-titre">{f.titre}</span>
                  <span className="carte-palette-duree">{formatDuree(f.dureeMinutes)}</span>
                  <span className="carte-palette-duree">{restantes} / {f.seancesParSemaine} restantes</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {chargement ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement…</p>
      ) : (
        [0, 1].map(salleIndex => (
          <section className="panneau" key={salleIndex}>
            <h2>{NOMS_SALLES[salleIndex]}</h2>
            <div className="reperes-heures">
              {REPERES_HEURES.map(h => (
                <span key={h} className="repere-heure">
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </div>
            <div
              className="bande-horaire"
              ref={el => {
                bandeRefs.current[salleIndex] = el;
              }}
              onDragOver={e => survolBande(e, salleIndex)}
              onDrop={e => deposerSurBande(e, salleIndex)}
              onDragLeave={() => setFantome(f => (f?.salleIndex === salleIndex ? null : f))}
            >
              {REPERES_HEURES.map(h => (
                <div key={h} className="trait-heure" style={{ left: `${(h / 24) * 100}%` }} />
              ))}

              {placementsSalle(salleIndex).map(p => {
                const fin = p.heureDebut + p.film.dureeMinutes;
                return (
                  <div
                    key={p.id}
                    className={`bloc-seance${dragInfo?.type === "deplacement" && dragInfo.placementId === p.id ? " bloc-seance--fantomise" : ""}`}
                    style={{
                      left: `${(p.heureDebut / MINUTES_JOUR) * 100}%`,
                      width: `${(p.film.dureeMinutes / MINUTES_JOUR) * 100}%`,
                      background: couleurFilm(p.film.id),
                    }}
                    draggable
                    onDragStart={e => debuterDragDeplacement(e, p)}
                    onDragEnd={finDrag}
                  >
                    <button type="button" className="bloc-seance-supprimer" onClick={() => supprimerPlacement(p.id)} title="Supprimer cette séance">
                      ×
                    </button>
                    <span className="bloc-seance-titre">{p.film.titre}</span>
                    <button type="button" className="bloc-seance-horaire" onClick={() => ouvrirEdition(p)}>
                      {minutesVersHeure(p.heureDebut)} – {minutesVersHeure(fin)}
                    </button>

                    {editionId === p.id && (
                      <div className="popover-heure" onClick={e => e.stopPropagation()}>
                        <input type="time" value={heureEdition} onChange={e => setHeureEdition(e.target.value)} />
                        <div className="ligne" style={{ marginTop: "0.4rem" }}>
                          <button type="button" className="secondaire" onClick={() => setEditionId(null)}>
                            Annuler
                          </button>
                          <button type="button" onClick={() => validerEdition(p)}>
                            Valider
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {fantome && fantome.salleIndex === salleIndex && (
                <div
                  className={`bloc-fantome${fantome.conflit ? " bloc-fantome--conflit" : ""}`}
                  style={{
                    left: `${(fantome.heureDebut / MINUTES_JOUR) * 100}%`,
                    width: `${(fantome.dureeMinutes / MINUTES_JOUR) * 100}%`,
                  }}
                >
                  {minutesVersHeure(fantome.heureDebut)}
                </div>
              )}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
