import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

function which(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [bin], { env: process.env });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => {
      resolve(code === 0 && output.trim().length > 0);
    });
  });
}

function harborAuthStatus(): Promise<boolean> {
  const harborBin = process.env.HARBOR_BIN ?? "harbor";
  return new Promise((resolve) => {
    const child = spawn(harborBin, ["auth", "status"], { env: process.env });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export async function GET() {
  const harborBinName = process.env.HARBOR_BIN ?? "harbor";
  const publishTarget = (process.env.PUBLISH_TARGET ?? "registry").trim() as
    | "registry"
    | "github"
    | "both";

  const [harborBin, ghCli, harborAuth] = await Promise.all([
    which(harborBinName),
    which("gh"),
    harborAuthStatus(),
  ]);

  return NextResponse.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()),
    harborBin,
    harborBinName,
    harborAuth,
    harborPublishOrg: process.env.HARBOR_PUBLISH_ORG?.trim() ?? null,
    ghCli,
    publishOwner: process.env.HARBOR_PUBLISH_OWNER?.trim() ?? null,
    publishTarget,
  });
}
