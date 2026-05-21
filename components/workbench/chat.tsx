"use client";

import {
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Square,
  User2,
} from "lucide-react";
import {
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWorkbench } from "@/lib/workbench/store";
import { stageContexts, stageForPhase } from "@/lib/agent/stages";
import type { ChatMessage } from "@/lib/agent/types";
import { ToolCallCard } from "./tool-call-card";
import { cn } from "@/lib/utils";

const ADVANCED_COMMANDS = [
  "/plan",
  "/weakness",
  "/probe",
  "/scaffold",
  "/fixtures",
  "/sweep oracle",
  "/sweep nop",
  "/sweep target",
  "/lint",
  "/audit",
  "/iterate",
  "/publish",
];

function PlanStrip() {
  const plan = useWorkbench((s) => s.plan);
  if (plan.length === 0) return null;

  return (
    <div className="border-b border-[var(--hairline)] bg-[var(--paper)] px-5 py-3">
      <p className="eyebrow">Active plan</p>
      <ol className="mt-2.5 space-y-1.5 text-[12px]">
        {plan.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2.5",
              step.status === "active" && "text-[var(--ink)]",
              step.status === "done" &&
                "text-[var(--ink-muted)] line-through decoration-[var(--ink-faded)]",
              step.status === "pending" && "text-[var(--ink-faint)]",
            )}
          >
            <span className="mono text-[10px] text-[var(--ink-faint)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {step.status === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-green)]" />
            ) : step.status === "active" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ink)]" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MessageBubble({
  message,
  isLastUser,
  isLastAssistant,
}: {
  message: ChatMessage;
  isLastUser: boolean;
  isLastAssistant: boolean;
}) {
  const isUser = message.role === "user";
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const regenerateLast = useWorkbench((s) => s.regenerateLast);
  const editLastUserMessage = useWorkbench((s) => s.editLastUserMessage);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  const showToolbar =
    !message.pending && ((isUser && isLastUser) || (!isUser && isLastAssistant));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group/message relative space-y-3 px-5 py-4"
    >
      <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[var(--paper-pure)]",
            isUser ? "bg-[var(--ink-soft)]" : "bg-[var(--ink)]",
          )}
        >
          {isUser ? <User2 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
        </span>
        <span className="mono uppercase tracking-[0.12em]">
          {isUser ? "you" : "orchestrator"}
        </span>
      </div>

      {editing && isUser ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            rows={Math.min(8, Math.max(2, editValue.split("\n").length))}
            className="w-full resize-none rounded-xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3 py-2 text-[13px] leading-6 text-[var(--ink)] outline-none focus:border-[var(--ink)]/30"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditValue(message.content);
              }}
              className="rounded-full px-2.5 py-1 text-[11.5px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void editLastUserMessage(editValue);
                setEditing(false);
              }}
              disabled={!editValue.trim() || isStreaming}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1 text-[11.5px] font-medium text-[var(--paper-pure)] hover:bg-[var(--ink-soft)] disabled:opacity-40"
            >
              <ArrowUp className="h-3 w-3" /> Send
            </button>
          </div>
        </div>
      ) : (
        message.content && (
          <p
            className={cn(
              "whitespace-pre-wrap text-[13.5px] leading-[1.7] text-[var(--ink)]",
              message.pending && !isUser && "caret",
            )}
          >
            {message.content}
          </p>
        )
      )}

      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="space-y-2">
          {message.toolCalls.map((call) => (
            <ToolCallCard key={call.id} call={call} />
          ))}
        </div>
      )}

      {showToolbar && !editing && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/message:opacity-100">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2 py-1 text-[10.5px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            aria-label="Copy message"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {isUser && (
            <button
              type="button"
              onClick={() => {
                setEditValue(message.content);
                setEditing(true);
              }}
              disabled={isStreaming}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2 py-1 text-[10.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {!isUser && (
            <button
              type="button"
              onClick={() => void regenerateLast()}
              disabled={isStreaming}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2 py-1 text-[10.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StageHeader() {
  const phase = useWorkbench((s) => s.workspace.phase);
  const stage = stageForPhase(phase);
  const context = stageContexts[stage];

  return (
    <div className="border-b border-[var(--hairline)] px-5 py-4">
      <p className="eyebrow">Stage · {stage}</p>
      <p className="mt-2 text-[13.5px] font-medium tracking-[-0.005em] text-[var(--ink)]">
        {context.headline}
      </p>
      <p className="mt-1.5 text-[12px] leading-[1.6] text-[var(--ink-muted)]">
        {context.hint}
      </p>
    </div>
  );
}

function ContextualChips({ onPick }: { onPick: (value: string) => void }) {
  const phase = useWorkbench((s) => s.workspace.phase);
  const stage = stageForPhase(phase);
  const isStreaming = useWorkbench((s) => s.isStreaming);
  const context = stageContexts[stage];

  return (
    <div className="flex flex-wrap gap-1.5 px-5 pb-3 pt-2">
      {context.chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          disabled={isStreaming}
          onClick={() => onPick(chip.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
            chip.tone === "primary"
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper-pure)] hover:bg-[var(--ink-soft)]"
              : "border-[var(--hairline-strong)] bg-[var(--paper-pure)] text-[var(--ink-soft)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]",
          )}
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
  const phase = useWorkbench((s) => s.workspace.phase);
  const stage = stageForPhase(phase);
  const context = stageContexts[stage];
  const artifacts = useWorkbench((s) => s.workspace.artifacts);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (!value.startsWith("/")) return [];
    const query = value.toLowerCase();
    return ADVANCED_COMMANDS.filter((cmd) => cmd.startsWith(query)).slice(0, 5);
  }, [value]);

  const mentionContext = useMemo(() => {
    const caret = value.length;
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    const query = match[1].toLowerCase();
    const matches = Object.keys(artifacts)
      .filter((path) => path.toLowerCase().includes(query))
      .slice(0, 6);
    return { token: match[0].trim(), matches };
  }, [value, artifacts]);

  const showSuggestions = value.startsWith("/") && suggestions.length > 0;
  const showMentions = !showSuggestions && mentionContext && mentionContext.matches.length > 0;

  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || isStreaming) return;
    void sendInput(value);
    setValue("");
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const placeholder = `Tell the orchestrator about ${context.stage === "intake" ? "your workflow" : context.stage === "probe" ? "the weakness you want to probe" : context.stage === "build" ? "the deliverable you want built" : context.stage === "validate" ? "what to sweep or audit" : "the iteration you want"}…`;

  const applyMention = (path: string) => {
    if (!mentionContext) return;
    const upToCaret = value.slice(0, value.length);
    const newValue = upToCaret.replace(
      new RegExp(`${mentionContext.token.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}$`),
      `@${path} `,
    );
    setValue(newValue);
    inputRef.current?.focus();
  };

  return (
    <div className="border-t border-[var(--hairline)] bg-[var(--paper)]/85 p-4 backdrop-blur-xl">
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="mb-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] shadow-[var(--shadow-soft)]"
          >
            {suggestions.map((command) => (
              <button
                key={command}
                type="button"
                onClick={() => {
                  setValue(command + " ");
                  inputRef.current?.focus();
                }}
                className="flex w-full items-center gap-3 border-b border-[var(--hairline)] px-3.5 py-2 text-left text-[12px] last:border-b-0 hover:bg-[var(--cream-soft)]"
              >
                <span className="mono text-[var(--ink)]">{command}</span>
                <span className="text-[var(--ink-muted)]">power command</span>
              </button>
            ))}
          </motion.div>
        )}
        {showMentions && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="mb-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--paper-pure)] shadow-[var(--shadow-soft)]"
          >
            <p className="eyebrow px-3.5 pt-3">Mention an artifact</p>
            <div className="px-1 py-1">
              {mentionContext?.matches.map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => applyMention(path)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] hover:bg-[var(--cream-soft)]"
                >
                  <span className="mono truncate text-[var(--ink)]">{path}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] shadow-[var(--shadow-soft)] transition-all focus-within:border-[var(--ink)]/30 focus-within:shadow-[var(--shadow-pop)]">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[13.5px] leading-[1.55] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <div className="flex items-center justify-between gap-2 px-4 pb-3 text-[11px] text-[var(--ink-muted)]">
          <span className="mono">/ commands · @ artifacts</span>
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--paper-pure)] px-3.5 text-[11.5px] font-medium text-[var(--ink)] transition-transform hover:-translate-y-0.5"
            >
              <Square className="h-3 w-3 fill-[var(--ink)]" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 text-[11.5px] font-medium text-[var(--paper-pure)] transition-transform hover:-translate-y-0.5",
                !value.trim() && "opacity-40 hover:translate-y-0",
              )}
            >
              <ArrowUp className="h-3 w-3" />
              Send
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-[var(--hairline)] bg-[var(--cream)]">
      <StageHeader />
      <PlanStrip />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--hairline)]"
      >
        {messages.map((message, index) => {
          const isLastUser =
            message.role === "user" &&
            !messages.slice(index + 1).some((m) => m.role === "user");
          const isLastAssistant =
            message.role === "assistant" &&
            !messages.slice(index + 1).some((m) => m.role === "assistant");
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isLastUser={isLastUser}
              isLastAssistant={isLastAssistant}
            />
          );
        })}
      </div>

      <ContextualChips onPick={(value) => void sendInput(value)} />
      <Composer />
    </aside>
  );
}
