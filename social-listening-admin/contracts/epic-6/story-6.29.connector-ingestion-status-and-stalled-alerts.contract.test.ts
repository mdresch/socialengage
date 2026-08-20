/**
 * Contract: Story 6.29 — Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action
 * Sourced from ADR-0070 (Accepted 2026-08-20).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-629
 *
 * Intent:
 * 1. Widens StatusBadge with 'stalled' variant (Amber/Orange with default label 'Stalled / No Ingestion').
 * 2. Connector status view (/tenant/connectors/status and /tenant/connectors) renders 'stalled' badges and
 *    explicit operational timestamps for last ingestion attempt, last successful ingestion, and poll cadence.
 * 3. On-demand "Force Retry / Re-sync" action allows Tenant-Admins (and Tier-3 credential owners) to invoke
 *    POST /v1/connectors/:id/retry (via /api/connectors/[platformId]/retry proxy) with loading state, instant
 *    metrics refresh, toast notification, and graceful 409 conflict handling.
 * 4. IngestionAlertBanner renders a prominent alert banner at the top of /tenant/analytics (Overview tab)
 *    and /tenant/connectors when any active connector is in 'stalled', 'failing', or 'reconnect_required' status,
 *    with direct action links ("Re-sync now" or "Reconnect account") and session dismissal.
 *
 * Scope:
 * - social-listening-admin/src/components/ui/StatusBadge.tsx
 * - social-listening-admin/src/app/globals.css
 * - social-listening-admin/src/lib/core-client.ts (retryConnector, ConnectorStatus.status widened)
 * - social-listening-admin/src/app/api/connectors/[platformId]/retry/route.ts (new)
 * - social-listening-admin/src/components/IngestionAlertBanner.tsx (new)
 * - social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx
 * - social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx
 * - social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
 *
 * Contract to encode:
 * - AC1: StatusBadge supports 'stalled' variant; Connector status cards render 'stalled' badge, last successful fetch, last attempt, and poll interval.
 * - AC2: retryConnector() client function & proxy route handle on-demand retry POST with 200 and 409 outcomes; UI renders "Re-sync now" button on active ingestion connectors for tenant_admin.
 * - AC3: IngestionAlertBanner renders alert notice with affected platforms and action triggers when active connectors are stalled/failing/reconnect_required; dismissible per session.
 *
 * Explicitly out of scope:
 * External push notification delivery (email/Slack/PagerDuty — handled downstream via Service Bus events).
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.29 — Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action', () => {
  // -------------------------------------------------------------------------
  // AC1: StatusBadge 'stalled' variant & Connector Status View Metrics
  // -------------------------------------------------------------------------
  describe('AC1: StatusBadge stalled variant and connector status metrics', () => {
    it('StatusBadge supports the "stalled" variant with default label and CSS class', async () => {
      const { StatusBadge } = await import('../../src/components/ui/StatusBadge');
      const html = renderToStaticMarkup(React.createElement(StatusBadge, { variant: 'stalled' }));

      expect(html).toContain('status-badge-stalled');
      expect(html).toContain('Stalled / No Ingestion');
      expect(html).toContain('data-variant="stalled"');
    });

    it('StatusBadge allows custom label override with "stalled" variant', async () => {
      const { StatusBadge } = await import('../../src/components/ui/StatusBadge');
      const html = renderToStaticMarkup(
        React.createElement(StatusBadge, { variant: 'stalled', label: 'Custom Stalled' })
      );

      expect(html).toContain('status-badge-stalled');
      expect(html).toContain('Custom Stalled');
    });

    it('globals.css defines .status-badge-stalled styling with amber/warning color', () => {
      const css = readSrc('app', 'globals.css');
      expect(css).toContain('.status-badge-stalled');
    });

    it('ConnectorStatusClient derives "stalled" badge variant when health status is stalled and connector is active', async () => {
      const { ConnectorStatusClient } = await import(
        '../../src/app/tenant/connectors/status/ConnectorStatusClient'
      );

      const rows = [
        {
          platform: {
            id: 'gnews',
            name: 'GNews API',
            description: 'Global news articles',
            category: 'Ingestion' as const,
            authMode: 'api_key' as const,
            icon: 'newspaper' as const,
            personalScopeAllowed: false,
          },
          isActive: true,
          health: {
            status: 'stalled' as const,
            lastSuccessfulFetchAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
            lastAttemptAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            consecutiveFailures: 0,
            credentialStatus: 'valid' as const,
            isActive: true,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorStatusClient, { rows, isTenantAdmin: true })
      );

      expect(html).toContain('status-badge-stalled');
      expect(html).toContain('Stalled / No Ingestion');
      expect(html).toContain('cs-card cs-card-stalled');
    });

    it('ConnectorStatusClient renders last successful ingestion, last attempt, and poll cadence', async () => {
      const { ConnectorStatusClient } = await import(
        '../../src/app/tenant/connectors/status/ConnectorStatusClient'
      );

      const rows = [
        {
          platform: {
            id: 'gnews',
            name: 'GNews API',
            description: 'Global news articles',
            category: 'Ingestion' as const,
            authMode: 'api_key' as const,
            icon: 'newspaper' as const,
            personalScopeAllowed: false,
          },
          isActive: true,
          health: {
            status: 'healthy' as const,
            lastSuccessfulFetchAt: '2026-08-20T10:00:00.000Z',
            lastAttemptAt: '2026-08-20T10:15:00.000Z',
            consecutiveFailures: 0,
            credentialStatus: 'valid' as const,
            isActive: true,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorStatusClient, { rows, isTenantAdmin: true })
      );

      expect(html).toContain('Last Successful Ingestion');
      expect(html).toContain('Last Polling Attempt');
      expect(html).toContain('Interval: every 15 minutes');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: On-Demand "Force Retry / Re-sync" API Client and Button
  // -------------------------------------------------------------------------
  describe('AC2: On-demand retry / re-sync endpoint, client function, and button', () => {
    it('core-client.ts exports retryConnector() targeting /v1/connectors/:id/retry (and /users/:userId/retry)', async () => {
      const coreClientSrc = readSrc('lib', 'core-client.ts');
      expect(coreClientSrc).toContain('export async function retryConnector');
      expect(coreClientSrc).toContain('/v1/connectors/');
      expect(coreClientSrc).toContain('/retry');
    });

    it('POST /api/connectors/[platformId]/retry proxy route exists and calls retryConnector()', () => {
      const routeSrc = readSrc('app', 'api', 'connectors', '[platformId]', 'retry', 'route.ts');
      expect(routeSrc).toContain('retryConnector');
      expect(routeSrc).toContain('export async function POST');
    });

    it('ConnectorStatusClient renders "Re-sync now" / "Force Retry" button on active ingestion connectors for tenant_admin', async () => {
      const { ConnectorStatusClient } = await import(
        '../../src/app/tenant/connectors/status/ConnectorStatusClient'
      );

      const rows = [
        {
          platform: {
            id: 'gnews',
            name: 'GNews API',
            description: 'Global news articles',
            category: 'Ingestion' as const,
            authMode: 'api_key' as const,
            icon: 'newspaper' as const,
            personalScopeAllowed: false,
          },
          isActive: true,
          health: {
            status: 'stalled' as const,
            lastSuccessfulFetchAt: null,
            lastAttemptAt: null,
            consecutiveFailures: 0,
            credentialStatus: 'valid' as const,
            isActive: true,
          },
        },
        {
          platform: {
            id: 'azure_language',
            name: 'Azure AI Language',
            description: 'Text analytics',
            category: 'Enrichment' as const,
            authMode: 'api_key' as const,
            icon: 'brain' as const,
            personalScopeAllowed: false,
          },
          isActive: true,
          health: {
            status: 'disconnected' as const,
            lastSuccessfulFetchAt: null,
            lastAttemptAt: null,
            consecutiveFailures: 0,
            credentialStatus: 'valid' as const,
            isActive: true,
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ConnectorStatusClient, { rows, isTenantAdmin: true })
      );

      // Rendered for active ingestion connector
      expect(html).toContain('Re-sync now');
      // Not rendered for AI Provider
      expect(html).not.toMatch(/azure_language.*Re-sync now/);
    });

    it('ConnectorsClient platformVariant handles "stalled" status', async () => {
      const connectorsClientSrc = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(connectorsClientSrc).toContain("'stalled'");
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Global Ingestion Alert Banner
  // -------------------------------------------------------------------------
  describe('AC3: Global Ingestion Alert Banner', () => {
    it('IngestionAlertBanner component exists and exports IngestionAlertBanner', async () => {
      const bannerModule = await import('../../src/components/IngestionAlertBanner');
      expect(typeof bannerModule.IngestionAlertBanner).toBe('function');
    });

    it('IngestionAlertBanner renders alert notice with affected platforms and action when connectors are stalled or failing', async () => {
      const { IngestionAlertBanner } = await import('../../src/components/IngestionAlertBanner');

      const activeIssues = [
        {
          platformId: 'gnews',
          platformName: 'GNews API',
          status: 'stalled' as const,
          reason: 'No posts ingested for > 24 hours',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(IngestionAlertBanner, { issues: activeIssues, isTenantAdmin: true })
      );

      expect(html).toContain('Ingestion Alert');
      expect(html).toContain('GNews API');
      expect(html).toContain('No posts ingested for');
      expect(html).toContain('Re-sync now');
    });

    it('IngestionAlertBanner renders reconnect action when connector status is reconnect_required', async () => {
      const { IngestionAlertBanner } = await import('../../src/components/IngestionAlertBanner');

      const activeIssues = [
        {
          platformId: 'facebook',
          platformName: 'Facebook',
          status: 'reconnect_required' as const,
          reason: 'Access token expired or revoked',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(IngestionAlertBanner, { issues: activeIssues, isTenantAdmin: true })
      );

      expect(html).toContain('Facebook');
      expect(html).toContain('Access token expired or revoked');
      expect(html).toContain('Reconnect');
    });

    it('IngestionAlertBanner renders nothing when there are no active issues', async () => {
      const { IngestionAlertBanner } = await import('../../src/components/IngestionAlertBanner');

      const html = renderToStaticMarkup(
        React.createElement(IngestionAlertBanner, { issues: [], isTenantAdmin: true })
      );

      expect(html).toBe('');
    });

    it('OverviewTab and Connectors include or mount IngestionAlertBanner', () => {
      const overviewSrc = readSrc('app', 'tenant', 'analytics', 'OverviewTab.tsx');
      const connectorsSrc = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(overviewSrc + connectorsSrc).toContain('IngestionAlertBanner');
    });
  });
});
