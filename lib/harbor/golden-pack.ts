import type { Artifact } from "@/lib/agent/types";
import { buildTaskToml } from "./task-toml";

const now = Date.now();

/** Minimal Harbor-valid pack for smoke tests (oracle=1, nop=0). */
export function buildGoldenArtifacts(slug = "smoke-golden-task"): Artifact[] {
  const taskToml = buildTaskToml({
    slug,
    org: process.env.HARBOR_PUBLISH_ORG ?? "local",
    description: "Golden smoke task for Harbor Eval Studio.",
  });

  return [
    {
      path: "instruction.md",
      kind: "markdown",
      badge: "operational",
      content:
        "Write the deliverable to /root/output.txt containing the word READY based on /root/data/policy.txt.",
      updatedAt: now,
    },
    { path: "task.toml", kind: "toml", content: taskToml, updatedAt: now },
    {
      path: "environment/Dockerfile",
      kind: "shell",
      content: "FROM python:3.12\nRUN pip install --no-cache-dir pytest==8.3.3\n",
      updatedAt: now,
    },
    {
      path: "environment/data/policy.txt",
      kind: "markdown",
      content: "Operational policy: output must be READY.",
      updatedAt: now,
    },
    {
      path: "solution/solve.sh",
      kind: "shell",
      content: `#!/bin/bash
set -euo pipefail
mkdir -p /logs/verifier
echo "READY" > /root/output.txt
echo "1" > /logs/verifier/reward.txt
`,
      updatedAt: now,
    },
    {
      path: "tests/test_outputs.py",
      kind: "python",
      content: `from pathlib import Path

def test_output_ready():
    assert Path("/root/output.txt").read_text().strip() == "READY"

def test_reward():
    assert Path("/logs/verifier/reward.txt").read_text().strip() == "1"
`,
      updatedAt: now,
    },
  ];
}
