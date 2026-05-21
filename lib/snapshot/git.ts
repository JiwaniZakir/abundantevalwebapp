import { spawn } from "node:child_process";

export type SnapshotResult = {
  tag: string;
  commitCreated: boolean;
  pushedHead: boolean;
  pushedTag: boolean;
  warnings: string[];
};

function runGit(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const command = "git";
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

export type SnapshotEntry = {
  tag: string;
  createdAt: string;
  subject: string;
};

export async function listSnapshots(): Promise<SnapshotEntry[]> {
  const result = await runGit([
    "for-each-ref",
    "--sort=-creatordate",
    "--format=%(refname:short)\t%(creatordate:iso8601)\t%(subject)",
    "refs/tags/snapshot/*",
  ]);
  if (result.code !== 0) return [];

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => {
      const [tag, createdAt, subject = ""] = line.split("\t");
      return { tag, createdAt, subject };
    });
}

function slugify(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "snapshot";
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "z")
    .toLowerCase();
}

export async function restoreSnapshot(
  tag: string,
): Promise<{ tag: string; commitSha: string; clean: boolean }> {
  if (!/^snapshot\/[a-z0-9-]+/.test(tag)) {
    throw new Error("Refusing to restore a non-snapshot ref");
  }

  const status = await runGit(["status", "--porcelain"]);
  const clean = status.code === 0 && status.stdout.trim().length === 0;
  if (!clean) {
    throw new Error("Working tree has uncommitted changes. Create a snapshot first.");
  }

  const verify = await runGit(["rev-parse", "--verify", tag]);
  if (verify.code !== 0) {
    throw new Error(`Snapshot tag not found: ${tag}`);
  }
  const commitSha = verify.stdout.trim();

  const reset = await runGit(["reset", "--hard", tag]);
  if (reset.code !== 0) {
    throw new Error(`git reset failed: ${reset.stderr.trim()}`);
  }

  return { tag, commitSha, clean: true };
}

export async function createSnapshot(label: string): Promise<SnapshotResult> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error("Snapshot label required");
  }

  const tag = `snapshot/${timestamp()}-${slugify(trimmedLabel)}`;
  const message = `snapshot: ${trimmedLabel.replace(/"/g, "'")}`;
  const warnings: string[] = [];

  const status = await runGit(["status", "--porcelain"]);
  let commitCreated = false;
  if (status.code === 0 && status.stdout.trim().length > 0) {
    const add = await runGit(["add", "-A"]);
    if (add.code !== 0) {
      throw new Error(`git add failed: ${add.stderr.trim()}`);
    }
    const commit = await runGit(["commit", "-m", message]);
    if (commit.code !== 0) {
      throw new Error(`git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`);
    }
    commitCreated = true;
  }

  const tagResult = await runGit(["tag", "-a", tag, "-m", message]);
  if (tagResult.code !== 0) {
    throw new Error(`git tag failed: ${tagResult.stderr.trim() || tagResult.stdout.trim()}`);
  }

  const pushHead = await runGit(["push", "origin", "HEAD"]);
  const pushedHead = pushHead.code === 0;
  if (!pushedHead) {
    warnings.push(`push HEAD: ${pushHead.stderr.trim()}`);
  }

  const pushTag = await runGit(["push", "origin", tag]);
  const pushedTag = pushTag.code === 0;
  if (!pushedTag) {
    warnings.push(`push tag: ${pushTag.stderr.trim()}`);
  }

  return { tag, commitCreated, pushedHead, pushedTag, warnings };
}
