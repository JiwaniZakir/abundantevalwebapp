/** Normalize Gemini / loose JSON into shapes Zod can validate. */

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function deepParseJsonStrings(value: unknown): unknown {
  const parsed = parseMaybeJson(value);
  if (parsed !== value) return deepParseJsonStrings(parsed);

  if (Array.isArray(parsed)) {
    return parsed.map((item) => deepParseJsonStrings(item));
  }

  if (parsed && typeof parsed === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      out[key] = deepParseJsonStrings(entry);
    }
    return out;
  }

  return parsed;
}

export function coerceStringArray(value: unknown): string[] {
  const parsed = deepParseJsonStrings(value);
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      if (typeof item === "string") return [item.trim()].filter(Boolean);
      if (item && typeof item === "object" && "name" in item) {
        return [String((item as { name: unknown }).name).trim()].filter(Boolean);
      }
      if (item && typeof item === "object" && "path" in item) {
        return [String((item as { path: unknown }).path).trim()].filter(Boolean);
      }
      return [];
    });
  }
  if (typeof parsed === "string") {
    return parsed
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function coerceCount(raw: unknown, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(120, Math.max(1, Math.round(raw)));
  }
  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    if (match) return Math.min(120, Math.max(1, parseInt(match[0], 10)));
  }
  return fallback;
}

export function coerceWorkflowFixtureCategory(item: unknown): {
  name: string;
  count: number;
  description: string;
} {
  const parsed = deepParseJsonStrings(item);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const row = parsed as Record<string, unknown>;
    const name = String(row.name ?? row.slug ?? row.category ?? row.label ?? "baseline").trim();
    return {
      name: name || "baseline",
      count: coerceCount(row.count ?? row.rows ?? row.size ?? row.n, 12),
      description: String(
        row.description ?? row.desc ?? row.note ?? row.purpose ?? "Representative operational rows.",
      ).trim(),
    };
  }

  if (typeof parsed === "string") {
    const text = parsed.trim();
    const countMatch = text.match(/(\d+)\s*(?:rows?|records?|items?)?/i);
    const nameMatch = text.match(/^([^:,\-\n]+)/);
    const afterDash = text.includes("—")
      ? text.split("—").slice(1).join("—").trim()
      : text.includes("-")
        ? text.split("-").slice(1).join("-").trim()
        : "";
    return {
      name: (nameMatch?.[1] ?? text).trim() || "baseline",
      count: countMatch ? coerceCount(countMatch[1], 12) : 12,
      description: afterDash || "Representative operational rows.",
    };
  }

  return { name: "baseline", count: 12, description: "Representative operational rows." };
}

export function coerceWorkflowFixtureCategories(value: unknown): Array<{
  name: string;
  count: number;
  description: string;
}> {
  const parsed = deepParseJsonStrings(value);
  if (!parsed) {
    return [
      { name: "clean_rows", count: 12, description: "Unambiguous rows." },
      { name: "edge_rows", count: 12, description: "Rows that stress reconciliation." },
    ];
  }

  if (Array.isArray(parsed)) {
    const items = parsed.map(coerceWorkflowFixtureCategory);
    return items.length > 0 ? items : coerceWorkflowFixtureCategories(null);
  }

  if (typeof parsed === "string") {
    return coerceStringArray(parsed).map((name) =>
      coerceWorkflowFixtureCategory(name),
    );
  }

  return coerceWorkflowFixtureCategories(null);
}

const FIXTURE_PURPOSES = ["clean", "trap", "bait", "authority"] as const;
const FIXTURE_KINDS = ["csv", "json", "jsonl", "markdown", "policy_text"] as const;

function normalizeEnum<T extends readonly string[]>(
  raw: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = String(raw ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

export function coerceFixtureSpecCategory(item: unknown): Record<string, unknown> {
  const parsed = deepParseJsonStrings(item);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const row = parsed as Record<string, unknown>;
    const slug = String(row.slug ?? row.name ?? row.id ?? "category").trim();
    return {
      slug,
      label: String(row.label ?? row.name ?? slug).trim(),
      purpose: normalizeEnum(row.purpose ?? row.type, FIXTURE_PURPOSES, "clean"),
      kind: normalizeEnum(row.kind ?? row.format, FIXTURE_KINDS, "csv"),
      path: String(row.path ?? `environment/data/${slug}.csv`).trim(),
      count: coerceCount(row.count ?? row.rows, 12),
      columns: row.columns,
      sampleRows: row.sampleRows ?? row.samples ?? row.rows,
      notes: row.notes ?? row.description,
    };
  }

  if (typeof parsed === "string") {
    const slug = parsed
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    return {
      slug: slug || "category",
      label: parsed.trim(),
      purpose: "clean",
      kind: "csv",
      path: `environment/data/${slug || "category"}.csv`,
      count: 12,
    };
  }

  return {
    slug: "category",
    label: "Category",
    purpose: "clean",
    kind: "csv",
    path: "environment/data/category.csv",
    count: 12,
  };
}

export function coerceFixtureSpecCategories(value: unknown): Record<string, unknown>[] {
  const parsed = deepParseJsonStrings(value);
  if (Array.isArray(parsed)) {
    return parsed.map(coerceFixtureSpecCategory);
  }
  if (parsed && typeof parsed === "object") {
    return [coerceFixtureSpecCategory(parsed)];
  }
  return [coerceFixtureSpecCategory("baseline")];
}

export function coerceSampleRows(value: unknown): Record<string, string | number | boolean>[] | undefined {
  const parsed = deepParseJsonStrings(value);
  if (!parsed) return undefined;
  if (Array.isArray(parsed)) {
    return parsed
      .map((row) => {
        const r = deepParseJsonStrings(row);
        if (r && typeof r === "object" && !Array.isArray(r)) {
          const out: Record<string, string | number | boolean> = {};
          for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
              out[k] = v;
            } else if (v != null) {
              out[k] = String(v);
            }
          }
          return out;
        }
        return null;
      })
      .filter((row): row is Record<string, string | number | boolean> => row !== null);
  }
  return undefined;
}
