# repo-agent

A small dashboard: type a prompt, pick a GitHub repo, get a reviewed pull request.

**How it works:** the app spins up a Gemini agent (`gemini-2.5-flash`, free tier) with
three tools — `list_files`, `read_file`, and `propose_changes`. It explores your repo
(never guessing at content it hasn't read), then proposes a complete diff. You review
the diff in the browser. Only when you click "Apply" does it commit to a new branch and
open a PR — it never pushes to your base branch and never auto-merges.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in a free Gemini API key from
[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (no card
required):

```bash
cp .env.example .env.local
```

Run locally:

```bash
npm run dev
```

Open http://localhost:3000, paste a GitHub personal access token (Settings → Developer
settings → Personal access tokens → generate one with `repo` scope), pick a repo, and
go.

## Deploying to Vercel

1. Push this folder to its own GitHub repo.
2. Import it in Vercel.
3. In Project Settings → Environment Variables, add `GEMINI_API_KEY`.
4. Deploy. No other config needed — it's a standard Next.js App Router project.

## Things worth knowing before you rely on this

- **The GitHub token is stored in an httpOnly cookie**, not localStorage, and expires
  after 8 hours. It's still a bearer token sitting in your browser session — don't use
  a token with more scope than `repo`, and don't leave the tab logged in on a shared
  machine.
- **Gemini's free tier terms allow using your prompts to improve their models** (unlike
  the paid tier). If you'll be running this against private or client repos, read
  [Google's terms](https://ai.google.dev/gemini-api/terms) before pointing it at
  anything sensitive — or switch to the paid tier, which opts out of training use.
- **Free tier limits**: 1,500 requests/day, 10 requests/minute, on `gemini-2.5-flash`.
  Each `generate` click uses one request per exploration turn (up to 14) — plenty for
  personal use, but watch it if you're running this constantly.
- **Large repos**: the agent reads files one at a time via `read_file`. For a very large
  repo, it may need several turns to find the right file — that's expected. There's a
  hard cap of 14 tool-use turns (`MAX_TURNS` in `lib/agent.ts`) so a confused run fails
  loudly instead of looping forever and burning quota. Raise it if you hit the cap on
  legitimately large tasks.
- **No test/lint run yet.** This MVP stops at "open a PR for review" — it does not run
  your test suite or linter before proposing changes. That's the natural next thing to
  add (see below) before trusting it with anything beyond small, reviewable changes.
- **One repo, one branch, one PR per run.** It doesn't batch multiple unrelated changes
  into one PR — if you ask for two unrelated things, ask for them in separate runs.

## Natural next steps

- Run the repo's own lint/test command against the proposed branch before showing you
  the diff (needs a way to execute code — e.g. a sandboxed CI job — since this app itself
  doesn't execute your repo's code).
- Swap the personal access token for a proper GitHub App installation if you want finer
  per-repo permission scoping than a PAT gives you.
- Let the agent open a *draft* PR and iterate based on review comments, instead of a
  single-shot proposal.
- If you outgrow the free tier's rate limits, `gemini-2.5-pro` (paid) or Anthropic's
  Claude API are drop-in-ish swaps — the tool-calling shape in `lib/agent.ts` maps
  cleanly to either.
