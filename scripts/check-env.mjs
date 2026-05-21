#!/usr/bin/env node
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../.env.local") });

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

const fileEnv = loadEnvFile(envPath);
const anthropic = Boolean((fileEnv.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY)?.trim());
const openai = Boolean((fileEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY)?.trim());
const google = Boolean(
  (fileEnv.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim(),
);
const harborBin = fileEnv.HARBOR_BIN ?? process.env.HARBOR_BIN ?? "harbor";
const harborOk = which(harborBin);
const ghOk = which("gh");
const publishOrg = (fileEnv.HARBOR_PUBLISH_ORG ?? process.env.HARBOR_PUBLISH_ORG)?.trim();
const publishTarget = (fileEnv.PUBLISH_TARGET ?? process.env.PUBLISH_TARGET ?? "registry").trim();

let harborAuth = false;
if (harborOk) {
  const auth = spawnSync(harborBin, ["auth", "status"], { encoding: "utf8" });
  harborAuth = auth.status === 0;
}

console.log("Harbor Eval Studio — environment check\n");
console.log(`  .env.local: ${existsSync(envPath) ? "found" : "MISSING (cp .env.example .env.local)"}`);
console.log(`  LLM keys:   anthropic=${anthropic} openai=${openai} google=${google}`);
console.log(`  harbor:     ${harborOk ? `ok (${harborBin})` : `MISSING (${harborBin})`}`);
console.log(`  harbor auth:${harborAuth ? " ok" : " needed (harbor auth login)"}`);
console.log(`  publish org:${publishOrg ? ` ${publishOrg}` : " unset (HARBOR_PUBLISH_ORG)"}`);
console.log(`  publish tgt:${publishTarget}`);
console.log(`  gh CLI:     ${ghOk ? "ok" : "MISSING"}`);

if (!anthropic && !openai && !google) {
  console.log("\nAdd at least one API key to .env.local, then restart npm run dev.");
  process.exit(1);
}

if (!harborOk) {
  console.log("\nWarning: harbor not on PATH — sweeps will fail until installed.");
}

if (!publishOrg && publishTarget !== "github") {
  console.log("\nWarning: set HARBOR_PUBLISH_ORG for registry publish.");
}

if (!harborAuth && publishTarget !== "github") {
  console.log("\nWarning: run harbor auth login for registry publish.");
}

if (!ghOk && (publishTarget === "github" || publishTarget === "both")) {
  console.log("\nWarning: gh not on PATH — GitHub export will fail until installed.");
} else if (ghOk) {
  const ghStatus = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  if (ghStatus.status !== 0) {
    console.log("\nWarning: gh is installed but not authenticated. Run: gh auth login");
  }
}

console.log("\nLive mode ready (restart dev server if you just edited .env.local).");
