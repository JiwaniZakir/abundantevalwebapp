#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const rawLabel = (process.argv[2] ?? "").trim();
if (!rawLabel) {
  console.error('Usage: npm run snapshot -- "<label>"');
  process.exit(1);
}

const slug = rawLabel
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 48) || "snapshot";

const ts = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d+Z$/, "Z")
  .toLowerCase();

const tag = `snapshot/${ts}-${slug}`;
const message = `snapshot: ${rawLabel.replace(/"/g, "'")}`;

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    const stderr = (result.stderr ?? "").toString().trim();
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  }
  return result;
}

const status = git(["status", "--porcelain"]).stdout.toString().trim();
if (status) {
  git(["add", "-A"]);
  git(["commit", "-m", message]);
}

git(["tag", "-a", tag, "-m", message]);

const pushHead = git(["push", "origin", "HEAD"], { allowFailure: true });
if (pushHead.status !== 0) {
  console.warn("Warning: failed to push commit:", pushHead.stderr.toString().trim());
}

const pushTag = git(["push", "origin", tag], { allowFailure: true });
if (pushTag.status !== 0) {
  console.warn("Warning: failed to push tag:", pushTag.stderr.toString().trim());
}

console.log(`Snapshot saved: ${tag}`);
