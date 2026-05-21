import { lintSpoilers } from "@/lib/ai/spoiler-lint";
import { auditTrajectoryHeuristically } from "@/lib/ai/trajectory-audit";
import { createFixtureManifest } from "@/lib/fixtures/generators";
import {
  ds25DependencyNodes,
  ds25Project,
} from "@/lib/domain/ds25-seed";
import { failureModes } from "@/lib/domain/taxonomy";
import type {
  Artifact,
  AuditSummary,
  ProbeSummary,
  SpoilerFinding,
  SweepSummary,
  WorkspaceState,
} from "./types";

const probeVariants = ["plain", "prior_work", "schema", "audit", "speed"] as const;

export type ToolContext = {
  workspace: WorkspaceState;
};

export type ToolOutput = {
  summary: string;
  artifacts?: Artifact[];
  probeSummary?: ProbeSummary;
  sweepSummary?: SweepSummary;
  spoilerFindings?: SpoilerFinding[];
  audit?: AuditSummary;
  phase?: WorkspaceState["phase"];
  result?: unknown;
};

export function executeListWorkspace(ctx: ToolContext): ToolOutput {
  const files = Object.values(ctx.workspace.artifacts).map((a) => ({
    path: a.path,
    kind: a.kind,
    badge: a.badge,
    bytes: a.content.length,
  }));

  return {
    summary: `Workspace has ${files.length} artifacts.`,
    result: { files },
  };
}

export function executeReadArtifact(
  ctx: ToolContext,
  args: { path: string },
): ToolOutput {
  const artifact = ctx.workspace.artifacts[args.path];
  if (!artifact) {
    return {
      summary: `No artifact at ${args.path}.`,
      result: { error: "not_found" },
    };
  }

  return {
    summary: `Read ${artifact.path} (${artifact.content.length} bytes).`,
    result: { path: artifact.path, content: artifact.content, kind: artifact.kind },
  };
}

export function executeWriteArtifact(
  ctx: ToolContext,
  args: { path: string; content: string; kind?: Artifact["kind"]; badge?: string },
): ToolOutput {
  const previous = ctx.workspace.artifacts[args.path];
  const next: Artifact = {
    path: args.path,
    kind: args.kind ?? previous?.kind ?? inferKind(args.path),
    badge: args.badge ?? previous?.badge,
    content: args.content,
    updatedAt: Date.now(),
    dirty: true,
  };

  return {
    summary: previous
      ? `Updated ${args.path}.`
      : `Created ${args.path}.`,
    artifacts: [next],
  };
}

function inferKind(path: string): Artifact["kind"] {
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".sh")) return "shell";
  if (path.endsWith(".csv")) return "csv";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  return "markdown";
}

export function executeProposeWeakness(
  ctx: ToolContext,
  args: {
    title: string;
    hypothesis: string;
    badHeuristic: string;
    authorityInvariant: string;
    taxonomySlug?: string;
  },
): ToolOutput {
  const taxonomy = failureModes.find((m) => m.slug === args.taxonomySlug) ?? failureModes.find((m) => m.slug === "lifecycle")!;
  const path = `weakness/${args.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.md`;
  const content = `# ${args.title}\n\n- Taxonomy: ${taxonomy.name}\n- Bad heuristic: ${args.badHeuristic}\n- Authority invariant: ${args.authorityInvariant}\n\n## Hypothesis\n${args.hypothesis}\n`;

  return {
    summary: `Promoted weakness card: ${args.title}.`,
    artifacts: [
      {
        path,
        kind: "markdown",
        badge: `weakness · ${taxonomy.shortName}`,
        content,
        updatedAt: Date.now(),
        dirty: true,
      },
    ],
  };
}

export function executeRunProbeVariants(
  _ctx: ToolContext,
  args: { weaknessTitle: string; trialsPerVariant?: number },
): ToolOutput {
  const trials = args.trialsPerVariant ?? 15;
  const failureRates = [0.8, 0.93, 0.73, 0.86, 1];

  const variants = probeVariants.map((variant, index) => ({
    variant,
    failureRate: failureRates[index],
    trials,
    failures: Math.round(failureRates[index] * trials),
  }));

  const aggregate =
    variants.reduce((acc, v) => acc + v.failureRate, 0) / variants.length;

  const verdict: ProbeSummary["verdict"] =
    aggregate >= 0.8 ? "promote" : aggregate >= 0.4 ? "redesign" : "reject";

  return {
    summary: `${variants.length} variants × ${trials} trials. ${(aggregate * 100).toFixed(0)}% mean failure → ${verdict}.`,
    probeSummary: {
      weaknessTitle: args.weaknessTitle,
      variants,
      verdict,
    },
    phase: "decision",
  };
}

export function executeLintSpoilers(
  ctx: ToolContext,
  args: { artifactPath: string },
): ToolOutput {
  const artifact = ctx.workspace.artifacts[args.artifactPath];
  if (!artifact) {
    return {
      summary: `No artifact at ${args.artifactPath}.`,
      result: { error: "not_found" },
    };
  }

  const findings = lintSpoilers({
    artifactPath: artifact.path,
    content: artifact.content,
  });

  return {
    summary:
      findings.length === 0
        ? `Spoiler lint clean for ${artifact.path}.`
        : `${findings.length} spoiler finding${findings.length === 1 ? "" : "s"} in ${artifact.path}.`,
    spoilerFindings: findings,
  };
}

export function executeGenerateFixtures(
  _ctx: ToolContext,
  args: { seed?: number; activeCertificates?: number },
): ToolOutput {
  const manifest = createFixtureManifest({
    seed: args.seed,
    activeCertificates: args.activeCertificates,
  });

  const path = "environment/data/build_inputs.py";
  const content = `# Auto-generated by Harbor Eval Orchestrator.\n# seed=${manifest.spec.seed}, active_certificates=${manifest.spec.activeCertificates}\n\nimport json, random\n\nrng = random.Random(${manifest.spec.seed})\n\nARTIFACTS = ${JSON.stringify(manifest.artifacts, null, 2)}\n\nfor artifact in ARTIFACTS:\n    open(f'/root/data/{artifact}', 'w').close()\n\nprint('emitted', len(ARTIFACTS), 'artifacts')\n`;

  return {
    summary: `Generated fixture manifest (${manifest.artifacts.length} artifacts).`,
    artifacts: [
      {
        path,
        kind: "python",
        badge: "fixture builder",
        content,
        updatedAt: Date.now(),
        dirty: true,
      },
    ],
    phase: "verifier",
  };
}

export function executeRunHarborSweep(
  _ctx: ToolContext,
  args: { taskSlug?: string; agent?: "oracle" | "nop" | "gemini-cli" },
): ToolOutput {
  const agent = args.agent ?? "gemini-cli";
  const summaryTrials: SweepSummary["trials"] = [
    {
      idx: 1,
      reward: agent === "oracle" ? 1 : 0,
      status: agent === "oracle" ? "passed" : "failed",
      summary:
        agent === "oracle"
          ? "Oracle reproduces release decision."
          : "Trusted portal export; missed transitive revocation cascade.",
    },
    {
      idx: 2,
      reward: agent === "oracle" ? 1 : 0,
      status: agent === "oracle" ? "passed" : "failed",
      summary:
        agent === "oracle"
          ? "Oracle reproduces release decision."
          : "Followed prior-workbook portal rule; failed dependency trace.",
    },
    {
      idx: 3,
      reward: agent === "oracle" ? 1 : 0,
      status: agent === "oracle" ? "passed" : "failed",
      summary:
        agent === "oracle"
          ? "Oracle reproduces release decision."
          : "Did not propagate LAB-1044 revocation to CERT-A17 / BATCH-22.",
    },
  ];

  const passes = summaryTrials.filter((t) => t.status === "passed").length;

  return {
    summary:
      agent === "oracle"
        ? `Oracle sweep complete: 3/3 reward=1.`
        : agent === "nop"
          ? `Nop sweep complete: 0/3 reward=0 (expected).`
          : `Target sweep complete: ${passes}/3 pass.`,
    sweepSummary: {
      taskSlug: args.taskSlug ?? "ds-25-compliance-cert-release",
      passAt3: `${passes}/3`,
      trials: summaryTrials,
      cascade: ds25DependencyNodes.map((node) => ({
        id: node.id,
        label: node.label,
        status: node.status,
      })),
    },
    phase: agent === "gemini-cli" ? "audit" : agent === "oracle" ? "sweep" : "sweep",
  };
}

export function executeAuditTrajectory(
  _ctx: ToolContext,
  args: { trajectoryText: string; auditorModel?: string },
): ToolOutput {
  const audit = auditTrajectoryHeuristically({
    targetModel: ds25Project.targetModel,
    auditorModel: args.auditorModel ?? ds25Project.auditorModel,
    trajectoryText: args.trajectoryText,
  });

  return {
    summary: `Audit classified failure as ${audit.classification}.`,
    audit,
    phase: "iteration",
  };
}

export function executeProposeIteration(
  _ctx: ToolContext,
  args: { artifactPath: string; before: string; after: string; rationale: string },
): ToolOutput {
  const diff = `--- a/${args.artifactPath}\n+++ b/${args.artifactPath}\n- ${args.before}\n+ ${args.after}\n`;

  return {
    summary: `Iteration proposed for ${args.artifactPath}.`,
    artifacts: [
      {
        path: `iterations/${Date.now()}.diff`,
        kind: "diff",
        badge: "iteration · proposed",
        content: `${diff}\n\nRationale: ${args.rationale}\n`,
        updatedAt: Date.now(),
        dirty: true,
      },
    ],
  };
}

export function executeSetPhase(
  _ctx: ToolContext,
  args: { phase: WorkspaceState["phase"] },
): ToolOutput {
  return {
    summary: `Phase set to ${args.phase}.`,
    phase: args.phase,
  };
}

