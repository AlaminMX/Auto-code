import Anthropic from "@anthropic-ai/sdk";
import { getFileContent, listRepoTree } from "./github";
import type { GeneratePlan, ProposedFileChange } from "./types";

const MODEL = "claude-sonnet-5";
const MAX_TURNS = 14; // hard cap so a confused agent can't loop forever / burn tokens

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_files",
    description:
      "List every file path in the repository at the working branch. Call this first to see the project layout.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_file",
    description: "Read the full text content of one file in the repository.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative file path, e.g. src/app.ts" },
      },
      required: ["path"],
    },
  },
  {
    name: "propose_changes",
    description:
      "Submit your final, complete set of file changes. Call this exactly once, only after you've read every file you needed to. Do not guess at content you haven't read — read a file before editing it.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One or two sentence human-readable summary of what this change does, for a PR description.",
        },
        branch_name: {
          type: "string",
          description: "kebab-case git branch name for this change, e.g. fix/null-check-on-checkout",
        },
        files: {
          type: "array",
          description: "Every file to create, modify, or delete.",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              action: { type: "string", enum: ["create", "modify", "delete"] },
              content: {
                type: "string",
                description: "Full new file content. Omit (or leave empty) for delete actions.",
              },
            },
            required: ["path", "action"],
          },
        },
      },
      required: ["summary", "branch_name", "files"],
    },
  },
];

export async function runAgentLoop(params: {
  anthropicApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  baseBranch: string;
  prompt: string;
}): Promise<GeneratePlan> {
  const { anthropicApiKey, githubToken, owner, repo, baseBranch, prompt } = params;
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const notes: string[] = [];

  const system = `You are a careful senior engineer making a code change to the repository ${owner}/${repo} on branch ${baseBranch}.
Explore only what you need with list_files and read_file, then call propose_changes exactly once with a complete, correct, minimal diff.
Rules:
- Never invent file content you haven't read. Read a file before modifying it.
- Keep the change as small as possible while fully satisfying the request.
- Match the existing code style, naming, and patterns in the file you're editing.
- If the request is ambiguous or you're missing critical context, make the most reasonable assumption, state it in "summary", and proceed — don't leave the task incomplete.
- Do not touch files unrelated to the request.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Task: ${prompt}` },
  ];

  // Cache original file contents so we can build an accurate diff (old vs new) at the end.
  const originalContents = new Map<string, string | null>();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      // Model stopped without proposing changes — surface what it said as an error upstream.
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      throw new Error(
        `Agent stopped without proposing a change. Last message: ${text || "(empty)"}`
      );
    }

    const proposeCall = toolUses.find((t) => t.name === "propose_changes");
    if (proposeCall) {
      const input = proposeCall.input as {
        summary: string;
        branch_name: string;
        files: { path: string; action: "create" | "modify" | "delete"; content?: string }[];
      };

      const files: ProposedFileChange[] = input.files.map((f) => ({
        path: f.path,
        oldContent: originalContents.get(f.path) ?? null,
        newContent: f.action === "delete" ? null : f.content ?? "",
      }));

      return {
        summary: input.summary,
        branchName: input.branch_name,
        files,
        notes,
      };
    }

    // Execute every other tool call and feed results back in one user turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      if (call.name === "list_files") {
        const paths = await listRepoTree(githubToken, owner, repo, baseBranch);
        notes.push(`Listed ${paths.length} files in the repo.`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: paths.join("\n").slice(0, 50000),
        });
      } else if (call.name === "read_file") {
        const { path } = call.input as { path: string };
        const content = await getFileContent(githubToken, owner, repo, path, baseBranch);
        originalContents.set(path, content);
        notes.push(`Read ${path} (${content === null ? "not found" : `${content.length} chars`}).`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: content === null ? `File not found: ${path}` : content,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("Agent exceeded the maximum number of exploration turns without proposing a change.");
}
