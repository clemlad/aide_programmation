"use client";

import { useEffect, useState } from "react";
import { couleurFilm, formatDuree, lireJsonSecurise } from "@/lib/planning-utils";

type Film = { id: string; titre: string; dureeMinutes: number; classification: string | null };

const OPTIONS_CLASSIFICATION = [
  { valeur: "", label: "Tous publics" },
  { valeur: "12", label: "Interdit -12 ans" },
  { valeur: "16", label: "Interdit -16 ans" },
  { valeur: "18", label: "Interdit -18 ans" },
];

export default function Films() {
  const [films, setFilms] = useState<Film[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [formOuvert, setFormOuvert] = useState(false);
  const [filmEnEdition, setFilmEnEdition] = useState<Film | null>(null);
  const [titre, setTitre] = useState("");
  const [heures, setHeures] = useState("");
  const [minutes, setMinutes] = useState("");
  const [classification, setClassification] = useState("");

  function chargerFilms() {
    fetch("/api/films")
      .then(r => r.json())
      .then(f => { setFilms(f); setChargement(false); });
  }
  useEffect(() => { chargerFilms(); }, []);

  function ouvrirNouveauFilm() {
    setFilmEnEdition(null);
    setTitre(""); setHeures(""); setMinutes(""); setClassification("");
    setErreur("");
    setFormOuvert(true);
  }

  function ouvrirEditionFilm(f: Film) {
    setFilmEnEdition(f);
    setTitre(f.titre);
    setHeures(String(Math.floor(f.dureeMinutes / 60)));
    setMinutes(String(f.dureeMinutes % 60));
    setClassification(f.classification ?? "");
    setErreur("");
    setFormOuvert(true);
  }

  async function enregistrer() {
    setErreur("");
    const dureeMinutes = (Number(heures) || 0) * 60 + (Number(minutes) || 0);
    if (!titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (dureeMinutes <= 0) { setErreur("La durée doit être supérieure à 0."); return; }

    if (filmEnEdition) {
      await fetch("/api/films", {
        method: "PATCH",
        body: JSON.stringify({ id: filmEnEdition.id, titre, dureeMinutes, classification: classification || null }),
      });
    } else {
      const res = await fetch("/api/films", {
        method: "POST",
        body: JSON.stringify({ titre, dureeMinutes, classification: classification || null }),
      });
      if (!res.ok) {
        const d = await lireJsonSecurise(res);
        setErreur(d?.erreur ?? `Erreur lors de l'ajout (${res.status}). Regarde le terminal du serveur pour le détail.`);
        return;
      }
    }
    setFormOuvert(false);
    chargerFilms();
  }

  async function supprimerFilm(id: string) {
    setErreur("");
    const res = await fetch("/api/films", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) {
      const d = await lireJsonSecurise(res);
      setErreur(`Impossible de retirer ce film : ${d?.erreur ?? "il est peut-être encore programmé quelque part."}`);
      return;
    }
    chargerFilms();
  }

  return (
    <main>
      <h1>Films</h1>
      <p style={{ color: "var(--text-dim)" }}>
        Chaque film devient une carte de couleur, réutilisable dans l'onglet{" "}
        <a href="/programmation">Programmation</a> par glisser-déposer.
      </p>

      {erreur && <div className="alerte">{erreur}</div>}

      <div className="grille-cartes-films">
        <button type="button" className="carte-film carte-film--ajout" onClick={ouvrirNouveauFilm}>
          <span className="carte-film-plus">+</span>
          <span>Ajouter un film</span>
        </button>

        {films.map(f => (
          <div key={f.id} className="carte-film" style={{ borderColor: couleurFilm(f.id) }}>
            <div className="carte-film-bandeau" style={{ background: couleurFilm(f.id) }} />
            <div className="carte-film-corps">
              <h3>{f.titre}</h3>
              <p className="carte-film-duree">{formatDuree(f.dureeMinutes)}</p>
              {f.classification && <span className="badge-classification">{f.classification}</span>}
            </div>
            <div className="carte-film-actions">
              <button type="button" className="secondaire" onClick={() => ouvrirEditionFilm(f)}>Modifier</button>
              <button type="button" className="secondaire" onClick={() => supprimerFilm(f.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      {chargement && <p style={{ color: "var(--text-dim)" }}>Chargement…</p>}
      {!chargement && films.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>Aucun film pour l'instant — clique sur "Ajouter un film" pour commencer.</p>
      )}

      {formOuvert && (
        <div className="fond-modale" onClick={() => setFormOuvert(false)}>
          <div className="modale" onClick={e => e.stopPropagation()}>
            <h2>{filmEnEdition ? "Modifier le film" : "Nouveau film"}</h2>
            <div className="champ">
              <label>Titre</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} autoFocus />
            </div>
            <div className="ligne">
              <div className="champ">
                <label>Heures</label>
                <input type="number" min={0} value={heures} onChange={e => setHeures(e.target.value)} style={{ width: "5rem" }} />
              </div>
              <div className="champ">
                <label>Minutes</label>
                <input type="number" min={0} max={59} value={minutes} onChange={e => setMinutes(e.target.value)} style={{ width: "5rem" }} />
              </div>
              <div className="champ">
                <label>Accessibilité</label>
                <select value={classification} onChange={e => setClassification(e.target.value)}>
                  {OPTIONS_CLASSIFICATION.map(o => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="ligne" style={{ marginTop: "1rem", justifyContent: "flex-end" }}>
              <button type="button" className="secondaire" onClick={() => setFormOuvert(false)}>Annuler</button>
              <button type="button" onClick={enregistrer}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
