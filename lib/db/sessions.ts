import { desc, eq } from "drizzle-orm";
import { db } from "./client";
import { workspaceSessions } from "./schema";
import type { WorkbenchSnapshot } from "@/lib/workbench/types";

export type SessionRow = {
  id: string;
  name: string;
  snapshot: WorkbenchSnapshot;
  updatedAt: Date;
};

export async function listSessions(limit = 20): Promise<SessionRow[]> {
  const rows = await db
    .select()
    .from(workspaceSessions)
    .orderBy(desc(workspaceSessions.updatedAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    snapshot: row.snapshot as WorkbenchSnapshot,
    updatedAt: row.updatedAt,
  }));
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const rows = await db
    .select()
    .from(workspaceSessions)
    .where(eq(workspaceSessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    snapshot: row.snapshot as WorkbenchSnapshot,
    updatedAt: row.updatedAt,
  };
}

export async function upsertSession(input: {
  id?: string;
  name: string;
  snapshot: WorkbenchSnapshot;
}): Promise<SessionRow> {
  if (input.id) {
    const updated = await db
      .update(workspaceSessions)
      .set({
        name: input.name,
        snapshot: input.snapshot,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSessions.id, input.id))
      .returning();
    const row = updated[0];
    if (row) {
      return {
        id: row.id,
        name: row.name,
        snapshot: row.snapshot as WorkbenchSnapshot,
        updatedAt: row.updatedAt,
      };
    }
  }

  const inserted = await db
    .insert(workspaceSessions)
    .values({
      name: input.name,
      snapshot: input.snapshot,
    })
    .returning();
  const row = inserted[0];
  return {
    id: row.id,
    name: row.name,
    snapshot: row.snapshot as WorkbenchSnapshot,
    updatedAt: row.updatedAt,
  };
}

export async function getLatestSession(): Promise<SessionRow | null> {
  const rows = await listSessions(1);
  return rows[0] ?? null;
}
