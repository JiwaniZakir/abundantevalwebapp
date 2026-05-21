#!/usr/bin/env node
/**
 * Materialize workspace artifacts and run publish (same path as the UI).
 * Usage: node scripts/run-publish.mjs [--skip-validate]
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import {
  ds25Instruction,
  ds25Project,
  ds25TaskToml,
} from "../lib/domain/ds25-seed.ts";

config({ path: resolve(import.meta.dirname, "../.env.local") });

const skipValidate = process.argv.includes("--skip-validate");
const slug = process.env.PUBLISH_SLUG ?? "harbor-eval-invoice-recon";
const now = Date.now();

const artifacts = [
  {
    path: "instruction.md",
    kind: "markdown",
    badge: "operational",
    content: ds25Instruction,
    updatedAt: now,
  },
  {
    path: "task.toml",
    kind: "toml",
    content: ds25TaskToml,
    updatedAt: now,
  },
  {
    path: "environment/Dockerfile",
    kind: "shell",
    content: `FROM python:3.12

RUN pip install --no-cache-dir \\
  openpyxl==3.1.5 \\
  pandas==2.2.3 \\
  pdfplumber==0.11.4 \\
  fpdf2==2.8.2 \\
  pytest==8.3.3
`,
    updatedAt: now,
  },
  {
    path: "solution/solve.sh",
    kind: "shell",
    content: `#!/bin/bash
set -euo pipefail
mkdir -p /logs/verifier
echo "1" > /logs/verifier/reward.txt
`,
    updatedAt: now,
  },
  {
    path: "tests/test_outputs.py",
    kind: "python",
    content: `from pathlib import Path

def test_oracle_reward():
    reward = Path("/logs/verifier/reward.txt").read_text().strip()
    assert reward == "1"
`,
    updatedAt: now,
  },
  {
    path: "environment/data/policy/compliance_policy.pdf.txt",
    kind: "markdown",
    badge: "authority artifact",
    content:
      "Compliance Policy v3.2\\n\\n- Release is permitted only when every upstream lab event in the dependency trace is finalized.\\n- Portal exports are advisory; the dependency trace is authoritative.\\n",
    updatedAt: now,
  },
];

const body = {
  slug,
  description: `Harbor eval: ${ds25Project.name}`,
  validate: !skipValidate,
  visibility: "public",
  workspace: { phase: "publish", artifacts },
};

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const res = await fetch(`${base}/api/publish`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error("Publish HTTP", res.status, await res.text());
  process.exit(1);
}

let repoUrl = null;
const decoder = new TextDecoder();
const reader = res.body.getReader();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.startsWith("data: ")) continue;
    const event = JSON.parse(part.slice(6));
    if (event.kind === "status") {
      console.log(`[${event.stage}] ${event.message}`);
    } else if (event.kind === "files") {
      console.log("files:", event.files.join(", "));
    } else if (event.kind === "validation") {
      console.log("validation:", event);
    } else if (event.kind === "log") {
      console.log("log:", event.line.trim());
    } else if (event.kind === "publish") {
      repoUrl = event.repoUrl;
      console.log("published:", repoUrl);
    } else if (event.kind === "error") {
      console.error("error:", event.message);
      process.exit(1);
    } else if (event.kind === "done") {
      console.log("done");
    }
  }
}

if (!repoUrl) {
  console.error("No repo URL returned");
  process.exit(1);
}
