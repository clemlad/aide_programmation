import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const films = await prisma.film.findMany({ orderBy: { titre: "asc" } });
  return NextResponse.json(films);
}

export async function POST(req: Request) {
  const { titre, dureeMinutes, classification } = await req.json();
  if (!titre || !dureeMinutes) {
    return NextResponse.json({ erreur: "Titre et durée requis." }, { status: 400 });
  }
  const film = await prisma.film.create({
    data: { titre, dureeMinutes: Number(dureeMinutes), classification: classification || null },
  });
  return NextResponse.json(film, { status: 201 });
}

export async function PATCH(req: Request) {
  const { id, titre, dureeMinutes, classification } = await req.json();
  if (!id) return NextResponse.json({ erreur: "id requis." }, { status: 400 });
  const film = await prisma.film.update({
    where: { id },
    data: {
      ...(titre !== undefined ? { titre } : {}),
      ...(dureeMinutes !== undefined ? { dureeMinutes: Number(dureeMinutes) } : {}),
      ...(classification !== undefined ? { classification: classification || null } : {}),
    },
  });
  return NextResponse.json(film);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  try {
    await prisma.film.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suppression impossible.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }
}
