import { NextRequest, NextResponse } from "next/server";
import { GH_PAT_COOKIE } from "@/lib/types";
import { runAgentLoop } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(GH_PAT_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Set it in your deployment's env vars." },
      { status: 500 }
    );
  }

  const { repoFullName, baseBranch, prompt } = await req.json();
  if (!repoFullName || !baseBranch || !prompt) {
    return NextResponse.json(
      { error: "repoFullName, baseBranch, and prompt are all required" },
      { status: 400 }
    );
  }

  const [owner, repo] = String(repoFullName).split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "repoFullName must look like owner/repo" }, { status: 400 });
  }

  try {
    const plan = await runAgentLoop({
      anthropicApiKey,
      githubToken: token,
      owner,
      repo,
      baseBranch,
      prompt,
    });
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Generation failed" }, { status: 500 });
  }
}
