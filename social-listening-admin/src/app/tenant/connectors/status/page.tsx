import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus, type ConnectorStatus } from '@/lib/core-client';
import { ConnectorStatusClient, type ConnectorStatusRow } from './ConnectorStatusClient';

interface PlatformDefinition {
  id: string;
  name: string;
  authMode: 'api_key' | 'none' | 'oauth';
  category: string;
  description: string;
  /** ADR-0028 Decision §1 (Clarification, 2026-08-17) — false for any AIProviderConnector; mirrors ConnectorsClient.tsx's own PlatformDef field. */
  personalScopeAllowed: boolean;
  /** Story 6.23 (ADR-0059 Decision §4) — false suppresses the tenant-wide ActivateDeactivateButton unconditionally; mirrors ConnectorsClient.tsx's own PlatformDef field. Optional, defaults true. */
  tenantScopeAllowed?: boolean;
}

/**
 * Story 6.5 (reworked 2026-08-12) / Story 6.15 (ADR-0051) — mirrors the
 * PLATFORMS array from tenant/connectors/page.tsx (deliberately duplicated,
 * not imported — a page component exports nothing). `isActive` comes from
 * real `health.isActive` (Story 1.12), never hardcoded.
 */
const PLATFORMS: PlatformDefinition[] = [
  {
    id: 'gnews',
    name: 'GNews API',
    authMode: 'api_key',
    category: 'Ingestion',
    description: 'Real-time global news monitoring with keyword, headline, and topic filtering across 60,000+ publishers.',
    personalScopeAllowed: true,
  },
  {
    id: 'newswire',
    name: 'Global Newswire Feeds',
    authMode: 'none',
    category: 'Ingestion',
    description: 'Syndicated public corporate press releases and regulatory disclosures. No credential required.',
    personalScopeAllowed: false,
  },
  {
    id: 'azure-ai-language',
    name: 'Azure AI Language',
    authMode: 'api_key',
    category: 'Enrichment',
    description: 'Named Entity Recognition, fine-grained multi-class sentiment analysis, and key phrase extraction.',
    // ADR-0028 Decision §1 (Clarification, 2026-08-17) — Tier 2 only.
    personalScopeAllowed: false,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI Service',
    authMode: 'api_key',
    category: 'Enrichment',
    description: 'Contextual brand reputation synthesis, executive summaries, and intent classification via private Azure OpenAI deployments.',
    // ADR-0028 Decision §1 (Clarification, 2026-08-17) — Tier 2 only.
    personalScopeAllowed: false,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    authMode: 'none',
    category: 'Ingestion',
    description: 'Tracks edits to a tracked Wikipedia article via the MediaWiki Action API. No credential required.',
    personalScopeAllowed: false,
  },
  {
    id: 'facebook',
    name: 'Facebook Page (Owned Feed)',
    authMode: 'oauth',
    category: 'Ingestion',
    description: "Ingests your own connected Facebook Page's own posts and engagement (ADR-0059).",
    // ADR-0059 Decision §4 — Tier 3 (personal) only, no tenant-wide credential path exists on the backend at all.
    personalScopeAllowed: true,
    tenantScopeAllowed: false,
  },
];

async function loadRow(platform: PlatformDefinition): Promise<ConnectorStatusRow> {
  try {
    const health = await getConnectorStatus(platform.id);
    return { platform, isActive: health.isActive, health };
  } catch {
    return { platform, isActive: false, health: null };
  }
}

export default async function ConnectorStatusPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const rows = await Promise.all(PLATFORMS.map(loadRow));

  return (
    <main>
      <ConnectorStatusClient rows={rows} isTenantAdmin={isTenantAdmin} />
    </main>
  );
}
