export interface CsvColumn {
  readonly key: string;
  readonly header: string;
}

/**
 * Text that a spreadsheet would treat as a formula is prefixed with an apostrophe (CSV injection).
 * Numbers are left alone, so negative amounts stay numeric.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a header row and CRLF line endings. */
export function toCsv(rows: readonly Record<string, unknown>[], columns: readonly CsvColumn[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c.key])).join(","));
  return lines.join("\r\n");
}
