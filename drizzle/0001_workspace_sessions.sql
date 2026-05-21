CREATE TABLE IF NOT EXISTS "workspace_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text DEFAULT 'Untitled' NOT NULL,
  "snapshot" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
