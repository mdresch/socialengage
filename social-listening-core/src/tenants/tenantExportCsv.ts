/**
 * ADR-0043 §4 — CSV rendering for a TenantExport, the caller's alternative
 * to raw JSON. One section per table (social_posts/authors/watchlists/
 * ingestion_runs), each its own header row + data rows, separated by a
 * `# sectionName` marker line — a nested-object export (raw_payload,
 * enrichment) has no single flat table shape, so a multi-section block is
 * the honest representation rather than forcing one.
 */
function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h])).join(','));
  }
  return lines.join('\n');
}

export function tenantExportToCsv(sections: Record<string, Record<string, unknown>[]>): string {
  const blocks: string[] = [];
  for (const [name, rows] of Object.entries(sections)) {
    blocks.push(`# ${name}\n${rowsToCsv(rows)}`);
  }
  return blocks.join('\n\n');
}
