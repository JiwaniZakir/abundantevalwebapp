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

export async function GET() {
  const harborBinName = process.env.HARBOR_BIN ?? "harbor";
  const [harborBin, ghCli] = await Promise.all([which(harborBinName), which("gh")]);

  return NextResponse.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    harborBin,
    harborBinName,
    ghCli,
    publishOwner: process.env.HARBOR_PUBLISH_OWNER ?? null,
  });
}
