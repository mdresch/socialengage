/**
 * Contract: Story 12.12 (ADR-0106, BRD-0106, FDD-0106) — Webhook management UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1212--webhook-management-ui-frontend
 * and docs/adr/0106-api-and-integrations-versioning-and-webhooks.md
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WebhookForm } from '../../src/components/webhooks/WebhookForm';
import { WebhooksView } from '../../src/components/webhooks/WebhooksView';
import type { WebhookSubscriptionItem } from '../../src/lib/core-client';

describe('Story 12.12 — Webhook management UI (frontend)', () => {
  const mockSubscriptions: WebhookSubscriptionItem[] = [
    {
      id: 'sub-1',
      tenant_id: 'tenant-123',
      url: 'https://api.example.com/webhooks/socialengage',
      secret: 'secret-key-1234567890',
      events: ['post.ingested', 'alert.triggered'],
      enabled: true,
      retry_count: 3,
      created_at: '2026-08-29T10:00:00Z',
      updated_at: '2026-08-29T10:00:00Z',
      last_delivery_status: 'success',
    },
    {
      id: 'sub-2',
      tenant_id: 'tenant-123',
      url: 'https://alerts.slack.com/hooks/xyz',
      secret: 'secret-slack-key',
      events: ['alert.triggered', 'connector.health.changed'],
      enabled: false,
      retry_count: 10,
      created_at: '2026-08-28T09:00:00Z',
      updated_at: '2026-08-28T09:00:00Z',
      last_delivery_status: 'failed',
    },
  ];

  describe('AC1: WebhookForm captures url, events, and secret', () => {
    it('renders form inputs for url, secret, and event checkboxes', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhookForm, {
          onSubmit: () => {},
          onCancel: () => {},
        })
      );

      expect(html).toContain('Endpoint URL *');
      expect(html).toContain('Secret (HMAC-SHA256 signing)');
      expect(html).toContain('post.ingested');
      expect(html).toContain('alert.triggered');
      expect(html).toContain('connector.health.changed');
      expect(html).toContain('Save Subscription');
    });

    it('renders pre-populated values when initialValues provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhookForm, {
          initialValues: {
            url: 'https://webhook.site/test-edit',
            secret: 'my-custom-secret',
            events: ['mention.threshold.crossed'],
          },
          onSubmit: () => {},
          onCancel: () => {},
        })
      );

      expect(html).toContain('https://webhook.site/test-edit');
      expect(html).toContain('my-custom-secret');
      expect(html).toContain('Edit Webhook Subscription');
    });
  });

  describe('AC2: WebhooksView lists active subscriptions', () => {
    it('displays list of active subscriptions with endpoint URLs and events', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhooksView, {
          initialSubscriptions: mockSubscriptions,
        })
      );

      expect(html).toContain('https://api.example.com/webhooks/socialengage');
      expect(html).toContain('https://alerts.slack.com/hooks/xyz');
      expect(html).toContain('post.ingested, alert.triggered');
      expect(html).toContain('+ Add Webhook');
    });

    it('renders empty state when no subscriptions exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhooksView, {
          initialSubscriptions: [],
        })
      );

      expect(html).toContain('No webhook subscriptions configured');
    });
  });

  describe('AC3: Delivery status and retry count visibility', () => {
    it('shows delivery status badge and retry count per subscription', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhooksView, {
          initialSubscriptions: mockSubscriptions,
        })
      );

      expect(html).toContain('Delivery: Success');
      expect(html).toContain('Delivery: Failed');
      expect(html).toContain('Retries: 3');
      expect(html).toContain('Retries: 10');
      expect(html).toContain('Disabled');
    });
  });

  describe('AC4: Test ping sample event dispatch', () => {
    it('renders test ping action buttons for subscriptions', () => {
      const html = renderToStaticMarkup(
        React.createElement(WebhooksView, {
          initialSubscriptions: mockSubscriptions,
        })
      );

      expect(html).toContain('⚡ Test Ping');
    });
  });
});
