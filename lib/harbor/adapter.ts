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

export type HarborMultiTrialResult = {
  trials: HarborTrialResult[];
  passCount: number;
  total: number;
  passAtK: string;
};

export async function runHarborTrials({
  taskDir,
  agent,
  model,
  trialCount = 1,
  logsDir = "logs",
  onLog,
  onTrialComplete,
}: HarborTrialArgs & {
  trialCount?: number;
  onTrialComplete?: (idx: number, result: HarborTrialResult) => void;
}): Promise<HarborMultiTrialResult> {
  const trials: HarborTrialResult[] = [];
  let passCount = 0;

  for (let idx = 0; idx < trialCount; idx++) {
    const result = await runHarborTrial({
      taskDir,
      agent,
      model,
      logsDir,
      onLog,
    });
    trials.push(result);
    if (result.reward === 1) passCount++;
    onTrialComplete?.(idx + 1, result);
  }

  return {
    trials,
    passCount,
    total: trialCount,
    passAtK: `${passCount}/${trialCount}`,
  };
}

export async function runHarborTrial({
  taskDir,
  agent,
  model,
  logsDir = "logs",
  onLog,
}: HarborTrialArgs): Promise<HarborTrialResult> {
  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  const args = ["run", "-p", taskDir, "-a", agent];

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
  const base = process.cwd();
  return match
    ? /* turbopackIgnore: true */ path.join(base, match[0])
    : /* turbopackIgnore: true */ path.join(base, logsDir);
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
