export type AgentPhase =
  | "intake"
  | "weakness"
  | "probe"
  | "decision"
  | "scaffold"
  | "fixtures"
  | "verifier"
  | "sweep"
  | "audit"
  | "iteration"
  | "publish";

export type ChatRole = "user" | "assistant" | "system";

export type ToolName =
  | "list_workspace"
  | "read_artifact"
  | "write_artifact"
  | "intake_workflow"
  | "map_workflow_weaknesses"
  | "batch_probe_candidates"
  | "render_probe_decision_report"
  | "run_probe_variants"
  | "lint_spoilers"
  | "generate_fixtures"
  | "scaffold_task"
  | "run_harbor_sweep"
  | "audit_trajectory"
  | "propose_iteration"
  | "set_phase";

export type ToolCallStatus = "queued" | "running" | "succeeded" | "failed";

export type ToolCall = {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  startedAt: number;
  finishedAt?: number;
  summary?: string;
};

export type PlanStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  toolCalls?: ToolCall[];
  plan?: PlanStep[];
  phase?: AgentPhase;
  pending?: boolean;
};

export type ArtifactKind =
  | "markdown"
  | "toml"
  | "python"
  | "json"
  | "shell"
  | "csv"
  | "yaml"
  | "diff";

export type Artifact = {
  path: string;
  kind: ArtifactKind;
  content: string;
  badge?: string;
  updatedAt: number;
  dirty?: boolean;
  taskSlug?: string;
};

export type WeaknessCandidate = {
  slug: string;
  weaknessTitle: string;
  domain: string;
  deliverable: string;
  hypothesis: string;
  badHeuristic: string;
  authorityInvariant: string;
  taxonomySlug: string;
  workflowFitScore: number;
  verifierStrategy: string;
  status: "candidate" | "approved" | "rejected" | "promoted" | "redesign";
};

export type WeaknessReport = {
  workflowDescription: string;
  candidates: WeaknessCandidate[];
  createdAt: number;
};

export type DecisionReportEntry = {
  slug: string;
  weaknessTitle: string;
  verdict: ProbeSummary["verdict"];
  aggregateFailureRate: number;
  recommendedAction: string;
};

export type WorkspaceState = {
  projectId: string;
  projectName: string;
  targetModel: string;
  auditorModel: string;
  runner: string;
  runConfigHash: string;
  phase: AgentPhase;
  artifacts: Record<string, Artifact>;
  probeSummary?: ProbeSummary;
  sweepSummary?: SweepSummary;
  spoilerFindings?: SpoilerFinding[];
  audit?: AuditSummary;
};

export type ProbeSummary = {
  weaknessTitle: string;
  variants: Array<{
    variant: string;
    failureRate: number;
    trials: number;
    failures: number;
  }>;
  verdict: "promote" | "redesign" | "reject";
};

export type SweepSummary = {
  taskSlug: string;
  passAt3: string;
  trials: Array<{
    idx: number;
    reward: number;
    status: "queued" | "running" | "passed" | "failed";
    summary: string;
  }>;
  cascade?: Array<{ id: string; label: string; status: string }>;
};

export type SpoilerFinding = {
  artifactPath: string;
  line: number;
  severity: "low" | "medium" | "high";
  ruleId: string;
  message: string;
};

export type AuditSummary = {
  auditorModel: string;
  classification: string;
  rationale: string;
  steps?: Array<{
    id: string;
    label: string;
    kind: "model" | "tool" | "verifier" | "notice";
    excerpt?: string;
    reward?: number;
    failed?: boolean;
  }>;
};

export type ApprovalGate = {
  gateId: string;
  title: string;
  description: string;
  stage: string;
  candidateCount?: number;
  promoteCount?: number;
  taskSlug?: string;
};

export type AgentEvent =
  | { type: "phase"; phase: AgentPhase }
  | { type: "plan"; plan: PlanStep[] }
  | { type: "text"; delta: string }
  | { type: "tool_call_start"; call: ToolCall }
  | {
      type: "tool_call_finish";
      id: string;
      result: unknown;
      summary?: string;
      status?: ToolCallStatus;
    }
  | { type: "artifact"; artifact: Artifact }
  | { type: "probe_summary"; summary: ProbeSummary }
  | { type: "probe_batch_summary"; summaries: ProbeSummary[] }
  | { type: "weakness_report"; report: WeaknessReport }
  | { type: "decision_report"; entries: DecisionReportEntry[] }
  | { type: "sweep_trial_update"; trial: SweepSummary["trials"][number] }
  | { type: "sweep_error"; message: string; detail?: string }
  | { type: "sweep_summary"; summary: SweepSummary }
  | { type: "spoiler_findings"; findings: SpoilerFinding[] }
  | { type: "audit"; audit: AuditSummary }
  | { type: "approval_gate"; gate: ApprovalGate }
  | {
      type: "autopilot_status";
      stage: string;
      message?: string;
      awaitingApproval?: boolean;
    }
  | {
      type: "notice";
      level: "info" | "warning" | "error";
      message: string;
      reason?: string;
    }
  | { type: "publish_open" }
  | { type: "done" }
  | { type: "error"; message: string };
