"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Token = { text: string; className?: string };

const pythonKeywords = new Set([
  "def",
  "return",
  "import",
  "from",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "in",
  "not",
  "and",
  "or",
  "True",
  "False",
  "None",
  "assert",
  "with",
  "as",
  "try",
  "except",
  "finally",
  "raise",
  "yield",
  "lambda",
]);

function tokenizeLine(line: string, kind: string): Token[] {
  if (kind === "diff") {
    if (line.startsWith("+")) {
      return [{ text: line, className: "text-[var(--status-green)]" }];
    }
    if (line.startsWith("-")) {
      return [{ text: line, className: "text-[var(--status-red)]" }];
    }
    if (line.startsWith("@@")) {
      return [{ text: line, className: "text-[var(--ink-muted)]" }];
    }
    return [{ text: line }];
  }

  if (kind === "markdown") {
    if (line.startsWith("# ")) {
      return [
        { text: line, className: "font-semibold text-[var(--ink)]" },
      ];
    }
    if (line.startsWith("## ")) {
      return [{ text: line, className: "font-medium text-[var(--ink)]" }];
    }
    if (line.startsWith("- ")) {
      return [{ text: line, className: "text-[var(--ink-soft)]" }];
    }
    return [{ text: line }];
  }

  if (kind === "toml" || kind === "yaml") {
    const headerMatch = line.match(/^(\s*)(\[[^\]]+\])(.*)$/);
    if (headerMatch) {
      const [, leading, header, rest] = headerMatch;
      return [
        { text: leading },
        { text: header, className: "text-[var(--status-blue)]" },
        { text: rest, className: "text-[var(--ink-muted)]" },
      ];
    }
    const kvMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+)(\s*=\s*)(.*)$/);
    if (kvMatch) {
      const [, leading, key, equals, value] = kvMatch;
      return [
        { text: leading },
        { text: key, className: "text-[var(--status-amber)]" },
        { text: equals, className: "text-[var(--ink-faint)]" },
        { text: value, className: "text-[var(--ink)]" },
      ];
    }
    if (line.trim().startsWith("#")) {
      return [{ text: line, className: "text-[var(--ink-faint)]" }];
    }
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
        tokens.push({ text: segment, className: "text-[var(--status-blue)] font-medium" });
      } else if (/^['"`].*['"`]$/.test(segment)) {
        tokens.push({ text: segment, className: "text-[var(--status-amber)]" });
      } else if (/^\d+(\.\d+)?$/.test(segment)) {
        tokens.push({ text: segment, className: "text-[var(--status-blue)]" });
      } else {
        tokens.push({ text: segment });
      }
    }

    if (commentPart) {
      tokens.push({ text: commentPart, className: "text-[var(--ink-faint)] italic" });
    }
    return tokens;
  }

  return [{ text: line }];
}

export function CodeView({
  content,
  kind,
  className,
}: {
  content: string;
  kind: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = content.split("\n");

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "mono group relative h-full overflow-hidden bg-[var(--paper-pure)] text-[12.5px] leading-[1.7] text-[var(--ink-soft)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-4 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)]/90 px-2.5 py-1 text-[11px] text-[var(--ink-muted)] opacity-0 shadow-[var(--shadow-soft)] backdrop-blur transition-opacity hover:text-[var(--ink)] group-hover:opacity-100"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>
      <div className="grid min-h-full grid-cols-[56px_1fr]">
        <div className="select-none border-r border-[var(--hairline)] py-6 text-right text-[11px] text-[var(--ink-faded)]">
          {lines.map((_, index) => (
            <div key={index} className="pr-3">
              {index + 1}
            </div>
          ))}
        </div>
        <div className="py-6 pl-5 pr-6">
          {lines.map((line, lineIndex) => {
            const tokens = tokenizeLine(line, kind);
            return (
              <div
                key={lineIndex}
                className="group/line -mx-2 min-h-[1.7em] whitespace-pre rounded px-2 hover:bg-[var(--cream)]/60"
              >
                {tokens.length === 0 ? (
                  <span>&nbsp;</span>
                ) : (
                  tokens.map((token, tokenIndex) => (
                    <span key={tokenIndex} className={token.className}>
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
