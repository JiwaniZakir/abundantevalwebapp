export type CsvRow = Record<string, string | number | boolean | null>;

export function emitCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function emitJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function emitJsonl(rows: unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

export function emitMarkdown(title: string, body: string): string {
  return `# ${title}\n\n${body.trim()}\n`;
}

export function emitPolicyText({
  title,
  version,
  body,
}: {
  title: string;
  version: string;
  body: string;
}): string {
  return `${title}\nVersion: ${version}\n\n${body.trim()}\n`;
}
