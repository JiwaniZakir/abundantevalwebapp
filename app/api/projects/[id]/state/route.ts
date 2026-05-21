import { NextResponse } from "next/server";
import { getSession } from "@/lib/db/sessions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: session.id,
      name: session.name,
      snapshot: session.snapshot,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "database unavailable" },
      { status: 503 },
    );
  }
}
