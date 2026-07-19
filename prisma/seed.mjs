// Pré-remplit salles, blocs, horaires par défaut et l'exception jeudi été,
// avec les valeurs réelles données pour ce cinéma. À exécuter UNE SEULE FOIS :
//   node prisma/seed.mjs
// Relancer ce script plus tard ne duplique rien (upsert), mais n'est utile
// que si tu changes ta config de base — sinon tu n'as plus jamais besoin d'y toucher.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const salle1 = await prisma.salle.upsert({ where: { id: "salle-1" }, update: {}, create: { id: "salle-1", nom: "Salle 1" } });
  const salle2 = await prisma.salle.upsert({ where: { id: "salle-2" }, update: {}, create: { id: "salle-2", nom: "Salle 2" } });

  const blocsDef = [
    { id: "bloc-matin", nom: "matin", ordre: 1 },
    { id: "bloc-aprem", nom: "aprem", ordre: 2 },
    { id: "bloc-soir1", nom: "soir1", ordre: 3 },
    { id: "bloc-soir2", nom: "soir2", ordre: 4 },
  ];
  const blocs = {};
  for (const b of blocsDef) {
    blocs[b.nom] = await prisma.bloc.upsert({ where: { id: b.id }, update: {}, create: b });
  }

  const horaires = [
    { bloc: "matin", salle: salle1.id, heureDebut: "11:00" },
    { bloc: "matin", salle: salle2.id, heureDebut: "11:00" },
    { bloc: "aprem", salle: salle1.id, heureDebut: "15:30" },
    { bloc: "aprem", salle: salle2.id, heureDebut: "15:45" },
    { bloc: "soir1", salle: salle1.id, heureDebut: "18:00" },
    { bloc: "soir1", salle: salle2.id, heureDebut: "18:15" },
    { bloc: "soir2", salle: salle1.id, heureDebut: "20:45" },
    { bloc: "soir2", salle: salle2.id, heureDebut: "21:00" },
  ];
  for (const h of horaires) {
    await prisma.blocHoraireDefaut.upsert({
      where: { blocId_salleId: { blocId: blocs[h.bloc].id, salleId: h.salle } },
      update: { heureDebut: h.heureDebut },
      create: { blocId: blocs[h.bloc].id, salleId: h.salle, heureDebut: h.heureDebut },
    });
  }

  // Jeudi en été, le bloc matin est décalé à 10h30 et réservé aux films tous publics.
  const exceptionExistante = await prisma.exceptionHoraire.findFirst({
    where: { jour: "JEUDI", blocId: blocs["matin"].id, periodeDebut: "06-01" },
  });
  if (!exceptionExistante) {
    await prisma.exceptionHoraire.create({
      data: {
        jour: "JEUDI",
        blocId: blocs["matin"].id,
        heureDebut: "10:30",
        publicRequis: "TOUS_PUBLIC",
        periodeDebut: "06-01",
        periodeFin: "08-31",
      },
    });
  }

  console.log("Réglages pré-remplis : 2 salles, 4 blocs, 8 horaires, 1 exception (jeudi été).");
}

main().finally(() => prisma.$disconnect());
