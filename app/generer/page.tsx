"use client";

import { useEffect, useState } from "react";

type Film = { id: string; titre: string; dureeMinutes: number; classification: string | null };
type SeanceGeneree = { filmId: string; salleIndex: number; jour: string; blocNom: string; heureDebut: string; semaine: string };
type FilmNonComplet = { filmId: string; titre: string; seancesRestantes: number };
type SemaineDemandee = { anneeIso: number; numeroIso: number };

const JOURS = ["MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE", "LUNDI", "MARDI"];
const OPTIONS_CLASSIFICATION = [
  { valeur: "", label: "Tous publics" },
  { valeur: "12", label: "Interdit -12 ans" },
  { valeur: "16", label: "Interdit -16 ans" },
  { valeur: "18", label: "Interdit -18 ans" },
];

export default function Generer() {
  const [films, setFilms] = useState<Film[]>([]);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [erreurFilm, setErreurFilm] = useState("");

  const [nouveauTitre, setNouveauTitre] = useState("");
  const [nouvelleDuree, setNouvelleDuree] = useState("");
  const [nouvelleClassif, setNouvelleClassif] = useState("");

  const [semaines, setSemaines] = useState<SemaineDemandee[]>([{ anneeIso: new Date().getFullYear(), numeroIso: 1 }]);

  const [resultatsParSemaine, setResultatsParSemaine] = useState<
    Record<string, { seances: SeanceGeneree[]; filmsNonComplets: FilmNonComplet[] }>
  >({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  function chargerFilms() {
    fetch("/api/films").then(r => r.json()).then(setFilms);
  }
  useEffect(() => { chargerFilms(); }, []);

  async function ajouterFilm() {
    setErreurFilm("");
    if (!nouveauTitre || !nouvelleDuree) { setErreurFilm("Titre et durée requis."); return; }
    const res = await fetch("/api/films", {
      method: "POST",
      body: JSON.stringify({ titre: nouveauTitre, dureeMinutes: Number(nouvelleDuree), classification: nouvelleClassif || null }),
    });
    if (!res.ok) { const d = await res.json(); setErreurFilm(d.erreur ?? "Erreur lors de l'ajout."); return; }
    setNouveauTitre(""); setNouvelleDuree(""); setNouvelleClassif("");
    chargerFilms();
  }

  async function modifierFilm(id: string, champ: string, valeur: string) {
    await fetch("/api/films", { method: "PATCH", body: JSON.stringify({ id, [champ]: valeur }) });
    chargerFilms();
  }

  async function supprimerFilm(id: string) {
    setErreurFilm("");
    const res = await fetch("/api/films", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) {
      const d = await res.json();
      setErreurFilm(`Impossible de retirer ce film : ${d.erreur ?? "erreur inconnue"}`);
      return;
    }
    setQuotas(q => { const c = { ...q }; delete c[id]; return c; });
    chargerFilms();
  }

  function ajouterSemaine() {
    setSemaines([...semaines, { anneeIso: new Date().getFullYear(), numeroIso: semaines.length + 1 }]);
  }
  function retirerSemaine(index: number) {
    setSemaines(semaines.filter((_, i) => i !== index));
  }
  function modifierSemaine(index: number, champ: keyof SemaineDemandee, valeur: string) {
    const copie = [...semaines];
    copie[index] = { ...copie[index], [champ]: Number(valeur) };
    setSemaines(copie);
  }

  async function generer() {
    setEnCours(true); setErreur(""); setResultatsParSemaine({});
    const filmsChoisis = Object.entries(quotas)
      .filter(([, q]) => q > 0)
      .map(([filmId, nbSeancesSouhaite]) => ({ filmId, nbSeancesSouhaite }));

    if (filmsChoisis.length === 0) { setErreur("Donne un quota de séances à au moins un film."); setEnCours(false); return; }
    if (semaines.length === 0) { setErreur("Ajoute au moins une semaine."); setEnCours(false); return; }

    const res = await fetch("/api/generer", { method: "POST", body: JSON.stringify({ films: filmsChoisis, semaines }) });
    const data = await res.json();
    setEnCours(false);
    if (!res.ok) { setErreur(data.erreur ?? "Erreur inconnue."); return; }

    const groupes: Record<string, SeanceGeneree[]> = {};
    for (const s of data.seances as SeanceGeneree[]) {
      groupes[s.semaine] = groupes[s.semaine] || [];
      groupes[s.semaine].push(s);
    }
    const resultats: typeof resultatsParSemaine = {};
    for (const cle of Object.keys(groupes)) {
      resultats[cle] = { seances: groupes[cle], filmsNonComplets: data.filmsNonComplets };
    }
    setResultatsParSemaine(resultats);
  }

  return (
    <main>
      <h1>Générer un planning</h1>

      <section className="panneau">
        <h2>Films</h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Titre, durée, accessibilité. Rien d'autre à configurer — horaires et salles sont fixes.
        </p>
        <div className="ligne">
          <div className="champ"><label>Titre</label><input value={nouveauTitre} onChange={e => setNouveauTitre(e.target.value)} /></div>
          <div className="champ"><label>Durée (min)</label><input type="number" value={nouvelleDuree} onChange={e => setNouvelleDuree(e.target.value)} style={{ width: "6rem" }} /></div>
          <div className="champ">
            <label>Accessibilité</label>
            <select value={nouvelleClassif} onChange={e => setNouvelleClassif(e.target.value)}>
              {OPTIONS_CLASSIFICATION.map(o => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={ajouterFilm}>Ajouter</button>
        </div>
        {erreurFilm && <div className="alerte">{erreurFilm}</div>}

        <table>
          <thead><tr><th>Film</th><th>Durée</th><th>Accessibilité</th><th>Séances souhaitées</th><th></th></tr></thead>
          <tbody>
            {films.map(f => (
              <tr key={f.id}>
                <td>{f.titre}</td>
                <td>
                  <input type="number" defaultValue={f.dureeMinutes} style={{ width: "4.5rem" }}
                    onBlur={e => e.target.value !== String(f.dureeMinutes) && modifierFilm(f.id, "dureeMinutes", e.target.value)} /> min
                </td>
                <td>
                  <select defaultValue={f.classification ?? ""} onChange={e => modifierFilm(f.id, "classification", e.target.value)}>
                    {OPTIONS_CLASSIFICATION.map(o => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={0} style={{ width: "4rem" }}
                    value={quotas[f.id] ?? 0}
                    onChange={e => setQuotas({ ...quotas, [f.id]: Number(e.target.value) })} />
                </td>
                <td><button className="secondaire" onClick={() => supprimerFilm(f.id)}>Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panneau">
        <h2>Semaines à programmer</h2>
        {semaines.map((s, i) => (
          <div className="ligne" key={i}>
            <div className="champ"><label>Année</label><input type="number" value={s.anneeIso} onChange={e => modifierSemaine(i, "anneeIso", e.target.value)} style={{ width: "6rem" }} /></div>
            <div className="champ"><label>N° semaine ISO</label><input type="number" min={1} max={53} value={s.numeroIso} onChange={e => modifierSemaine(i, "numeroIso", e.target.value)} style={{ width: "5rem" }} /></div>
            {semaines.length > 1 && <button className="secondaire" onClick={() => retirerSemaine(i)}>Retirer cette semaine</button>}
          </div>
        ))}
        <div className="ligne" style={{ marginTop: "0.5rem" }}>
          <button className="secondaire" onClick={ajouterSemaine}>+ Ajouter une semaine</button>
          <button onClick={generer} disabled={enCours}>{enCours ? "Génération..." : "Générer le planning"}</button>
        </div>
      </section>

      {erreur && <div className="alerte">{erreur}</div>}

      {Object.entries(resultatsParSemaine).map(([cleSemaine, resultat]) => {
        const filmsAffiches = films.filter(f => resultat.seances.some(s => s.filmId === f.id));
        return (
          <section className="panneau" key={cleSemaine}>
            <h2>Semaine {cleSemaine}</h2>
            {resultat.filmsNonComplets.length > 0 && (
              <div className="alerte">
                <strong>Quota non atteint :</strong>
                <ul>{resultat.filmsNonComplets.map(f => <li key={f.filmId}>{f.titre} — {f.seancesRestantes} séance(s) non placée(s).</li>)}</ul>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="grille-affiche">
                <thead>
                  <tr>
                    <th></th>
                    {filmsAffiches.map(f => (
                      <th key={f.id} className="titre-film">
                        {f.titre}{f.classification && <span className="badge-classification">{f.classification}</span>}
                        <small>{f.dureeMinutes} min</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {JOURS.map(jour => (
                    <tr key={jour}>
                      <td className="jour-label">{jour.slice(0, 3)}</td>
                      {filmsAffiches.map(f => {
                        const seancesJourFilm = resultat.seances
                          .filter(s => s.filmId === f.id && s.jour === jour)
                          .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
                        const estMatin = seancesJourFilm.some(s => s.blocNom === "matin");
                        return (
                          <td key={f.id} className={estMatin ? "horaire-matin" : "horaire-normal"}>
                            {seancesJourFilm.map(s => s.heureDebut).join(" / ")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
