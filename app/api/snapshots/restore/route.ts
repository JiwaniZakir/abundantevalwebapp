import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreSnapshot } from "@/lib/snapshot/git";

export const runtime = "nodejs";

const postSchema = z.object({
  tag: z.string().regex(/^snapshot\/[a-z0-9-]+/),
});

export async function POST(request: Request) {
  let body: { tag?: string } = {};
  try {
    body = (await request.json()) as { tag?: string };
  } catch {
    body = {};
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid tag" },
      { status: 400 },
    );
  }

  try {
    const result = await restoreSnapshot(parsed.data.tag);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "restore failed",
      },
      { status: 500 },
    );
  }
}
