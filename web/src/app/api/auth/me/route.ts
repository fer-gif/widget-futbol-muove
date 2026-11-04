import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false }, { status: 401 });
  const { role, clienteId, nombre } = session;
  return NextResponse.json({ success: true, session: { role, clienteId, nombre } });
}
