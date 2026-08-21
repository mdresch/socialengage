import { publishEvent } from './serviceBusPublisher';
import {
  buildConnectorIngestionAlertEvent,
  BuildConnectorIngestionAlertEventInput,
  ConnectorIngestionAlertEvent,
} from './connectorIngestionAlertEvent';

/**
 * Story 1.16 (ADR-0070 §3) — Publishes a ConnectorIngestionAlertEvent to Azure Service Bus.
 * Best-effort, never throws: downstream messaging transient failures must never halt
 * ingestion processing or scheduler execution.
 */
export async function publishConnectorAlertEvent(
  input: BuildConnectorIngestionAlertEventInput
): Promise<ConnectorIngestionAlertEvent | null> {
  const event = buildConnectorIngestionAlertEvent(input);
  try {
    await publishEvent(input.tenantId, event);
    return event;
  } catch (err) {
    console.error(
      `[ingestion-events] Failed to publish ConnectorIngestionAlertEvent (tenant=${input.tenantId} platform=${input.platformId} type=${input.alertType}):`,
      err
    );
    return null;
  }
}
