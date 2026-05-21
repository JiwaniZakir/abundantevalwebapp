import { tool } from "ai";
import { z } from "zod";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AgentEvent,
  Artifact,
  WorkspaceState,
} from "./types";
import type { EventChannel } from "./event-channel";
import { stageForPhase } from "./stages";
import { intakeWorkflow } from "@/lib/ai/workflow-intake";
import { mapWorkflowWeaknesses, renderWeaknessReportMarkdown } from "@/lib/ai/weakness-map";
import { runProbeSweep, runBatchProbeSweep } from "@/lib/ai/probe-runner";
import {
  buildDecisionReportEntries,
  renderDecisionReportMarkdown,
} from "@/lib/ai/decision-report";
import { generateScaffold } from "@/lib/ai/scaffold-generator";
import {
  generateFixtureSpec,
  materializeFixtures,
} from "@/lib/ai/fixture-generator";
import { lintSpoilersHybrid } from "@/lib/ai/spoiler-lint";
import { auditTrajectoryWithLlm } from "@/lib/ai/trajectory-audit";
import { runHarborTrial, runHarborTrials } from "@/lib/harbor/adapter";
import { materializeWorkspace } from "@/lib/harbor/materialize";
import { validateTaskPack } from "@/lib/harbor/validate-task";
import { buildTaskToml, normalizeTaskTomlContent } from "@/lib/harbor/task-toml";

export type ToolBindings = {
  workspace: WorkspaceState;
  channel: EventChannel<AgentEvent>;
  targetProvider: string;
  targetModelSlug: string;
  judgeProvider: string;
  judgeModelSlug: string;
  scaffoldProvider: string;
  scaffoldModelSlug: string;
  intakeProvider: string;
  intakeModelSlug: string;
  trialsPerVariant: number;
};

function inferKind(filePath: string): Artifact["kind"] {
  if (filePath.endsWith(".md")) return "markdown";
  if (filePath.endsWith(".toml")) return "toml";
  if (filePath.endsWith(".py")) return "python";
  if (filePath.endsWith(".json") || filePath.endsWith(".jsonl")) return "json";
  if (filePath.endsWith(".sh")) return "shell";
  if (filePath.endsWith(".csv")) return "csv";
  if (filePath.endsWith(".yml") || filePath.endsWith(".yaml")) return "yaml";
  if (filePath.endsWith(".diff")) return "diff";
  return "markdown";
}

function applyArtifact(bindings: ToolBindings, artifact: Artifact) {
  bindings.workspace.artifacts[artifact.path] = artifact;
  bindings.channel.push({ type: "artifact", artifact });
}

function setPhase(
  bindings: ToolBindings,
  phase: WorkspaceState["phase"],
) {
  if (bindings.workspace.phase === phase) return;
  bindings.workspace.phase = phase;
  bindings.channel.push({ type: "phase", phase });
  stageForPhase(phase);
}

export function buildLlmTools(bindings: ToolBindings) {
  return {
    list_workspace: tool({
      description:
        "List every artifact currently in the workspace with path and kind. Use this before writing files.",
      inputSchema: z.object({}),
      execute: async () => {
        const files = Object.values(bindings.workspace.artifacts).map((a) => ({
          path: a.path,
          kind: a.kind,
          bytes: a.content.length,
          badge: a.badge,
        }));
        return { count: files.length, files };
      },
    }),

    read_artifact: tool({
      description: "Read the content of a single artifact by path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: artifactPath }) => {
        const artifact = bindings.workspace.artifacts[artifactPath];
        if (!artifact) {
          return { error: "not_found", path: artifactPath };
        }
        return {
          path: artifact.path,
          kind: artifact.kind,
          content: artifact.content,
        };
      },
    }),

    write_artifact: tool({
      description:
        "Create or overwrite an artifact. Use realistic file content — no failure-mode jargon, no expected answers, no recipe sentences. Spoiler lint runs automatically on instruction/policy artifacts.",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
        badge: z.string().optional(),
      }),
      execute: async ({ path: artifactPath, content, badge }) => {
        const previous = bindings.workspace.artifacts[artifactPath];
        const artifact: Artifact = {
          path: artifactPath,
          kind: previous?.kind ?? inferKind(artifactPath),
          badge: badge ?? previous?.badge,
          content,
          updatedAt: Date.now(),
          dirty: true,
        };
        applyArtifact(bindings, artifact);

        const shouldAutoLint =
          artifactPath === "instruction.md" ||
          artifactPath.startsWith("policy/") ||
          artifactPath.endsWith(".pdf.txt");

        if (shouldAutoLint) {
          try {
            const findings = await lintSpoilersHybrid({
              artifactPath: artifact.path,
              content: artifact.content,
              auditorProvider: bindings.judgeProvider,
              auditorModelSlug: bindings.judgeModelSlug,
            });
            bindings.channel.push({ type: "spoiler_findings", findings });
            return {
              ok: true,
              path: artifactPath,
              bytes: content.length,
              autoLint: { findings: findings.length },
            };
          } catch (error) {
            bindings.channel.push({
              type: "notice",
              level: "warning",
              message: `Auto-lint failed for ${artifactPath}: ${error instanceof Error ? error.message : String(error)}`,
              reason: "autolint_failure",
            });
          }
        }

        return { ok: true, path: artifactPath, bytes: content.length };
      },
    }),

    intake_workflow: tool({
      description:
        "Convert a freeform workflow description into a Harbor weakness card. Always call this first when the user introduces a new workflow.",
      inputSchema: z.object({
        description: z.string().min(8),
      }),
      execute: async ({ description }) => {
        setPhase(bindings, "intake");
        const intake = await intakeWorkflow({
          provider: bindings.intakeProvider,
          modelSlug: bindings.intakeModelSlug,
          description,
        });

        const cardPath = `weakness/${intake.weaknessTitle
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60)}.md`;

        const title = intake.weaknessTitle.slice(0, 80);
        const body = `# ${title}\n\n- Domain: ${intake.domain}\n- Deliverable: ${intake.deliverable}\n- Taxonomy: ${intake.taxonomySlug}\n- Authority invariant: ${intake.authorityInvariant}\n\n## Hypothesis\n${intake.hypothesis.slice(0, 500)}\n\n## Bad heuristic (internal only)\n${intake.badHeuristic.slice(0, 200)}\n`;

        applyArtifact(bindings, {
          path: cardPath,
          kind: "markdown",
          badge: `weakness · ${intake.taxonomySlug}`,
          content: body,
          updatedAt: Date.now(),
          dirty: true,
        });

        setPhase(bindings, "weakness");

        return { ok: true, intake };
      },
    }),

    map_workflow_weaknesses: tool({
      description:
        "Map a workflow to 5-10 ranked weakness candidates across the failure-mode taxonomy. Call this for /weakness before probing.",
      inputSchema: z.object({
        description: z.string().min(8),
      }),
      execute: async ({ description }) => {
        setPhase(bindings, "intake");
        const report = await mapWorkflowWeaknesses({
          provider: bindings.intakeProvider,
          modelSlug: bindings.intakeModelSlug,
          description,
        });

        applyArtifact(bindings, {
          path: "weakness/candidates.json",
          kind: "json",
          badge: "weakness map",
          content: JSON.stringify(report, null, 2),
          updatedAt: Date.now(),
          dirty: true,
        });

        applyArtifact(bindings, {
          path: "weakness/report.md",
          kind: "markdown",
          badge: "weakness map",
          content: renderWeaknessReportMarkdown(report),
          updatedAt: Date.now(),
          dirty: true,
        });

        bindings.channel.push({ type: "weakness_report", report });
        setPhase(bindings, "weakness");
        return { ok: true, count: report.candidates.length, report };
      },
    }),

    batch_probe_candidates: tool({
      description:
        "Run probe sweeps for multiple weakness candidates (approved slugs from weakness/candidates.json).",
      inputSchema: z.object({
        candidates: z.array(
          z.object({
            slug: z.string(),
            weaknessTitle: z.string(),
            deliverable: z.string(),
            badHeuristic: z.string(),
            authorityInvariant: z.string(),
            authorityArtifacts: z.array(z.string()).default([]),
          }),
        ),
        trialsPerVariant: z.number().int().min(1).max(15).optional(),
      }),
      execute: async ({ candidates, trialsPerVariant }) => {
        setPhase(bindings, "probe");
        const trials = trialsPerVariant ?? bindings.trialsPerVariant;
        const summaries = await runBatchProbeSweep(candidates, {
          provider: bindings.targetProvider,
          modelSlug: bindings.targetModelSlug,
          judgeProvider: bindings.judgeProvider,
          judgeModelSlug: bindings.judgeModelSlug,
          trialsPerVariant: trials,
        });

        for (const summary of summaries) {
          const slug = summary.weaknessTitle
            .toLowerCase()
            .replaceAll(/[^a-z0-9]+/g, "-")
            .slice(0, 48);
          applyArtifact(bindings, {
            path: `probe/${slug}.json`,
            kind: "json",
            badge: "probe results",
            content: JSON.stringify(summary, null, 2),
            updatedAt: Date.now(),
            dirty: true,
          });
        }

        bindings.channel.push({ type: "probe_batch_summary", summaries });
        if (summaries[0]) {
          bindings.channel.push({ type: "probe_summary", summary: summaries[0] });
        }

        setPhase(bindings, "decision");
        return { ok: true, summaries };
      },
    }),

    render_probe_decision_report: tool({
      description: "Render a markdown decision report from probe batch results.",
      inputSchema: z.object({
        summaries: z.array(
          z.object({
            weaknessTitle: z.string(),
            verdict: z.enum(["promote", "redesign", "reject"]),
            aggregateFailureRate: z.number(),
            variants: z.array(z.unknown()).optional(),
          }),
        ),
      }),
      execute: async ({ summaries }) => {
        const entries = buildDecisionReportEntries(
          summaries as Parameters<typeof buildDecisionReportEntries>[0],
        );
        const markdown = renderDecisionReportMarkdown(entries);
        applyArtifact(bindings, {
          path: "weakness/decision-report.md",
          kind: "markdown",
          badge: "decision report",
          content: markdown,
          updatedAt: Date.now(),
          dirty: true,
        });
        bindings.channel.push({ type: "decision_report", entries });
        return { ok: true, entries };
      },
    }),

    run_probe_variants: tool({
      description:
        "Run five pressure variants against the target model and let the auditor judge each trial. Returns aggregate verdict.",
      inputSchema: z.object({
        weaknessTitle: z.string(),
        hypothesis: z.string().optional(),
        deliverable: z.string(),
        badHeuristic: z.string(),
        authorityInvariant: z.string(),
        authorityArtifacts: z.array(z.string()).default([]),
        trialsPerVariant: z.number().int().min(1).max(15).optional(),
      }),
      execute: async (args) => {
        setPhase(bindings, "probe");
        const trials = args.trialsPerVariant ?? bindings.trialsPerVariant;
        const summary = await runProbeSweep({
          provider: bindings.targetProvider,
          modelSlug: bindings.targetModelSlug,
          judgeProvider: bindings.judgeProvider,
          judgeModelSlug: bindings.judgeModelSlug,
          weaknessTitle: args.weaknessTitle,
          deliverable: args.deliverable,
          badHeuristic: args.badHeuristic,
          authorityInvariant: args.authorityInvariant,
          authorityArtifacts: args.authorityArtifacts,
          trialsPerVariant: trials,
        });

        bindings.channel.push({
          type: "probe_summary",
          summary: {
            weaknessTitle: summary.weaknessTitle,
            variants: summary.variants,
            verdict: summary.verdict,
          },
        });

        setPhase(bindings, "decision");
        return summary;
      },
    }),

    generate_fixtures: tool({
      description:
        "Generate a multimodal fixture spec and write real CSV/JSON/markdown artifacts under environment/data.",
      inputSchema: z.object({
        weaknessTitle: z.string(),
        deliverable: z.string(),
        domain: z.string(),
        categoriesHint: z
          .array(
            z.object({
              name: z.string(),
              count: z.number().int().min(1).max(60),
              description: z.string(),
            }),
          )
          .default([]),
      }),
      execute: async (args) => {
        setPhase(bindings, "fixtures");
        const spec = await generateFixtureSpec({
          provider: bindings.scaffoldProvider,
          modelSlug: bindings.scaffoldModelSlug,
          weaknessTitle: args.weaknessTitle,
          deliverable: args.deliverable,
          domain: args.domain,
          categoriesHint: args.categoriesHint,
        });
        const artifacts = materializeFixtures(spec);
        for (const artifact of artifacts) {
          applyArtifact(bindings, artifact);
        }
        return {
          ok: true,
          fixtureCount: artifacts.length,
          paths: artifacts.map((a) => a.path),
        };
      },
    }),

    scaffold_task: tool({
      description:
        "Generate the canonical Harbor task pack (instruction.md, task.toml, Dockerfile, build_inputs.py, solve.sh, test_outputs.py) for the current weakness. Call after fixtures.",
      inputSchema: z.object({
        weaknessTitle: z.string(),
        hypothesis: z.string(),
        badHeuristic: z.string(),
        authorityInvariant: z.string(),
        deliverable: z.string(),
        domain: z.string(),
        fixtureCategories: z
          .array(
            z.object({
              name: z.string(),
              count: z.number().int().min(1).max(60),
              description: z.string(),
            }),
          )
          .default([]),
      }),
      execute: async (args) => {
        setPhase(bindings, "scaffold");
        const scaffold = await generateScaffold({
          provider: bindings.scaffoldProvider,
          modelSlug: bindings.scaffoldModelSlug,
          weaknessTitle: args.weaknessTitle,
          hypothesis: args.hypothesis,
          badHeuristic: args.badHeuristic,
          authorityInvariant: args.authorityInvariant,
          deliverable: args.deliverable,
          domain: args.domain,
          fixtureCategories: args.fixtureCategories,
        });

        const now = Date.now();
        const taskToml = normalizeTaskTomlContent(scaffold.taskToml, {
          slug: scaffold.slug,
          description: args.weaknessTitle,
        });
        const files: Array<{ path: string; content: string; badge: string; kind: Artifact["kind"] }> = [
          { path: "instruction.md", content: scaffold.instructionMd, badge: "operational", kind: "markdown" },
          { path: "task.toml", content: taskToml, badge: "metadata", kind: "toml" },
          { path: "environment/Dockerfile", content: scaffold.dockerfile, badge: "environment", kind: "shell" },
          {
            path: "environment/data/build_inputs.py",
            content: scaffold.buildInputsPy,
            badge: "fixture builder",
            kind: "python",
          },
          { path: "solution/solve.sh", content: scaffold.solveSh, badge: "oracle", kind: "shell" },
          {
            path: "tests/test_outputs.py",
            content: scaffold.testOutputsPy,
            badge: "deterministic verifier",
            kind: "python",
          },
          {
            path: scaffold.policyArtifactPath.startsWith("environment/data/")
              ? scaffold.policyArtifactPath
              : `environment/data/${scaffold.policyArtifactPath.replace(/^\/+/, "")}`,
            content: scaffold.policyArtifactBody,
            badge: "authority",
            kind: "markdown",
          },
        ];

        for (const file of files) {
          applyArtifact(bindings, {
            path: file.path,
            kind: file.kind,
            badge: file.badge,
            content: file.content,
            updatedAt: now,
            dirty: true,
            taskSlug: scaffold.slug,
          });
        }

        return {
          ok: true,
          slug: scaffold.slug,
          outputFilename: scaffold.outputFilename,
          files: files.map((f) => f.path),
        };
      },
    }),

    lint_spoilers: tool({
      description:
        "Spoiler-lint an artifact with regex rules plus an LLM auditor pass. Returns line-anchored findings.",
      inputSchema: z.object({
        artifactPath: z.string(),
      }),
      execute: async ({ artifactPath }) => {
        const artifact = bindings.workspace.artifacts[artifactPath];
        if (!artifact) {
          return { error: "not_found", path: artifactPath };
        }
        const findings = await lintSpoilersHybrid({
          artifactPath: artifact.path,
          content: artifact.content,
          auditorProvider: bindings.judgeProvider,
          auditorModelSlug: bindings.judgeModelSlug,
        });
        bindings.channel.push({ type: "spoiler_findings", findings });
        return { ok: true, count: findings.length, findings };
      },
    }),

    run_harbor_sweep: tool({
      description:
        "Run the canonical Harbor sweep (oracle, nop, target) using the local harbor binary. Materializes the workspace, parses reward + ctrf + trajectory.",
      inputSchema: z.object({
        agent: z.enum(["oracle", "nop", "target"]).default("oracle"),
        slug: z.string().default("eval-task"),
      }),
      execute: async ({ agent, slug }) => {
        setPhase(bindings, agent === "target" ? "sweep" : "verifier");
        const tempRoot = await mkdtemp(path.join(tmpdir(), "harbor-"));
        const { taskDir } = await materializeWorkspace({
          workspace: bindings.workspace,
          destDir: tempRoot,
          taskSlug: slug,
        });

        const validation = await validateTaskPack(taskDir);
        if (!validation.ok) {
          await rm(tempRoot, { recursive: true, force: true });
          const message = validation.errors.join("; ");
          bindings.channel.push({ type: "sweep_error", message, detail: message });
          return { error: "validation_failed", detail: message };
        }

        const trialAgent =
          agent === "oracle"
            ? "oracle"
            : agent === "nop"
              ? "nop"
              : "gemini-cli";

        const trialCount = agent === "target" ? 3 : 1;

        try {
          const multi = await runHarborTrials({
            taskDir,
            agent: trialAgent,
            model: agent === "target" ? bindings.targetModelSlug : undefined,
            trialCount,
            onTrialComplete: (idx, result) => {
              bindings.channel.push({
                type: "sweep_trial_update",
                trial: {
                  idx,
                  reward: result.reward,
                  status: result.reward === 1 ? "passed" : "failed",
                  summary:
                    agent === "oracle"
                      ? "Oracle reproduces the deliverable."
                      : agent === "nop"
                        ? "Nop produced no deliverable."
                        : `Target trial ${idx} complete.`,
                },
              });
            },
          });

          const sweepSummary = {
            taskSlug: slug,
            passAt3: multi.passAtK,
            trials: multi.trials.map((t, i) => ({
              idx: i + 1,
              reward: t.reward,
              status: (t.reward === 1 ? "passed" : "failed") as "passed" | "failed",
              summary:
                agent === "oracle"
                  ? "Oracle reproduces the deliverable."
                  : agent === "nop"
                    ? "Nop produced no deliverable."
                    : "Target model trial complete.",
            })),
          };

          bindings.channel.push({ type: "sweep_summary", summary: sweepSummary });
          if (agent === "target") setPhase(bindings, "audit");
          await rm(tempRoot, { recursive: true, force: true });
          return {
            ok: true,
            passAt3: multi.passAtK,
            logPath: multi.trials.at(-1)?.logPath,
          };
        } catch (error) {
          await rm(tempRoot, { recursive: true, force: true });
          const detail = error instanceof Error ? error.message : String(error);
          bindings.channel.push({ type: "sweep_error", message: detail, detail });
          return { error: "harbor_failed", detail };
        }
      },
    }),

    audit_trajectory: tool({
      description:
        "Audit a failing trajectory excerpt with the non-target auditor model. Returns classification + rationale.",
      inputSchema: z.object({
        trajectoryText: z.string().min(8),
      }),
      execute: async ({ trajectoryText }) => {
        const audit = await auditTrajectoryWithLlm({
          targetModel: bindings.targetModelSlug,
          auditorProvider: bindings.judgeProvider,
          auditorModelSlug: bindings.judgeModelSlug,
          trajectoryText,
        });
        bindings.channel.push({ type: "audit", audit });
        setPhase(bindings, "iteration");
        return audit;
      },
    }),

    propose_iteration: tool({
      description:
        "Propose an iteration diff for an artifact to remove bait realism issues. Writes a .diff into iterations/.",
      inputSchema: z.object({
        artifactPath: z.string(),
        before: z.string(),
        after: z.string(),
        rationale: z.string(),
      }),
      execute: async ({ artifactPath, before, after, rationale }) => {
        const diff = `--- a/${artifactPath}\n+++ b/${artifactPath}\n- ${before}\n+ ${after}\n`;
        const diffPath = `iterations/${Date.now()}.diff`;
        applyArtifact(bindings, {
          path: diffPath,
          kind: "diff",
          badge: "iteration · proposed",
          content: `${diff}\n\nRationale: ${rationale}\n`,
          updatedAt: Date.now(),
          dirty: true,
        });
        return { ok: true, diffPath };
      },
    }),

    set_phase: tool({
      description: "Mark the active pipeline phase for the workbench rail.",
      inputSchema: z.object({
        phase: z.enum([
          "intake",
          "weakness",
          "probe",
          "decision",
          "scaffold",
          "fixtures",
          "verifier",
          "sweep",
          "audit",
          "iteration",
          "publish",
        ]),
      }),
      execute: async ({ phase }) => {
        setPhase(bindings, phase);
        return { ok: true, phase };
      },
    }),
  };
}
