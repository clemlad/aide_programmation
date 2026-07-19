"use client";

import { useEffect, useState } from "react";

type Film = { id: string; titre: string; dureeMinutes: number; classification: string | null; seancesParSemaine: number };
type SeanceGeneree = { filmId: string; salleIndex: number; jour: string; blocNom: string; heureDebut: string; semaine: number };
type FilmNonComplet = { filmId: string; titre: string; semaine: number; seancesRestantes: number };

const JOURS = ["MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE", "LUNDI", "MARDI"];

export default function Generer() {
  const [films, setFilms] = useState<Film[]>([]);
  const [seances, setSeances] = useState<SeanceGeneree[]>([]);
  const [filmsNonComplets, setFilmsNonComplets] = useState<FilmNonComplet[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [genere, setGenere] = useState(false);

  useEffect(() => {
    fetch("/api/films").then(r => r.json()).then(setFilms);
  }, []);

  async function generer() {
    setEnCours(true);
    setErreur("");
    const res = await fetch("/api/generer", { method: "POST", body: JSON.stringify({}) });
    const data = await res.json();
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur ?? "Erreur inconnue.");
      return;
    }
    setSeances(data.seances);
    setFilmsNonComplets(data.filmsNonComplets);
    setGenere(true);
  }

  const filmsAvecQuota = films.filter(f => f.seancesParSemaine > 0);

  function tableauSemaine(numeroSemaine: number) {
    const seancesSemaine = seances.filter(s => s.semaine === numeroSemaine);
    const filmsAffiches = films.filter(f => seancesSemaine.some(s => s.filmId === f.id));
    const nonComplets = filmsNonComplets.filter(f => f.semaine === numeroSemaine);

    return (
      <section className="panneau" key={numeroSemaine}>
        <h2>Semaine {numeroSemaine}</h2>
        {nonComplets.length > 0 && (
          <div className="alerte">
            <strong>Quota non atteint :</strong>
            <ul>
              {nonComplets.map(f => (
                <li key={f.filmId}>{f.titre} — {f.seancesRestantes} séance(s) non placée(s).</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table className="grille-affiche">
            <thead>
              <tr>
                <th></th>
                {filmsAffiches.map(f => (
                  <th key={f.id} className="titre-film">
                    {f.titre}
                    {f.classification && <span className="badge-classification">{f.classification}</span>}
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
                    const seancesJourFilm = seancesSemaine
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
  }

  return (
    <main>
      <h1>Générer la programmation</h1>
      <p style={{ color: "var(--text-dim)" }}>
        Les quotas de séances par semaine se règlent dans l'onglet <a href="/films">Films</a>. La génération produit
        deux semaines totalement indépendantes : chaque film retrouve son quota complet en semaine 2.
      </p>

      <section className="panneau">
        <h2>Quotas actuels</h2>
        {filmsAvecQuota.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            Aucun film n'a de quota de séances par semaine pour l'instant — règle-le dans l'onglet Films.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Film</th>
                <th>Séances / semaine</th>
              </tr>
            </thead>
            <tbody>
              {filmsAvecQuota.map(f => (
                <tr key={f.id}>
                  <td>{f.titre}</td>
                  <td>{f.seancesParSemaine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button style={{ marginTop: "1rem" }} onClick={generer} disabled={enCours || filmsAvecQuota.length === 0}>
          {enCours ? "Génération..." : "Générer les 2 semaines"}
        </button>
      </section>

      {erreur && <div className="alerte">{erreur}</div>}

      {genere && [1, 2].map(tableauSemaine)}
    </main>
  );
}
