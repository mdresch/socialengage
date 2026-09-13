import { Router, RequestHandler } from 'express';
import { getPool } from '../../../db/pool';
import { checkPostgresConnectivity } from '../../../db/postgresReadiness';
import { postsRouter } from './postsRouter';
import { topicsRouter } from './topicsRouter';
import { connectorsRouter } from './connectorsRouter';
import { tenantOwnedFeedRouter } from './tenantOwnedFeedRouter';
import { facebookOAuthRouter } from './facebookOAuthRouter';
import { facebookPagesRouter } from './facebookPagesRouter';
import { instagramOAuthRouter } from './instagramOAuthRouter';
import { instagramAccountsRouter } from './instagramAccountsRouter';
import { linkedinOAuthRouter } from './linkedinOAuthRouter';
import { watchlistsRouter } from './watchlistsRouter';
import { outboundPostsRouter } from './outboundPostsRouter';
import { outboundActivitiesRouter } from './outboundActivitiesRouter';
import { meRouter } from './meRouter';
import { adminTenantsRouter } from './adminTenantsRouter';
import { adminBreakGlassRouter } from './adminBreakGlassRouter';
import { adminAuditLogRouter } from './adminAuditLogRouter';
import { selfServiceSignupRouter } from './selfServiceSignupRouter';
import { domainSignupAttemptsRouter } from './domainSignupAttemptsRouter';
import { selfServiceTenantDeletionRouter } from './selfServiceTenantDeletionRouter';
import { tenantSelfViewRouter } from './tenantSelfViewRouter';
import { tenantPlanRouter } from './tenantPlanRouter';
import { tenantUsersRouter } from './tenantUsersRouter';
import { tenantExportRouter } from './tenantExportRouter';
import { onboardingChecklistRouter } from './onboardingChecklistRouter';
import { composerRouter } from './composerRouter';
import { crisisTemplatesRouter } from './crisisTemplatesRouter';
import { crisisIncidentsRouter } from './crisisIncidentsRouter';
import { explainRouter } from './explainRouter';
import { ragRouter } from './ragRouter';
import { prospectingListsRouter } from './prospectingListsRouter';
import { analyticsViewsRouter } from './analyticsViewsRouter';
import { platformDashboardRouter } from './platformDashboardRouter';
import { adminPlatformMetricsRouter } from './adminPlatformMetricsRouter';
import { postsExportRouter, exportsStatusRouter } from './postsExportRouter';
import { alertRulesRouter } from './alertRulesRouter';
import { webhooksRouter } from './webhooksRouter';
import { youtubeConnectorRouter } from './youtubeConnectorRouter';
import { inboxRouter } from './inboxRouter';
import { mentionSuggestionsRouter } from './mentionSuggestionsRouter';
import { createCRMRoutes } from '../../routes/crmRoutes';
import { createDigestRoutes, createPublicDigestRoutes } from '../../routes/digestRoutes';
import { createPublishingRoutes } from '../../routes/publishingRoutes';
import { influencersRouter } from './influencersRouter';
import { takedownsRouter } from './takedownsRouter';
import { takedownsPublicRouter } from './takedownsPublicRouter';
import { dsrRouter } from './dsrRouter';
import { dsrPublicRouter } from './dsrPublicRouter';
import { complianceRouter } from './complianceRouter';

/**
 * Story 5.10 (ADR-0033): a factory, not a static router, so app.ts can pass
 * in whichever auth middleware variant it selected (real or test-only) —
 * see .claude/skills/tenant-auth-middleware/SKILL.md. /v1/health is
 * deliberately exempt: it predates any auth mechanism (Story 1.3, ADR-0017)
 * and stays public on purpose — a health/liveness endpoint requiring
 * credentials would be unusual and its own contract
 * (contracts/epic-1/story-1.3.api-versioning.contract.test.ts) explicitly
 * requires it reachable unauthenticated. Every substantive route is mounted
 * behind authMiddleware, except self-service-signup below, which needs its
 * own, different (claims-level, not identity-level) auth middleware — see
 * .claude/skills/self-service-tenant-signup/SKILL.md.
 */
export function createV1Router(authMiddleware: RequestHandler, claimsAuthMiddleware: RequestHandler): Router {
  const v1Router = Router();

  /**
   * Story 1.10 (ADR-0016): database-aware liveness route, still
   * deliberately public/unauthenticated (unchanged from Story 1.3/
   * ADR-0017's own original placeholder) — see
   * .claude/skills/http-api-versioning/SKILL.md and
   * .claude/skills/postgres-tenant-db/SKILL.md.
   */
  v1Router.get('/health', async (_req, res) => {
    const ok = await checkPostgresConnectivity(getPool());
    if (ok) {
      res.json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  /** Story 11.3 (ADR-0096) — public one-click unsubscribe route. */
  v1Router.use('/', createPublicDigestRoutes());

  /** Story 10.8 (ADR-0090) — posts data export (streaming CSV & async jobs). Mounted BEFORE generic /posts. */
  v1Router.use('/posts', authMiddleware, postsExportRouter);

  /** Story 3.4 (ADR-0011) — see .claude/skills/posts-api/SKILL.md. */
  v1Router.use('/posts', authMiddleware, postsRouter);

  /** Story 4.1 (ADR-0007) — see .claude/skills/author-topic-signals/SKILL.md. */
  v1Router.use('/topics', authMiddleware, topicsRouter);

  /**
   * Story 2.11 (ADR-0050) — mounted BEFORE the generic /connectors router
   * below, deliberately: its own literal /connectors/tenant-owned-feed/*
   * paths must be intercepted here, or they'd fall through to
   * connectorsRouter's generic /:platformId/connect route with
   * 'tenant-owned-feed' bound as platformId. This is also why
   * connectorsRouter.ts itself was never touched to add these routes — see
   * .claude/skills/tenant-owned-feed-connector/SKILL.md and ADR-0048/
   * Story 2.10's own no-core-path-edit requirement.
   */
  v1Router.use('/connectors/tenant-owned-feed', authMiddleware, tenantOwnedFeedRouter);

  /**
   * Story 2.15 (ADR-0059) — mounted BEFORE the generic /connectors router
   * below, the same "more specific path first" reason as tenant-owned-feed
   * above: its own /connectors/facebook/oauth/* paths must be intercepted
   * here, not fall through to connectorsRouter's generic
   * /:platformId/connect with 'facebook' bound as platformId (which
   * rejects it outright — see that router's own authMode:'oauth' guard).
   */
  v1Router.use('/connectors/facebook/oauth', authMiddleware, facebookOAuthRouter);

  /**
   * Story 6.27 (ADR-0060 Decision §5) — mounted BEFORE the generic
   * /connectors router below, the same "more specific path first" reason
   * as tenant-owned-feed/facebook/oauth above.
   */
  v1Router.use('/connectors/facebook/pages', authMiddleware, facebookPagesRouter);

  /**
   * Story 2.24/6.34 (ADR-0068) — Instagram Business OAuth & Account Management.
   * Mounted BEFORE the generic /connectors router below.
   */
  v1Router.use('/connectors/instagram/oauth', authMiddleware, instagramOAuthRouter);
  v1Router.use('/connectors/instagram/accounts', authMiddleware, instagramAccountsRouter);

  /**
   * Story 2.25/6.35 (ADR-0069) — LinkedIn OAuth Connect Flow.
   * Mounted BEFORE the generic /connectors router below.
   */
  v1Router.use('/connectors/linkedin/oauth', authMiddleware, linkedinOAuthRouter);

  /** Story 10.13 (ADR-0093) — YouTube Data API v3 Ingestion Connector. */
  v1Router.use('/connectors/youtube', authMiddleware, youtubeConnectorRouter);

  /** Story 4.4 (ADR-0022) — see .claude/skills/derived-data-caching-and-refresh/SKILL.md. */
  v1Router.use('/connectors', authMiddleware, connectorsRouter);

  /**
   * Watchlist CRUD — Phase 1 "also build, not storied" work.
   * See .claude/skills/watchlist-crud/SKILL.md and docs/open-items-and-deferred-work.md §A.
   */
  v1Router.use('/watchlists', authMiddleware, watchlistsRouter);

  /** Story 5.11 (ADR-0036 §5) — see .claude/skills/me-endpoint/SKILL.md. */
  v1Router.use('/me', authMiddleware, meRouter);

  /** Story 5.12 (ADR-0030, ADR-0031) — see .claude/skills/platform-admin-tenant-management/SKILL.md. */
  v1Router.use('/admin/tenants', authMiddleware, adminTenantsRouter);

  /** Story 5.13 (ADR-0030 §3) — see .claude/skills/platform-admin-break-glass-rest/SKILL.md. */
  v1Router.use('/admin/tenants/:tenantId/break-glass', authMiddleware, adminBreakGlassRouter);

  /** Story 5.14 (ADR-0030 §5) — see .claude/skills/platform-admin-audit-log/SKILL.md. */
  v1Router.use('/admin/audit-log', authMiddleware, adminAuditLogRouter);

  /** Story 13.8 (ADR-0114) — platform metrics query and admin endpoints. */
  v1Router.use('/admin', authMiddleware, adminPlatformMetricsRouter);

  /** Story 10.6 (ADR-0089) — platform operations telemetry dashboard. */
  v1Router.use('/admin', authMiddleware, platformDashboardRouter);

  /**
   * Story 5.15 (ADR-0037 §5) — the one route in this project accepting a
   * caller resolveIdentity() cannot match. claimsAuthMiddleware verifies
   * the token but does not itself reject on unresolved identity — the
   * route handler does that check. See
   * .claude/skills/self-service-tenant-signup/SKILL.md.
   */
  v1Router.use('/tenants/self-service-signup', claimsAuthMiddleware, selfServiceSignupRouter);

  /** Story 5.16 (ADR-0037 §8b) — see .claude/skills/same-domain-invite-assist/SKILL.md. */
  v1Router.use('/tenants/domain-signup-attempts', authMiddleware, domainSignupAttemptsRouter);

  /** Story 1.8 (ADR-0031) — see .claude/skills/tenants/SKILL.md. */
  v1Router.use('/tenants/me', authMiddleware, tenantSelfViewRouter);

  /** Story 13.5 (ADR-0112) — see .claude/skills/feature-gating/SKILL.md. */
  v1Router.use('/tenants/plan', authMiddleware, tenantPlanRouter);

  /** Story 1.9 (ADR-0032) — see .claude/skills/identity-resolution/SKILL.md. */
  v1Router.use('/tenants/users', authMiddleware, tenantUsersRouter);

  /** Story 3.16 (ADR-0074) — on-demand workspace JSON and posts CSV exports. */
  v1Router.use('/tenants/me/export', authMiddleware, tenantExportRouter);

  /** Story 3.8 (ADR-0043) — see .claude/skills/self-service-tenant-deletion/SKILL.md. */
  v1Router.use('/tenants/self-service-deletion', authMiddleware, selfServiceTenantDeletionRouter);

  /** Story 3.15 (ADR-0075) / Story 11.7 (ADR-0098) — outbound post publishing, scheduling, and asset targeting. */
  v1Router.use('/', authMiddleware, createPublishingRoutes(authMiddleware));
  v1Router.use('/outbound/posts', authMiddleware, outboundPostsRouter);
  /** Story 14.2 (ADR-0119) — editing and deleting published outbound posts and revisions. */
  v1Router.use('/outbound/activities', authMiddleware, outboundActivitiesRouter);

  /** Story 3.17 (ADR-0076) — composer Deep Research endpoint. */
  v1Router.use('/composer', authMiddleware, composerRouter);

  /** Story 9.5 (ADR-0080) — tenant onboarding checklist state. */
  v1Router.use('/tenants', authMiddleware, onboardingChecklistRouter);

  /** Story 9.3 (ADR-0079) — crisis template bundle & activation. */
  v1Router.use('/crisis-templates', authMiddleware, crisisTemplatesRouter);

  /** Story 17.3 (ADR-0131) — crisis incident lifecycle (acknowledge/resolve). */
  v1Router.use('/crisis/incidents', authMiddleware, crisisIncidentsRouter);

  /** Story 9.2 (ADR-0078) — metric explainability endpoint. */
  v1Router.use('/explain', authMiddleware, explainRouter);

  /** Story 9.10 (ADR-0084) — RAG search, Q&A, and status endpoints. */
  v1Router.use('/rag', authMiddleware, ragRouter);

  /** Story 10.1 (ADR-0086) — prospecting lists & author entries. */
  v1Router.use('/prospecting-lists', authMiddleware, prospectingListsRouter);

  /** Story 10.3 (ADR-0087) — precomputed daily count analytics views. */
  v1Router.use('/analytics', authMiddleware, analyticsViewsRouter);

  /** Story 10.8 (ADR-0090) — posts data export status. */
  v1Router.use('/exports', authMiddleware, exportsStatusRouter);

  /** Story 10.9 (ADR-0091) — real-time alert rules & alerts inbox. */
  v1Router.use('/alerts', authMiddleware, alertRulesRouter);

  /** Story 15.1 (ADR-0123) � alert rules refinements and volume preview. */
  v1Router.use('/alert-rules', authMiddleware, alertRulesRouter);

  /** Story 10.11 (ADR-0092) — webhook subscriptions & delivery dispatcher. */
  v1Router.use('/webhooks', authMiddleware, webhooksRouter);

  /** Story 11.1 (ADR-0095) — CRM connectors, field mappings, and case handoff. */
  v1Router.use('/', authMiddleware, createCRMRoutes());

  /** Story 11.3 (ADR-0096) — daily digest preferences, previews, and unsubscribe. */
  v1Router.use('/', authMiddleware, createDigestRoutes());

  /** Story 11.9 (ADR-0099) — unified social inbox and triage. */
  v1Router.use('/inbox/items', authMiddleware, inboxRouter);
  v1Router.use('/inbox', authMiddleware, inboxRouter);

  /** Story 11.11 (ADR-0100) — composed post author mention suggestions. */
  v1Router.use('/composer', authMiddleware, mentionSuggestionsRouter);

  /** Story 12.15 (ADR-0108) — influencer discovery and multi-factor scoring. */
  v1Router.use('/influencers', authMiddleware, influencersRouter);

  /** Story 16.1 (ADR-0125) — author takedowns review queue, grant cascade, and public endpoints. */
  v1Router.use('/takedowns', authMiddleware, takedownsRouter);
  v1Router.use('/public/takedowns', takedownsPublicRouter);

  /** Story 16.2 (ADR-0126) — DSR Article 18 restriction quarantining and receipts. */
  v1Router.use('/dsr', authMiddleware, dsrRouter);
  v1Router.use('/public/dsr', dsrPublicRouter);

  /** Story 16.3 (ADR-0127) — compliance audit log hash chaining and audit pack exports. */
  v1Router.use('/compliance', authMiddleware, complianceRouter);

  return v1Router;
}

