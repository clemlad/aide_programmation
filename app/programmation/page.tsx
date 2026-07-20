"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  couleurFilm,
  formatDuree,
  minutesVersHeure,
  heureVersMinutes,
  trouverConflit,
  decalerCreneaux,
  jourPrecedent,
  jourSuivant,
  MINUTES_JOUR,
  lireJsonSecurise,
  type Jour,
  type CreneauOccupe,
} from "@/lib/planning-utils";

type Film = { id: string; titre: string; dureeMinutes: number; classification: string | null };
type Placement = {
  id: string;
  semaine: number;
  jour: string;
  salleIndex: number;
  heureDebut: number;
  film: Film;
};

const JOURS_AFFICHES: { valeur: Jour; label: string }[] = [
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
  const [jour, setJour] = useState<Jour>(JOURS_AFFICHES[0].valeur);

  const [placementsJour, setPlacementsJour] = useState<Placement[]>([]);
  // Séances de la veille qui débordent après minuit : affichées en début de
  // frise aujourd'hui (lecture seule) et utilisées pour la détection de
  // chevauchement côté client (l'API refait de toute façon la vérification).
  const [placementsVeille, setPlacementsVeille] = useState<Placement[]>([]);
  const [placementsLendemain, setPlacementsLendemain] = useState<Placement[]>([]);
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

  async function chargerJournee(s: number, j: Jour) {
    setChargement(true);
    const [resJour, resVeille, resLendemain] = await Promise.all([
      fetch(`/api/placements?semaine=${s}&jour=${j}`),
      fetch(`/api/placements?semaine=${s}&jour=${jourPrecedent(j)}`),
      fetch(`/api/placements?semaine=${s}&jour=${jourSuivant(j)}`),
    ]);
    const [pJour, pVeille, pLendemain] = await Promise.all([
      lireJsonSecurise<Placement[]>(resJour),
      lireJsonSecurise<Placement[]>(resVeille),
      lireJsonSecurise<Placement[]>(resLendemain),
    ]);
    if (!resJour.ok || !pJour) {
      setErreur((pJour as any)?.erreur ?? `Impossible de charger le planning de ce jour (${resJour.status}).`);
      setPlacementsJour([]);
    } else {
      setPlacementsJour(pJour);
    }
    setPlacementsVeille(resVeille.ok && pVeille ? pVeille : []);
    setPlacementsLendemain(resLendemain.ok && pLendemain ? pLendemain : []);
    setChargement(false);
  }
  useEffect(() => {
    chargerJournee(semaine, jour);
  }, [semaine, jour]);

  function placementsSalle(salleIndex: number) {
    return placementsJour.filter(p => p.salleIndex === salleIndex);
  }

  /** Débordements de la veille visibles en tout début de frise aujourd'hui. */
  function debordsVeilleSalle(salleIndex: number) {
    return placementsVeille.filter(p => p.salleIndex === salleIndex && p.heureDebut + p.film.dureeMinutes > MINUTES_JOUR);
  }

  function versCreneaux(liste: Placement[], salleIndex: number): CreneauOccupe[] {
    return liste.filter(p => p.salleIndex === salleIndex).map(p => ({ id: p.id, heureDebut: p.heureDebut, dureeMinutes: p.film.dureeMinutes }));
  }

  /** Même logique que l'API (voir app/api/placements/route.ts) : compare aussi
   * contre la veille et le lendemain décalés, pour prévisualiser correctement
   * un chevauchement qui déborderait après minuit. */
  function calculerConflit(salleIndex: number, heureDebut: number, dureeMinutes: number, ignorerId?: string) {
    const occupesJour = versCreneaux(placementsJour, salleIndex);
    const occupesVeille = decalerCreneaux(versCreneaux(placementsVeille, salleIndex), -MINUTES_JOUR);
    const occupesLendemain = decalerCreneaux(versCreneaux(placementsLendemain, salleIndex), MINUTES_JOUR);
    return trouverConflit([...occupesJour, ...occupesVeille, ...occupesLendemain], { id: ignorerId, heureDebut, dureeMinutes });
  }

  // --- Démarrage d'un glisser depuis la palette de films ---
  function debuterDragNouveau(e: DragEvent, film: Film) {
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
    const conflit = !!calculerConflit(salleIndex, heureDebut, dragInfo.dureeMinutes, ignorerId);
    setFantome({ salleIndex, heureDebut, dureeMinutes: dragInfo.dureeMinutes, titre: dragInfo.titre, conflit });
  }

  async function deposerSurBande(e: DragEvent, salleIndex: number) {
    e.preventDefault();
    if (!dragInfo) return;
    const rect = bandeRefs.current[salleIndex]?.getBoundingClientRect();
    const heureDebut = rect ? minutesDepuisPosition(rect, e.clientX) : 0;

    const ignorerId = dragInfo.type === "deplacement" ? dragInfo.placementId : undefined;
    const conflit = calculerConflit(salleIndex, heureDebut, dragInfo.dureeMinutes, ignorerId);
    if (conflit) {
      const tousLesTitres = [...placementsJour, ...placementsVeille, ...placementsLendemain];
      const filmConflit = tousLesTitres.find(p => p.id === conflit.id)?.film.titre ?? "une autre séance";
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
        setPlacementsJour(prev => [...prev, d as Placement]);
      } else {
        setErreur((d as any)?.erreur ?? `Impossible de placer ce film (${res.status}).`);
      }
    } else {
      // mise à jour optimiste
      setPlacementsJour(prev => prev.map(p => (p.id === dragInfo.placementId ? { ...p, salleIndex, heureDebut } : p)));
      const res = await fetch(`/api/placements/${dragInfo.placementId}`, {
        method: "PATCH",
        body: JSON.stringify({ salleIndex, heureDebut }),
      });
      if (!res.ok) {
        const d = await lireJsonSecurise(res);
        setErreur((d as any)?.erreur ?? `Impossible de déplacer ce film (${res.status}).`);
        chargerJournee(semaine, jour); // annule la mise à jour optimiste en cas d'échec
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
    setPlacementsJour(prev => prev.filter(p => p.id !== id));
    setPlacementsVeille(prev => prev.filter(p => p.id !== id));
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
      setPlacementsJour(prev => prev.map(x => (x.id === p.id ? (d as Placement) : x)));
      setEditionId(null);
    } else {
      setErreur((d as any)?.erreur ?? "Heure invalide.");
    }
  }

  return (
    <main>
      <h1>Programmation</h1>
      <p style={{ color: "var(--text-dim)" }}>
        Glisse un film depuis la palette vers l'une des deux salles. Glisse un film déjà placé pour le déplacer.
        Clique sur son horaire pour le régler précisément. Un film peut commencer dès que le précédent se termine,
        et peut se terminer après minuit — la portion après minuit apparaît alors en début de frise le jour suivant.
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
        {JOURS_AFFICHES.map(j => (
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
        <h2>Films disponibles</h2>
        {films.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            Aucun film pour l'instant — ajoutes-en dans l'onglet <a href="/films">Films</a>.
          </p>
        ) : (
          <div className="palette-films">
            {films.map(f => (
              <div
                key={f.id}
                className="carte-palette"
                style={{ background: couleurFilm(f.id) }}
                draggable
                onDragStart={e => debuterDragNouveau(e, f)}
                onDragEnd={finDrag}
              >
                <span className="carte-palette-titre">{f.titre}</span>
                <span className="carte-palette-duree">{formatDuree(f.dureeMinutes)}</span>
              </div>
            ))}
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

              {debordsVeilleSalle(salleIndex).map(p => {
                const largeurPct = Math.min(100, ((p.heureDebut + p.film.dureeMinutes - MINUTES_JOUR) / MINUTES_JOUR) * 100);
                return (
                  <div
                    key={`debord-${p.id}`}
                    className="bloc-seance bloc-seance--debord"
                    style={{ left: "0%", width: `${largeurPct}%`, background: couleurFilm(p.film.id) }}
                    title="Suite de la séance de la veille — modifie-la depuis le jour précédent."
                  >
                    <button
                      type="button"
                      className="bloc-seance-supprimer"
                      onClick={() => supprimerPlacement(p.id)}
                      title="Supprimer cette séance"
                    >
                      ×
                    </button>
                    <span className="bloc-seance-titre">{p.film.titre} (suite)</span>
                    <span className="bloc-seance-horaire">
                      00:00 – {minutesVersHeure(p.heureDebut + p.film.dureeMinutes)}
                    </span>
                  </div>
                );
              })}

              {placementsSalle(salleIndex).map(p => {
                const fin = p.heureDebut + p.film.dureeMinutes;
                const finApresMinuit = fin > MINUTES_JOUR;
                const gauchePct = (p.heureDebut / MINUTES_JOUR) * 100;
                // Largeur visuelle bornée au bord droit de la frise (le film continue
                // réellement le lendemain — voir le bloc "(suite)" affiché sur le jour
                // suivant — mais cette frise ne représente qu'une seule journée).
                const largeurPct = Math.min((p.film.dureeMinutes / MINUTES_JOUR) * 100, 100 - gauchePct);
                return (
                  <div
                    key={p.id}
                    className={`bloc-seance${dragInfo?.type === "deplacement" && dragInfo.placementId === p.id ? " bloc-seance--fantomise" : ""}`}
                    style={{
                      left: `${gauchePct}%`,
                      width: `${largeurPct}%`,
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
                      {finApresMinuit ? " (+1j)" : ""}
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
                    width: `${Math.min((fantome.dureeMinutes / MINUTES_JOUR) * 100, 100 - (fantome.heureDebut / MINUTES_JOUR) * 100)}%`,
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
