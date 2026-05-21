import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "./providers";
import {
  emitCsv,
  emitJson,
  emitJsonl,
  emitMarkdown,
  emitPolicyText,
} from "@/lib/fixtures/emitters";
import type { Artifact } from "@/lib/agent/types";

export const fixtureSpecSchema = z.object({
  seed: z.number().int().default(42),
  categories: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9_]+$/),
        label: z.string(),
        purpose: z.enum(["clean", "trap", "bait", "authority"]),
        kind: z.enum(["csv", "json", "jsonl", "markdown", "policy_text"]),
        path: z.string().describe("Path relative to /root/data."),
        count: z.number().int().min(1).max(120),
        columns: z
          .array(z.string())
          .optional()
          .describe("CSV columns when kind=csv."),
        sampleRows: z
          .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
          .optional()
          .describe("Up to 5 sample rows demonstrating shape."),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export type FixtureSpec = z.infer<typeof fixtureSpecSchema>;

const fixtureSystemPrompt = `You produce a multimodal fixture spec for a Harbor eval task.

Hard rules:
- Each category has a clear operational purpose: clean rows, trap rows (hide among normals), bait artifacts (look like prior analyst drafts), authority artifacts (policy text the agent must consult).
- Bait/trap categories must NOT carry self-incriminating column names (no "is_trap", "wrong_value"). Use realistic columns.
- Authority artifacts use kind=policy_text or markdown.
- Provide at least one clean and one trap category, plus at least one authority artifact.
- File paths use kebab/snake-case under realistic subdirs.`;

export async function generateFixtureSpec({
  provider,
  modelSlug,
  weaknessTitle,
  deliverable,
  domain,
  categoriesHint,
}: {
  provider: string;
  modelSlug: string;
  weaknessTitle: string;
  deliverable: string;
  domain: string;
  categoriesHint: Array<{ name: string; count: number; description: string }>;
}): Promise<FixtureSpec> {
  const result = await generateObject({
    model: getAiModel(provider, modelSlug),
    schema: fixtureSpecSchema,
    system: fixtureSystemPrompt,
    prompt: `Domain: ${domain}\nDeliverable: ${deliverable}\nWeakness: ${weaknessTitle}\n\nSuggested categories from intake:\n${JSON.stringify(categoriesHint, null, 2)}\n\nReturn a complete fixture spec.`,
  });
  return result.object;
}

function nudgeNumber(seed: number, salt: number) {
  const value = Math.sin(seed + salt) * 10_000;
  return Math.abs(value - Math.floor(value));
}

function fillRow(
  columns: string[],
  sample: Record<string, string | number | boolean> | undefined,
  seed: number,
  rowIndex: number,
): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {};
  for (const column of columns) {
    if (sample && sample[column] !== undefined) {
      const value = sample[column];
      if (typeof value === "number") {
        row[column] = Math.round((value + nudgeNumber(seed, rowIndex + column.length) * value * 0.1) * 100) / 100;
      } else if (typeof value === "boolean") {
        row[column] = value;
      } else {
        row[column] = `${value}-${rowIndex + 1}`;
      }
    } else {
      row[column] = `${column}-${rowIndex + 1}`;
    }
  }
  return row;
}

export function materializeFixtures(spec: FixtureSpec): Artifact[] {
  const seed = spec.seed ?? 42;
  const now = Date.now();
  const artifacts: Artifact[] = [];

  for (const category of spec.categories) {
    const path = category.path.replace(/^\/+/, "");
    const fullPath = path.startsWith("environment/data/")
      ? path
      : `environment/data/${path}`;

    let content = "";
    let kind: Artifact["kind"];
    const sampleRows = category.sampleRows ?? [];
    const columns = category.columns ?? Object.keys(sampleRows[0] ?? { id: "id" });

    switch (category.kind) {
      case "csv": {
        const rows = Array.from({ length: category.count }, (_, idx) =>
          fillRow(columns, sampleRows[idx % Math.max(1, sampleRows.length)], seed, idx),
        );
        content = emitCsv(rows);
        kind = "csv";
        break;
      }
      case "jsonl": {
        const rows = Array.from({ length: category.count }, (_, idx) =>
          fillRow(columns, sampleRows[idx % Math.max(1, sampleRows.length)], seed, idx),
        );
        content = emitJsonl(rows);
        kind = "json";
        break;
      }
      case "json": {
        const rows = Array.from({ length: category.count }, (_, idx) =>
          fillRow(columns, sampleRows[idx % Math.max(1, sampleRows.length)], seed, idx),
        );
        content = emitJson({ category: category.slug, records: rows });
        kind = "json";
        break;
      }
      case "markdown": {
        content = emitMarkdown(
          category.label,
          category.notes ??
            `Operational background for ${category.label}. Generated for ${category.purpose} rows.`,
        );
        kind = "markdown";
        break;
      }
      case "policy_text": {
        content = emitPolicyText({
          title: category.label,
          version: "v3.0",
          body:
            category.notes ??
            `Policy body describing the operational invariants for ${category.label}. The deliverable must respect this policy.`,
        });
        kind = "markdown";
        break;
      }
    }

    artifacts.push({
      path: fullPath,
      kind,
      badge: category.purpose,
      content,
      updatedAt: now,
      dirty: true,
    });
  }

  return artifacts;
}
