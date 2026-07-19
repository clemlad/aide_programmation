import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const exceptions = await prisma.exceptionHoraire.findMany({ include: { bloc: true } });
  return NextResponse.json(exceptions);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { jour, blocId, salleId, heureDebut, publicRequis, periodeDebut, periodeFin } = body;
  if (!jour || !blocId) {
    return NextResponse.json({ erreur: "jour et blocId requis." }, { status: 400 });
  }
  const exception = await prisma.exceptionHoraire.create({
    data: {
      jour,
      blocId,
      salleId: salleId || null,
      heureDebut: heureDebut || null,
      publicRequis: publicRequis || null,
      periodeDebut: periodeDebut || null,
      periodeFin: periodeFin || null,
    },
  });
  return NextResponse.json(exception, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.exceptionHoraire.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
