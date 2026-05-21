import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { materializeWorkspace } from "./materialize";
import { runHarborTrial } from "./adapter";
import { validateTaskPack } from "./validate-task";
import { harborTaskId } from "./task-toml";
import type { WorkspaceState } from "@/lib/agent/types";

export type PublishStage =
  | { kind: "status"; stage: string; message: string }
  | { kind: "files"; files: string[] }
  | { kind: "validation"; oracleReward: number | null; nopReward: number | null }
  | { kind: "log"; line: string }
  | {
      kind: "publish";
      registryRef: string;
      registryUrl: string;
      repoUrl?: string;
      defaultBranch?: string;
    }
  | { kind: "error"; message: string }
  | { kind: "done" };

export type PublishOptions = {
  workspace: WorkspaceState;
  slug: string;
  description: string;
  visibility?: "public" | "private";
  validate?: boolean;
  exportToGitHub?: boolean;
};

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  onLog?: (line: string) => void,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onLog?.(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onLog?.(text);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function ensureHarborAuth(): Promise<{ ok: boolean; detail: string }> {
  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  try {
    const result = await runCommand(harborBin, ["auth", "status"], process.cwd());
    if (result.code === 0) return { ok: true, detail: result.stdout.trim() };
    return { ok: false, detail: result.stderr.trim() || result.stdout.trim() };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureGhAuth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const result = await runCommand("gh", ["auth", "status"], process.cwd());
    if (result.code === 0) return { ok: true, detail: result.stdout.trim() };
    return { ok: false, detail: result.stderr.trim() || result.stdout.trim() };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function publishTargetMode() {
  return (process.env.PUBLISH_TARGET ?? "registry").trim() as
    | "registry"
    | "github"
    | "both";
}

export async function* publishTaskPack(
  options: PublishOptions,
): AsyncGenerator<PublishStage> {
  const { workspace, slug, description, validate = true } = options;
  const visibility = options.visibility ?? "public";
  const mode = publishTargetMode();
  const exportToGitHub =
    options.exportToGitHub ?? (mode === "github" || mode === "both");
  const publishRegistry = mode === "registry" || mode === "both";
  const org = process.env.HARBOR_PUBLISH_ORG?.trim();
  const harborBin = process.env.HARBOR_BIN ?? "harbor";

  if (publishRegistry) {
    const harborAuth = await ensureHarborAuth();
    if (!harborAuth.ok) {
      yield {
        kind: "error",
        message: `Harbor CLI not authenticated. Run 'harbor auth login'. Detail: ${harborAuth.detail.slice(0, 240)}`,
      };
      yield { kind: "done" };
      return;
    }
    if (!org) {
      yield {
        kind: "error",
        message:
          "Set HARBOR_PUBLISH_ORG in .env.local (e.g. your Harbor org name) before publishing to the registry.",
      };
      yield { kind: "done" };
      return;
    }
  }

  if (exportToGitHub) {
    const ghAuth = await ensureGhAuth();
    if (!ghAuth.ok) {
      yield {
        kind: "error",
        message: `gh CLI not authenticated for GitHub export. Run 'gh auth login'. Detail: ${ghAuth.detail.slice(0, 240)}`,
      };
      yield { kind: "done" };
      return;
    }
  }

  yield { kind: "status", stage: "materialize", message: "Writing canonical task pack" };

  const tempRoot = await mkdtemp(path.join(tmpdir(), "harbor-publish-"));
  let taskDir = path.join(tempRoot, slug);

  try {
    const { taskDir: writtenDir, files } = await materializeWorkspace({
      workspace,
      destDir: tempRoot,
      taskSlug: slug,
    });
    taskDir = writtenDir;
    yield { kind: "files", files };

    const packValidation = await validateTaskPack(taskDir);
    if (!packValidation.ok) {
      yield {
        kind: "error",
        message: `Task pack validation failed: ${packValidation.errors.join("; ")}`,
      };
      yield { kind: "done" };
      return;
    }

    if (validate) {
      yield { kind: "status", stage: "validate-oracle", message: "Running oracle trial" };
      let oracleReward: number | null = null;
      let nopReward: number | null = null;
      try {
        const oracleResult = await runHarborTrial({
          taskDir,
          agent: "oracle",
          onLog: () => {},
        });
        oracleReward = oracleResult.reward;
      } catch (error) {
        yield {
          kind: "log",
          line: `oracle error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      yield { kind: "status", stage: "validate-nop", message: "Running nop trial" };
      try {
        const nopResult = await runHarborTrial({
          taskDir,
          agent: "nop",
          onLog: () => {},
        });
        nopReward = nopResult.reward;
      } catch (error) {
        yield {
          kind: "log",
          line: `nop error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      yield { kind: "validation", oracleReward, nopReward };

      if (oracleReward !== 1 || nopReward !== 0) {
        yield {
          kind: "error",
          message: `Validation blocked publish: oracle reward = ${oracleReward ?? "?"}, nop reward = ${nopReward ?? "?"}. Required: oracle = 1, nop = 0.`,
        };
        yield { kind: "done" };
        return;
      }
    }

    const registryRef = harborTaskId(slug, org);
    let registryUrl = `https://hub.harborframework.com/${registryRef}`;
    let repoUrl: string | undefined;

    if (publishRegistry) {
      yield {
        kind: "status",
        stage: "harbor-task-update",
        message: `Updating task package ${registryRef}`,
      };

      const taskUpdate = await runCommand(
        harborBin,
        ["task", "update", taskDir, "--org", org!, "--description", description, "--overwrite"],
        process.cwd(),
      );
      if (taskUpdate.code !== 0) {
        yield {
          kind: "error",
          message: `harbor task update failed: ${taskUpdate.stderr.trim() || taskUpdate.stdout.trim()}`,
        };
        yield { kind: "done" };
        return;
      }

      yield {
        kind: "status",
        stage: "harbor-publish",
        message: `Publishing to Harbor registry (${visibility})`,
      };

      const publishArgs = [
        "publish",
        taskDir,
        visibility === "public" ? "--public" : "--private",
      ];
      const publishResult = await runCommand(harborBin, publishArgs, process.cwd());
      if (publishResult.code !== 0) {
        yield {
          kind: "error",
          message: `harbor publish failed: ${publishResult.stderr.trim() || publishResult.stdout.trim()}`,
        };
        yield { kind: "done" };
        return;
      }

      const urlMatch = publishResult.stdout.match(/https:\/\/hub\.harborframework\.com\/[^\s]+/);
      if (urlMatch) registryUrl = urlMatch[0];
    }

    if (exportToGitHub) {
      yield {
        kind: "status",
        stage: "git-init",
        message: "Exporting to GitHub",
      };

      const gitInit = await runCommand("git", ["init", "-b", "main"], taskDir);
      if (gitInit.code !== 0) {
        yield { kind: "error", message: `git init failed: ${gitInit.stderr.trim()}` };
        yield { kind: "done" };
        return;
      }

      const gitAdd = await runCommand("git", ["add", "-A"], taskDir);
      if (gitAdd.code !== 0) {
        yield { kind: "error", message: `git add failed: ${gitAdd.stderr.trim()}` };
        yield { kind: "done" };
        return;
      }

      const gitCommit = await runCommand(
        "git",
        ["commit", "-m", "Initial Harbor task pack"],
        taskDir,
      );
      if (gitCommit.code !== 0) {
        yield {
          kind: "error",
          message: `git commit failed: ${gitCommit.stderr.trim() || gitCommit.stdout.trim()}`,
        };
        yield { kind: "done" };
        return;
      }

      const owner = process.env.HARBOR_PUBLISH_OWNER?.trim();
      const repoTarget = owner ? `${owner}/${slug}` : slug;

      yield {
        kind: "status",
        stage: "gh-create",
        message: `Creating GitHub repo (${visibility})`,
      };

      const repoArgs = [
        "repo",
        "create",
        repoTarget,
        visibility === "public" ? "--public" : "--private",
        "--source=.",
        "--remote=origin",
        "--push",
        "--description",
        description,
      ];

      const repoCreate = await runCommand("gh", repoArgs, taskDir);
      if (repoCreate.code !== 0) {
        yield {
          kind: "error",
          message: `gh repo create failed: ${repoCreate.stderr.trim() || repoCreate.stdout.trim()}`,
        };
        yield { kind: "done" };
        return;
      }

      const ghMatch = repoCreate.stdout.match(/https:\/\/github\.com\/[^\s]+/);
      repoUrl = ghMatch ? ghMatch[0] : repoCreate.stdout.trim();
    }

    yield {
      kind: "publish",
      registryRef,
      registryUrl,
      repoUrl,
      defaultBranch: repoUrl ? "main" : undefined,
    };
    yield { kind: "done" };
  } catch (error) {
    yield {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    yield { kind: "done" };
  } finally {
    try {
      await rm(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
