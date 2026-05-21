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

export const DEFAULT_TRIALS_PER_VARIANT = 5;

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

function explainSlashCommand(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) return null;
  const [head, ...rest] = trimmed.slice(1).split(/\s+/);
  switch (head) {
    case "plan":
      return "Draft a 3-5 step plan first using a <plan>...</plan> block, then proceed step-by-step.";
    case "weakness":
      return "Call intake_workflow tool first to derive a weakness card from the user's prior description (or ask for one).";
    case "probe":
      return "Call run_probe_variants tool with the current weakness card. Use the workspace context to fill weaknessTitle, hypothesis, deliverable, badHeuristic, authorityInvariant.";
    case "scaffold":
      return "Call scaffold_task tool to emit the Harbor task pack files. Use the active weakness card and intake context for inputs.";
    case "fixtures":
      return "Call generate_fixtures tool to synthesize multimodal fixtures and write them under environment/data.";
    case "sweep": {
      const target = rest[0]?.toLowerCase();
      if (target === "oracle" || target === "nop" || target === "target") {
        return `Call run_harbor_sweep tool with agent=${target}. Materialize the workspace first if needed.`;
      }
      return "Call run_harbor_sweep tool. Default agent to oracle if not specified.";
    }
    case "lint": {
      const path = rest.join(" ") || "instruction.md";
      return `Call lint_spoilers tool with artifactPath="${path}".`;
    }
    case "audit":
      return "Call audit_trajectory tool with the most recent failing trajectory text.";
    case "iterate":
      return "Call propose_iteration tool with a before/after pair targeting the most spoiler-laden artifact.";
    case "publish":
      return "Tell the user you're opening the publish dialog and call set_phase tool with phase=publish. The UI will surface the GitHub publish dialog separately.";
    default:
      return null;
  }
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
    trialsPerVariant: options.trialsPerVariant ?? DEFAULT_TRIALS_PER_VARIANT,
  });

  const messages = deriveHistory(options.history);
  messages.push({ role: "user", content: options.input });

  const slashGuidance = explainSlashCommand(options.input);
  const contextualSystem = `${systemPrompt}\n\nWorkbench context: ${plannerHeadline(options.workspace)}\nKnown artifacts: ${Object.keys(options.workspace.artifacts).join(", ") || "(empty)"}.${slashGuidance ? `\n\nUser invoked a slash command. ${slashGuidance}` : ""}`;

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
      if (options.input.trim().toLowerCase().startsWith("/publish")) {
        channel.push({ type: "publish_open" });
      }
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
