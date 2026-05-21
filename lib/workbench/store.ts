"use client";

import { create } from "zustand";
import {
  buildAutopilotContinuation,
  isAutopilotContinuation,
  parseAutopilotContinuation,
} from "@/lib/agent/autopilot-continuation";
import { buildEmptyWorkspace } from "@/lib/agent/seed-workspace";
import { stageForPhase } from "@/lib/agent/stages";
import type {
  AgentEvent,
  Artifact,
  AuditSummary,
  ApprovalGate,
  ChatMessage,
  DecisionReportEntry,
  PlanStep,
  ProbeSummary,
  SpoilerFinding,
  SweepSummary,
  ToolCall,
  WeaknessReport,
  WorkspaceState,
} from "@/lib/agent/types";

export type FocusTarget =
  | { kind: "none" }
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

export type EnvStatus = {
  anthropic: boolean;
  openai: boolean;
  google: boolean;
  harborBin: boolean;
  harborBinName?: string;
  harborAuth: boolean;
  harborPublishOrg: string | null;
  ghCli: boolean;
  publishOwner: string | null;
  publishTarget: "registry" | "github" | "both";
};

export type WorkbenchSnapshot = {
  workspace: WorkspaceState;
  messages: ChatMessage[];
  focus: FocusTarget;
  recentArtifacts: string[];
  resultsAvailable: Record<ResultSurface, boolean>;
  probeSummary?: ProbeSummary;
  probeSummaries: ProbeSummary[];
  sweepSummary?: SweepSummary;
  weaknessReport?: WeaknessReport;
  decisionReport: DecisionReportEntry[];
  resultTimestamps: Partial<Record<ResultSurface, number>>;
  spoilerFindings: SpoilerFinding[];
  audit?: AuditSummary;
  latestIterationPath?: string;
  plan: PlanStep[];
};

type WorkbenchState = WorkbenchSnapshot & {
  isStreaming: boolean;
  taskPackOpen: boolean;
  publishOpen: boolean;
  envStatus: EnvStatus | null;
  sweepTrialsLive: SweepSummary["trials"];
  notices: Notice[];
  projectId: string | null;
  saveDebounceTimer: ReturnType<typeof setTimeout> | null;
  pendingApproval: ApprovalGate | null;
  autopilotActive: boolean;
  autopilotMessage: string | null;

  setFocus: (focus: FocusTarget) => void;
  openArtifact: (path: string) => void;
  setTaskPackOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  setEnvStatus: (status: EnvStatus) => void;
  setTargetModel: (modelSlug: string, runner?: string) => void;
  dismissNotice: (id: string) => void;
  applyIteration: (input: {
    diffPath: string;
    targetPath: string;
    before: string;
    after: string;
  }) => { ok: boolean; reason?: string };

  sendInput: (input: string, options?: { displayContent?: string }) => Promise<void>;
  stopStreaming: () => void;
  regenerateLast: () => Promise<void>;
  editLastUserMessage: (newContent: string) => Promise<void>;
  approveWeaknessCandidates: (slugs: string[]) => void;
  rejectWeaknessCandidates: (slugs: string[]) => void;
  resetWorkspace: () => void;
  hydrateFromSnapshot: (snapshot: WorkbenchSnapshot, projectId?: string) => void;
  scheduleProjectSave: () => void;
  respondToApproval: (decision: "approve" | "reject") => Promise<void>;
};

let activeStreamController: AbortController | null = null;

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
        "Describe an operational workflow in plain language. I'll run the full pipeline — weakness map, batch probes, Harbor build, validation, and registry publish — pausing only for your approval at key gates.",
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

function snapshotFromState(state: WorkbenchState): WorkbenchSnapshot {
  return {
    workspace: state.workspace,
    messages: state.messages,
    focus: state.focus,
    recentArtifacts: state.recentArtifacts,
    resultsAvailable: state.resultsAvailable,
    probeSummary: state.probeSummary,
    probeSummaries: state.probeSummaries,
    sweepSummary: state.sweepSummary,
    weaknessReport: state.weaknessReport,
    decisionReport: state.decisionReport,
    resultTimestamps: state.resultTimestamps,
    spoilerFindings: state.spoilerFindings,
    audit: state.audit,
    latestIterationPath: state.latestIterationPath,
    plan: state.plan,
  };
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  workspace: buildEmptyWorkspace(),
  messages: initialMessages(),
  focus: { kind: "none" },
  recentArtifacts: [],
  isStreaming: false,
  taskPackOpen: false,
  publishOpen: false,
  envStatus: null,
  resultsAvailable: {
    probe: false,
    sweep: false,
    cascade: false,
    audit: false,
    iteration: false,
    spoilers: false,
  },
  probeSummaries: [],
  sweepTrialsLive: [],
  decisionReport: [],
  resultTimestamps: {},
  spoilerFindings: [],
  plan: [],
  notices: [],
  projectId: null,
  saveDebounceTimer: null,
  pendingApproval: null,
  autopilotActive: false,
  autopilotMessage: null,

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

  setEnvStatus(envStatus) {
    set({ envStatus });
  },

  setTargetModel(modelSlug, runner) {
    set((state) => {
      const hash = `rcfg_${Date.now().toString(36)}_${modelSlug.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
      return {
        workspace: {
          ...state.workspace,
          targetModel: modelSlug,
          runner: runner ?? state.workspace.runner,
          runConfigHash: hash,
        },
        notices: [
          ...state.notices,
          {
            id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level: "info",
            message: `Target model switched to ${modelSlug}. New RunConfig hash pinned.`,
            createdAt: Date.now(),
          },
        ],
      };
    });
  },

  dismissNotice(id) {
    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== id),
    }));
  },

  applyIteration({ diffPath, targetPath, before, after }) {
    const state = get();
    const target = state.workspace.artifacts[targetPath];
    if (!target) {
      return { ok: false, reason: "target_missing" };
    }
    if (!target.content.includes(before)) {
      return { ok: false, reason: "before_not_found" };
    }
    const nextContent = target.content.replace(before, after);
    const now = Date.now();
    const updatedTarget: Artifact = {
      ...target,
      content: nextContent,
      updatedAt: now,
      dirty: true,
    };
    const updatedDiff = state.workspace.artifacts[diffPath]
      ? {
          ...state.workspace.artifacts[diffPath],
          badge: "iteration · accepted",
          updatedAt: now,
        }
      : undefined;

    set((s) => ({
      workspace: {
        ...s.workspace,
        artifacts: {
          ...s.workspace.artifacts,
          [targetPath]: updatedTarget,
          ...(updatedDiff ? { [diffPath]: updatedDiff } : {}),
        },
      },
      notices: [
        ...s.notices,
        {
          id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          level: "info",
          message: `Iteration applied to ${targetPath}.`,
          createdAt: Date.now(),
        },
      ],
    }));
    return { ok: true };
  },

  resetWorkspace() {
    set({
      workspace: buildEmptyWorkspace(),
      messages: initialMessages(),
      focus: { kind: "none" },
      recentArtifacts: [],
      taskPackOpen: false,
      projectId: null,
      resultsAvailable: {
        probe: false,
        sweep: false,
        cascade: false,
        audit: false,
        iteration: false,
        spoilers: false,
      },
      probeSummary: undefined,
      probeSummaries: [],
      sweepSummary: undefined,
      sweepTrialsLive: [],
      weaknessReport: undefined,
      decisionReport: [],
      resultTimestamps: {},
      spoilerFindings: [],
      audit: undefined,
      latestIterationPath: undefined,
      plan: [],
      notices: [],
      pendingApproval: null,
      autopilotActive: false,
      autopilotMessage: null,
    });
  },

  hydrateFromSnapshot(snapshot, projectId) {
    set({
      ...snapshot,
      isStreaming: false,
      taskPackOpen: false,
      publishOpen: false,
      sweepTrialsLive: snapshot.sweepSummary?.trials ?? [],
      projectId: projectId ?? get().projectId,
      notices: [],
    });
  },

  scheduleProjectSave() {
    const state = get();
    if (state.saveDebounceTimer) clearTimeout(state.saveDebounceTimer);
    const timer = setTimeout(() => {
      void (async () => {
        const current = get();
        const body = {
          id: current.projectId ?? undefined,
          name: current.workspace.projectName,
          snapshot: snapshotFromState(current),
        };
        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) return;
          const data = (await res.json()) as { id: string };
          if (data.id && data.id !== current.projectId) {
            set({ projectId: data.id });
          }
        } catch {
          /* persistence optional when DB unavailable */
        }
      })();
    }, 1200);
    set({ saveDebounceTimer: timer });
  },

  approveWeaknessCandidates(slugs) {
    set((state) => {
      if (!state.weaknessReport) return state;
      const approved = new Set(slugs);
      return {
        weaknessReport: {
          ...state.weaknessReport,
          candidates: state.weaknessReport.candidates.map((c) =>
            approved.has(c.slug) ? { ...c, status: "approved" as const } : c,
          ),
        },
      };
    });
  },

  rejectWeaknessCandidates(slugs) {
    set((state) => {
      if (!state.weaknessReport) return state;
      const rejected = new Set(slugs);
      return {
        weaknessReport: {
          ...state.weaknessReport,
          candidates: state.weaknessReport.candidates.map((c) =>
            rejected.has(c.slug) ? { ...c, status: "rejected" as const } : c,
          ),
        },
      };
    });
  },

  async respondToApproval(decision) {
    const gate = get().pendingApproval;
    if (!gate || get().isStreaming) return;
    set({ pendingApproval: null, autopilotActive: decision === "approve" });
    const continuation = buildAutopilotContinuation(
      gate.gateId,
      gate.stage as import("@/lib/agent/autopilot-continuation").AutopilotStage,
      decision,
    );
    const label = decision === "approve" ? `Approved: ${gate.title}` : `Paused: ${gate.title}`;
    await get().sendInput(continuation, { displayContent: label });
  },

  async sendInput(rawInput, options) {
    let input = rawInput.trim();
    if (!input || get().isStreaming) return;

    const pending = get().pendingApproval;
    if (pending && !isAutopilotContinuation(input)) {
      if (/^(yes|approve|continue|ok|go ahead)$/i.test(input)) {
        input = buildAutopilotContinuation(
          pending.gateId,
          pending.stage as import("@/lib/agent/autopilot-continuation").AutopilotStage,
          "approve",
        );
        set({ pendingApproval: null, autopilotActive: true });
      } else if (/^(no|reject|stop|pause)$/i.test(input)) {
        input = buildAutopilotContinuation(
          pending.gateId,
          pending.stage as import("@/lib/agent/autopilot-continuation").AutopilotStage,
          "reject",
        );
        set({ pendingApproval: null });
      }
    }

    if (isAutopilotContinuation(input)) {
      const parsed = parseAutopilotContinuation(input);
      set({
        autopilotActive: parsed?.decision === "approve",
        pendingApproval: null,
      });
    } else if (pending && /^(no|reject|stop|pause)$/i.test(rawInput.trim())) {
      set({ autopilotActive: false });
    }

    const userMessage: ChatMessage = {
      id: nextMessageId(),
      role: "user",
      content: options?.displayContent ?? input,
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
      autopilotActive: isAutopilotContinuation(input) || (!input.startsWith("/") && input.length >= 12),
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

      activeStreamController?.abort();
      const controller = new AbortController();
      activeStreamController = controller;

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          history: trimmedHistory,
          workspace: {
            phase: state.workspace.phase,
            artifacts: Object.values(state.workspace.artifacts),
          },
        }),
        signal: controller.signal,
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
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (!aborted) {
        console.error("Agent stream failed", error);
      }
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                pending: false,
                content: aborted
                  ? `${message.content}\n\n_Stream stopped by user._`
                  : `${message.content}\n\n_Stream failed: ${
                      error instanceof Error ? error.message : "unknown error"
                    }_`,
              }
            : message,
        ),
      }));
    } finally {
      activeStreamController = null;
      set((state) => ({
        isStreaming: false,
        messages: state.messages.map((message) =>
          message.id === assistantId ? { ...message, pending: false } : message,
        ),
      }));
      get().scheduleProjectSave();
    }
  },

  stopStreaming() {
    activeStreamController?.abort();
  },

  async regenerateLast() {
    const state = get();
    if (state.isStreaming) return;

    let lastUserIndex = -1;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex < 0) return;

    const lastUser = state.messages[lastUserIndex];
    set((s) => ({
      messages: s.messages.slice(0, lastUserIndex),
    }));
    await get().sendInput(lastUser.content);
  },

  async editLastUserMessage(newContent) {
    const state = get();
    if (state.isStreaming) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    let lastUserIndex = -1;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex < 0) return;

    set((s) => ({
      messages: s.messages.slice(0, lastUserIndex),
    }));
    await get().sendInput(trimmed);
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
        const userIsBrowsingArtifact =
          state.focus.kind === "artifact" &&
          state.focus.path !== event.artifact.path;

        let nextFocus = state.focus;
        if (isIteration) {
          nextFocus = { kind: "result", result: "iteration" };
        } else if (state.focus.kind === "none") {
          nextFocus = { kind: "artifact", path: event.artifact.path };
        } else if (state.focus.kind === "result") {
          nextFocus = state.focus;
        } else if (!userIsBrowsingArtifact) {
          nextFocus = { kind: "artifact", path: event.artifact.path };
        }

        return {
          workspace,
          recentArtifacts,
          focus: nextFocus,
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
        probeSummaries: [...state.probeSummaries.filter((s) => s.weaknessTitle !== event.summary.weaknessTitle), event.summary],
        resultsAvailable: { ...state.resultsAvailable, probe: true },
        resultTimestamps: { ...state.resultTimestamps, probe: Date.now() },
        focus: { kind: "result", result: "probe" },
      }));
      break;

    case "probe_batch_summary":
      set((state) => ({
        probeSummaries: event.summaries,
        probeSummary: event.summaries[0] ?? state.probeSummary,
        resultsAvailable: { ...state.resultsAvailable, probe: true },
        resultTimestamps: { ...state.resultTimestamps, probe: Date.now() },
        focus: { kind: "result", result: "probe" },
      }));
      break;

    case "weakness_report":
      set({ weaknessReport: event.report });
      break;

    case "approval_gate":
      set({
        pendingApproval: event.gate,
        autopilotActive: true,
        autopilotMessage: event.gate.description,
      });
      break;

    case "autopilot_status":
      set((state) => ({
        autopilotActive: event.stage === "ready_publish" && !event.awaitingApproval
          ? false
          : true,
        autopilotMessage: event.message ?? null,
        pendingApproval: event.awaitingApproval ? state.pendingApproval : null,
      }));
      break;

    case "decision_report":
      set({ decisionReport: event.entries });
      break;

    case "sweep_trial_update":
      set((state) => ({
        sweepTrialsLive: [...state.sweepTrialsLive.filter((t) => t.idx !== event.trial.idx), event.trial],
        resultsAvailable: { ...state.resultsAvailable, sweep: true },
      }));
      break;

    case "sweep_error":
      set((state) => ({
        notices: [
          ...state.notices,
          {
            id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level: "error",
            message: event.message,
            createdAt: Date.now(),
          },
        ],
        focus: { kind: "result", result: "sweep" },
      }));
      break;

    case "sweep_summary":
      set((state) => ({
        sweepSummary: event.summary,
        sweepTrialsLive: event.summary.trials,
        resultsAvailable: {
          ...state.resultsAvailable,
          sweep: true,
          cascade: !!event.summary.cascade,
        },
        resultTimestamps: { ...state.resultTimestamps, sweep: Date.now() },
        focus: { kind: "result", result: "sweep" },
      }));
      break;

    case "spoiler_findings":
      set((state) => ({
        spoilerFindings: event.findings,
        resultsAvailable: {
          ...state.resultsAvailable,
          spoilers: true,
        },
        resultTimestamps: { ...state.resultTimestamps, spoilers: Date.now() },
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

    case "publish_open":
      set({ publishOpen: true, autopilotActive: false, pendingApproval: null });
      break;

    case "audit":
      set((state) => ({
        audit: event.audit,
        resultsAvailable: { ...state.resultsAvailable, audit: true },
        resultTimestamps: { ...state.resultTimestamps, audit: Date.now() },
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
