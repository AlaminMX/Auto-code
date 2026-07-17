"use client";

import { useEffect, useState } from "react";
import DiffView from "@/components/DiffView";
import type { GeneratePlan, RepoSummary } from "@/lib/types";

type Stage = "idle" | "generating" | "reviewing" | "applying" | "done";

export default function Page() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [patInput, setPatInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [baseBranch, setBaseBranch] = useState<string>("");

  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeneratePlan | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setConnected(Boolean(d.connected)))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) return;
    setReposLoading(true);
    fetch("/api/repos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRepos(d.repos);
      })
      .catch((e) => setError(e.message))
      .finally(() => setReposLoading(false));
  }, [connected]);

  useEffect(() => {
    const repo = repos.find((r) => r.fullName === selectedRepo);
    if (repo) setBaseBranch(repo.defaultBranch);
  }, [selectedRepo, repos]);

  async function connect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patInput.trim() }),
      });
      if (!res.ok) throw new Error("Couldn't save token");
      setConnected(true);
      setPatInput("");
    } catch (e: any) {
      setConnectError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/session", { method: "DELETE" });
    setConnected(false);
    setRepos([]);
    setSelectedRepo("");
  }

  async function generate() {
    setStage("generating");
    setError(null);
    setPlan(null);
    setPrUrl(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: selectedRepo, baseBranch, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setPlan(data.plan);
      setStage("reviewing");
    } catch (e: any) {
      setError(e.message);
      setStage("idle");
    }
  }

  async function apply() {
    if (!plan) return;
    setStage("applying");
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: selectedRepo,
          baseBranch,
          branchName: plan.branchName,
          files: plan.files,
          summary: plan.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");
      setPrUrl(data.pullRequestUrl);
      setStage("done");
    } catch (e: any) {
      setError(e.message);
      setStage("reviewing");
    }
  }

  function startOver() {
    setPrompt("");
    setPlan(null);
    setPrUrl(null);
    setError(null);
    setStage("idle");
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-baseline justify-between mb-10">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight">repo-agent</h1>
          <p className="text-muted text-sm mt-1">Prompt in, pull request out.</p>
        </div>
        {connected && (
          <button onClick={disconnect} className="text-xs text-muted hover:text-text underline">
            disconnect GitHub
          </button>
        )}
      </header>

      {connected === false && (
        <section className="rounded-lg border border-border bg-panel p-5">
          <h2 className="text-sm font-medium mb-1">Connect GitHub</h2>
          <p className="text-muted text-sm mb-3">
            Paste a personal access token with <code className="text-accent">repo</code> scope. It's stored
            in an httpOnly cookie, never in the browser's local storage, and expires after 8 hours.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="ghp_..."
              className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none"
            />
            <button
              onClick={connect}
              disabled={connecting || !patInput.trim()}
              className="bg-accent text-bg font-medium text-sm px-4 py-2 rounded-md disabled:opacity-40"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
          {connectError && <p className="text-diffrem text-sm mt-2">{connectError}</p>}
        </section>
      )}

      {connected && (
        <section className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Repository</label>
            {reposLoading ? (
              <p className="text-muted text-sm">Loading your repos…</p>
            ) : (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full bg-panel border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none"
              >
                <option value="">Select a repo…</option>
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedRepo && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Base branch</label>
              <input
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="w-full bg-panel border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none"
              />
            </div>
          )}

          {selectedRepo && baseBranch && (
            <div>
              <label className="block text-sm font-medium mb-1.5">What do you want changed?</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. Add input validation to the signup form so empty emails are rejected client-side."
                className="w-full bg-panel border border-border rounded-md px-3 py-2 text-sm focus:outline-none resize-none"
              />
              <button
                onClick={generate}
                disabled={!prompt.trim() || stage === "generating"}
                className="mt-3 bg-accent text-bg font-medium text-sm px-4 py-2 rounded-md disabled:opacity-40"
              >
                {stage === "generating" ? "Reading the repo…" : "Generate change"}
              </button>
            </div>
          )}

          {error && <p className="text-diffrem text-sm">{error}</p>}

          {stage === "generating" && (
            <div className="rounded-md border border-border bg-panel p-4 font-mono text-xs text-muted">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse mr-2" />
              exploring {selectedRepo} on {baseBranch}…
            </div>
          )}

          {plan && (stage === "reviewing" || stage === "applying") && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-panel p-4">
                <p className="text-sm">{plan.summary}</p>
                <p className="text-xs text-muted mt-2 font-mono">
                  branch: {plan.branchName} · {plan.files.length} file
                  {plan.files.length === 1 ? "" : "s"} changed
                </p>
              </div>

              <div className="space-y-3">
                {plan.files.map((f) => (
                  <DiffView key={f.path} file={f} />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={apply}
                  disabled={stage === "applying"}
                  className="bg-accent text-bg font-medium text-sm px-4 py-2 rounded-md disabled:opacity-40"
                >
                  {stage === "applying" ? "Opening PR…" : "Apply & open pull request"}
                </button>
                <button
                  onClick={startOver}
                  disabled={stage === "applying"}
                  className="text-muted text-sm px-4 py-2 rounded-md border border-border"
                >
                  Discard
                </button>
              </div>
              <p className="text-xs text-muted">
                This opens a pull request — nothing is merged automatically. Review it on GitHub before merging.
              </p>
            </div>
          )}

          {stage === "done" && prUrl && (
            <div className="rounded-md border border-diffadd bg-diffaddbg p-4">
              <p className="text-sm mb-2">Pull request opened.</p>
              <a href={prUrl} target="_blank" rel="noreferrer" className="text-accent text-sm underline">
                {prUrl}
              </a>
              <div className="mt-3">
                <button onClick={startOver} className="text-sm text-muted underline">
                  Start another change
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
