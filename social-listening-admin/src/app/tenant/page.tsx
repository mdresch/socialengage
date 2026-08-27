import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import {
  getMyTenant,
  listWatchlists,
  getConnectorStatus,
  listPosts,
  getOnboardingChecklist,
  type AdminTenant,
  type Watchlist,
  type ConnectorStatus,
  type SocialPostSummary,
  type OnboardingChecklistResponse,
} from '@/lib/core-client';
import { RelativeTime } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import { extractDisplayText, extractProviderBadge, extractEnrichmentSummary } from './posts/postDisplay';
import { OnboardingChecklist } from './OnboardingChecklist';

const PLATFORMS = [
  { id: 'gnews', name: 'GNews' },
  { id: 'newswire', name: 'Newswire' },
  { id: 'wikipedia', name: 'Wikipedia' },
  { id: 'facebook', name: 'Facebook Page' },
  { id: 'azure-ai-language', name: 'Azure AI Language' },
  { id: 'azure-openai', name: 'Azure OpenAI' },
  { id: 'tenant-owned-feed', name: 'Tenant Feed' },
];

interface ConnectorSummary {
  id: string;
  name: string;
  status: ConnectorStatus['status'];
  isActive: boolean;
}

/**
 * Story 6.2 / Story 9.6 — Tenant workspace overview dashboard.
 * Fetches tenant, watchlists, connector statuses, recent posts, and onboarding checklist in parallel.
 * Each data source degrades independently — a single failing call never blocks the page.
 */
export default async function TenantShellPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const tenantId = identity?.type === 'tenant_user' ? identity.tenantId : '';

  // Fetch all data in parallel — each source degrades independently on failure.
  const [tenant, watchlists, connectors, allPosts, onboardingChecklist] = await Promise.all([
    getMyTenant().catch((): AdminTenant | null => null),
    listWatchlists().catch((): Watchlist[] => []),
    Promise.all(
      PLATFORMS.map((p) =>
        getConnectorStatus(p.id)
          .then((s): ConnectorSummary => ({ id: p.id, name: p.name, status: s.status, isActive: s.isActive }))
          .catch((): ConnectorSummary => ({ id: p.id, name: p.name, status: 'disconnected' as ConnectorStatus['status'], isActive: false }))
      )
    ),
    (async () => {
      try {
        const page = await listPosts(undefined, 100);
        return (page.posts ?? []).reverse();
      } catch {
        return [];
      }
    })(),
    (async () => {
      if (tenantId) {
        try {
          return await getOnboardingChecklist(tenantId);
        } catch {
          return null;
        }
      }
      return null;
    })(),
  ]);

  const activeWatchlists = watchlists.filter((w) => w.isActive).length;
  const activeConnectors = connectors.filter((c) => c.isActive || c.status !== 'disconnected');
  const activeConnectorsCount = activeConnectors.length;
  const degradedConnectors = connectors.filter(
    (c) => (c.isActive || c.status !== 'disconnected') && (c.status === 'degraded' || c.status === 'failing')
  );

  const totalPostsCount = allPosts.length;
  const recentPosts = allPosts.slice(0, 3);
  const seatPercent =
    tenant && tenant.licenseSeatCount > 0
      ? Math.min(100, Math.round((tenant.activeSeatCount / tenant.licenseSeatCount) * 100))
      : 0;

  return (
    <main>
      {/* Page header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 className="page-title">Workspace Overview</h1>
          {tenant && (
            <p className="page-subtitle">
              Active monitoring operations for <strong>{tenant.name}</strong>
            </p>
          )}
        </div>
        <div className="page-actions">
          {isTenantAdmin && (
            <>
              <a href="/tenant/watchlists" className="btn btn-primary btn-sm">
                + New Watchlist
              </a>
              <a href="/tenant/connectors" className="btn btn-secondary btn-sm">
                Tenant-wide connect
              </a>
            </>
          )}
        </div>
      </div>

      {/* Story 9.6: Onboarding Checklist */}
      {tenantId && onboardingChecklist && (
        <OnboardingChecklist
          tenantId={tenantId}
          initialChecklist={onboardingChecklist}
          isTenantAdmin={isTenantAdmin}
        />
      )}

      {/* Degraded connector alert banner */}
      {degradedConnectors.length > 0 && (
        <div
          role="alert"
          className="status-banner status-banner-warning"
          style={{ marginBottom: 'var(--space-5)' }}
        >
          <span>⚠</span>
          <div style={{ flex: 1 }}>
            <strong>Connector attention required ({degradedConnectors.length})</strong>
            <span style={{ marginLeft: 'var(--space-2)', fontWeight: 400 }}>
              {degradedConnectors.map((c) => c.name).join(', ')} is reporting degraded or failing responses. Ingestion may be delayed.
            </span>
          </div>
          <a href="/tenant/connectors/status" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            Review status →
          </a>
        </div>
      )}

      {/* Metric summary cards */}
      <div className="overview-cards-grid">
        {/* Active Watchlists */}
        <a href="/tenant/watchlists" className="overview-card">
          <div className="overview-card-header">
            <span className="overview-card-label">Active Watchlists</span>
            <div className="overview-card-icon-badge overview-card-icon-watchlists" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>
          <div className="overview-card-body">
            <div className="overview-card-stat">
              <span className="overview-card-count">{activeWatchlists}</span>
              <span className="overview-card-sub">of {watchlists.length} configured</span>
            </div>
          </div>
          <div className="overview-card-footer">
            <span>Manage match rules →</span>
          </div>
        </a>

        {/* Ingestion Connectors */}
        <a href="/tenant/connectors/status" className="overview-card">
          <div className="overview-card-header">
            <span className="overview-card-label">Ingestion Connectors</span>
            <div className="overview-card-icon-badge overview-card-icon-connectors" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="overview-card-body">
            <div className="overview-card-stat">
              <span className="overview-card-count">{activeConnectorsCount}</span>
              <span className="overview-card-sub">of {connectors.length} active feeds</span>
            </div>
          </div>
          <div className="overview-card-footer">
            <span>Inspect health status →</span>
          </div>
        </a>

        {/* Ingested Posts */}
        <a href="/tenant/posts" className="overview-card">
          <div className="overview-card-header">
            <span className="overview-card-label">Ingested Posts</span>
            <div className="overview-card-icon-badge overview-card-icon-posts" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div className="overview-card-body">
            <div className="overview-card-stat">
              <span className="overview-card-count">{totalPostsCount.toLocaleString()}</span>
              <span className="overview-card-sub">matched items</span>
            </div>
          </div>
          <div className="overview-card-footer">
            <span>Browse enriched feed →</span>
          </div>
        </a>

        {/* Seat Utilization */}
        <a href={isTenantAdmin ? '/tenant/users' : '/tenant/settings'} className="overview-card">
          <div className="overview-card-header">
            <span className="overview-card-label">Seat Utilization</span>
            <div className="overview-card-icon-badge overview-card-icon-seats" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="overview-card-body">
            <div className="overview-card-stat">
              <span className="overview-card-count">{tenant?.activeSeatCount ?? '—'}</span>
              <span className="overview-card-sub">of {tenant?.licenseSeatCount ?? '—'} licensed ({seatPercent}%)</span>
            </div>
            {tenant && (
              <div className="overview-card-progress-track">
                <div
                  className="overview-card-progress-fill"
                  style={{ width: `${seatPercent}%` }}
                />
              </div>
            )}
          </div>
          <div className="overview-card-footer">
            <span>{isTenantAdmin ? 'Manage users & access →' : 'View license info →'}</span>
          </div>
        </a>
      </div>

      {/* Main content grid: recent posts + connector sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Recent ingestion stream */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '0.9375rem' }}>Recent Ingestion Stream</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                  Latest monitoring hits enriched with Azure AI
                </p>
              </div>
              <a href="/tenant/posts" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-accent)', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                View all →
              </a>
            </div>

            {recentPosts.length === 0 ? (
              <div className="card-body">
                <div className="empty-state" style={{ border: 'none', padding: 'var(--space-5) 0', margin: 0 }}>
                  <h3>No posts yet</h3>
                  <p>Connect a platform and activate a watchlist to start ingesting posts.</p>
                  {isTenantAdmin && (
                    <a href="/tenant/connectors" className="btn btn-primary btn-sm">Connect a platform</a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {recentPosts.map((post) => {
                  const { title, snippet } = extractDisplayText(post.rawPayload);
                  const provider = extractProviderBadge(post.rawPayload);
                  const enrichment = post.enrichment ? extractEnrichmentSummary(post.enrichment) : null;
                  const providerClass = provider
                    ? `provider-pill provider-pill-${provider.toLowerCase().replace(/_/g, '-')}`
                    : 'provider-pill provider-pill-default';
                  const sentimentClass = enrichment?.sentiment
                    ? `enrichment-chip enrichment-chip-sentiment-${enrichment.sentiment.toLowerCase()}`
                    : null;

                  return (
                    <a
                      key={post.id}
                      href="/tenant/posts"
                      style={{ display: 'block', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', textDecoration: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          {provider && <span className={providerClass}>{provider.replace(/_/g, ' ')}</span>}
                        </div>
                        {post.publishedAt && <RelativeTime timestamp={post.publishedAt} />}
                      </div>

                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)', lineHeight: 1.4 }}>
                        {title ?? 'Untitled post'}
                      </div>

                      {snippet && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {snippet}
                        </p>
                      )}

                      {enrichment && (
                        <div className="enrichment-chips" style={{ marginTop: 'var(--space-2)' }}>
                          {enrichment.sentiment && sentimentClass && (
                            <span className={sentimentClass}>{enrichment.sentiment}</span>
                          )}
                          {enrichment.keyPhrases.slice(0, 2).map((phrase) => (
                            <span key={phrase} className="enrichment-chip enrichment-chip-phrase">{phrase}</span>
                          ))}
                          {enrichment.entities.slice(0, 1).map((entity) => (
                            <span key={entity} className="enrichment-chip enrichment-chip-entity">{entity}</span>
                          ))}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: connector summary + billing note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Connector status summary */}
            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0, fontSize: '0.9375rem' }}>Active Connectors</h2>
              </div>
              <div className="card-body">
                {activeConnectors.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    No connectors active.{' '}
                    {isTenantAdmin && <a href="/tenant/connectors">Connect a platform →</a>}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {connectors.filter((c) => c.isActive || c.status !== 'disconnected').map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        <StatusBadge variant={c.status === 'disconnected' ? 'inactive' : c.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-footer" style={{ justifyContent: 'center' }}>
                <a href="/tenant/connectors/status" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
                  Inspect health & latency →
                </a>
              </div>
            </div>

            {/* ADR-0027 billing note */}
            <div className="card card-body" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Direct Cloud Billing Model
              </strong>
              <p style={{ margin: 0, lineHeight: 1.55 }}>
                SocialEngage is not a billing intermediary. All API keys and Azure cognitive endpoints connect directly under your organisation's own provider agreements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
