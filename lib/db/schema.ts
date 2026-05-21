import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const weaknessCategoryEnum = pgEnum("weakness_category", [
  "authority_ambiguity",
  "false_recency",
  "wrong_source",
  "phantom_join",
  "tie_breaking",
  "null_cascade",
  "provenance",
  "lifecycle",
]);

export const weaknessStatusEnum = pgEnum("weakness_status", [
  "draft",
  "probing",
  "promoted",
  "redesign",
  "rejected",
]);

export const probeVariantEnum = pgEnum("probe_variant", [
  "plain",
  "prior_work",
  "schema",
  "audit",
  "speed",
]);

export const sweepPhaseEnum = pgEnum("sweep_phase", [
  "oracle",
  "nop",
  "calibration",
  "target",
  "regression",
]);

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const auditClassificationEnum = pgEnum("audit_classification", [
  "ignored_authority_artifact",
  "used_prior_work_heuristic",
  "format_violation",
  "misread_input",
  "task_design_bug",
  "environment_failure",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  workflowSlug: text("workflow_slug").notNull(),
  runConfigId: uuid("run_config_id"),
  userId: text("user_id").default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runConfigs = pgTable("run_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  modelSlug: text("model_slug").notNull(),
  runner: text("runner").notNull(),
  flags: jsonb("flags").$type<Record<string, unknown>>().notNull().default({}),
  temperature: numeric("temperature", { precision: 4, scale: 2 }).notNull().default("0"),
  passThreshold: numeric("pass_threshold", { precision: 4, scale: 2 })
    .notNull()
    .default("0.6"),
  hardThreshold: numeric("hard_threshold", { precision: 4, scale: 2 })
    .notNull()
    .default("0.3"),
  hash: text("hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weaknessCards = pgTable("weakness_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  taxonomyCategory: weaknessCategoryEnum("taxonomy_category").notNull(),
  title: text("title").notNull(),
  hypothesis: text("hypothesis").notNull(),
  badHeuristic: text("bad_heuristic").notNull(),
  authorityInvariant: text("authority_invariant").notNull(),
  status: weaknessStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const probes = pgTable("probes", {
  id: uuid("id").primaryKey().defaultRandom(),
  weaknessCardId: uuid("weakness_card_id").notNull(),
  variant: probeVariantEnum("variant").notNull(),
  prompt: text("prompt").notNull(),
  trialsTarget: integer("trials_target").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const probeTrials = pgTable("probe_trials", {
  id: uuid("id").primaryKey().defaultRandom(),
  probeId: uuid("probe_id").notNull(),
  rawOutput: text("raw_output").notNull(),
  scoredFailure: boolean("scored_failure").notNull(),
  latencyMs: integer("latency_ms").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  slug: text("slug").notNull(),
  instructionMd: text("instruction_md").notNull(),
  taskToml: text("task_toml").notNull(),
  dockerfile: text("dockerfile").notNull(),
  buildInputsPy: text("build_inputs_py").notNull(),
  solveSh: text("solve_sh").notNull(),
  testOutputsPy: text("test_outputs_py").notNull(),
  version: integer("version").notNull().default(1),
  parentVersionId: uuid("parent_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sweeps = pgTable("sweeps", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  runConfigId: uuid("run_config_id").notNull(),
  phase: sweepPhaseEnum("phase").notNull(),
  trialsTarget: integer("trials_target").notNull().default(3),
  status: runStatusEnum("status").notNull().default("queued"),
  passAtKNumerator: integer("pass_at_k_numerator").notNull().default(0),
  passAtKDenominator: integer("pass_at_k_denominator").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trials = pgTable("trials", {
  id: uuid("id").primaryKey().defaultRandom(),
  sweepId: uuid("sweep_id").notNull(),
  trialIdx: integer("trial_idx").notNull(),
  reward: numeric("reward", { precision: 5, scale: 3 }).notNull().default("0"),
  trajectoryJson: jsonb("trajectory_json").$type<Record<string, unknown>>(),
  ctrfJson: jsonb("ctrf_json").$type<Record<string, unknown>>(),
  logText: text("log_text").notNull().default(""),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: runStatusEnum("status").notNull().default("queued"),
});

export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  trialId: uuid("trial_id").notNull(),
  auditorModel: text("auditor_model").notNull(),
  classification: auditClassificationEnum("classification").notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spoilerFindings = pgTable("spoiler_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  artifactPath: text("artifact_path").notNull(),
  line: integer("line").notNull(),
  severity: text("severity").notNull(),
  ruleId: text("rule_id").notNull(),
  message: text("message").notNull(),
});

export const iterations = pgTable("iterations", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  summary: text("summary").notNull(),
  diffJson: jsonb("diff_json").$type<Record<string, unknown>>().notNull(),
  acceptedByUserAt: timestamp("accepted_by_user_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
