import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const salles = await prisma.salle.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(salles);
}

export async function POST(req: Request) {
  const { nom } = await req.json();
  if (!nom || typeof nom !== "string") {
    return NextResponse.json({ erreur: "Nom de salle requis." }, { status: 400 });
  }
  const salle = await prisma.salle.create({ data: { nom } });
  return NextResponse.json(salle, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.salle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
