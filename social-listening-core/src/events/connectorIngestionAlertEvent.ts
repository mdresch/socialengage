export type IngestionAlertType =
  | 'run_timed_out'
  | 'ingestion_stalled'
  | 'connector_failing'
  | 'reconnect_required'
  | 'connector_disabled';

export type AlertSeverity = 'warning' | 'critical';

export interface ConnectorIngestionAlertMetadata {
  consecutiveFailures?: number;
  lastAttemptAt?: string | null;
  lastSuccessfulFetchAt?: string | null;
  staleRunId?: string;
  [key: string]: unknown;
}

export interface ConnectorIngestionAlertEvent {
  tenantId: string;
  platformId: string;
  userId?: string;
  alertType: IngestionAlertType;
  severity: AlertSeverity;
  message: string;
  occurredAt: string;
  metadata: ConnectorIngestionAlertMetadata;
}

export interface BuildConnectorIngestionAlertEventInput {
  tenantId: string;
  platformId: string;
  userId?: string;
  alertType: IngestionAlertType;
  severity: AlertSeverity;
  message: string;
  occurredAt?: string;
  metadata?: ConnectorIngestionAlertMetadata;
}

/**
 * Story 1.16 (ADR-0070 §3) — Constructs a ConnectorIngestionAlertEvent.
 * Thin event for Service Bus publishing to notify operators and downstream
 * systems of ingestion timeouts, stalls, and critical circuit-breaker trips.
 */
export function buildConnectorIngestionAlertEvent(
  input: BuildConnectorIngestionAlertEventInput
): ConnectorIngestionAlertEvent {
  return {
    tenantId: input.tenantId,
    platformId: input.platformId,
    userId: input.userId,
    alertType: input.alertType,
    severity: input.severity,
    message: input.message,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}
