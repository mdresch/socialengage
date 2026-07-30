/**
 * Retention windows (Story 3.5, ADR-0018) — configuration, not hardcoded
 * constants, so changing either is an operational change, not a code
 * change (ADR-0018's own explicit requirement). See
 * .claude/skills/data-retention-and-archival/SKILL.md.
 */
export function rawPayloadRetentionDays(): number {
  return Number(process.env.RAW_PAYLOAD_RETENTION_DAYS ?? 90);
}

export function ingestionRunRetentionMonths(): number {
  return Number(process.env.INGESTION_RUN_RETENTION_MONTHS ?? 18);
}
