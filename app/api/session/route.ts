import { NextRequest, NextResponse } from "next/server";
import { GH_PAT_COOKIE as COOKIE_NAME } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours — re-paste after that rather than storing it indefinitely
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const has = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({ connected: has });
}
