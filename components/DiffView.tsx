"use client";

import { diffLines } from "diff";
import type { ProposedFileChange } from "@/lib/types";

export default function DiffView({ file }: { file: ProposedFileChange }) {
  const isNew = file.oldContent === null;
  const isDeleted = file.newContent === null;
  const parts = diffLines(file.oldContent ?? "", file.newContent ?? "");

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-panel px-3 py-2 border-b border-border">
        <span className="font-mono text-sm text-text">{file.path}</span>
        <span className="text-xs uppercase tracking-wide text-muted">
          {isNew ? "new file" : isDeleted ? "deleted" : "modified"}
        </span>
      </div>
      <pre className="font-mono text-[13px] leading-5 overflow-x-auto max-h-96">
        {parts.map((part, i) => {
          const color = part.added
            ? "bg-diffaddbg text-diffadd"
            : part.removed
            ? "bg-diffrembg text-diffrem"
            : "text-muted";
          const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
          const lines = part.value.replace(/\n$/, "").split("\n");
          return lines.map((line, j) => (
            <div key={`${i}-${j}`} className={`px-3 ${color} whitespace-pre`}>
              {prefix}
              {line}
            </div>
          ));
        })}
      </pre>
    </div>
  );
}
