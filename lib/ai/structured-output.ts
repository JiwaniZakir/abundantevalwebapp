import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import { deepParseJsonStrings } from "./coerce-llm-json";

function preprocessRaw(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return deepParseJsonStrings(raw);
  }
  return deepParseJsonStrings(raw);
}

function parseWithSchema<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const preprocessed = preprocessRaw(raw);
  const parsed = schema.safeParse(preprocessed);
  if (parsed.success) return parsed.data;
  throw new Error(
    `Schema validation failed: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  );
}

export async function generateStructuredObject<T extends z.ZodTypeAny>({
  model,
  schema,
  system,
  prompt,
  schemaName,
}: {
  model: LanguageModel;
  schema: T;
  system: string;
  prompt: string;
  schemaName: string;
}): Promise<z.infer<T>> {
  try {
    const result = await generateObject({
      model,
      schema,
      schemaName,
      system,
      prompt,
      experimental_repairText: async ({ text }) => {
        try {
          const raw = JSON.parse(extractJsonPayload(text));
          parseWithSchema(schema, raw);
          return JSON.stringify(preprocessRaw(raw));
        } catch {
          return null;
        }
      },
    });
    return parseWithSchema(schema, result.object);
  } catch {
    const fallback = await generateText({
      model,
      system: `${system}\n\nRespond with a single JSON object only. No markdown fences or commentary. For array fields whose items are objects, return JSON objects (not strings) for each item.`,
      prompt,
    });

    const raw = JSON.parse(extractJsonPayload(fallback.text)) as unknown;
    return parseWithSchema(schema, raw);
  }
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);

  const arrayStart = raw.indexOf("[");
  const arrayEnd = raw.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) return raw.slice(arrayStart, arrayEnd + 1);

  return raw.trim();
}
