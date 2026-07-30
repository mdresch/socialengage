// Contract: Story 5.5 (ADR-0019) — schemaVersion as a Service Bus application
// property on every published event.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-55--event-schema-versioning-via-service-bus-message-property
//
// Intent: Story 5.5 — Event schema versioning via Service Bus message property (ADR-0019)
// Scope: src/events/serviceBusPublisher.ts (publishEvent gains an optional
// schemaVersion parameter, defaulting to 1, set as an application property
// alongside tenantId — ADR-0019's Decision: the property is the authoritative
// signal, inspectable without deserializing the body, same mechanical reason
// tenantId already had to work this way for Story 5.2/ADR-0013)
// Contract to encode: (1) a published event carries schemaVersion=1 as a
// Service Bus application property when not specified; (2) publishing a body
// with an extra/different shape (simulating an additive payload change)
// still yields schemaVersion=1 — the version signal is independent of
// payload content, proving additive changes never accidentally bump it; (3)
// publishEvent can be called with an explicit schemaVersion (e.g. 2) and
// that exact value is what's set — the mechanism a future breaking-change
// dual-publish would use, proven directly rather than via a fabricated
// second real event type; (4) a subscription with a SQL filter on
// schemaVersion receives only messages carrying the matching version,
// without deserializing the body — mirrors Story 5.2's AC2 tenantId-filter
// contract, filtering on schemaVersion instead.
// Explicitly out of scope: an actual coordinated-cutover dual-publish of two
// *real* event shapes — no existing event type is undergoing a breaking
// change right now, so there is nothing concrete to dual-publish; ADR-0019
// itself frames "is coordinated cutover operationally realistic" as an open,
// decision-level question to revisit once a real subscriber exists, not an
// implementation default this story resolves. Mirroring schemaVersion into
// the JSON payload body (ADR-0019 calls this optional, the property is the
// source of truth) — not built, since no AC requires it.

import { randomUUID } from 'crypto';
import { ServiceBusClient, ServiceBusAdministrationClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { publishEvent, TOPIC_NAME, namespaceHost } from '../../src/events/serviceBusPublisher';

// Generous timeout — real Service Bus management + AMQP setup, same
// reasoning as Story 5.2's contract.
jest.setTimeout(120000);

const credential = new DefaultAzureCredential();
const adminClient = new ServiceBusAdministrationClient(namespaceHost(), credential);
const sbClient = new ServiceBusClient(namespaceHost(), credential);

describe('Story 5.5 — event schema versioning contract', () => {
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

  it('AC1: a published event carries schemaVersion=1 by default', async () => {
    const tenantId = randomUUID();
    const subscriptionName = `test-ac1-${randomUUID()}`;
    await adminClient.createSubscription(TOPIC_NAME, subscriptionName, { autoDeleteOnIdle: 'PT10M' });
    createdSubscriptions.push(subscriptionName);

    await publishEvent(tenantId, { hello: 'world' });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const [message] = await receiver.receiveMessages(1, { maxWaitTimeInMs: 20000 });
      expect(message).toBeDefined();
      expect(message.applicationProperties?.schemaVersion).toBe(1);
    } finally {
      await receiver.close();
    }
  });

  it('AC2: an additive (differently-shaped) payload body still yields schemaVersion=1', async () => {
    const tenantId = randomUUID();
    const subscriptionName = `test-ac2-${randomUUID()}`;
    await adminClient.createSubscription(TOPIC_NAME, subscriptionName, { autoDeleteOnIdle: 'PT10M' });
    createdSubscriptions.push(subscriptionName);

    // A body shape with an extra field, simulating an additive payload
    // change to an existing event type — schemaVersion must be unaffected.
    await publishEvent(tenantId, { hello: 'world', newOptionalField: 'anything' });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const [message] = await receiver.receiveMessages(1, { maxWaitTimeInMs: 20000 });
      expect(message).toBeDefined();
      expect(message.applicationProperties?.schemaVersion).toBe(1);
    } finally {
      await receiver.close();
    }
  });

  it('AC3: publishEvent() can emit an explicit schemaVersion — the mechanism a future breaking-change cutover would use', async () => {
    const tenantId = randomUUID();
    const subscriptionName = `test-ac3-${randomUUID()}`;
    await adminClient.createSubscription(TOPIC_NAME, subscriptionName, { autoDeleteOnIdle: 'PT10M' });
    createdSubscriptions.push(subscriptionName);

    await publishEvent(tenantId, { hello: 'world' }, { schemaVersion: 2 });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const [message] = await receiver.receiveMessages(1, { maxWaitTimeInMs: 20000 });
      expect(message).toBeDefined();
      expect(message.applicationProperties?.schemaVersion).toBe(2);
    } finally {
      await receiver.close();
    }
  });

  it('AC4: a schemaVersion-SQL-filtered subscription receives only messages carrying that version', async () => {
    const tenantId = randomUUID();
    const subscriptionName = `test-ac4-${randomUUID()}`;
    await adminClient.createSubscription(TOPIC_NAME, subscriptionName, {
      defaultRuleOptions: {
        name: 'schema-version-filter',
        filter: {
          sqlExpression: 'schemaVersion = @schemaVersion',
          sqlParameters: { '@schemaVersion': 2 },
        },
      },
      autoDeleteOnIdle: 'PT10M',
    });
    createdSubscriptions.push(subscriptionName);

    await publishEvent(tenantId, { version: 1 }, { schemaVersion: 1 });
    await publishEvent(tenantId, { version: 2 }, { schemaVersion: 2 });

    const receiver = sbClient.createReceiver(TOPIC_NAME, subscriptionName);
    try {
      const messages = await receiver.receiveMessages(2, { maxWaitTimeInMs: 20000 });
      expect(messages).toHaveLength(1);
      expect(messages[0].applicationProperties?.schemaVersion).toBe(2);
      expect((messages[0].body as { version: number }).version).toBe(2);
    } finally {
      await receiver.close();
    }
  });
});
