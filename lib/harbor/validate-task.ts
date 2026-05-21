import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type TaskValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const REQUIRED_PATHS = [
  "instruction.md",
  "task.toml",
  "environment/Dockerfile",
  "solution/solve.sh",
  "tests/test_outputs.py",
];

export async function validateTaskPack(taskDir: string): Promise<TaskValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rel of REQUIRED_PATHS) {
    try {
      await readFile(path.join(taskDir, rel), "utf8");
    } catch {
      errors.push(`Missing required file: ${rel}`);
    }
  }

  try {
    const toml = await readFile(path.join(taskDir, "task.toml"), "utf8");
    if (!/\[task\]/i.test(toml)) {
      errors.push("task.toml missing [task] section");
    }
    if (!/id\s*=\s*["'][^"']+\/[^"']+["']/i.test(toml)) {
      errors.push("task.toml missing task id (org/name)");
    }
    if (!/\[metadata\]/i.test(toml)) errors.push("task.toml missing [metadata]");
    if (!/\[environment\]/i.test(toml)) errors.push("task.toml missing [environment]");
    if (!/\[agent\]/i.test(toml)) errors.push("task.toml missing [agent]");
    if (!/\[verifier\]/i.test(toml)) errors.push("task.toml missing [verifier]");
  } catch {
    /* already reported missing task.toml */
  }

  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  const dryRun = await runHarborDryCheck(harborBin, taskDir);
  if (!dryRun.ok) {
    warnings.push(`Harbor dry check: ${dryRun.detail.slice(0, 400)}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function runHarborDryCheck(
  harborBin: string,
  taskDir: string,
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const child = spawn(harborBin, ["run", "-p", taskDir, "-a", "nop"], {
      env: process.env,
    });
    let output = "";
    child.stdout.on("data", (c: Buffer) => {
      output += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      output += c.toString();
    });
    child.on("error", () => resolve({ ok: false, detail: "harbor binary not found" }));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, detail: output });
        return;
      }
      if (/pydantic|validation|task\.toml/i.test(output)) {
        resolve({ ok: false, detail: output.slice(-800) });
        return;
      }
      resolve({ ok: true, detail: output });
    });
  });
}
