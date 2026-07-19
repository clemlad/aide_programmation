"use client";

import { useEffect, useState } from "react";

type Salle = { id: string; nom: string };
type Bloc = { id: string; nom: string; ordre: number };
type Horaire = { id: string; blocId: string; salleId: string; heureDebut: string; bloc: Bloc; salle: Salle };
type Exception = {
  id: string; jour: string; blocId: string; salleId: string | null;
  heureDebut: string | null; publicRequis: string | null;
  periodeDebut: string | null; periodeFin: string | null; bloc: Bloc;
};

const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

export default function Reglages() {
  const [salles, setSalles] = useState<Salle[]>([]);
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [horaires, setHoraires] = useState<Horaire[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);

  const [nomSalle, setNomSalle] = useState("");
  const [nomBloc, setNomBloc] = useState("");
  const [ordreBloc, setOrdreBloc] = useState("");
  const [hSalle, setHSalle] = useState("");
  const [hBloc, setHBloc] = useState("");
  const [hHeure, setHHeure] = useState("");
  const [exJour, setExJour] = useState("JEUDI");
  const [exBloc, setExBloc] = useState("");
  const [exSalle, setExSalle] = useState("");
  const [exHeure, setExHeure] = useState("");
  const [exPublic, setExPublic] = useState("");
  const [exDebut, setExDebut] = useState("");
  const [exFin, setExFin] = useState("");

  async function chargerTout() {
    const [s, b, h, e] = await Promise.all([
      fetch("/api/salles").then(r => r.json()),
      fetch("/api/blocs").then(r => r.json()),
      fetch("/api/horaires").then(r => r.json()),
      fetch("/api/exceptions").then(r => r.json()),
    ]);
    setSalles(s); setBlocs(b); setHoraires(h); setExceptions(e);
  }
  useEffect(() => { chargerTout(); }, []);

  async function ajouterSalle() {
    if (!nomSalle) return;
    await fetch("/api/salles", { method: "POST", body: JSON.stringify({ nom: nomSalle }) });
    setNomSalle(""); chargerTout();
  }
  async function ajouterBloc() {
    if (!nomBloc || ordreBloc === "") return;
    await fetch("/api/blocs", { method: "POST", body: JSON.stringify({ nom: nomBloc, ordre: Number(ordreBloc) }) });
    setNomBloc(""); setOrdreBloc(""); chargerTout();
  }
  async function definirHoraire() {
    if (!hSalle || !hBloc || !hHeure) return;
    await fetch("/api/horaires", { method: "POST", body: JSON.stringify({ salleId: hSalle, blocId: hBloc, heureDebut: hHeure }) });
    setHHeure(""); chargerTout();
  }
  async function ajouterException() {
    if (!exBloc) return;
    await fetch("/api/exceptions", {
      method: "POST",
      body: JSON.stringify({
        jour: exJour, blocId: exBloc, salleId: exSalle || null,
        heureDebut: exHeure || null, publicRequis: exPublic || null,
        periodeDebut: exDebut || null, periodeFin: exFin || null,
      }),
    });
    setExHeure(""); setExPublic(""); setExDebut(""); setExFin("");
    chargerTout();
  }
  async function supprimer(url: string, id: string) {
    await fetch(url, { method: "DELETE", body: JSON.stringify({ id }) });
    chargerTout();
  }

  return (
    <main>
      <h1>Réglages</h1>

      <section className="panneau">
        <h2>Salles</h2>
        <div className="ligne">
          <div className="champ">
            <label>Nom</label>
            <input value={nomSalle} onChange={e => setNomSalle(e.target.value)} placeholder="Salle 1" />
          </div>
          <button onClick={ajouterSalle}>Ajouter</button>
        </div>
        <ul>
          {salles.map(s => (
            <li key={s.id}>
              {s.nom} <button className="secondaire" onClick={() => supprimer("/api/salles", s.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panneau">
        <h2>Blocs horaires</h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Un bloc (matin, aprem, soir1, soir2...) définit un segment de la journée. L'ordre détermine l'enchaînement.
        </p>
        <div className="ligne">
          <div className="champ">
            <label>Nom</label>
            <input value={nomBloc} onChange={e => setNomBloc(e.target.value)} placeholder="matin" />
          </div>
          <div className="champ">
            <label>Ordre</label>
            <input type="number" value={ordreBloc} onChange={e => setOrdreBloc(e.target.value)} placeholder="1" style={{ width: "5rem" }} />
          </div>
          <button onClick={ajouterBloc}>Ajouter</button>
        </div>
        <ul>
          {blocs.map(b => (
            <li key={b.id}>
              #{b.ordre} — {b.nom} <button className="secondaire" onClick={() => supprimer("/api/blocs", b.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panneau">
        <h2>Horaires par défaut (bloc × salle)</h2>
        <div className="ligne">
          <div className="champ">
            <label>Salle</label>
            <select value={hSalle} onChange={e => setHSalle(e.target.value)}>
              <option value="">—</option>
              {salles.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Bloc</label>
            <select value={hBloc} onChange={e => setHBloc(e.target.value)}>
              <option value="">—</option>
              {blocs.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Heure de départ</label>
            <input type="time" value={hHeure} onChange={e => setHHeure(e.target.value)} />
          </div>
          <button onClick={definirHoraire}>Définir</button>
        </div>
        <table>
          <thead><tr><th>Salle</th><th>Bloc</th><th>Heure</th></tr></thead>
          <tbody>
            {horaires.map(h => (
              <tr key={h.id}><td>{h.salle.nom}</td><td>{h.bloc.nom}</td><td className="seance"><span className="heure">{h.heureDebut}</span></td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panneau">
        <h2>Exceptions (jour / saison)</h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Ex: jeudi en été, bloc "matin" décalé à 10:30, réservé aux films dont le public cible est "ENFANT".
        </p>
        <div className="ligne">
          <div className="champ">
            <label>Jour</label>
            <select value={exJour} onChange={e => setExJour(e.target.value)}>
              {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Bloc</label>
            <select value={exBloc} onChange={e => setExBloc(e.target.value)}>
              <option value="">—</option>
              {blocs.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Salle (vide = toutes)</label>
            <select value={exSalle} onChange={e => setExSalle(e.target.value)}>
              <option value="">Toutes</option>
              {salles.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div className="champ">
            <label>Nouvelle heure (optionnel)</label>
            <input type="time" value={exHeure} onChange={e => setExHeure(e.target.value)} />
          </div>
          <div className="champ">
            <label><input type="checkbox" checked={exPublic === "TOUS_PUBLIC"} onChange={e => setExPublic(e.target.checked ? "TOUS_PUBLIC" : "")} /> Réserver aux films tous publics</label>
          </div>
          <div className="champ">
            <label>Période début (MM-JJ)</label>
            <input value={exDebut} onChange={e => setExDebut(e.target.value)} placeholder="06-01" style={{ width: "5rem" }} />
          </div>
          <div className="champ">
            <label>Période fin (MM-JJ)</label>
            <input value={exFin} onChange={e => setExFin(e.target.value)} placeholder="08-31" style={{ width: "5rem" }} />
          </div>
          <button onClick={ajouterException}>Ajouter</button>
        </div>
        <ul>
          {exceptions.map(e => (
            <li key={e.id}>
              {e.jour} — {e.bloc.nom}
              {e.heureDebut ? ` → ${e.heureDebut}` : ""}
              {e.publicRequis ? ` (tous publics uniquement)` : ""}
              {e.periodeDebut ? ` [${e.periodeDebut} → ${e.periodeFin}]` : ""}
              {" "}
              <button className="secondaire" onClick={() => supprimer("/api/exceptions", e.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
