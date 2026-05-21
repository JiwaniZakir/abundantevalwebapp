"use client";

import { create } from "zustand";
import { buildDemoWorkspace } from "@/lib/agent/seed-workspace";
import { stageForPhase } from "@/lib/agent/stages";
import type {
  AgentEvent,
  Artifact,
  AuditSummary,
  ChatMessage,
  PlanStep,
  ProbeSummary,
  SpoilerFinding,
  SweepSummary,
  ToolCall,
  WorkspaceState,
} from "@/lib/agent/types";

export type FocusTarget =
  | { kind: "briefing" }
  | { kind: "artifact"; path: string }
  | { kind: "result"; result: ResultSurface };

export type ResultSurface =
  | "probe"
  | "sweep"
  | "cascade"
  | "audit"
  | "iteration"
  | "spoilers";

export type Notice = {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  createdAt: number;
};

export type RuntimeMode = "live" | "demo";

export type EnvStatus = {
  anthropic: boolean;
  openai: boolean;
  google: boolean;
  harborBin: boolean;
  harborBinName?: string;
  ghCli: boolean;
  publishOwner: string | null;
};

type WorkbenchState = {
  workspace: WorkspaceState;
  messages: ChatMessage[];
  focus: FocusTarget;
  recentArtifacts: string[];
  isStreaming: boolean;
  taskPackOpen: boolean;
  publishOpen: boolean;
  mode: RuntimeMode;
  envStatus: EnvStatus | null;
  resultsAvailable: Record<ResultSurface, boolean>;
  probeSummary?: ProbeSummary;
  sweepSummary?: SweepSummary;
  spoilerFindings: SpoilerFinding[];
  audit?: AuditSummary;
  latestIterationPath?: string;
  plan: PlanStep[];
  notices: Notice[];

  setFocus: (focus: FocusTarget) => void;
  openArtifact: (path: string) => void;
  setTaskPackOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  setMode: (mode: RuntimeMode) => void;
  setEnvStatus: (status: EnvStatus) => void;
  dismissNotice: (id: string) => void;

  sendInput: (input: string) => Promise<void>;
  resetDemo: () => void;
};

function nextMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function initialMessages(): ChatMessage[] {
  return [
    {
      id: "intro",
      role: "assistant",
      createdAt: Date.now(),
      content:
        "Welcome. Describe the operational workflow you want to turn into a hard Harbor eval, or say \"use the ds-25 demo\" to follow a guided run.",
      phase: "intake",
    },
  ];
}

function applyArtifact(
  workspace: WorkspaceState,
  artifact: Artifact,
): WorkspaceState {
  return {
    ...workspace,
    artifacts: {
      ...workspace.artifacts,
      [artifact.path]: artifact,
    },
  };
}

function pushRecent(list: string[], path: string) {
  const filtered = list.filter((entry) => entry !== path);
  return [path, ...filtered].slice(0, 6);
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  workspace: buildDemoWorkspace(),
  messages: initialMessages(),
  focus: { kind: "briefing" },
  recentArtifacts: ["instruction.md"],
  isStreaming: false,
  taskPackOpen: false,
  publishOpen: false,
  mode: "live",
  envStatus: null,
  resultsAvailable: {
    probe: false,
    sweep: false,
    cascade: false,
    audit: false,
    iteration: false,
    spoilers: false,
  },
  spoilerFindings: [],
  plan: [],
  notices: [],

  setFocus(focus) {
    set({ focus });
  },

  openArtifact(path) {
    set((state) => ({
      focus: { kind: "artifact", path },
      recentArtifacts: pushRecent(state.recentArtifacts, path),
      taskPackOpen: false,
    }));
  },

  setTaskPackOpen(open) {
    set({ taskPackOpen: open });
  },

  setPublishOpen(open) {
    set({ publishOpen: open });
  },

  setMode(mode) {
    set({ mode });
  },

  setEnvStatus(envStatus) {
    set((state) => {
      const anyKey = envStatus.anthropic || envStatus.openai || envStatus.google;
      return {
        envStatus,
        mode: state.mode === "live" && !anyKey ? "demo" : state.mode,
      };
    });
  },

  dismissNotice(id) {
    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== id),
    }));
  },

  resetDemo() {
    set({
      workspace: buildDemoWorkspace(),
      messages: initialMessages(),
      focus: { kind: "briefing" },
      recentArtifacts: ["instruction.md"],
      taskPackOpen: false,
      resultsAvailable: {
        probe: false,
        sweep: false,
        cascade: false,
        audit: false,
        iteration: false,
        spoilers: false,
      },
      probeSummary: undefined,
      sweepSummary: undefined,
      spoilerFindings: [],
      audit: undefined,
      latestIterationPath: undefined,
      plan: [],
      notices: [],
    });
  },

  async sendInput(rawInput) {
    const input = rawInput.trim();
    if (!input || get().isStreaming) return;

    const userMessage: ChatMessage = {
      id: nextMessageId(),
      role: "user",
      content: input,
      createdAt: Date.now(),
    };

    const assistantId = nextMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      toolCalls: [],
      pending: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      plan: [],
    }));

    let buffer = "";

    try {
      const state = get();
      const trimmedHistory = state.messages
        .slice(-13, -1)
        .filter((message) => message.role !== "assistant" || message.content.length > 0)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        }));

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode: state.mode,
          history: trimmedHistory,
          workspace: {
            phase: state.workspace.phase,
            artifacts: Object.values(state.workspace.artifacts),
          },
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          if (!raw.startsWith("data: ")) continue;
          const payload = raw.slice("data: ".length);
          let event: AgentEvent;
          try {
            event = JSON.parse(payload) as AgentEvent;
          } catch {
            continue;
          }

          applyEventToStore(event, assistantId, set);
        }
      }
    } catch (error) {
      console.error("Agent stream failed", error);
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                pending: false,
                content: `${message.content}\n\n_Stream failed: ${
                  error instanceof Error ? error.message : "unknown error"
                }_`,
              }
            : message,
        ),
      }));
    } finally {
      set((state) => ({
        isStreaming: false,
        messages: state.messages.map((message) =>
          message.id === assistantId ? { ...message, pending: false } : message,
        ),
      }));
    }
  },
}));

function applyEventToStore(
  event: AgentEvent,
  assistantId: string,
  set: (
    partial:
      | Partial<WorkbenchState>
      | ((state: WorkbenchState) => Partial<WorkbenchState>),
  ) => void,
) {
  switch (event.type) {
    case "text":
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? { ...message, content: message.content + event.delta }
            : message,
        ),
      }));
      break;

    case "tool_call_start": {
      const call: ToolCall = { ...event.call, status: "running" };
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                toolCalls: [...(message.toolCalls ?? []), call],
              }
            : message,
        ),
      }));
      break;
    }

    case "tool_call_finish":
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                toolCalls: message.toolCalls?.map((call) =>
                  call.id === event.id
                    ? {
                        ...call,
                        status: event.status ?? "succeeded",
                        finishedAt: Date.now(),
                        result: event.result,
                        summary: event.summary ?? call.summary,
                      }
                    : call,
                ),
              }
            : message,
        ),
      }));
      break;

    case "artifact":
      set((state) => {
        const workspace = applyArtifact(state.workspace, event.artifact);
        const recentArtifacts = pushRecent(state.recentArtifacts, event.artifact.path);
        const isIteration = event.artifact.path.startsWith("iterations/");
        return {
          workspace,
          recentArtifacts,
          focus: isIteration
            ? ({ kind: "result", result: "iteration" } as const)
            : ({ kind: "artifact", path: event.artifact.path } as const),
          latestIterationPath: isIteration ? event.artifact.path : state.latestIterationPath,
          resultsAvailable: isIteration
            ? { ...state.resultsAvailable, iteration: true }
            : state.resultsAvailable,
        };
      });
      break;

    case "phase":
      set((state) => ({
        workspace: { ...state.workspace, phase: event.phase },
      }));
      // Touch derived value to keep TS happy and to surface stage transitions later if needed.
      stageForPhase(event.phase);
      break;

    case "plan":
      set({ plan: event.plan });
      break;

    case "probe_summary":
      set((state) => ({
        probeSummary: event.summary,
        resultsAvailable: { ...state.resultsAvailable, probe: true },
        focus: { kind: "result", result: "probe" },
      }));
      break;

    case "sweep_summary":
      set((state) => ({
        sweepSummary: event.summary,
        resultsAvailable: {
          ...state.resultsAvailable,
          sweep: true,
          cascade: !!event.summary.cascade,
        },
        focus: { kind: "result", result: "sweep" },
      }));
      break;

    case "spoiler_findings":
      set((state) => ({
        spoilerFindings: event.findings,
        resultsAvailable: {
          ...state.resultsAvailable,
          spoilers: event.findings.length > 0,
        },
        focus:
          event.findings.length > 0
            ? ({ kind: "result", result: "spoilers" } as const)
            : state.focus,
      }));
      break;

    case "notice":
      set((state) => ({
        notices: [
          ...state.notices,
          {
            id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level: event.level,
            message: event.message,
            createdAt: Date.now(),
          },
        ],
      }));
      break;

    case "audit":
      set((state) => ({
        audit: event.audit,
        resultsAvailable: { ...state.resultsAvailable, audit: true },
        focus: { kind: "result", result: "audit" },
      }));
      break;

    case "done":
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? { ...message, pending: false }
            : message,
        ),
      }));
      break;

    case "error":
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                pending: false,
                content: `${message.content}\n\n_${event.message}_`,
              }
            : message,
        ),
      }));
      break;
  }
}
