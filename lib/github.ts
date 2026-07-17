import { Octokit } from "@octokit/rest";
import type { ProposedFileChange, RepoSummary } from "./types";

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const octokit = getOctokit(token);
  const repos: RepoSummary[] = [];
  let page = 1;
  // Page through everything the token can see (owned + collaborator + org, if scopes allow).
  while (true) {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "pushed",
    });
    if (data.length === 0) break;
    for (const r of data) {
      repos.push({
        fullName: r.full_name,
        defaultBranch: r.default_branch ?? "main",
        private: r.private,
        description: r.description,
      });
    }
    if (data.length < 100) break;
    page += 1;
  }
  return repos;
}

/** Recursively list every file path in the repo at a given ref (branch/sha). */
export async function listRepoTree(
  token: string,
  owner: string,
  repo: string,
  ref: string
): Promise<string[]> {
  const octokit = getOctokit(token);
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${ref}`,
  });
  const commitSha = refData.object.sha;
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: commit.tree.sha,
    recursive: "true",
  });
  return (tree.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path)
    .map((entry) => entry.path as string);
}

/** Fetch the decoded text content of a single file. Returns null if it doesn't exist. */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const octokit = getOctokit(token);
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export async function getDefaultBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const octokit = getOctokit(token);
  const { data } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  return data.object.sha;
}

/**
 * Creates a new branch off `baseBranch`, commits all proposed file changes as a single
 * commit (via the low-level git data API so multiple file changes land atomically),
 * and opens a pull request back into baseBranch. Never touches baseBranch directly.
 */
export async function commitChangesAndOpenPR(params: {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  files: ProposedFileChange[];
  prTitle: string;
  prBody: string;
}): Promise<{ branchName: string; pullRequestUrl: string; pullRequestNumber: number }> {
  const { token, owner, repo, baseBranch, newBranch, files, prTitle, prBody } = params;
  const octokit = getOctokit(token);

  const baseSha = await getDefaultBranchSha(token, owner, repo, baseBranch);

  // Create the working branch from base.
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: baseSha,
  });

  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });

  // Build blobs for every changed/added file (deletions carry no blob).
  const treeEntries = [];
  for (const file of files) {
    if (file.newContent === null) {
      // Deletion: mark with sha null via tree entry.
      treeEntries.push({
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null,
      });
      continue;
    }
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: file.newContent,
      encoding: "utf-8",
    });
    treeEntries.push({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.sha,
    });
  }

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeEntries,
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: prTitle,
    tree: newTree.sha,
    parents: [baseSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${newBranch}`,
    sha: newCommit.sha,
  });

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: prTitle,
    body: prBody,
    head: newBranch,
    base: baseBranch,
  });

  return {
    branchName: newBranch,
    pullRequestUrl: pr.html_url,
    pullRequestNumber: pr.number,
  };
}
