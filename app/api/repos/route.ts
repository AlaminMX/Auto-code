import { NextRequest, NextResponse } from "next/server";
import { GH_PAT_COOKIE } from "@/lib/types";
import { listRepos } from "@/lib/github";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(GH_PAT_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  try {
    const repos = await listRepos(token);
    return NextResponse.json({ repos });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to list repos" },
      { status: err?.status ?? 500 }
    );
  }
}
