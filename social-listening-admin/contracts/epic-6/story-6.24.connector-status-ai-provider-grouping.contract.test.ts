/**
 * Contract: Story 6.24 — Connector status screen groups Connectors and AI
 * Providers into separate sections, with honest AI-provider metrics.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-624
 *
 * Intent: `ConnectorStatusClient.tsx` (Story 6.5/6.15) renders every platform
 * — ingestion connectors and AI enrichment providers alike — as one flat
 * card list, using `deriveConnectorHealth()`'s `disconnected` status
 * (permanent for an AIProviderConnector, which never accumulates an
 * `ingestion_runs` row — connector-status-view/SKILL.md's own already-named
 * "Known gaps" entry) to render a "Paused" badge next to a "Deactivate"
 * button, even when the provider is genuinely active and working. The same
 * card also shows two hardcoded, wrong sub-labels for every platform:
 * "Interval: every 2 minutes" (the real cadence is 15 or 30 minutes,
 * `bootstrapConnectors.ts`'s real `pollCadenceMs` constants) and
 * "Threshold: 5 retries before alert" (the real, single global ceiling is
 * `CONSECUTIVE_FAILURE_CEILING = 20`, `connectorHealth.ts`).
 *
 * Scope: social-listening-admin/src/app/tenant/connectors/status/
 * ConnectorStatusClient.tsx only (splits `rows` into a "Connectors" section,
 * category === 'Ingestion', and an "AI Providers" section, category ===
 * 'Enrichment'; AI Provider cards get a plain Active/Inactive badge off real
 * `isActive` and an explanatory note instead of the metrics grid; Connector
 * cards get their own real per-platform interval and the real 20-retry
 * threshold; the KPI strip's "Total Feeds" count reflects the Connectors
 * section only). No change to page.tsx, core-client.ts, or any backend file
 * — this is a display-only rework of an already-real data shape.
 *
 * Contract to encode: AC1 two labelled sections, split by real `category`;
 * AC2 AI Provider cards render a plain Active/Inactive badge from `isActive`
 * alone, never the health-derived variant, regardless of `health.status`;
 * AC3 AI Provider cards render no metrics grid, an explanatory note instead;
 * AC4 Connector cards show each platform's own real poll interval, not a
 * universal "2 minutes"; AC5 Connector cards show "Threshold: 20 retries
 * before alert"; AC6 "Total Feeds" counts the Connectors section only; AC7
 * both sections still render `ActivateDeactivateButton` exactly as before.
 *
 * Explicitly out of scope, per the story's own boundary (not tested): real
 * success/failure tracking for AI providers based on actual `enrichPost()`
 * outcomes; a real backend endpoint exposing per-platform poll cadence; any
 * change to `tenant/connectors/page.tsx`.
 */

import fs from 'fs';
import path from 'path';

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const statusClientPath = ['app', 'tenant', 'connectors', 'status', 'ConnectorStatusClient.tsx'];
const STATUS_CLIENT_MODULE = '../../src/app/tenant/connectors/status/ConnectorStatusClient';

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

const gnewsRow = {
  platform: { id: 'gnews', name: 'GNews API', authMode: 'api_key', category: 'Ingestion', description: 'x', personalScopeAllowed: true },
  isActive: true,
  health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid', isActive: true },
};

const wikipediaRow = {
  platform: { id: 'wikipedia', name: 'Wikipedia', authMode: 'none', category: 'Ingestion', description: 'x', personalScopeAllowed: false },
  isActive: true,
  health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: true },
};

function aiRow(id: 'azure-ai-language' | 'azure-openai', isActive: boolean) {
  return {
    platform: { id, name: id === 'azure-ai-language' ? 'Azure AI Language' : 'Azure OpenAI Service', authMode: 'api_key', category: 'Enrichment', description: 'x', personalScopeAllowed: false },
    isActive,
    // disconnected: connector-status-view/SKILL.md's own named gap — an
    // AIProviderConnector's health.status is permanently 'disconnected',
    // never anything else, regardless of real, successful usage.
    health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid', isActive },
  };
}

describe('Story 6.24 — connector status screen groups Connectors and AI Providers', () => {
  describe('AC1: two labelled sections, split by real category', () => {
    it('renders a "Connectors" heading and an "AI Providers" heading, each grouping the right platforms', () => {
      const rows = [gnewsRow, aiRow('azure-ai-language', true), wikipediaRow, aiRow('azure-openai', false)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });

      expect(html).toContain('Connectors');
      expect(html).toContain('AI Providers');

      const connectorsHeadingIdx = html.indexOf('Connectors');
      const aiHeadingIdx = html.indexOf('AI Providers');
      const gnewsIdx = html.indexOf('GNews API');
      const wikipediaIdx = html.indexOf('Wikipedia');
      const azureLangIdx = html.indexOf('Azure AI Language');
      const azureOpenAiIdx = html.indexOf('Azure OpenAI Service');

      // Every Ingestion-category card renders between the two headings;
      // every Enrichment-category card renders after the AI Providers
      // heading — proves the split is real (by category), not a partial
      // re-render of the same flat list.
      expect(gnewsIdx).toBeGreaterThan(connectorsHeadingIdx);
      expect(gnewsIdx).toBeLessThan(aiHeadingIdx);
      expect(wikipediaIdx).toBeGreaterThan(connectorsHeadingIdx);
      expect(wikipediaIdx).toBeLessThan(aiHeadingIdx);
      expect(azureLangIdx).toBeGreaterThan(aiHeadingIdx);
      expect(azureOpenAiIdx).toBeGreaterThan(aiHeadingIdx);
    });
  });

  describe('AC2: AI Provider cards render a plain Active/Inactive badge off real isActive, never the health-derived variant', () => {
    it('an AI provider with isActive: true renders the "active" StatusBadge variant, regardless of a permanently-disconnected health.status', () => {
      const rows = [aiRow('azure-ai-language', true)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('data-variant="active"');
      expect(html).not.toContain('data-variant="inactive"');
      expect(html).not.toContain('Paused');
    });

    it('an AI provider with isActive: false renders the "inactive" StatusBadge variant labelled "Inactive", not the default "Paused" label', () => {
      const rows = [aiRow('azure-openai', false)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('data-variant="inactive"');
      expect(html).toContain('Inactive');
      expect(html).not.toContain('Paused');
    });
  });

  describe('AC3: AI Provider cards render no metrics grid, an explanatory note instead', () => {
    it('omits the cs-metrics-grid entirely for AI Provider cards and shows an on-demand explanation', () => {
      const rows = [aiRow('azure-ai-language', true), aiRow('azure-openai', true)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).not.toContain('cs-metrics-grid');
      expect(html).not.toContain('Last Successful Ingestion');
      expect(html).not.toContain('Consecutive Retry Count');
      expect(html.match(/not (independently )?polled/i)).not.toBeNull();
    });

    it('still renders the metrics grid for Connector cards in the same render', () => {
      const rows = [gnewsRow, aiRow('azure-ai-language', true)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('cs-metrics-grid');
      expect(html).toContain('Last Successful Ingestion');
    });
  });

  describe('AC4: Connector cards show each real platform interval, not a universal "2 minutes"', () => {
    it('gnews (15-minute cadence) and wikipedia (30-minute cadence) each show their own real interval', () => {
      const rows = [gnewsRow, wikipediaRow];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('Interval: every 15 minutes');
      expect(html).toContain('Interval: every 30 minutes');
      expect(html).not.toContain('Interval: every 2 minutes');
    });
  });

  describe('AC5: Connector cards show the real global retry threshold (20), not the hardcoded wrong "5"', () => {
    it('renders "Threshold: 20 retries before alert" for a Connector card', () => {
      const rows = [gnewsRow];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('Threshold: 20 retries before alert');
      expect(html).not.toContain('Threshold: 5 retries before alert');
    });
  });

  describe('AC6: "Total Feeds" reflects the Connectors section only, never AI providers', () => {
    it('counts only Ingestion-category rows toward the Total Feeds KPI', () => {
      const rows = [gnewsRow, wikipediaRow, aiRow('azure-ai-language', true), aiRow('azure-openai', true)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      const kpiMatch = html.match(/Total Feeds<\/span><div class="cs-kpi-value cs-kpi-value-neutral">(\d+)</);
      expect(kpiMatch).not.toBeNull();
      expect(kpiMatch![1]).toBe('2');
    });
  });

  describe('AC7: both sections still render ActivateDeactivateButton exactly as before', () => {
    it('renders the tenant-wide activation control for both a Connector row and an AI Provider row', () => {
      const rows = [gnewsRow, aiRow('azure-ai-language', true)];
      const html = renderComponent(STATUS_CLIENT_MODULE, 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      const source = readSrc(...statusClientPath);
      expect(source).toContain('ActivateDeactivateButton');
      // Deactivate renders for both an active Connector row and an active
      // AI Provider row (isTenantAdmin: true, both isActive: true here).
      expect((html.match(/Deactivate<\/button>/g) ?? []).length).toBe(2);
    });
  });
});
