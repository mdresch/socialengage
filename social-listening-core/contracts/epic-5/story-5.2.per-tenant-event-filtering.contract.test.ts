// Contract: Story 5.2 (ADR-0013) — per-tenant event filtering via Service Bus
// subscription SQL filters on tenantId.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-52--per-tenant-event-filtering-via-service-bus-subscription-rules
//
// Intent: Story 5.2 — Per-tenant event filtering via Service Bus subscription rules (ADR-0013)
// Scope: src/events/serviceBusPublisher.ts (new — real ServiceBusClient publish
// path, tenantId set as a Service Bus application property, not only in the
// payload — ADR-0013's Clarification)
// Contract to encode, against the real social-listening-dev namespace/
// social-listening-events topic (this repo's established pattern — real
// Azure resources, not mocks, same as Story 5.3's live Key Vault): (1) a
// published event carries tenantId as a Service Bus application property,
// readable without deserializing the body; (2) a subscription with a SQL
// filter on tenantId receives events only for the matching tenant — proven
// by publishing events for two tenants and reading from a single-tenant-
// scoped subscription; (3) adding a second, differently-scoped subscription
// to the same topic requires no change to publishEvent() at all — proven by
// reusing the exact same publish calls from (2) against a second subscription
// created with a different tenantId filter, receiving only its own tenant's
// event.
// Explicitly out of scope: schemaVersion as an application property (Story
// 5.5, ADR-0019 — separate story, not folded in here even though the same
// namespace now unblocks it too); the event *content* shapes themselves
// (Story 5.1's own contract already covers buildSocialPostIngestedEvent()/
// buildConnectorHealthChangedEvent()) — this contract only proves the
// transport-level tenantId property and SQL-filter delivery guarantee.

import { randomUUID } from 'crypto';
import { ServiceBusClient, ServiceBusAdministrationClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { publishEvent, TOPIC_NAME, namespaceHost } from '../../src/events/serviceBusPublisher';

// Generous timeout: real Service Bus management (ATOM) calls plus cold AMQP
// connection setup for sender/receiver can take longer than typical DB-backed
// contracts, especially against a namespace's first-ever use in a session.
jest.setTimeout(120000);

const credential = new DefaultAzureCredential();
const adminClient = new ServiceBusAdministrationClient(namespaceHost(), credential);
const sbClient = new ServiceBusClient(namespaceHost(), credential);

async function createTenantFilteredSubscription(subscriptionName: string, tenantId: string): Promise<void> {
  await adminClient.createSubscription(TOPIC_NAME, subscriptionName, {
    defaultRuleOptions: {
      name: 'tenant-filter',
      filter: {
        sqlExpression: 'tenantId = @tenantId',
        sqlParameters: { '@tenantId': tenantId },
      },
    },
    // Short-lived: this test's own subscriptions, deleted in afterEach — a
    // TTL is a safety net if cleanup itself fails mid-run.
    autoDeleteOnIdle: 'PT10M',
  });
}

describe('Story 5.2 — per-tenant event filtering contract', () => {
  const createdSubscriptions: string[] = [];

  afterEach(async () => {
    while (createdSubscriptions.length > 0) {
      const name = createdSubscriptions.pop() as string;
      await adminClient.deleteSubscription(TOPIC_NAME, name).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await sbClient.close();
  });

  it('AC1: a published event carries tenantId as a Service Bus application property', async () => {
    const tenantId = randomUUID();
    const subscriptionName = `test-ac1-${randomUUID()}`;
    // Scoped to this test's own tenantId purely for delivery isolation against
    // the shared real topic — not testing filtering itself (AC2/AC3 do that).
    // Without this, a message published by another contract file running
    // concurrently in a different Jest worker could land here instead.
    await createTenantFilteredSubscription(subscriptionName, tenantId);
    createdSubscriptions.push(subscriptionName);

    await publishEvent(tenantId, { hello: 'world' });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const [message] = await receiver.receiveMessages(1, { maxWaitTimeInMs: 20000 });
      expect(message).toBeDefined();
      expect(message.applicationProperties?.tenantId).toBe(tenantId);
    } finally {
      await receiver.close();
    }
  });

  it('AC2: a tenantId-SQL-filtered subscription receives only the matching tenant\'s events', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const subscriptionName = `test-ac2-${randomUUID()}`;
    await createTenantFilteredSubscription(subscriptionName, tenantA);
    createdSubscriptions.push(subscriptionName);

    await publishEvent(tenantA, { for: 'tenantA' });
    await publishEvent(tenantB, { for: 'tenantB' });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const messages = await receiver.receiveMessages(2, { maxWaitTimeInMs: 20000 });
      expect(messages).toHaveLength(1);
      expect(messages[0].applicationProperties?.tenantId).toBe(tenantA);
      expect((messages[0].body as { for: string }).for).toBe('tenantA');
    } finally {
      await receiver.close();
    }
  });

  it('AC3: a second, differently-scoped subscription requires no change to publishEvent() — same publish calls, different filter', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const subscriptionForB = `test-ac3-${randomUUID()}`;
    await createTenantFilteredSubscription(subscriptionForB, tenantB);
    createdSubscriptions.push(subscriptionForB);

    // Same two publishEvent() calls AC2 already exercised for a different
    // subscription's filter — nothing about the publisher changes here.
    await publishEvent(tenantA, { for: 'tenantA' });
    await publishEvent(tenantB, { for: 'tenantB' });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionForB);
    try {
      const messages = await receiver.receiveMessages(2, { maxWaitTimeInMs: 20000 });
      expect(messages).toHaveLength(1);
      expect(messages[0].applicationProperties?.tenantId).toBe(tenantB);
    } finally {
      await receiver.close();
    }
  });
});
