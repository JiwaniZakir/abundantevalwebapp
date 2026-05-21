import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    harborBin: Boolean(process.env.HARBOR_BIN ?? "harbor"),
    publishOwner: process.env.HARBOR_PUBLISH_OWNER ?? null,
  });
}
