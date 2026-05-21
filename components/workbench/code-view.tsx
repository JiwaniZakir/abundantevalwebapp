"use client";

import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState } from "react";
import type { SpoilerFinding } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

type Token = { text: string; className?: string };

const pythonKeywords = new Set([
  "def", "return", "import", "from", "class", "if", "elif", "else", "for",
  "while", "in", "not", "and", "or", "True", "False", "None", "assert",
  "with", "as", "try", "except", "finally", "raise", "yield", "lambda",
]);

function tokenizeLine(line: string, kind: string): Token[] {
  if (kind === "diff") {
    if (line.startsWith("+")) return [{ text: line, className: "text-[var(--green)]" }];
    if (line.startsWith("-")) return [{ text: line, className: "text-[var(--red)]" }];
    if (line.startsWith("@@")) return [{ text: line, className: "text-[var(--fg-muted)]" }];
    return [{ text: line }];
  }

  if (kind === "markdown") {
    if (line.startsWith("# ")) return [{ text: line, className: "font-semibold text-[var(--fg)]" }];
    if (line.startsWith("## ")) return [{ text: line, className: "font-medium text-[var(--fg)]" }];
    if (line.startsWith("- ")) return [{ text: line, className: "text-[var(--fg-secondary)]" }];
    return [{ text: line }];
  }

  if (kind === "toml" || kind === "yaml") {
    const headerMatch = line.match(/^(\s*)(\[[^\]]+\])(.*)$/);
    if (headerMatch) {
      const [, leading, header, rest] = headerMatch;
      return [
        { text: leading },
        { text: header, className: "text-[var(--blue)]" },
        { text: rest, className: "text-[var(--fg-muted)]" },
      ];
    }
    const kvMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+)(\s*=\s*)(.*)$/);
    if (kvMatch) {
      const [, leading, key, equals, value] = kvMatch;
      return [
        { text: leading },
        { text: key, className: "text-[var(--amber)]" },
        { text: equals, className: "text-[var(--fg-faint)]" },
        { text: value, className: "text-[var(--fg)]" },
      ];
    }
    if (line.trim().startsWith("#")) return [{ text: line, className: "text-[var(--fg-faint)]" }];
    return [{ text: line }];
  }

  if (kind === "python" || kind === "shell") {
    const tokens: Token[] = [];
    const commentIdx = line.indexOf("#");
    const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : "";

    const segments = codePart.split(/(\s+|[(){}[\],.:=])/);
    for (const segment of segments) {
      if (!segment) continue;
      if (pythonKeywords.has(segment)) {
        tokens.push({ text: segment, className: "text-[var(--blue)] font-medium" });
      } else if (/^['"`].*['"`]$/.test(segment)) {
        tokens.push({ text: segment, className: "text-[var(--amber)]" });
      } else if (/^\d+(\.\d+)?$/.test(segment)) {
        tokens.push({ text: segment, className: "text-[var(--blue)]" });
      } else {
        tokens.push({ text: segment });
      }
    }

    if (commentPart) tokens.push({ text: commentPart, className: "text-[var(--fg-faint)] italic" });
    return tokens;
  }

  return [{ text: line }];
}

const severityColor: Record<SpoilerFinding["severity"], string> = {
  high: "var(--red)",
  medium: "var(--amber)",
  low: "var(--blue)",
};

export function CodeView({
  content,
  kind,
  className,
  findings = [],
}: {
  content: string;
  kind: string;
  className?: string;
  findings?: SpoilerFinding[];
}) {
  const [copied, setCopied] = useState(false);
  const lines = content.split("\n");

  const findingsByLine = new Map<number, SpoilerFinding[]>();
  for (const finding of findings) {
    const list = findingsByLine.get(finding.line) ?? [];
    list.push(finding);
    findingsByLine.set(finding.line, list);
  }

  const onCopy = async () => {
    await navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={cn("mono group relative h-full overflow-hidden bg-[var(--bg)] text-[11px] leading-[1.7] text-[var(--fg-secondary)]", className)}>
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-4 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)]/90 px-2 py-1 text-[10px] text-[var(--fg-muted)] opacity-0 backdrop-blur transition-opacity hover:text-[var(--fg)] group-hover:opacity-100"
      >
        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
      <div className="grid min-h-full grid-cols-[48px_1fr]">
        <div className="select-none border-r border-[var(--border)] py-6 text-right text-[11px] text-[var(--fg-faint)]">
          {lines.map((_, index) => {
            const lineFindings = findingsByLine.get(index + 1);
            return (
              <div key={index} className="relative flex items-center justify-end gap-1.5 pr-3">
                {lineFindings && lineFindings.length > 0 && (
                  <span
                    title={lineFindings.map((f) => `${f.severity}: ${f.message}`).join("\n")}
                    style={{ background: severityColor[lineFindings[0].severity] }}
                    className="h-1.5 w-1.5 rounded-full"
                  />
                )}
                <span>{index + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="py-6 pl-5 pr-6">
          {lines.map((line, lineIndex) => {
            const tokens = tokenizeLine(line, kind);
            const lineFindings = findingsByLine.get(lineIndex + 1);
            return (
              <div
                key={lineIndex}
                className={cn(
                  "group/line relative -mx-2 min-h-[1.7em] whitespace-pre rounded px-2 hover:bg-[var(--bg-hover)]",
                  lineFindings && lineFindings.length > 0 && "bg-[var(--amber-soft)]",
                )}
              >
                {tokens.length === 0 ? <span>&nbsp;</span> : tokens.map((token, i) => <span key={i} className={token.className}>{token.text}</span>)}
                {lineFindings && lineFindings.length > 0 && (
                  <span className="pointer-events-none absolute right-2 top-0 hidden items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--fg)] shadow-sm group-hover/line:inline-flex">
                    <AlertTriangle className="h-2.5 w-2.5" style={{ color: severityColor[lineFindings[0].severity] }} />
                    {lineFindings[0].message.slice(0, 80)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
