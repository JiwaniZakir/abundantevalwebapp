#!/usr/bin/env tsx
/**
 * Harbor pack smoke: materialize golden task, validate TOML, run oracle/nop sweeps.
 * Usage: npm run smoke:harbor
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { materializeWorkspace } from "../lib/harbor/materialize";
import { validateTaskPack } from "../lib/harbor/validate-task";
import { runHarborTrial } from "../lib/harbor/adapter";
import { buildGoldenArtifacts } from "../lib/harbor/golden-pack";
import { buildEmptyWorkspace } from "../lib/agent/seed-workspace";

async function main() {
  const slug = "smoke-golden-task";
  const workspace = buildEmptyWorkspace();
  for (const artifact of buildGoldenArtifacts(slug)) {
    workspace.artifacts[artifact.path] = artifact;
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), "harbor-smoke-"));
  let ok = true;
  const report: Record<string, unknown> = { slug, tempRoot, steps: [] as unknown[] };

  try {
    const { taskDir, files } = await materializeWorkspace({
      workspace,
      destDir: tempRoot,
      taskSlug: slug,
    });
    report.files = files;
    (report.steps as unknown[]).push({ step: "materialize", ok: true, taskDir });

    const validation = await validateTaskPack(taskDir);
    (report.steps as unknown[]).push({ step: "validate", ok: validation.ok, errors: validation.errors });
    if (!validation.ok) ok = false;

    let oracleReward: number | null = null;
    let nopReward: number | null = null;

    try {
      const oracle = await runHarborTrial({ taskDir, agent: "oracle", onLog: () => {} });
      oracleReward = oracle.reward;
    } catch (error) {
      (report.steps as unknown[]).push({
        step: "oracle",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      ok = false;
    }

    if (oracleReward !== null) {
      (report.steps as unknown[]).push({ step: "oracle", ok: oracleReward === 1, reward: oracleReward });
      if (oracleReward !== 1) ok = false;
    }

    try {
      const nop = await runHarborTrial({ taskDir, agent: "nop", onLog: () => {} });
      nopReward = nop.reward;
    } catch (error) {
      (report.steps as unknown[]).push({
        step: "nop",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      ok = false;
    }

    if (nopReward !== null) {
      (report.steps as unknown[]).push({ step: "nop", ok: nopReward === 0, reward: nopReward });
      if (nopReward !== 0) ok = false;
    }
  } finally {
    try {
      await rm(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  report.ok = ok;
  const outPath = "/tmp/harbor-smoke-harbor.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
