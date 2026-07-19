import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Horaire de départ par défaut d'un bloc, propre à une salle.
export async function GET() {
  const horaires = await prisma.blocHoraireDefaut.findMany({
    include: { bloc: true, salle: true },
  });
  return NextResponse.json(horaires);
}

export async function POST(req: Request) {
  const { blocId, salleId, heureDebut } = await req.json();
  if (!blocId || !salleId || !heureDebut) {
    return NextResponse.json({ erreur: "blocId, salleId et heureDebut requis." }, { status: 400 });
  }
  const horaire = await prisma.blocHoraireDefaut.upsert({
    where: { blocId_salleId: { blocId, salleId } },
    update: { heureDebut },
    create: { blocId, salleId, heureDebut },
  });
  return NextResponse.json(horaire, { status: 201 });
}
