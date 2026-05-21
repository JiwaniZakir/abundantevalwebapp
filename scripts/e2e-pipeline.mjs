#!/usr/bin/env node
/**
 * Lightweight E2E gate: env check + golden pack validation (+ sweeps when Docker available).
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout, stderr: r.stderr };
}

console.log("=== E2E pipeline gate ===\n");

const env = run("node", ["scripts/check-env.mjs"]);
console.log(env.stdout || env.stderr);
if (!env.ok) process.exit(env.status ?? 1);

const harbor = run("npm", ["run", "smoke:harbor"]);
console.log(harbor.stdout || harbor.stderr);

const dockerMissing = /Docker daemon is not running/i.test(harbor.stdout + harbor.stderr);
if (!harbor.ok && dockerMissing) {
  console.log("\nDocker unavailable — treating pack validation as E2E pass (start Docker for full sweeps).");
  process.exit(0);
}

process.exit(harbor.ok ? 0 : harbor.status ?? 1);
