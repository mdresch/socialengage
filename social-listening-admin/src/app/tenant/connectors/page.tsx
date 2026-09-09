import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus } from '@/lib/core-client';
import { ConnectorsClient, type PlatformDef, type ConnectorInitialState } from './ConnectorsClient';

/**
 * Story 6.3 (healed 2026-08-10) / Story 6.15 (ADR-0051) — enriched platform
 * definitions now carry all display metadata (icon, colour, description,
 * notices, credential field shapes) so the server page never needs to know
 * about JSX rendering. Deliberately not imported from status/page.tsx — each
 * page owns its own view-specific metadata, per the "no cross-page imports"
 * convention already established across this repo.
 */
const PLATFORMS: PlatformDef[] = [
  {
    id: 'gnews',
    name: 'GNews API',
    subtitle: 'Ingestion Provider (REST)',
    description: 'Real-time global news monitoring with keyword, headline, and topic filtering across 60,000+ publishers.',
    authMode: 'api_key',
    color: 'blue',
    icon: 'globe',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'GNews API Key',
        type: 'password',
        placeholder: 'gn_live_xxxxxxxxxxxxxxxx',
        hint: 'Obtained from your GNews.io account dashboard.',
      },
    ],
    personalScopeAllowed: true,
  },
  {
    id: 'newswire',
    name: 'Global Newswire Feeds',
    subtitle: 'Public Ingestion Source',
    description: 'Syndicated public corporate press releases and regulatory disclosures (zero credential required).',
    authMode: 'none',
    color: 'indigo',
    icon: 'radio',
    adNotice: 'public',
    credentialFields: [],
    personalScopeAllowed: false,
  },
  {
    id: 'azure-ai-language',
    name: 'Azure AI Language',
    subtitle: 'Cognitive Enrichment (NER / Sentiment)',
    description: 'Azure Cognitive Services for Named Entity Recognition, fine-grained multi-class sentiment analysis, and key phrase extraction.',
    authMode: 'api_key',
    color: 'purple',
    icon: 'sparkles-purple',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'endpoint',
        label: 'Azure Cognitive Services Endpoint URL',
        type: 'url',
        placeholder: 'https://<resource-name>.cognitiveservices.azure.com/',
      },
      {
        key: 'key',
        label: 'Azure Language API Key',
        type: 'password',
        placeholder: '32-character hexadecimal key',
      },
      {
        key: 'region',
        label: 'Azure Region',
        type: 'select',
        options: [
          { value: 'westeurope', label: 'West Europe' },
          { value: 'eastus', label: 'East US' },
          { value: 'northeurope', label: 'North Europe' },
          { value: 'southeastasia', label: 'Southeast Asia' },
        ],
      },
    ],
    // ADR-0028 Decision §1 (Clarification, 2026-08-17) — Tier 2 only.
    personalScopeAllowed: false,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI Service',
    subtitle: 'Cognitive Reasoning (GPT-4o)',
    description: 'Contextual brand reputation synthesis, executive summaries, and intent classification via private Azure OpenAI deployments.',
    authMode: 'api_key',
    color: 'emerald',
    icon: 'sparkles-emerald',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'endpoint',
        label: 'Azure OpenAI Resource Endpoint',
        type: 'url',
        placeholder: 'https://<resource-name>.openai.azure.com/',
      },
      {
        key: 'deployment',
        label: 'Model Deployment Name',
        type: 'text',
        placeholder: 'e.g. gpt-4o or gpt-4o-mini',
      },
      {
        key: 'key',
        label: 'Azure OpenAI API Key',
        type: 'password',
        placeholder: '32-character hexadecimal key',
      },
    ],
    // ADR-0028 Decision §1 (Clarification, 2026-08-17) — Tier 2 only.
    personalScopeAllowed: false,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    subtitle: 'Public Ingestion Source',
    description: 'Tracks edits to a tracked Wikipedia article via the MediaWiki Action API (zero credential required).',
    authMode: 'none',
    color: 'amber',
    icon: 'book-open',
    adNotice: 'public',
    credentialFields: [],
    personalScopeAllowed: false,
  },
  {
    id: 'facebook',
    name: 'Facebook Page',
    subtitle: 'Meta Graph API Ingestion Source',
    description: "Ingests published posts, reactions, comments, and shares directly from your connected Facebook Business, Brand, and Creator Pages via Meta Graph API. Exclusively for managed Pages — personal account profiles and timelines are not ingested.",
    authMode: 'oauth',
    color: 'blue',
    icon: 'facebook',
    adNotice: null,
    credentialFields: [],
    // ADR-0059 Decision §4 — Tier 3 (personal, self-activated) only, no
    // tenant-wide credential path exists on the backend at all.
    personalScopeAllowed: true,
    tenantScopeAllowed: false,
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    subtitle: 'Active Web & News Discovery',
    description: 'Active discovery connector querying the Brave Search index for tenant active watchlists with in-process AST validation.',
    authMode: 'api_key',
    color: 'amber',
    icon: 'brave-search',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'subscriptionToken',
        label: 'Brave Search API Subscription Token',
        type: 'password',
        placeholder: 'BSA...',
        hint: 'Obtained from your Brave Search API account dashboard (api.search.brave.com).',
      },
    ],
    // ADR-0028 / ADR-0065 — Tier 2 (tenant-wide) only.
    personalScopeAllowed: false,
    tenantScopeAllowed: true,
  },
  {
    id: 'bing-search',
    name: 'Bing Search (Azure)',
    subtitle: 'Active Web & News Discovery',
    description: 'Azure AI Services active web & news search discovery for tenant watchlists with in-process AST validation.',
    authMode: 'api_key',
    color: 'blue',
    icon: 'bing-search',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'Azure Bing Search API Key (Ocp-Apim-Subscription-Key)',
        type: 'password',
        placeholder: '32-character hexadecimal key',
        hint: 'Obtained from your Azure Portal Cognitive Services / Bing Search resource (Keys and Endpoint).',
      },
    ],
    // ADR-0028 / ADR-0066 — Tier 2 (tenant-wide) only.
    personalScopeAllowed: false,
    tenantScopeAllowed: true,
  },
  {
    id: 'instagram',
    name: 'Instagram Business',
    subtitle: 'Meta Graph API Ingestion Source',
    description: 'Ingests published photos, videos, carousels, and reels directly from your connected Instagram Business and Creator accounts via Meta Graph API.',
    authMode: 'oauth',
    color: 'pink',
    icon: 'instagram',
    adNotice: null,
    credentialFields: [],
    // ADR-0068 — Tier 3 (personal, self-activated) only, no tenant-wide credential path exists.
    personalScopeAllowed: true,
    tenantScopeAllowed: false,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    subtitle: 'OAuth Ingestion Source',
    description: 'Ingests published posts, comments, reactions, and company page analytics via LinkedIn REST API.',
    authMode: 'oauth',
    color: 'blue',
    icon: 'linkedin',
    adNotice: null,
    credentialFields: [],
    // ADR-0069 — Tier 3 (personal, self-activated) only, no tenant-wide credential path exists.
    personalScopeAllowed: true,
    tenantScopeAllowed: false,
  },
  {
    id: 'youtube',
    name: 'YouTube Data API',
    subtitle: 'Video Comments & Channel Mentions',
    description: 'Ingests comments, community discussions, and video descriptions matching brand watchlists via YouTube Data API v3.',
    authMode: 'api_key',
    color: 'red',
    icon: 'youtube',
    adNotice: 'billing',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'YouTube Data API Key',
        type: 'password',
        placeholder: 'AIzaSy...',
        hint: 'Obtained from your Google Cloud Console project with YouTube Data API v3 enabled.',
      },
    ],
    personalScopeAllowed: false,
    tenantScopeAllowed: true,
  },
];

/**
 * Story 6.3 (healed 2026-08-10) — each platform's connection state is a
 * real `getConnectorStatus()` call. A failed status call degrades to "not
 * connected" for that one platform, not a failed page render.
 * Story 6.15 (ADR-0051) — `isActive` from real `health.isActive`.
 */
async function loadState(platform: PlatformDef): Promise<ConnectorInitialState> {
  try {
    const status = await getConnectorStatus(platform.id);
    const connected = platform.authMode === 'none' || status.credentialStatus !== null;
    return {
      platformId: platform.id,
      connected,
      credentialStatus: status.credentialStatus,
      isActive: status.isActive,
      // Story 6.23 — the raw status, so platformVariant() can detect 'reconnect_required' distinctly.
      status: status.status,
      // maskedHint — core doesn't return the masked key today; placeholder for future.
      maskedHint: null,
    };
  } catch {
    return {
      platformId: platform.id,
      connected: false,
      credentialStatus: null,
      isActive: false,
      status: null,
      maskedHint: null,
    };
  }
}

export default async function ConnectorsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const initialStates = await Promise.all(PLATFORMS.map(loadState));

  return (
    <main>
      <ConnectorsClient
        platforms={PLATFORMS}
        initialStates={initialStates}
        isTenantAdmin={isTenantAdmin}
      />
    </main>
  );
}
