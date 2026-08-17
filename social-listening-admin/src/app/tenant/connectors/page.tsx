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
      // maskedHint — core doesn't return the masked key today; placeholder for future.
      maskedHint: null,
    };
  } catch {
    return {
      platformId: platform.id,
      connected: false,
      credentialStatus: null,
      isActive: false,
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
