import type {
  AuditSummary,
  ChatMessage,
  DecisionReportEntry,
  PlanStep,
  ProbeSummary,
  SpoilerFinding,
  SweepSummary,
  WeaknessReport,
  WorkspaceState,
} from "@/lib/agent/types";

export type ResultSurface =
  | "probe"
  | "sweep"
  | "cascade"
  | "audit"
  | "iteration"
  | "spoilers";

export type FocusTarget =
  | { kind: "none" }
  | { kind: "artifact"; path: string }
  | { kind: "result"; result: ResultSurface };

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
