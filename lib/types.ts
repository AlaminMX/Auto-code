export interface RepoSummary {
  fullName: string; // "owner/repo"
  defaultBranch: string;
  private: boolean;
  description: string | null;
}

export interface ProposedFileChange {
  path: string;
  oldContent: string | null; // null = new file
  newContent: string | null; // null = deletion
}

export interface GeneratePlan {
  summary: string;
  branchName: string;
  files: ProposedFileChange[];
  notes: string[]; // running log of what the agent looked at / decided
}

export interface ApplyResult {
  branchName: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
}

export const GH_PAT_COOKIE = "gh_pat";
