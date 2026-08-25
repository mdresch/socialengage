/**
 * Story 3.16 (ADR-0074) — flat, RFC 4180-ish CSV helper for the matched-posts
 * export. Built-in Node only; no external dependency added.
 */

export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: Record<string, unknown>[], headers: string[]): string {
  if (rows.length === 0) {
    return headers.join(',');
  }
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => formatCsvValue(row[h])).join(','));
  }
  return lines.join('\n');
}
