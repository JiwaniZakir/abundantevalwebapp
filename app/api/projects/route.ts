import { NextResponse } from "next/server";
import { getLatestSession, listSessions, upsertSession } from "@/lib/db/sessions";
import type { WorkbenchSnapshot } from "@/lib/workbench/store";

export const runtime = "nodejs";

type PostBody = {
  id?: string;
  name?: string;
  snapshot?: WorkbenchSnapshot;
};

export async function GET() {
  try {
    const latest = await getLatestSession();
    const sessions = await listSessions(20);
    return NextResponse.json({ latest, sessions });
  } catch (error) {
    return NextResponse.json(
      {
        latest: null,
        sessions: [],
        error: error instanceof Error ? error.message : "database unavailable",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.snapshot) {
    return NextResponse.json({ error: "snapshot required" }, { status: 400 });
  }

  try {
    const row = await upsertSession({
      id: body.id,
      name: body.name ?? body.snapshot.workspace.projectName ?? "Untitled",
      snapshot: body.snapshot,
    });
    return NextResponse.json({ id: row.id, name: row.name, updatedAt: row.updatedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 503 },
    );
  }
}
