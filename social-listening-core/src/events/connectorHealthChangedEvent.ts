export interface ConnectorHealthChangedEvent {
  tenantId: string;
  platformId: string;
  previousStatus: string;
  newStatus: string;
  occurredAt: string;
}

export interface BuildConnectorHealthChangedEventInput {
  tenantId: string;
  platformId: string;
  previousStatus: string;
  newStatus: string;
  occurredAt?: string;
}

/**
 * Constructs a ConnectorHealthChangedEvent — only status-transition fields
 * (ADR-0012). Pure — no Service Bus call; see
 * .claude/skills/ingestion-events/SKILL.md.
 */
export function buildConnectorHealthChangedEvent(
  input: BuildConnectorHealthChangedEventInput
): ConnectorHealthChangedEvent {
  return {
    tenantId: input.tenantId,
    platformId: input.platformId,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}
