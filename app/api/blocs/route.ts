import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const blocs = await prisma.bloc.findMany({ orderBy: { ordre: "asc" } });
  return NextResponse.json(blocs);
}

export async function POST(req: Request) {
  const { nom, ordre } = await req.json();
  if (!nom || ordre === undefined) {
    return NextResponse.json({ erreur: "Nom et ordre requis." }, { status: 400 });
  }
  const bloc = await prisma.bloc.create({ data: { nom, ordre: Number(ordre) } });
  return NextResponse.json(bloc, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.bloc.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
