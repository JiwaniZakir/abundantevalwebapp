import { EventChannel } from "./event-channel";
import type { AgentEvent, ProbeSummary, WeaknessReport, WorkspaceState } from "./types";
import type { ToolBindings } from "./llm-tools";
import { buildLlmTools } from "./llm-tools";
import { buildDecisionReportEntries } from "@/lib/ai/decision-report";
import {
  buildAutopilotContinuation,
  isAutopilotContinuation,
  isAutopilotInput,
  parseAutopilotContinuation,
  type AutopilotStage,
} from "./autopilot-continuation";

export {
  buildAutopilotContinuation,
  isAutopilotContinuation,
  isAutopilotInput,
  parseAutopilotContinuation,
  type AutopilotStage,
};

export type AutopilotCheckpoint = {
  stage: AutopilotStage;
  workflowDescription: string;
  approvedSlugs: string[];
  promotedSlugs: string[];
  taskSlug?: string;
  primaryWeakness?: {
    weaknessTitle: string;
    hypothesis: string;
    badHeuristic: string;
    authorityInvariant: string;
    deliverable: string;
    domain: string;
  };
};

export type ApprovalGatePayload = {
  gateId: string;
  title: string;
  description: string;
  stage: AutopilotCheckpoint["stage"];
  candidateCount?: number;
  promoteCount?: number;
  taskSlug?: string;
};

const CHECKPOINT_PATH = "pipeline/autopilot.json";

type ToolMap = ReturnType<typeof buildLlmTools>;
type ToolExec = { execute: (input: Record<string, unknown>, options?: unknown) => Promise<unknown> };

function execTool(tools: ToolMap, name: keyof ToolMap) {
  return (tools[name] as unknown as ToolExec).execute.bind(tools[name]);
}

export function loadAutopilotCheckpoint(workspace: WorkspaceState): AutopilotCheckpoint | null {
  const raw = workspace.artifacts[CHECKPOINT_PATH]?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AutopilotCheckpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(bindings: ToolBindings, checkpoint: AutopilotCheckpoint) {
  const artifact = {
    path: CHECKPOINT_PATH,
    kind: "json" as const,
    badge: "autopilot",
    content: JSON.stringify(checkpoint, null, 2),
    updatedAt: Date.now(),
  };
  bindings.workspace.artifacts[CHECKPOINT_PATH] = artifact;
  bindings.channel.push({ type: "artifact", artifact });
}

function emitGate(channel: EventChannel<AgentEvent>, payload: ApprovalGatePayload) {
  channel.push({ type: "approval_gate", gate: payload });
  channel.push({ type: "autopilot_status", stage: payload.stage, awaitingApproval: true });
}

function emitProgress(channel: EventChannel<AgentEvent>, stage: AutopilotCheckpoint["stage"], message: string) {
  channel.push({ type: "autopilot_status", stage, message, awaitingApproval: false });
}

function emitText(channel: EventChannel<AgentEvent>, text: string) {
  channel.push({ type: "text", delta: text });
}

async function runStep<T>(
  channel: EventChannel<AgentEvent>,
  name: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const id = `autopilot-${name}-${Date.now()}`;
  channel.push({
    type: "tool_call_start",
    call: { id, name: name as never, args, status: "running", startedAt: Date.now() },
  });
  try {
    const result = await fn();
    channel.push({
      type: "tool_call_finish",
      id,
      result,
      status: "succeeded",
      summary: `${name} done`,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    channel.push({
      type: "tool_call_finish",
      id,
      result: { error: message },
      status: "failed",
      summary: message.slice(0, 120),
    });
    throw error;
  }
}

function topCandidates(report: WeaknessReport, n = 3) {
  return [...report.candidates].sort((a, b) => b.workflowFitScore - a.workflowFitScore).slice(0, n);
}

function probeSummariesFromWorkspace(workspace: WorkspaceState): ProbeSummary[] {
  return Object.entries(workspace.artifacts)
    .filter(([p]) => p.startsWith("probe/") && p.endsWith(".json"))
    .map(([, a]) => {
      try {
        return JSON.parse(a.content) as ProbeSummary;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ProbeSummary[];
}

export type AutopilotRunOptions = {
  bindings: Omit<ToolBindings, "channel" | "workspace">;
  workspace: WorkspaceState;
  input: string;
};

export async function* runAutopilot(options: AutopilotRunOptions): AsyncGenerator<AgentEvent> {
  const channel = new EventChannel<AgentEvent>();
  const bindings: ToolBindings = {
    ...options.bindings,
    workspace: options.workspace,
    channel,
  };
  const tools = buildLlmTools(bindings);
  let checkpoint = loadAutopilotCheckpoint(bindings.workspace);

  const work = (async () => {
    try {
      const input = options.input.trim();
      const isContinue = input.startsWith("__autopilot:");
      const parts = isContinue ? input.split(":") : [];
      const continueStage = parts[2] as AutopilotCheckpoint["stage"] | undefined;
      const userDecision = (parts[3] as "approve" | "reject" | undefined) ?? undefined;

      if (!checkpoint && !isContinue) {
        if (input.length < 12) {
          channel.push({ type: "error", message: "Describe your workflow in a sentence or two." });
          channel.push({ type: "done" });
          return;
        }

        checkpoint = {
          stage: "idle",
          workflowDescription: input,
          approvedSlugs: [],
          promotedSlugs: [],
        };
        saveCheckpoint(bindings, checkpoint);

        emitText(
          channel,
          "Running the full eval pipeline autonomously. I'll pause for approval at key gates — watch the Studio panel for live charts.\n\n",
        );
        emitProgress(channel, "idle", "Mapping weaknesses…");

        await runStep(channel, "map_workflow_weaknesses", { description: input }, () =>
          execTool(tools, "map_workflow_weaknesses")({ description: input }),
        );

        checkpoint.stage = "mapped";
        saveCheckpoint(bindings, checkpoint);

        const reportRaw = bindings.workspace.artifacts["weakness/candidates.json"]?.content;
        const report = reportRaw ? (JSON.parse(reportRaw) as WeaknessReport) : null;

        emitGate(channel, {
          gateId: "weakness-map",
          title: "Approve weakness map",
          description: report
            ? `${report.candidates.length} candidates found. Approve to batch-probe the top ${Math.min(3, report.candidates.length)}.`
            : "Approve to continue to batch probe.",
          stage: "mapped",
          candidateCount: report?.candidates.length,
        });
        channel.push({ type: "done" });
        return;
      }

      if (!checkpoint) {
        channel.push({ type: "error", message: "No pipeline checkpoint. Send a workflow description to start." });
        channel.push({ type: "done" });
        return;
      }

      const stage = continueStage ?? checkpoint.stage;
      const decision = userDecision ?? "approve";

      if (stage === "mapped" || (checkpoint.stage === "mapped" && isContinue)) {
        if (decision === "reject") {
          emitText(channel, "Paused after weakness map.\n");
          channel.push({ type: "done" });
          return;
        }

        const reportRaw = bindings.workspace.artifacts["weakness/candidates.json"]?.content;
        const report = reportRaw ? (JSON.parse(reportRaw) as WeaknessReport) : null;
        if (!report) {
          channel.push({ type: "error", message: "Weakness map missing." });
          channel.push({ type: "done" });
          return;
        }

        const selected = topCandidates(report, 3);
        checkpoint.approvedSlugs = selected.map((c) => c.slug);
        saveCheckpoint(bindings, checkpoint);

        emitProgress(channel, "mapped", `Batch probing ${selected.length} candidates…`);
        emitText(channel, `\nProbing at scale — heatmap updating in Studio.\n\n`);

        await runStep(channel, "batch_probe_candidates", { count: selected.length }, () =>
          execTool(tools, "batch_probe_candidates")({
            candidates: selected.map((c) => ({
              slug: c.slug,
              weaknessTitle: c.weaknessTitle,
              deliverable: c.deliverable,
              badHeuristic: c.badHeuristic,
              authorityInvariant: c.authorityInvariant,
              authorityArtifacts: [],
            })),
          }),
        );

        const summaries = probeSummariesFromWorkspace(bindings.workspace);
        const decisionInputs = buildDecisionReportEntries(summaries).map((e) => ({
          weaknessTitle: e.weaknessTitle,
          verdict: e.verdict,
          aggregateFailureRate: e.aggregateFailureRate,
        }));
        await runStep(channel, "render_probe_decision_report", {}, () =>
          execTool(tools, "render_probe_decision_report")({ summaries: decisionInputs }),
        );

        checkpoint.stage = "probed";
        saveCheckpoint(bindings, checkpoint);

        const promote = buildDecisionReportEntries(summaries).filter((e) => e.verdict === "promote");
        emitGate(channel, {
          gateId: "probe-decision",
          title: "Approve build",
          description:
            promote.length > 0
              ? `${promote.length} promoted. Approve to scaffold Harbor tasks and validate.`
              : "Best candidate selected. Approve to scaffold and validate.",
          stage: "probed",
          promoteCount: Math.max(1, promote.length),
        });
        channel.push({ type: "done" });
        return;
      }

      if (stage === "probed" || checkpoint.stage === "probed") {
        if (decision === "reject") {
          emitText(channel, "Build paused.\n");
          channel.push({ type: "done" });
          return;
        }

        const reportRaw = bindings.workspace.artifacts["weakness/candidates.json"]?.content;
        const report = reportRaw ? (JSON.parse(reportRaw) as WeaknessReport) : null;
        const summaries = probeSummariesFromWorkspace(bindings.workspace);
        const entries = buildDecisionReportEntries(summaries);
        const promoted =
          entries.find((e) => e.verdict === "promote") ??
          [...entries].sort((a, b) => b.aggregateFailureRate - a.aggregateFailureRate)[0];

        const candidate =
          report?.candidates.find((c) => c.weaknessTitle === promoted?.weaknessTitle) ??
          report?.candidates.find((c) => checkpoint!.approvedSlugs.includes(c.slug)) ??
          report?.candidates[0];

        if (!candidate) {
          channel.push({ type: "error", message: "No candidate to build." });
          channel.push({ type: "done" });
          return;
        }

        checkpoint.promotedSlugs = [candidate.slug];
        checkpoint.primaryWeakness = {
          weaknessTitle: candidate.weaknessTitle,
          hypothesis: candidate.hypothesis,
          badHeuristic: candidate.badHeuristic,
          authorityInvariant: candidate.authorityInvariant,
          deliverable: candidate.deliverable,
          domain: candidate.domain,
        };
        saveCheckpoint(bindings, checkpoint);

        emitProgress(channel, "probed", "Scaffolding task pack…");
        const scaffoldResult = (await runStep(channel, "scaffold_task", {}, () =>
          execTool(tools, "scaffold_task")({
            weaknessTitle: candidate.weaknessTitle,
            hypothesis: candidate.hypothesis,
            badHeuristic: candidate.badHeuristic,
            authorityInvariant: candidate.authorityInvariant,
            deliverable: candidate.deliverable,
            domain: candidate.domain,
            fixtureCategories: [],
          }),
        )) as { slug?: string };

        checkpoint.taskSlug = scaffoldResult.slug ?? "eval-task";
        saveCheckpoint(bindings, checkpoint);

        await runStep(channel, "generate_fixtures", {}, () =>
          execTool(tools, "generate_fixtures")({
            weaknessTitle: candidate.weaknessTitle,
            deliverable: candidate.deliverable,
            domain: candidate.domain,
            categoriesHint: [],
          }),
        );

        await runStep(channel, "lint_spoilers", {}, () =>
          execTool(tools, "lint_spoilers")({ artifactPath: "instruction.md" }),
        );

        checkpoint.stage = "built";
        saveCheckpoint(bindings, checkpoint);

        emitGate(channel, {
          gateId: "harbor-validate",
          title: "Run Harbor sweeps",
          description: "Oracle, nop, and target pass@3. Requires Docker.",
          stage: "built",
          taskSlug: checkpoint.taskSlug,
        });
        channel.push({ type: "done" });
        return;
      }

      if (stage === "built" || checkpoint.stage === "built") {
        if (decision === "reject") {
          emitText(channel, "Validation skipped.\n");
          channel.push({ type: "done" });
          return;
        }

        const slug = checkpoint.taskSlug ?? "eval-task";

        await runStep(channel, "run_harbor_sweep", { agent: "oracle" }, () =>
          execTool(tools, "run_harbor_sweep")({ agent: "oracle", slug }),
        );
        await runStep(channel, "run_harbor_sweep", { agent: "nop" }, () =>
          execTool(tools, "run_harbor_sweep")({ agent: "nop", slug }),
        );
        await runStep(channel, "run_harbor_sweep", { agent: "target" }, () =>
          execTool(tools, "run_harbor_sweep")({ agent: "target", slug }),
        );
        await runStep(channel, "audit_trajectory", {}, () =>
          execTool(tools, "audit_trajectory")({
            trajectoryText:
              "Target model attempted the task; verifier reward was 0. Classify the failure mode.",
          }),
        );

        checkpoint.stage = "validated";
        saveCheckpoint(bindings, checkpoint);

        emitGate(channel, {
          gateId: "registry-publish",
          title: "Publish to Harbor registry",
          description: `Task \`${slug}\` ready for registry publish.`,
          stage: "validated",
          taskSlug: slug,
        });
        channel.push({ type: "done" });
        return;
      }

      if (stage === "validated" || checkpoint.stage === "validated") {
        if (decision === "reject") {
          emitText(channel, "Publish skipped.\n");
          channel.push({ type: "done" });
          return;
        }

        checkpoint.stage = "ready_publish";
        saveCheckpoint(bindings, checkpoint);
        emitText(channel, "\nOpening registry publish…\n");
        channel.push({ type: "publish_open" });
        channel.push({ type: "autopilot_status", stage: "ready_publish", message: "Complete", awaitingApproval: false });
        channel.push({ type: "done" });
        return;
      }

      channel.push({ type: "error", message: "Unknown pipeline stage." });
      channel.push({ type: "done" });
    } catch (error) {
      channel.push({
        type: "error",
        message: error instanceof Error ? error.message : "autopilot failed",
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

