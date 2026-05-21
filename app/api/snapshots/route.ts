import { NextResponse } from "next/server";
import { z } from "zod";
import { createSnapshot, listSnapshots } from "@/lib/snapshot/git";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshots = await listSnapshots();
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      {
        snapshots: [],
        error: error instanceof Error ? error.message : "list failed",
      },
      { status: 500 },
    );
  }
}

const postSchema = z.object({ label: z.string().min(1).max(120) });

export async function POST(request: Request) {
  let body: { label?: string } = {};
  try {
    body = (await request.json()) as { label?: string };
  } catch {
    body = {};
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing label" }, { status: 400 });
  }

  try {
    const result = await createSnapshot(parsed.data.label);
    const snapshots = await listSnapshots();
    return NextResponse.json({
      ok: true,
      log: `Snapshot saved: ${result.tag}`,
      result,
      snapshots,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "snapshot failed",
      },
      { status: 500 },
    );
  }
}
