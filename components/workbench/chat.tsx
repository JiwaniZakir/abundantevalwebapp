"use client";

import { ArrowUp, Check, Copy, Loader2, RefreshCw, Square, Sparkles } from "lucide-react";
import { KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWorkbench } from "@/lib/workbench/store";
import { stageContexts, stageForPhase } from "@/lib/agent/stages";
import type { ChatMessage } from "@/lib/agent/types";
import { ToolCallCard } from "./tool-call-card";
import { ApprovalGateCard } from "./approval-gate-card";
import { cn } from "@/lib/utils";

const COMMANDS = ["/plan", "/weakness", "/probe", "/scaffold", "/fixtures", "/sweep oracle", "/sweep nop", "/sweep target", "/lint", "/audit", "/iterate", "/publish"];

function PlanStrip() {
  const plan = useWorkbench((s) => s.plan);
  if (plan.length === 0) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-5 py-2.5">
      <ol className="space-y-1 text-[12px]">
        {plan.map((step, i) => (
          <li key={step.id} className={cn(
            "flex items-center gap-2",
            step.status === "done" && "text-[var(--fg-faint)] line-through",
            step.status === "pending" && "text-[var(--fg-muted)]",
            step.status === "active" && "text-[var(--fg)]",
          )}>
            <span className="mono text-[10px] text-[var(--fg-faint)] w-4">{String(i + 1).padStart(2, "0")}</span>
            {step.status === "active" && <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />}
            {step.status === "done" && <Check className="h-3 w-3 text-[var(--green)]" />}
            {step.status === "pending" && <span className="h-3 w-3 rounded-full border border-[var(--fg-faint)]" />}
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MessageBubble({ message, isLastAssistant }: { message: ChatMessage; isLastAssistant: boolean }) {
  const isUser = message.role === "user";
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const regenerateLast = useWorkbench((s) => s.regenerateLast);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(message.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={cn("group/msg px-5 py-5 animate-fade-in", !isUser && "bg-[var(--bg-surface)]")}>
      <div className="mx-auto max-w-[680px]">
        <div className="flex items-start gap-3">
          {isUser ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-active)] text-[11px] font-semibold text-[var(--fg-muted)]">Y</span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          )}

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[13px] font-semibold text-[var(--fg)]">
                {isUser ? "You" : "Harbor Agent"}
              </span>
              {message.pending && !isUser && (
                <Loader2 className="h-3 w-3 animate-spin text-[var(--fg-muted)]" />
              )}
            </div>

            {message.content && (
              <p className={cn(
                "text-[14px] leading-[1.6] text-[var(--fg-secondary)] whitespace-pre-wrap",
                message.pending && !isUser && "caret",
              )}>
                {message.content}
              </p>
            )}

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {message.toolCalls.map((call) => <ToolCallCard key={call.id} call={call} />)}
              </div>
            )}

            {!message.pending && (isLastAssistant && !isUser) && (
              <div className="flex items-center gap-1 mt-3 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                <button type="button" onClick={onCopy} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={() => void regenerateLast()} disabled={isStreaming} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30">
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onPick }: { onPick: (v: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[520px] w-full">
        <p className="text-micro uppercase tracking-wider text-[var(--accent)]">Autopilot pipeline</p>
        <h2 className="mt-2 text-display text-[var(--fg)]">One workflow. Full benchmark.</h2>
        <p className="mt-3 text-body text-[var(--fg-muted)] leading-relaxed">
          Describe your operational workflow. The agent runs weakness mapping, batch probes, Harbor build, validation, and registry publish — pausing only for approval.
        </p>
        <button
          type="button"
          onClick={() =>
            onPick(
              "Quarterly compliance release: analysts reconcile policy updates, evidence packs, and a signed audit workbook from conflicting stakeholder exports.",
            )
          }
          className="mt-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3.5 text-left hover:border-[var(--accent-strong)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <p className="text-body font-medium text-[var(--fg)]">Try example workflow</p>
          <p className="mt-1 text-caption text-[var(--fg-muted)]">Starts the full autopilot run</p>
        </button>
      </div>
    </div>
  );
}

function ContextualChips({ onPick }: { onPick: (v: string) => void }) {
  const autopilotActive = useWorkbench((s) => s.autopilotActive);
  const pendingApproval = useWorkbench((s) => s.pendingApproval);
  const phase = useWorkbench((s) => s.workspace.phase);
  const stage = stageForPhase(phase);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const ctx = stageContexts[stage];
  const chips = ctx.chips.filter((c) => c.tone === "primary").slice(0, 1);

  if (autopilotActive || pendingApproval || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-5 py-2 border-t border-[var(--border)] bg-[var(--bg-surface)]">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          disabled={isStreaming}
          onClick={() => onPick(chip.value)}
          className="rounded-full bg-[var(--accent)] px-3 py-1 text-caption font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-30 transition-colors"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function Composer() {
  const [value, setValue] = useState("");
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const sendInput = useWorkbench((s) => s.sendInput);
  const stopStreaming = useWorkbench((s) => s.stopStreaming);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (!value.startsWith("/")) return [];
    return COMMANDS.filter((c) => c.startsWith(value.toLowerCase())).slice(0, 5);
  }, [value]);

  useLayoutEffect(() => {
    const n = ref.current;
    if (!n) return;
    n.style.height = "auto";
    n.style.height = `${Math.min(n.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || isStreaming) return;
    void sendInput(value);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div className="border-t border-[var(--border)] px-5 py-4">
      {suggestions.length > 0 && (
        <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden shadow-sm">
          {suggestions.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => { setValue(cmd + " "); ref.current?.focus(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-b-0"
            >
              <span className="mono text-[var(--accent)] font-medium">{cmd}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto max-w-[680px]">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-white px-4 py-3 shadow-sm focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-soft)] transition-all">
          <textarea
            ref={ref}
            id="chat-composer"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe your workflow — the agent runs the full pipeline automatically…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[14px] leading-[1.5] outline-none placeholder:text-[var(--fg-faint)]"
          />
          {isStreaming ? (
            <button type="button" onClick={stopStreaming} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--fg-secondary)] hover:bg-[var(--bg-active)] transition-colors">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={!value.trim()} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-opacity", !value.trim() && "opacity-15")}>
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Chat() {
  const messages = useWorkbench((s) => s.messages);
  const sendInput = useWorkbench((s) => s.sendInput);
  const pendingApproval = useWorkbench((s) => s.pendingApproval);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(messages.length);
  const hasOnlyIntro = messages.length === 1 && messages[0].id === "intro";

  useEffect(() => {
    const n = scrollRef.current;
    if (!n) return;
    if (messages.length >= prevLenRef.current) {
      n.scrollTo({ top: n.scrollHeight, behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages]);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <PlanStrip />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {hasOnlyIntro ? (
          <WelcomeScreen onPick={(v) => void sendInput(v)} />
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "user" && msg.content.startsWith("__autopilot:")) return null;
            const isLastAssistant = msg.role === "assistant" && !messages.slice(i + 1).some((m) => m.role === "assistant");
            return <MessageBubble key={msg.id} message={msg} isLastAssistant={isLastAssistant} />;
          })
        )}
      </div>
      {pendingApproval && !isStreaming && <ApprovalGateCard gate={pendingApproval} />}
      <ContextualChips onPick={(v) => void sendInput(v)} />
      <Composer />
    </section>
  );
}
