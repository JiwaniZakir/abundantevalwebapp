import { streamText, stepCountIs } from "ai";
import { randomUUID } from "node:crypto";
import { EventChannel } from "./event-channel";
import { buildLlmTools } from "./llm-tools";
import { systemPrompt } from "./system-prompt";
import { getAiModel } from "@/lib/ai/providers";
import { stageContexts, stageForPhase } from "./stages";
import type {
  AgentEvent,
  ChatMessage,
  PlanStep,
  ToolCall,
  WorkspaceState,
} from "./types";

export type LlmAgentOptions = {
  input: string;
  history: ChatMessage[];
  workspace: WorkspaceState;
  targetProvider: string;
  targetModelSlug: string;
  judgeProvider: string;
  judgeModelSlug: string;
  scaffoldProvider: string;
  scaffoldModelSlug: string;
  intakeProvider: string;
  intakeModelSlug: string;
  trialsPerVariant?: number;
};

function plannerHeadline(workspace: WorkspaceState): string {
  const stage = stageForPhase(workspace.phase);
  const ctx = stageContexts[stage];
  return `Active stage: ${ctx.stage}. ${ctx.headline} ${ctx.hint}`;
}

function deriveHistory(history: ChatMessage[]) {
  return history.slice(-12).map((message) => ({
    role: message.role === "system" ? ("system" as const) : message.role,
    content: message.content,
  }));
}

function maybeEmitPlan(channel: EventChannel<AgentEvent>, text: string) {
  const match = text.match(/<plan>([\s\S]*?)<\/plan>/i);
  if (!match) return;
  const lines = match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return;
  const plan: PlanStep[] = lines.map((label, index) => ({
    id: `step-${index}`,
    label,
    status: index === 0 ? "active" : "pending",
  }));
  channel.push({ type: "plan", plan });
}

export async function* runLlmAgent(
  options: LlmAgentOptions,
): AsyncGenerator<AgentEvent> {
  const channel = new EventChannel<AgentEvent>();

  const tools = buildLlmTools({
    workspace: options.workspace,
    channel,
    targetProvider: options.targetProvider,
    targetModelSlug: options.targetModelSlug,
    judgeProvider: options.judgeProvider,
    judgeModelSlug: options.judgeModelSlug,
    scaffoldProvider: options.scaffoldProvider,
    scaffoldModelSlug: options.scaffoldModelSlug,
    intakeProvider: options.intakeProvider,
    intakeModelSlug: options.intakeModelSlug,
    trialsPerVariant: options.trialsPerVariant ?? 5,
  });

  const messages = deriveHistory(options.history);
  messages.push({ role: "user", content: options.input });

  const contextualSystem = `${systemPrompt}\n\nWorkbench context: ${plannerHeadline(options.workspace)}\nKnown artifacts: ${Object.keys(options.workspace.artifacts).join(", ") || "(empty)"}.`;

  const accumulatedText: { value: string } = { value: "" };
  const toolStartTimes = new Map<string, number>();

  const work = (async () => {
    try {
      const result = streamText({
        model: getAiModel(options.targetProvider, options.targetModelSlug),
        system: contextualSystem,
        messages,
        tools,
        stopWhen: stepCountIs(12),
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta": {
            const delta =
              "text" in part && typeof part.text === "string"
                ? part.text
                : "textDelta" in part && typeof part.textDelta === "string"
                  ? part.textDelta
                  : "";
            if (!delta) break;
            accumulatedText.value += delta;
            channel.push({ type: "text", delta });
            break;
          }
          case "tool-call": {
            const id = part.toolCallId ?? randomUUID();
            toolStartTimes.set(id, Date.now());
            const rawInput = (part as unknown as { input?: Record<string, unknown> }).input;
            channel.push({
              type: "tool_call_start",
              call: {
                id,
                name: part.toolName as ToolCall["name"],
                args: (rawInput ?? {}) as Record<string, unknown>,
                status: "running",
                startedAt: toolStartTimes.get(id)!,
              },
            });
            break;
          }
          case "tool-result": {
            const id = part.toolCallId ?? randomUUID();
            const rawResult = (part as unknown as { output?: unknown }).output;
            const summary =
              typeof rawResult === "object" && rawResult !== null && "summary" in (rawResult as Record<string, unknown>)
                ? String((rawResult as Record<string, unknown>).summary)
                : undefined;
            channel.push({
              type: "tool_call_finish",
              id,
              result: rawResult ?? null,
              summary,
              status: "succeeded",
            });
            break;
          }
          case "tool-error": {
            const id = part.toolCallId ?? randomUUID();
            const errorValue = (part as unknown as { error?: unknown }).error;
            const message =
              errorValue instanceof Error
                ? errorValue.message
                : typeof errorValue === "string"
                  ? errorValue
                  : "tool execution failed";
            channel.push({
              type: "tool_call_finish",
              id,
              result: { error: message },
              summary: message.slice(0, 200),
              status: "failed",
            });
            channel.push({
              type: "notice",
              level: "error",
              message: `Tool ${part.toolName ?? "unknown"} failed: ${message}`,
              reason: "tool_error",
            });
            break;
          }
          case "error": {
            const message =
              (part as unknown as { error?: unknown }).error instanceof Error
                ? ((part as unknown as { error?: Error }).error as Error).message
                : String((part as unknown as { error?: unknown }).error ?? "unknown stream error");
            channel.push({ type: "error", message });
            break;
          }
          default:
            break;
        }
      }

      maybeEmitPlan(channel, accumulatedText.value);
      channel.push({ type: "done" });
    } catch (error) {
      channel.push({
        type: "error",
        message: error instanceof Error ? error.message : "agent failed",
      });
      channel.push({ type: "done" });
    } finally {
      channel.close();
    }
  })();

  try {
    for await (const event of channel) {
      yield event;
    }
  } finally {
    await work;
  }
}
