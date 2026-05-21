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
  | "propose_weakness_card"
  | "intake_workflow"
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
  | { type: "sweep_summary"; summary: SweepSummary }
  | { type: "spoiler_findings"; findings: SpoilerFinding[] }
  | { type: "audit"; audit: AuditSummary }
  | {
      type: "notice";
      level: "info" | "warning" | "error";
      message: string;
      reason?: string;
    }
  | { type: "publish_open" }
  | { type: "done" }
  | { type: "error"; message: string };
