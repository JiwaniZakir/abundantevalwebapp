import { randomUUID } from "node:crypto";
import {
  executeAuditTrajectory,
  executeGenerateFixtures,
  executeLintSpoilers,
  executeListWorkspace,
  executeProposeIteration,
  executeProposeWeakness,
  executeReadArtifact,
  executeRunHarborSweep,
  executeRunProbeVariants,
  executeSetPhase,
  executeWriteArtifact,
} from "./tools";
import type {
  AgentEvent,
  Artifact,
  PlanStep,
  ToolCall,
  ToolName,
  WorkspaceState,
} from "./types";
import { buildDemoWorkspace } from "./seed-workspace";

type ScenarioStep =
  | { type: "text"; chunks: string[]; delayMs?: number }
  | {
      type: "tool";
      name: ToolName;
      args: Record<string, unknown>;
      latencyMs?: number;
      narrative?: string;
    }
  | { type: "publish_open"; delayMs?: number };

type Scenario = {
  preface?: string[];
  plan?: PlanStep[];
  phase?: WorkspaceState["phase"];
  steps: ScenarioStep[];
  closing?: string[];
};

function planFromLabels(labels: string[]): PlanStep[] {
  return labels.map((label, index) => ({
    id: `step-${index}`,
    label,
    status: index === 0 ? "active" : "pending",
  }));
}

function parseInput(rawInput: string): {
  command: string;
  args: Record<string, string>;
  rest: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    return { command: "chat", args: {}, rest: trimmed };
  }

  const [head, ...restParts] = trimmed.slice(1).split(/\s+/);
  return {
    command: head,
    args: {},
    rest: restParts.join(" "),
  };
}

function buildScenario(input: string, workspace: WorkspaceState): Scenario {
  const { command, rest } = parseInput(input);

  switch (command) {
    case "plan":
      return {
        plan: planFromLabels([
          "Read workspace + policy artifact",
          "Promote a lifecycle weakness card",
          "Run 5 probe variants on ds-25",
          "Scaffold restaurant-style workbook task",
          "Run oracle → nop → target Harbor sweep",
        ]),
        phase: "intake",
        preface: [
          "Got it. Here's a plan to take ds-25 from intake to published-hard.",
          "I'll start by reading the workspace and authority artifact.",
        ],
        steps: [
          {
            type: "tool",
            name: "list_workspace",
            args: {},
            latencyMs: 320,
          },
          {
            type: "tool",
            name: "read_artifact",
            args: { path: "policy/compliance_policy.pdf.txt" },
            latencyMs: 280,
          },
          {
            type: "text",
            chunks: [
              "The policy puts dependency-trace authority above portal exports.",
              " That's the invariant the target must respect.",
              " Hit /probe next to pressure the lifecycle hypothesis.",
            ],
          },
        ],
        closing: ["Ready when you are."],
      };

    case "weakness":
      return {
        plan: planFromLabels([
          "Promote lifecycle weakness card",
          "Stage for probe",
        ]),
        phase: "weakness",
        preface: [
          "Drafting a lifecycle / revocation propagation card.",
          " I'll keep the bad heuristic explicit only inside this card, never inside agent-visible artifacts.",
        ],
        steps: [
          {
            type: "tool",
            name: "propose_weakness_card",
            args: {
              title: "Transitive revocation through lab dependency graph",
              hypothesis:
                "Frontier models trust portal-active certificate states and miss revocation propagated through a two-hop lab dependency graph.",
              badHeuristic:
                "Use the supplier portal export as the release source of truth when it says a certificate is active.",
              authorityInvariant:
                "A certificate publishes only if its dependency trace has no revoked or pending upstream lab event before close.",
              taxonomySlug: "lifecycle",
            },
            latencyMs: 420,
          },
          {
            type: "text",
            chunks: [
              "Card promoted. Run /probe to validate it before any scaffold spend.",
            ],
          },
        ],
      };

    case "probe":
      return {
        plan: planFromLabels([
          "Build 5 pressure variants",
          "Run 15 trials per variant",
          "Score failure rate per variant",
          "Issue promote / redesign / reject verdict",
        ]),
        phase: "probe",
        preface: ["Probing the lifecycle weakness candidate."],
        steps: [
          {
            type: "tool",
            name: "run_probe_variants",
            args: {
              weaknessTitle: "Transitive revocation through lab dependency graph",
              trialsPerVariant: 15,
            },
            latencyMs: 900,
          },
          {
            type: "text",
            chunks: [
              "Aggregate failure rate clears the 80% promote threshold.",
              " The portal-shortcut bait is doing real work.",
            ],
          },
        ],
        closing: ["Run /scaffold to start the Harbor pack."],
      };

    case "scaffold":
      return {
        plan: planFromLabels([
          "Write operational instruction.md",
          "Pin task.toml metadata",
          "Stage deterministic verifier outline",
        ]),
        phase: "scaffold",
        preface: ["Scaffolding the restaurant-style ds-25 task pack."],
        steps: [
          {
            type: "tool",
            name: "write_artifact",
            args: {
              path: "instruction.md",
              content: workspace.artifacts["instruction.md"]?.content ?? "",
            },
            latencyMs: 260,
            narrative: "Re-asserting the operational deliverable framing.",
          },
          {
            type: "tool",
            name: "write_artifact",
            args: {
              path: "task.toml",
              content: workspace.artifacts["task.toml"]?.content ?? "",
            },
            latencyMs: 240,
          },
          {
            type: "tool",
            name: "lint_spoilers",
            args: { artifactPath: "instruction.md" },
            latencyMs: 280,
          },
          {
            type: "text",
            chunks: [
              "Scaffold staged with no spoiler findings.",
              " /fixtures next to synthesize multimodal inputs.",
            ],
          },
        ],
      };

    case "fixtures":
      return {
        plan: planFromLabels([
          "Spec fixture surface",
          "Emit build_inputs.py",
          "Catalog artifacts",
        ]),
        phase: "fixtures",
        preface: ["Generating fixture builder + manifest."],
        steps: [
          {
            type: "tool",
            name: "generate_fixtures",
            args: { seed: 25, activeCertificates: 34 },
            latencyMs: 360,
          },
          {
            type: "text",
            chunks: [
              "Fixtures staged. Run /sweep oracle to prove the verifier can pass.",
            ],
          },
        ],
      };

    case "sweep": {
      const agentArg = rest as "oracle" | "nop" | "target" | "";
      const agent: "oracle" | "nop" | "gemini-cli" =
        agentArg === "oracle"
          ? "oracle"
          : agentArg === "nop"
            ? "nop"
            : "gemini-cli";

      const label =
        agent === "oracle"
          ? "oracle sanity"
          : agent === "nop"
            ? "nop sanity"
            : "target model";

      return {
        plan: planFromLabels([
          `Queue ${label} trial`,
          "Stream stdout/stderr",
          "Parse reward.txt + ctrf.json",
        ]),
        phase: "sweep",
        preface: [`Queuing Harbor ${label} sweep against ${workspace.runConfigHash}.`],
        steps: [
          {
            type: "tool",
            name: "run_harbor_sweep",
            args: { taskSlug: "ds-25-compliance-cert-release", agent },
            latencyMs: agent === "gemini-cli" ? 1500 : 850,
          },
          {
            type: "text",
            chunks:
              agent === "gemini-cli"
                ? [
                    "All three trials failed for the same reason: portal-active trust over dependency trace.",
                    " Run /audit to classify the failure officially.",
                  ]
                : agent === "oracle"
                  ? [
                      "Oracle reward=1 across the board.",
                      " Run /sweep nop to confirm the verifier isn't trivially passable.",
                    ]
                  : [
                      "Nop reward=0 across the board. Verifier holds.",
                      " Run /sweep target to launch the model trial.",
                    ],
          },
        ],
      };
    }

    case "lint": {
      const path = rest || "instruction.md";
      return {
        plan: planFromLabels([`Lint ${path}`, "Report line-anchored findings"]),
        phase: "iteration",
        preface: [`Spoiler-linting ${path}.`],
        steps: [
          {
            type: "tool",
            name: "lint_spoilers",
            args: { artifactPath: path },
            latencyMs: 300,
          },
          {
            type: "text",
            chunks: [
              "Findings opened in the Spoilers result card.",
              " Apply /iterate to propose fixes for any high-severity entry.",
            ],
          },
        ],
      };
    }

    case "audit":
      return {
        plan: planFromLabels([
          "Confirm auditor != target",
          "Classify failure into 6 buckets",
          "Attach rationale to trials",
        ]),
        phase: "audit",
        preface: ["Running trajectory audit with the non-target judge."],
        steps: [
          {
            type: "tool",
            name: "audit_trajectory",
            args: {
              trajectoryText:
                "model_output: trusted portal export, did not consult dependency trace, published release.",
              auditorModel: workspace.auditorModel,
            },
            latencyMs: 720,
          },
          {
            type: "text",
            chunks: [
              "Verdict: used_prior_work_heuristic across all three trials.",
              " Genuine model failure, not a verifier bug.",
            ],
          },
        ],
        closing: ["/iterate to harden bait realism."],
      };

    case "iterate":
      return {
        plan: planFromLabels(["Identify spoiler", "Propose diff", "Stage for review"]),
        phase: "iteration",
        preface: ["Drafting an iteration diff for the bait notebook."],
        steps: [
          {
            type: "tool",
            name: "propose_iteration",
            args: {
              artifactPath: "environment/data/prior_release_workbook.notes",
              before: "Do not trust portal active rows; traverse dependency graph first.",
              after:
                "Prior analyst used the portal export to draft the release view ahead of the close window.",
              rationale:
                "Bait must read like an analyst draft, not a self-incriminating tutorial.",
            },
            latencyMs: 360,
          },
          {
            type: "text",
            chunks: ["Diff staged in iterations/. Accept it to bump version and re-sweep."],
          },
        ],
      };

    case "publish":
      return {
        plan: planFromLabels([
          "Verify oracle/nop sanity",
          "Lock RunConfig lineage",
          "Open publish dialog",
        ]),
        phase: "publish",
        preface: ["Finalizing ds-25 as published-hard."],
        steps: [
          {
            type: "tool",
            name: "set_phase",
            args: { phase: "publish" },
            latencyMs: 180,
          },
          {
            type: "text",
            chunks: [
              "Pass@3 = 0/3, oracle = 1, nop = 0, spoiler lint clean.",
              " Opening the publish dialog so you can push to GitHub.",
            ],
          },
          {
            type: "publish_open",
            delayMs: 280,
          },
        ],
      };

    case "chat":
    default:
      return chatFallback(rest);
  }
}

function chatFallback(text: string): Scenario {
  const lower = text.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi ")) {
    return {
      preface: [
        "I'm the Harbor Eval Orchestrator.",
        " Try /plan to get a roadmap for ds-25, or hit /probe to pressure the lifecycle weakness.",
      ],
      steps: [],
    };
  }

  if (lower.includes("workflow") || lower.includes("design") || lower.includes("eval")) {
    return {
      plan: planFromLabels([
        "Capture workflow intent",
        "Stage a weakness candidate",
        "Probe before scaffold",
      ]),
      preface: [
        "Treating your message as a workflow intake.",
        " I'll capture it, then move into weakness mapping.",
      ],
      steps: [
        {
          type: "tool",
          name: "set_phase",
          args: { phase: "weakness" },
          latencyMs: 220,
        },
        {
          type: "text",
          chunks: ["Hit /weakness to promote a card or /probe to start pressure-testing."],
        },
      ],
    };
  }

  return {
    preface: [
      "Acknowledged.",
      " Use slash commands to advance the pipeline (e.g. /plan, /probe, /scaffold, /sweep target).",
    ],
    steps: [],
  };
}

function* chunkText(chunks: string[]): Generator<string> {
  for (const chunk of chunks) {
    const words = chunk.split(/(?<=\s)/);
    for (const word of words) {
      yield word;
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyToolToWorkspace(
  workspace: WorkspaceState,
  output: { artifacts?: Artifact[]; phase?: WorkspaceState["phase"] },
) {
  if (output.artifacts) {
    for (const artifact of output.artifacts) {
      workspace.artifacts[artifact.path] = artifact;
    }
  }
  if (output.phase) {
    workspace.phase = output.phase;
  }
}

function runTool(
  name: ToolName,
  args: Record<string, unknown>,
  workspace: WorkspaceState,
) {
  const ctx = { workspace };
  switch (name) {
    case "list_workspace":
      return executeListWorkspace(ctx);
    case "read_artifact":
      return executeReadArtifact(ctx, args as { path: string });
    case "write_artifact":
      return executeWriteArtifact(ctx, args as Parameters<typeof executeWriteArtifact>[1]);
    case "propose_weakness_card":
      return executeProposeWeakness(ctx, args as Parameters<typeof executeProposeWeakness>[1]);
    case "run_probe_variants":
      return executeRunProbeVariants(ctx, args as Parameters<typeof executeRunProbeVariants>[1]);
    case "lint_spoilers":
      return executeLintSpoilers(ctx, args as { artifactPath: string });
    case "generate_fixtures":
      return executeGenerateFixtures(ctx, args as Parameters<typeof executeGenerateFixtures>[1]);
    case "run_harbor_sweep":
      return executeRunHarborSweep(ctx, args as Parameters<typeof executeRunHarborSweep>[1]);
    case "audit_trajectory":
      return executeAuditTrajectory(ctx, args as Parameters<typeof executeAuditTrajectory>[1]);
    case "propose_iteration":
      return executeProposeIteration(ctx, args as Parameters<typeof executeProposeIteration>[1]);
    case "set_phase":
      return executeSetPhase(ctx, args as { phase: WorkspaceState["phase"] });
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export async function* runScriptedAgent(
  input: string,
  initialWorkspace?: WorkspaceState,
): AsyncGenerator<AgentEvent> {
  const workspace = initialWorkspace ?? buildDemoWorkspace();
  const scenario = buildScenario(input, workspace);

  if (scenario.phase) {
    yield { type: "phase", phase: scenario.phase };
    workspace.phase = scenario.phase;
  }

  if (scenario.plan) {
    yield { type: "plan", plan: scenario.plan };
  }

  if (scenario.preface) {
    for (const word of chunkText(scenario.preface)) {
      await delay(18);
      yield { type: "text", delta: word };
    }
    yield { type: "text", delta: "\n\n" };
  }

  for (const [index, step] of scenario.steps.entries()) {
    if (step.type === "text") {
      for (const word of chunkText(step.chunks)) {
        await delay(step.delayMs ?? 20);
        yield { type: "text", delta: word };
      }
      yield { type: "text", delta: "\n\n" };
      continue;
    }

    if (step.type === "publish_open") {
      await delay(step.delayMs ?? 200);
      yield { type: "publish_open" };
      continue;
    }

    const call: ToolCall = {
      id: randomUUID(),
      name: step.name,
      args: step.args,
      status: "running",
      startedAt: Date.now(),
    };

    if (step.narrative) {
      for (const word of chunkText([step.narrative])) {
        await delay(14);
        yield { type: "text", delta: word };
      }
      yield { type: "text", delta: "\n" };
    }

    yield { type: "tool_call_start", call };
    await delay(step.latencyMs ?? 320);

    const output = runTool(step.name, step.args, workspace);

    if (output.artifacts) {
      for (const artifact of output.artifacts) {
        yield { type: "artifact", artifact };
      }
    }
    if (output.probeSummary) {
      yield { type: "probe_summary", summary: output.probeSummary };
    }
    if (output.sweepSummary) {
      yield { type: "sweep_summary", summary: output.sweepSummary };
    }
    if (output.spoilerFindings) {
      yield { type: "spoiler_findings", findings: output.spoilerFindings };
    }
    if (output.audit) {
      yield { type: "audit", audit: output.audit };
    }
    if (output.phase && output.phase !== workspace.phase) {
      yield { type: "phase", phase: output.phase };
      workspace.phase = output.phase;
    }

    applyToolToWorkspace(workspace, output);

    yield {
      type: "tool_call_finish",
      id: call.id,
      result: output.result ?? output.summary,
      summary: output.summary,
    };

    if (scenario.plan && index < scenario.plan.length) {
      const updatedPlan = scenario.plan.map((step, planIndex) => ({
        ...step,
        status:
          planIndex < index + 1
            ? ("done" as const)
            : planIndex === index + 1
              ? ("active" as const)
              : ("pending" as const),
      }));
      yield { type: "plan", plan: updatedPlan };
    }
  }

  if (scenario.closing) {
    for (const word of chunkText(scenario.closing)) {
      await delay(20);
      yield { type: "text", delta: word };
    }
    yield { type: "text", delta: "\n" };
  }

  yield { type: "done" };
}
