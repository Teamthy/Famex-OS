import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
export async function GET() {
  const user = await getSession();
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}
