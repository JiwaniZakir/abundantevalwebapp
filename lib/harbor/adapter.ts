import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type HarborAgent = "oracle" | "nop" | "gemini-cli" | "claude-cli";

export type HarborTrialArgs = {
  taskDir: string;
  agent: HarborAgent;
  model?: string;
  logsDir?: string;
  onLog?: (chunk: string) => void;
};

export type HarborTrialResult = {
  reward: number;
  ctrf: unknown;
  trajectory: unknown;
  logPath: string;
};

export async function runHarborTrial({
  taskDir,
  agent,
  model,
  logsDir = "logs",
  onLog,
}: HarborTrialArgs): Promise<HarborTrialResult> {
  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  const args = ["run", "--task", taskDir, "-a", agent];

  if (model) {
    args.push("-m", model);
  }

  const child = spawn(harborBin, args, {
    cwd: process.cwd(),
    env: process.env,
  });

  let output = "";

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    output += text;
    onLog?.(text);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    output += text;
    onLog?.(text);
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`Harbor exited with ${exitCode}: ${output.slice(-1000)}`);
  }

  const runPath = inferRunPath(output, logsDir);

  return {
    reward: await readReward(runPath),
    ctrf: await readJson(path.join(runPath, "verifier", "ctrf.json")),
    trajectory:
      (await readJson(path.join(runPath, "agent", "trajectory.json")).catch(
        () => null,
      )) ??
      (await readJson(path.join(runPath, "agent", "gemini-cli.trajectory.jsonl")).catch(
        () => null,
      )),
    logPath: runPath,
  };
}

function inferRunPath(output: string, logsDir: string) {
  const match = output.match(/logs\/[^\s"']+/);
  return match ? path.resolve(match[0]) : path.resolve(logsDir);
}

async function readReward(runPath: string) {
  const rewardText = await readFile(
    path.join(runPath, "verifier", "reward.txt"),
    "utf8",
  );

  return Number.parseFloat(rewardText.trim());
}

async function readJson(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}
