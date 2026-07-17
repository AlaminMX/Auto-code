import { NextRequest, NextResponse } from "next/server";
import { GH_PAT_COOKIE, ProposedFileChange } from "@/lib/types";
import { commitChangesAndOpenPR } from "@/lib/github";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(GH_PAT_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }

  const { repoFullName, baseBranch, branchName, files, summary } = await req.json();
  if (!repoFullName || !baseBranch || !branchName || !Array.isArray(files)) {
    return NextResponse.json(
      { error: "repoFullName, baseBranch, branchName, and files are all required" },
      { status: 400 }
    );
  }

  const [owner, repo] = String(repoFullName).split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "repoFullName must look like owner/repo" }, { status: 400 });
  }

  try {
    const result = await commitChangesAndOpenPR({
      token,
      owner,
      repo,
      baseBranch,
      newBranch: branchName,
      files: files as ProposedFileChange[],
      prTitle: summary || `Automated change via repo-agent`,
      prBody:
        (summary ? `${summary}\n\n` : "") +
        `_Opened automatically by repo-agent. Nothing here is merged — review the diff before merging._`,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Apply failed" }, { status: 500 });
  }
}
