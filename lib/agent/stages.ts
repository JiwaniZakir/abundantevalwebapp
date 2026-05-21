import type { AgentPhase } from "./types";

export type ProductStage = "intake" | "probe" | "build" | "validate" | "publish";

export const productStages: Array<{
  id: ProductStage;
  label: string;
  description: string;
}> = [
  {
    id: "intake",
    label: "Intake",
    description: "Capture the workflow and the weakness we want to expose.",
  },
  {
    id: "probe",
    label: "Probe",
    description: "Pressure the target model before we build anything.",
  },
  {
    id: "build",
    label: "Build",
    description: "Scaffold the Harbor task pack and synthesize fixtures.",
  },
  {
    id: "validate",
    label: "Validate",
    description: "Run oracle, nop, target sweeps. Audit the failure.",
  },
  {
    id: "publish",
    label: "Publish",
    description: "Iterate spoilers, freeze the run-config, ship the pack.",
  },
];

const phaseToStage: Record<AgentPhase, ProductStage> = {
  intake: "intake",
  weakness: "intake",
  probe: "probe",
  decision: "probe",
  scaffold: "build",
  fixtures: "build",
  verifier: "validate",
  sweep: "validate",
  audit: "validate",
  iteration: "publish",
  publish: "publish",
};

export function stageForPhase(phase: AgentPhase): ProductStage {
  return phaseToStage[phase];
}

export type StageContext = {
  stage: ProductStage;
  headline: string;
  hint: string;
  chips: Array<{ label: string; value: string; tone?: "primary" | "muted" }>;
};

export const stageContexts: Record<ProductStage, StageContext> = {
  intake: {
    stage: "intake",
    headline: "What workflow should we turn into a hard eval?",
    hint: "Describe the real operational deliverable. The orchestrator will pick a failure-mode hypothesis worth probing.",
    chips: [
      { label: "Draft a plan", value: "/plan", tone: "primary" },
      { label: "Map weakness", value: "/weakness" },
      { label: "Example workflow", value: "I need a Harbor eval for a quarterly compliance release workflow: policy updates, evidence packs, and a signed audit workbook." },
    ],
  },
  probe: {
    stage: "probe",
    headline: "Does the target actually fail on this?",
    hint: "Run five pressure variants. If the failure rate clears 80%, promote. If not, redesign before building.",
    chips: [
      { label: "Run probes", value: "/probe", tone: "primary" },
      { label: "Inspect weakness card", value: "Show me the current weakness card and reasoning." },
      { label: "Skip to build", value: "/scaffold" },
    ],
  },
  build: {
    stage: "build",
    headline: "Stage the Harbor task pack.",
    hint: "Operational instruction, task.toml, fixtures, verifier. Spoiler-lint runs after every write.",
    chips: [
      { label: "Scaffold task", value: "/scaffold", tone: "primary" },
      { label: "Generate fixtures", value: "/fixtures" },
      { label: "Lint instruction", value: "/lint instruction.md" },
    ],
  },
  validate: {
    stage: "validate",
    headline: "Prove the task is hard for real.",
    hint: "Oracle should reward 1, nop should reward 0, target should fail pass@3. Audit the trajectory to confirm.",
    chips: [
      { label: "Sweep oracle", value: "/sweep oracle" },
      { label: "Sweep nop", value: "/sweep nop" },
      { label: "Sweep target", value: "/sweep target", tone: "primary" },
      { label: "Audit failure", value: "/audit" },
    ],
  },
  publish: {
    stage: "publish",
    headline: "Iterate, then freeze the verdict.",
    hint: "Spoiler-fix bait artifacts, re-run the regression, then publish the task with full run-config lineage.",
    chips: [
      { label: "Propose iteration", value: "/iterate", tone: "primary" },
      { label: "Publish task", value: "/publish" },
    ],
  },
};
