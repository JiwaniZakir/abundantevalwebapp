CREATE TYPE "public"."audit_classification" AS ENUM('ignored_authority_artifact', 'used_prior_work_heuristic', 'format_violation', 'misread_input', 'task_design_bug', 'environment_failure');--> statement-breakpoint
CREATE TYPE "public"."probe_variant" AS ENUM('plain', 'prior_work', 'schema', 'audit', 'speed');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sweep_phase" AS ENUM('oracle', 'nop', 'calibration', 'target', 'regression');--> statement-breakpoint
CREATE TYPE "public"."weakness_category" AS ENUM('authority_ambiguity', 'false_recency', 'wrong_source', 'phantom_join', 'tie_breaking', 'null_cascade', 'provenance', 'lifecycle');--> statement-breakpoint
CREATE TYPE "public"."weakness_status" AS ENUM('draft', 'probing', 'promoted', 'redesign', 'rejected');--> statement-breakpoint
CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_id" uuid NOT NULL,
	"auditor_model" text NOT NULL,
	"classification" "audit_classification" NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iterations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"diff_json" jsonb NOT NULL,
	"accepted_by_user_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "probe_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"probe_id" uuid NOT NULL,
	"raw_output" text NOT NULL,
	"scored_failure" boolean NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "probes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weakness_card_id" uuid NOT NULL,
	"variant" "probe_variant" NOT NULL,
	"prompt" text NOT NULL,
	"trials_target" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"workflow_slug" text NOT NULL,
	"run_config_id" uuid,
	"user_id" text DEFAULT 'local',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "run_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_slug" text NOT NULL,
	"runner" text NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"temperature" numeric(4, 2) DEFAULT '0' NOT NULL,
	"pass_threshold" numeric(4, 2) DEFAULT '0.6' NOT NULL,
	"hard_threshold" numeric(4, 2) DEFAULT '0.3' NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_configs_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "spoiler_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"artifact_path" text NOT NULL,
	"line" integer NOT NULL,
	"severity" text NOT NULL,
	"rule_id" text NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sweeps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"run_config_id" uuid NOT NULL,
	"phase" "sweep_phase" NOT NULL,
	"trials_target" integer DEFAULT 3 NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"pass_at_k_numerator" integer DEFAULT 0 NOT NULL,
	"pass_at_k_denominator" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"instruction_md" text NOT NULL,
	"task_toml" text NOT NULL,
	"dockerfile" text NOT NULL,
	"build_inputs_py" text NOT NULL,
	"solve_sh" text NOT NULL,
	"test_outputs_py" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweep_id" uuid NOT NULL,
	"trial_idx" integer NOT NULL,
	"reward" numeric(5, 3) DEFAULT '0' NOT NULL,
	"trajectory_json" jsonb,
	"ctrf_json" jsonb,
	"log_text" text DEFAULT '' NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"status" "run_status" DEFAULT 'queued' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weakness_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"taxonomy_category" "weakness_category" NOT NULL,
	"title" text NOT NULL,
	"hypothesis" text NOT NULL,
	"bad_heuristic" text NOT NULL,
	"authority_invariant" text NOT NULL,
	"status" "weakness_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
