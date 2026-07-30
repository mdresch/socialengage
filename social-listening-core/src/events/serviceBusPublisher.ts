import { ServiceBusClient, ServiceBusMessage } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';

export const TOPIC_NAME = 'social-listening-events';

/**
 * DefaultAzureCredential's chain includes AzureCliCredential, so local dev/test just
 * needs `az login` already done — no separate local credential setup, same as
 * keyVaultProvider.ts.
 */
export function namespaceHost(): string {
  return process.env.SERVICE_BUS_NAMESPACE ?? 'social-listening-dev.servicebus.windows.net';
}

export interface PublishEventOptions {
  /** Defaults to 1 (ADR-0019). Only a genuine breaking change to an existing event type's shape bumps this — additive fields never do. */
  schemaVersion?: number;
}

/**
 * Publishes an already-constructed thin event body (see
 * socialPostIngestedEvent.ts/connectorHealthChangedEvent.ts) to the shared
 * events topic, with tenantId and schemaVersion set as Service Bus
 * application properties — required for ADR-0013's per-tenant and
 * ADR-0019's per-version SQL subscription filters to evaluate them at all
 * (filters see message properties, not payload body content). See
 * .claude/skills/ingestion-events/SKILL.md.
 */
export async function publishEvent(
  tenantId: string,
  body: unknown,
  options: PublishEventOptions = {}
): Promise<void> {
  const client = new ServiceBusClient(namespaceHost(), new DefaultAzureCredential());
  try {
    const sender = client.createSender(TOPIC_NAME);
    try {
      const message: ServiceBusMessage = {
        body,
        applicationProperties: {
          tenantId,
          schemaVersion: options.schemaVersion ?? 1,
        },
      };
      await sender.sendMessages(message);
    } finally {
      await sender.close();
    }
  } finally {
    await client.close();
  }
}
