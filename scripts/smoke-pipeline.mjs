#!/usr/bin/env node
/**
 * Sequential Harbor Eval Studio pipeline smoke tests via POST /api/agent (SSE).
 * Usage: node scripts/smoke-pipeline.mjs [--base http://localhost:3000]
 */
import { writeFileSync } from "node:fs";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const WEAKNESS_PROMPT =
  "Design an eval for a data analyst agent that must reconcile conflicting KPI definitions across two stakeholder spreadsheets without using hidden oracle files.";

const history = [];
let workspace = { phase: "intake", artifacts: [] };

function artifactList() {
  return Object.values(
    workspace.artifacts.reduce((acc, a) => {
      acc[a.path] = a;
      return acc;
    }, {}),
  );
}

async function consumeSse(response, timeoutMs) {
  const events = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const start = Date.now();

  const timeout = setTimeout(() => reader.cancel("timeout"), timeoutMs);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          events.push(ev);
          if (ev.type === "artifact" && ev.artifact) {
            const idx = workspace.artifacts.findIndex(
              (a) => a.path === ev.artifact.path,
            );
            if (idx >= 0) workspace.artifacts[idx] = ev.artifact;
            else workspace.artifacts.push(ev.artifact);
          }
          if (ev.type === "phase" && ev.phase) {
            workspace.phase = ev.phase;
          }
        } catch {
          /* ignore parse errors */
        }
      }
      if (events.some((e) => e.type === "done")) break;
    }
  } finally {
    clearTimeout(timeout);
  }

  return { events, durationMs: Date.now() - start };
}

async function runAgent(input, { timeoutMs = 300_000, trialsPerVariant } = {}) {
  const body = {
    input,
    history,
    workspace: { phase: workspace.phase, artifacts: artifactList() },
  };
  if (trialsPerVariant != null) body.trialsPerVariant = trialsPerVariant;

  const res = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 500),
      events: [],
      durationMs: 0,
    };
  }

  const { events, durationMs } = await consumeSse(res, timeoutMs);
  const assistantText = events
    .filter((e) => e.type === "text_delta")
    .map((e) => e.delta ?? "")
    .join("");
  const toolCalls = events.filter((e) => e.type === "tool_call");
  const errors = events.filter((e) => e.type === "error");
  const notices = events.filter((e) => e.type === "notice");

  if (assistantText) {
    history.push({
      id: `u-${Date.now()}`,
      role: "user",
      content: input,
      createdAt: Date.now(),
    });
    history.push({
      id: `a-${Date.now()}`,
      role: "assistant",
      content: assistantText,
      createdAt: Date.now(),
    });
  }

  return {
    ok: errors.length === 0 && !notices.some((n) => n.level === "error"),
    status: res.status,
    durationMs,
    events,
    toolCalls,
    errors,
    notices,
    eventTypes: [...new Set(events.map((e) => e.type))],
  };
}

async function runPublish() {
  const body = {
    slug: "smoke-eval-task",
    description: "Smoke test publish",
    validate: false,
    workspace: { phase: workspace.phase, artifacts: artifactList() },
  };
  const start = Date.now();
  const res = await fetch(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const events = [];
  if (res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const timeout = setTimeout(() => reader.cancel("timeout"), 120_000);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            events.push(JSON.parse(line.slice(6)));
          } catch {
            /* */
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } else {
    return {
      ok: false,
      status: res.status,
      error: await res.text(),
      durationMs: Date.now() - start,
      events: [],
    };
  }
  return {
    ok: !events.some((e) => e.kind === "error"),
    status: res.status,
    durationMs: Date.now() - start,
    events,
    eventKinds: [...new Set(events.map((e) => e.kind))],
  };
}

function summarizeStep(name, result, checks) {
  const probeSummary = result.events?.find((e) => e.type === "probe_summary");
  const sweepSummary = result.events?.find((e) => e.type === "sweep_summary");
  const spoilerFindings = result.events?.filter(
    (e) => e.type === "spoiler_finding",
  );
  const paths = workspace.artifacts.map((a) => a.path);

  return {
    step: name,
    command: name.startsWith("publish") ? "POST /api/publish" : `POST /api/agent input=${JSON.stringify(name)}`,
    durationSec: (result.durationMs / 1000).toFixed(1),
    success: result.ok && checks.every((c) => c.pass),
    httpStatus: result.status,
    blocked: result.notices?.some((n) => n.reason === "live_setup_required"),
    errors: (result.errors ?? []).map((e) => e.message),
    notices: (result.notices ?? []).map((n) => n.message ?? n.reason),
    eventTypes: result.eventTypes ?? result.eventKinds ?? [],
    toolCalls: (result.toolCalls ?? []).map((t) => ({
      name: t.call?.name ?? t.name,
      status: t.call?.status ?? t.status,
    })),
    probeSummary: probeSummary?.summary ?? null,
    sweepSummary: sweepSummary?.summary ?? null,
    spoilerCount: spoilerFindings?.length ?? 0,
    artifactPaths: paths,
    checks,
  };
}

const results = [];

console.log("=== Harbor Eval Studio pipeline smoke ===\n");
console.log(`Base: ${BASE}`);
console.log(`Artifacts before: ${workspace.artifacts.length}\n`);

// 1. Weakness / intake
console.log("1/7 /weakness ...");
const w = await runAgent(
  `/weakness\n${WEAKNESS_PROMPT}`,
  { timeoutMs: 180_000 },
);
const weaknessCard = workspace.artifacts.some(
  (a) => a.path.includes("weakness") || a.content?.includes("hypothesis"),
);
results.push(
  summarizeStep("/weakness", w, [
    {
      name: "no_error",
      pass: w.errors?.length === 0,
    },
    {
      name: "intake_or_weakness_artifact",
      pass:
        weaknessCard ||
        w.toolCalls?.some((t) =>
          ["intake_workflow", "propose_weakness_card"].includes(
            t.call?.name ?? t.name,
          ),
        ),
    },
  ]),
);

// 2. Probe
console.log("2/7 /probe (5 variants x 5 trials) ...");
const p = await runAgent("/probe", { timeoutMs: 600_000 });
const probeEv = p.events?.find((e) => e.type === "probe_summary");
results.push(
  summarizeStep("/probe", p, [
    { name: "probe_summary_sse", pass: Boolean(probeEv?.summary) },
    {
      name: "run_probe_tool",
      pass: p.toolCalls?.some((t) =>
        (t.call?.name ?? t.name) === "run_probe_variants",
      ),
    },
  ]),
);

// 3. Scaffold
console.log("3/7 /scaffold ...");
const s = await runAgent("/scaffold", { timeoutMs: 300_000 });
const hasInstruction = workspace.artifacts.some((a) =>
  a.path.endsWith("instruction.md"),
);
const hasTaskToml = workspace.artifacts.some((a) =>
  a.path.endsWith("task.toml"),
);
results.push(
  summarizeStep("/scaffold", s, [
    { name: "instruction.md", pass: hasInstruction },
    { name: "task.toml", pass: hasTaskToml },
  ]),
);

// 4. Fixtures
console.log("4/7 /fixtures ...");
const f = await runAgent("/fixtures", { timeoutMs: 300_000 });
const dataFiles = workspace.artifacts.filter((a) =>
  a.path.includes("environment/data"),
);
results.push(
  summarizeStep("/fixtures", f, [
    {
      name: "environment/data files",
      pass: dataFiles.length > 0,
    },
  ]),
);

// 5. Lint
console.log("5/7 /lint ...");
const l = await runAgent("/lint instruction.md", { timeoutMs: 120_000 });
results.push(
  summarizeStep("/lint", l, [
    {
      name: "lint_spoilers tool",
      pass: l.toolCalls?.some((t) =>
        (t.call?.name ?? t.name) === "lint_spoilers",
      ),
    },
  ]),
);

// 6a. Sweep oracle
console.log("6a/7 /sweep oracle ...");
const so = await runAgent("/sweep oracle", { timeoutMs: 600_000 });
const sweepOracle = so.events?.find((e) => e.type === "sweep_summary");
results.push(
  summarizeStep("/sweep oracle", so, [
    {
      name: "sweep_summary",
      pass: Boolean(sweepOracle?.summary),
    },
  ]),
);

// 6b. Sweep nop
console.log("6b/7 /sweep nop ...");
const sn = await runAgent("/sweep nop", { timeoutMs: 600_000 });
const sweepNop = sn.events?.find((e) => e.type === "sweep_summary");
results.push(
  summarizeStep("/sweep nop", sn, [
    {
      name: "sweep_summary",
      pass: Boolean(sweepNop?.summary),
    },
  ]),
);

// 7. Publish
console.log("7/7 POST /api/publish validate:false ...");
const pub = await runPublish();
results.push({
  step: "POST /api/publish",
  command: "POST /api/publish validate:false",
  durationSec: (pub.durationMs / 1000).toFixed(1),
  success: pub.ok,
  httpStatus: pub.status,
  eventKinds: pub.eventKinds ?? [],
  events: pub.events?.slice(-5),
  errors: pub.error ? [pub.error.slice(0, 300)] : [],
});

const report = {
  timestamp: new Date().toISOString(),
  base: BASE,
  finalArtifactCount: workspace.artifacts.length,
  artifactPaths: workspace.artifacts.map((a) => a.path),
  steps: results,
};

const outPath = "/tmp/harbor-smoke-report.json";
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport written to ${outPath}`);
console.log(JSON.stringify(report, null, 2));
