# Self-Learning Synthesis: Epic 6 (Tenant Admin UI)

**Compiled Date:** 2026-09-01
**Source Capture:** `raw/synthesis-epic-6-2026-09-01/`
**Git HEAD:** `bae408227c8c38d23f20e2e0b8f337b4aa286efb`
**Branch:** `main`
**Governing Architecture:** ADR-0122 / FDD-0122 / Story 14.5

---

## 1. Telemetry Summary

| Metric | Value |
|--------|-------|
| Git commits scanned | 292 |
| Healing / fix commits | 1 |
| Feature commits (this epic) | 29 |
| Contract test files | 211 |
| ADRs with Implementation Learnings | 5/139 |

## 2. Healing & Fix Passes

| Commit | Subject |
|--------|---------|
| `4595a200866fdaa9a8576aa57b1fce05b12ad5f1` | docs(adr-0122): complete Story 14.5 self-learning synthesis remediation |

## 3. Feature Commits (This Epic)

| Commit | Date | Subject |
|--------|------|---------|
| `64ac1f334d438317d89b507fd4f56ca58e0c9c80` | 2026-08-27 08:23:11 +0200 | feat(composer): Story 6.41 — Deep Research panel UI |
| `cf1f96c5e34730f0a24ef69d6cce13d307f28b26` | 2026-08-27 07:18:58 +0200 | feat(admin): Story 6.40 / ADR-0074 — tenant settings styled workspace profile, export actions, and offboarding link |
| `e0abfdd6e544d7196de121a8c47bddb87c8914a6` | 2026-08-26 14:23:04 +0200 | feat(admin): implement Story 6.39 — Polypost Composer Real Publish Flow (ADR-0075) |
| `ae5d16a31e81b4627be3dd92dbb69fe2b3675c64` | 2026-08-24 13:12:02 +0200 | feat(admin): Story 6.38 / ADR-0073 — post detail reply composer and replies tab |
| `f459114d8a252dd9f279aa9e6f04e97f5ba7fa59` | 2026-08-22 15:20:41 +0200 | feat(admin): Story 6.36 / ADR-0072 — contract, SKILL.md, and alt-text traceability for Polypost Composer |
| `89eb97c22b115c76e058d241a275a8e26fa0b377` | 2026-08-21 08:37:34 +0200 | feat(admin): implement LinkedIn connector UI and OAuth proxy (Story 6.35, ADR-0069) |
| `986a93cb25ced727d3ec9be6fb2fc4b41a2cf105` | 2026-08-21 08:36:53 +0200 | feat(admin): implement Instagram Business connector UI and OAuth proxy (Story 6.34, ADR-0068) |
| `5ff540ae9c284abb0cc9e348ae4ef10234df9ffd` | 2026-08-21 00:18:15 +0200 | feat(admin): expose brave search connector setup and watchlist sourcing (Story 6.30, ADR-0065) |
| `b0dc89e38aa2ee5476ba99db34f875cc11e70891` | 2026-08-20 21:26:36 +0200 | feat(admin): implement Facebook hosting Page attribution and author distinction display (Story 6.33 / ADR-0067) |
| `9260f6f73f84f3f6a9955546878d54d0268d97ab` | 2026-08-20 20:57:14 +0200 | feat(admin): implement post enrichment cascading edit drawer and entity categorization (Story 6.31 / ADR-0071) |
| `be6c4cd081b8cef9b314f636707f51a6f057f575` | 2026-08-20 18:02:07 +0200 | feat(admin): implement Story 6.29 connector ingestion status badges, stalled alerts banner, and on-demand re-sync (ADR-0070) |
| `5d76e443262992672b0c89e29143959f7b8c127a` | 2026-08-19 10:25:49 +0200 | feat(story-6.24): connector status screen groups Connectors and AI Providers |
| `b58b323cd18e4eb81dcc5adf93613c9c54b1bf75` | 2026-08-18 16:34:09 +0200 | feat(story-6.27): Facebook multi-Page-per-user support (ADR-0060) |
| `535338ff3dac36738d0240fb0d4994ec2d478e3f` | 2026-08-18 08:13:14 +0200 | feat(story-6.23): Facebook OAuth connect flow with Page selection |
| `03c37c91c3ffabfd69c15bb7339abf9b2e77d8fd` | 2026-08-18 04:58:16 +0200 | feat(story-6.26): post feed's Provider filter derives its options from real data |
| `65507164bac4ef7fdfb48d82627a940670b39155` | 2026-08-18 04:23:03 +0200 | feat(story-6.25): post feed shows most-recently-ingested posts first |
| `8182706d5f57a8fcc9ad8f5d680ec4c6e9fbc402` | 2026-08-18 02:03:47 +0200 | feat(story-6.22): add Wikipedia to the watchlist screen's platform-source list |
| `be1764d002bec66d5dac71d33c49b108c07f47ee` | 2026-08-17 21:37:46 +0200 | feat(admin): tenant-owned-feed multi-feed administration (Story 6.20, admin half) |
| `e9d797f64f67984fcb88985d0076ff21ab070d30` | 2026-08-17 21:21:28 +0200 | feat(core): tenant-owned-feed multi-feed administration (Story 6.20, core half) |
| `150124760d4f30c920f173b7fa783739c3901fdc` | 2026-08-17 19:49:07 +0200 | feat(admin): redesign the Team & Access screen (/tenant/users) |
| `556bb65a75f501c2062f421ab8c4abd620ac5a15` | 2026-08-17 19:38:25 +0200 | feat(core): expose caller tenant's own seat counts on GET /v1/tenants/users |
| `b837b390ad7de1a4acf61833f7191649c5022f0c` | 2026-08-17 19:27:33 +0200 | feat(admin): show detected language and clean the card-list post snippet |
| `4f099a611faee8383e32d81efacbc97752b4a144` | 2026-08-17 18:35:42 +0200 | feat(admin): render post detail body as real Markdown (Story 6.19) |
| `a27aa10cb5db80a1046de3e0a38274dbec42efd2` | 2026-08-17 17:37:32 +0200 | feat(admin): Story 6.14 — access-history view on the tenant users screen |
| `a97cf300ff9edcfa9e8a11377ef4befa45b3c03a` | 2026-08-17 17:27:18 +0200 | feat(admin): Story 6.18 — post feed search/filter operates over all matched posts |
| `feae698d9a7024381b824fd074866fb9069e4671` | 2026-08-12 13:52:34 +0200 | feat(social-listening-admin): show Active/Inactive on every connector, not just connected ones |
| `51eecf0270472fb6d30f30bca3a53b6d0a9557f8` | 2026-08-12 13:38:00 +0200 | feat(social-listening-admin): rebuild Story 6.6 Platform Admin console for real |
| `4046e75598214371efa888fbe6bca049e01bd1dd` | 2026-08-12 13:17:57 +0200 | feat(social-listening-admin): rebuild Story 6.5 connector status screen for real |
| `fded97b08813d7ab686582410c7d99668e5d4eac` | 2026-08-12 13:10:44 +0200 | feat(social-listening-admin): rebuild Story 6.4 watchlist screen for real, against ADR-0044 |

## 4. Contract Test Inventory

Total: 211 contract test files.

### social-listening-admin/contracts (78 files)

- `story-1.1.rest-only-boundary.contract.test.ts` (modified 2026-08-01)
- `story-10.10.real-time-alert-ui.contract.test.ts` (modified 2026-08-27)
- `story-10.12.webhook-management-ui.contract.test.ts` (modified 2026-08-27)
- `story-10.13.youtube-admin-ui.contract.test.ts` (modified 2026-08-27)
- `story-10.2.prospecting-list-ui.contract.test.ts` (modified 2026-08-27)
- `story-10.5.ad-hoc-query-ui.contract.test.ts` (modified 2026-08-27)
- `story-10.7.platform-operations-dashboard.contract.test.ts` (modified 2026-08-27)
- `story-11.10.social-inbox-ui.contract.test.ts` (modified 2026-08-28)
- `story-11.12.mention-suggestions-ui.contract.test.ts` (modified 2026-08-28)
- `story-11.2.case-handoff-ui.contract.test.ts` (modified 2026-08-28)
- `story-11.4.daily-digest-ui.contract.test.ts` (modified 2026-08-28)
- `story-11.6.topic-evolution-ui.contract.test.ts` (modified 2026-08-28)
- `story-11.8.publishing-ui.contract.test.ts` (modified 2026-08-28)
- `story-12.10.dashboard-widget-renderer.contract.test.ts` (modified 2026-08-29)
- `story-12.12.webhook-management-ui.contract.test.ts` (modified 2026-08-29)
- `story-12.14.workspace-settings-ui.contract.test.ts` (modified 2026-08-29)
- `story-12.16.influencer-discovery-ui.contract.test.ts` (modified 2026-08-30)
- `story-12.2.connector-capability-matrix-ui.contract.test.ts` (modified 2026-08-29)
- `story-12.4.boolean-query-visual-builder.contract.test.ts` (modified 2026-08-31)
- `story-12.6.ai-sentiment-aspect-ui.contract.test.ts` (modified 2026-08-29)
- `story-12.8.topic-curation-selected-topic-ui.contract.test.ts` (modified 2026-08-29)
- `story-13.3.query-capability-warnings-in-watchlist-builder.contract.test.ts` (modified 2026-08-31)
- `story-13.6.plan-and-seat-management-ui.contract.test.ts` (modified 2026-09-01)
- `story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` (modified 2026-08-27)
- `story-6.10.same-domain-invite-assist-view.contract.test.ts` (modified 2026-08-10)
- `story-6.11.post-feed.contract.test.ts` (modified 2026-08-30)
- `story-6.12.tenant-owned-feed-connector-setup.contract.test.ts` (modified 2026-08-17)
- `story-6.13.tenant-deletion-offboarding.contract.test.ts` (modified 2026-08-27)
- `story-6.14.access-history-view.contract.test.ts` (modified 2026-08-17)
- `story-6.15.connector-activation-controls.contract.test.ts` (modified 2026-08-17)
- `story-6.16.manual-enrichment-button.contract.test.ts` (modified 2026-08-12)
- `story-6.17.tenant-owned-feed-activation-control.contract.test.ts` (modified 2026-08-17)
- `story-6.18.post-feed-search-all-posts.contract.test.ts` (modified 2026-08-17)
- `story-6.19.post-body-markdown-rendering.contract.test.ts` (modified 2026-08-17)
- `story-6.2.resolved-identity-migration-ripple.contract.test.ts` (modified 2026-08-17)
- `story-6.2.role-gated-routing-shell.contract.test.ts` (modified 2026-08-20)
- `story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts` (modified 2026-08-20)
- `story-6.21.wikipedia-connector-ui.contract.test.ts` (modified 2026-08-20)
- `story-6.22.wikipedia-watchlist-platform-source.contract.test.ts` (modified 2026-08-18)
- `story-6.23.facebook-oauth-connect-flow.contract.test.ts` (modified 2026-08-20)
- `story-6.24.connector-status-ai-provider-grouping.contract.test.ts` (modified 2026-08-29)
- `story-6.25.post-feed-newest-first.contract.test.ts` (modified 2026-08-18)
- `story-6.26.post-feed-dynamic-provider-filter.contract.test.ts` (modified 2026-08-20)
- `story-6.27.facebook-multi-page-picker.contract.test.ts` (modified 2026-08-20)
- `story-6.28.tenant-owned-feed-friendly-naming.contract.test.ts` (modified 2026-08-20)
- `story-6.29.connector-ingestion-status-and-stalled-alerts.contract.test.ts` (modified 2026-08-20)
- `story-6.3.connector-connect-disconnect.contract.test.ts` (modified 2026-08-17)
- `story-6.30.brave-search-connector-ui.contract.test.ts` (modified 2026-08-20)
- `story-6.31.post-enrichment-cascading-edit-drawer.contract.test.ts` (modified 2026-08-20)
- `story-6.32.bing-search-connector-ui.contract.test.ts` (modified 2026-08-20)
- `story-6.33.facebook-page-attribution-display.contract.test.ts` (modified 2026-08-20)
- `story-6.34.instagram-connector-ui.contract.test.ts` (modified 2026-08-21)
- `story-6.35.linkedin-connector-ui.contract.test.ts` (modified 2026-08-21)
- `story-6.36.polypost-composer.contract.test.ts` (modified 2026-08-22)
- `story-6.37.post-page-and-watchlist-attribution.contract.test.ts` (modified 2026-08-22)
- `story-6.38.post-detail-reply-action.contract.test.ts` (modified 2026-08-27)
- `story-6.39.polypost-composer-real-publish-flow.contract.test.ts` (modified 2026-08-29)
- `story-6.4.watchlist-management-screen.contract.test.ts` (modified 2026-08-12)
- `story-6.40.tenant-settings-export-actions.contract.test.ts` (modified 2026-08-27)
- `story-6.41.composer-deep-research-panel-ui.contract.test.ts` (modified 2026-08-27)
- `story-6.5.connector-status-view.contract.test.ts` (modified 2026-08-21)
- `story-6.6.platform-admin-console.contract.test.ts` (modified 2026-08-12)
- `story-6.7.self-service-signup.contract.test.ts` (modified 2026-08-24)
- `story-6.8.user-invitation-management-screen.contract.test.ts` (modified 2026-08-17)
- `story-6.9.tenant-settings-screen.contract.test.ts` (modified 2026-08-27)
- `story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts` (modified 2026-08-31)
- `story-8.10.location-and-geospatial-insights.contract.test.ts` (modified 2026-08-20)
- `story-8.2.sentiment-tab.contract.test.ts` (modified 2026-08-21)
- `story-8.3.conversations-tab.contract.test.ts` (modified 2026-08-20)
- `story-8.4.overview-enrichment-period-comparison.contract.test.ts` (modified 2026-08-20)
- `story-8.5.languages-breakdown-widget.contract.test.ts` (modified 2026-08-20)
- `story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts` (modified 2026-08-20)
- `story-8.7.overview-tab-enhancement.contract.test.ts` (modified 2026-08-20)
- `story-8.8.spike-storyteller-widget.contract.test.ts` (modified 2026-08-27)
- `story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts` (modified 2026-08-20)
- `story-9.11.rag-discovery-ui.contract.test.ts` (modified 2026-08-27)
- `story-9.4.crisis-threshold-wizard.contract.test.ts` (modified 2026-08-27)
- `story-9.6.onboarding-checklist-ui.contract.test.ts` (modified 2026-08-29)

### social-listening-core/contracts (133 files)

- `story-1.1.independent-repo-scaffold.contract.test.ts` (modified 2026-08-01)
- `story-1.10.postgres-readiness-and-health.contract.test.ts` (modified 2026-08-12)
- `story-1.11.connector-activation.contract.test.ts` (modified 2026-08-17)
- `story-1.12.connector-status-includes-activation.contract.test.ts` (modified 2026-08-20)
- `story-1.13.live-ingestion-polling-scheduler.contract.test.ts` (modified 2026-08-29)
- `story-1.14.poll-scheduler-skip-in-flight.contract.test.ts` (modified 2026-08-18)
- `story-1.15.tier3-poll-scheduling.contract.test.ts` (modified 2026-08-31)
- `story-1.16.ingestion-watchdog-and-stalled-alerts.contract.test.ts` (modified 2026-08-31)
- `story-1.2.postgres-jsonb.contract.test.ts` (modified 2026-08-01)
- `story-1.3.api-versioning.contract.test.ts` (modified 2026-08-01)
- `story-1.4.persistent-local-dev-database.contract.test.ts` (modified 2026-08-12)
- `story-1.5.watchlist-crud.contract.test.ts` (modified 2026-08-12)
- `story-1.6.connector-connect-disconnect.contract.test.ts` (modified 2026-08-03)
- `story-1.7.ownership-tier-connect-disconnect.contract.test.ts` (modified 2026-08-17)
- `story-1.8.tenant-self-view.contract.test.ts` (modified 2026-08-09)
- `story-1.9.user-invite-offboard.contract.test.ts` (modified 2026-08-17)
- `story-10.1.prospecting-list-model.contract.test.ts` (modified 2026-08-27)
- `story-10.11.webhook-notifications.contract.test.ts` (modified 2026-08-27)
- `story-10.13.youtube-connector.contract.test.ts` (modified 2026-08-29)
- `story-10.14.ai-insights-digest.contract.test.ts` (modified 2026-08-27)
- `story-10.3.preconfigured-analytics-views.contract.test.ts` (modified 2026-08-27)
- `story-10.4.ad-hoc-query-endpoint.contract.test.ts` (modified 2026-08-27)
- `story-10.6.platform-metrics.contract.test.ts` (modified 2026-08-27)
- `story-10.8.data-export-posts-csv.contract.test.ts` (modified 2026-08-27)
- `story-10.9.real-time-alert-rules.contract.test.ts` (modified 2026-08-27)
- `story-11.1.crm-connector-and-case-handoff.contract.test.ts` (modified 2026-08-28)
- `story-11.11.mention-suggestions.contract.test.ts` (modified 2026-08-28)
- `story-11.3.daily-digest-email.contract.test.ts` (modified 2026-08-28)
- `story-11.5.topic-evolution.contract.test.ts` (modified 2026-08-31)
- `story-11.7.publishing-and-scheduling.contract.test.ts` (modified 2026-08-28)
- `story-11.9.social-inbox-and-reply.contract.test.ts` (modified 2026-08-28)
- `story-12.1.connector-capability-matrix.contract.test.ts` (modified 2026-08-29)
- `story-12.11.public-api-and-webhooks.contract.test.ts` (modified 2026-08-29)
- `story-12.13.multi-user-workspaces-rbac.contract.test.ts` (modified 2026-08-29)
- `story-12.15.influencer-discovery-and-scoring.contract.test.ts` (modified 2026-08-30)
- `story-12.3.boolean-query-ast.contract.test.ts` (modified 2026-08-29)
- `story-12.5.ai-sentiment-aspect-schema.contract.test.ts` (modified 2026-08-29)
- `story-12.7.ai-topic-clustering-post-topics-schema.contract.test.ts` (modified 2026-08-29)
- `story-12.9.dashboard-widget-contracts.contract.test.ts` (modified 2026-08-29)
- `story-13.1.connector-health-auto-disable-and-recovery.contract.test.ts` (modified 2026-08-31)
- `story-13.2.per-connector-query-translation-and-validation.contract.test.ts` (modified 2026-08-31)
- `story-13.4.export-bounding-streaming-and-size-caps.contract.test.ts` (modified 2026-09-01)
- `story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts` (modified 2026-09-01)
- `story-13.6.admin-tenant-plan-read.contract.test.ts` (modified 2026-09-01)
- `story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` (modified 2026-09-01)
- `story-13.8.platform-metrics-table-and-azure-metrics.contract.test.ts` (modified 2026-09-01)
- `story-2.1.provider-connector-framework.contract.test.ts` (modified 2026-08-01)
- `story-2.10.connector-registration-transparency.contract.test.ts` (modified 2026-08-21)
- `story-2.11.tenant-owned-feed-connector.contract.test.ts` (modified 2026-08-17)
- `story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts` (modified 2026-08-31)
- `story-2.13.wikipedia-connector.contract.test.ts` (modified 2026-08-17)
- `story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts` (modified 2026-08-20)
- `story-2.15.facebook-connector.contract.test.ts` (modified 2026-08-20)
- `story-2.16.azure-ai-language-classified-document-error.contract.test.ts` (modified 2026-08-18)
- `story-2.17.azure-openai-summary-field.contract.test.ts` (modified 2026-08-18)
- `story-2.18.facebook-engagement-counts.contract.test.ts` (modified 2026-08-18)
- `story-2.19.tenant-owned-feed-naming-and-byline.contract.test.ts` (modified 2026-08-20)
- `story-2.2.per-tenant-rate-limiting.contract.test.ts` (modified 2026-08-01)
- `story-2.20.geospatial-enrichment.contract.test.ts` (modified 2026-08-20)
- `story-2.21.brave-search-active-watchlist-connector.contract.test.ts` (modified 2026-08-20)
- `story-2.22.bing-search-active-watchlist-connector.contract.test.ts` (modified 2026-08-20)
- `story-2.23.facebook-page-dependency-and-author-resolution.contract.test.ts` (modified 2026-08-20)
- `story-2.24.instagram-connector.contract.test.ts` (modified 2026-08-21)
- `story-2.25.linkedin-connector.contract.test.ts` (modified 2026-08-21)
- `story-2.26.connector-reply-framework.contract.test.ts` (modified 2026-08-23)
- `story-2.27.facebook-page-reply-implementation.contract.test.ts` (modified 2026-08-23)
- `story-2.28.connector-publish-framework.contract.test.ts` (modified 2026-08-23)
- `story-2.29.facebook-page-post-publishing.contract.test.ts` (modified 2026-08-23)
- `story-2.3.error-handling-auto-disable.contract.test.ts` (modified 2026-08-31)
- `story-2.30.linkedin-post-publishing.contract.test.ts` (modified 2026-08-23)
- `story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts` (modified 2026-08-23)
- `story-2.32.azure-openai-research-capability.contract.test.ts` (modified 2026-08-23)
- `story-2.4.bounded-queues-and-dead-lettering.contract.test.ts` (modified 2026-08-25)
- `story-2.5.proportional-failure-threshold.contract.test.ts` (modified 2026-08-31)
- `story-2.6.newswire-connector.contract.test.ts` (modified 2026-08-25)
- `story-2.7.gnews-connector.contract.test.ts` (modified 2026-08-25)
- `story-2.8.azure-ai-language-connector.contract.test.ts` (modified 2026-08-12)
- `story-2.9.second-ai-provider-connector.contract.test.ts` (modified 2026-08-12)
- `story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts` (modified 2026-08-17)
- `story-6.27.facebook-multi-page-support.contract.test.ts` (modified 2026-09-01)
- `story-6.37.watchlist-raw-payload.contract.test.ts` (modified 2026-08-22)
- `story-3.1.author-normalization.contract.test.ts` (modified 2026-08-01)
- `story-3.10.canonical-markdown-post-body-normalization.contract.test.ts` (modified 2026-08-20)
- `story-3.11.post-watchlist-match-persistence.contract.test.ts` (modified 2026-08-20)
- `story-3.12.post-watchlist-match-backfill-and-discovery-attribution.contract.test.ts` (modified 2026-08-20)
- `story-3.13.post-enrichment-overrides.contract.test.ts` (modified 2026-08-29)
- `story-3.14.outbound-reply-audit.contract.test.ts` (modified 2026-08-23)
- `story-3.15.outbound-post-publishing-audit.contract.test.ts` (modified 2026-08-29)
- `story-3.16.tenant-workspace-and-posts-export.contract.test.ts` (modified 2026-08-24)
- `story-3.17.composer-deep-research.contract.test.ts` (modified 2026-08-24)
- `story-3.2.ingestion-run-audit-anchor.contract.test.ts` (modified 2026-08-01)
- `story-3.2.ingestion-run-retryable-field.contract.test.ts` (modified 2026-08-01)
- `story-3.3.watchlist-matching.contract.test.ts` (modified 2026-08-01)
- `story-3.4.cursor-pagination.contract.test.ts` (modified 2026-08-03)
- `story-3.5.tiered-retention-and-archival.contract.test.ts` (modified 2026-08-01)
- `story-3.6.watchlist-boolean-ast.contract.test.ts` (modified 2026-08-01)
- `story-3.8.self-service-tenant-initiated-deletion.contract.test.ts` (modified 2026-09-01)
- `story-3.9.author-follower-count-at-publish.contract.test.ts` (modified 2026-08-12)
- `story-6.16.post-manual-enrich-endpoint.contract.test.ts` (modified 2026-08-12)
- `story-6.19.post-body-markdown-exposure.contract.test.ts` (modified 2026-08-17)
- `story-4.1.author-topic-signals.contract.test.ts` (modified 2026-08-03)
- `story-4.2.topic-time-series-deferred.contract.test.ts` (modified 2026-08-29)
- `story-4.3.derived-connector-health.contract.test.ts` (modified 2026-08-31)
- `story-4.3.health-derivation-index.contract.test.ts` (modified 2026-08-01)
- `story-4.4.derived-data-caching-and-refresh.contract.test.ts` (modified 2026-08-06)
- `story-5.1.thin-events.contract.test.ts` (modified 2026-08-03)
- `story-5.10.retire-x-tenant-id.contract.test.ts` (modified 2026-08-12)
- `story-5.11.get-v1-me.contract.test.ts` (modified 2026-08-05)
- `story-5.12.platform-admin-tenant-management.contract.test.ts` (modified 2026-08-12)
- `story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts` (modified 2026-08-07)
- `story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts` (modified 2026-08-06)
- `story-5.15.self-service-tenant-signup.contract.test.ts` (modified 2026-08-10)
- `story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts` (modified 2026-08-06)
- `story-5.17.access-history-read-endpoint.contract.test.ts` (modified 2026-08-10)
- `story-5.18.signup-rate-limiting.contract.test.ts` (modified 2026-08-10)
- `story-5.19.wire-ingestion-events.contract.test.ts` (modified 2026-08-17)
- `story-5.2.per-tenant-event-filtering.contract.test.ts` (modified 2026-08-05)
- `story-5.3.credential-envelope-encryption.contract.test.ts` (modified 2026-08-03)
- `story-5.4.tenant-isolation-rls.contract.test.ts` (modified 2026-08-01)
- `story-5.5.event-schema-versioning.contract.test.ts` (modified 2026-08-05)
- `story-5.6.entra-authentication.contract.test.ts` (modified 2026-08-03)
- `story-5.7.platform-admin-rls-bypass.contract.test.ts` (modified 2026-08-07)
- `story-5.8.tenants-table-rls.contract.test.ts` (modified 2026-08-03)
- `story-5.9.users-table-identity-resolution.contract.test.ts` (modified 2026-08-09)
- `story-8.8.posts-explain-spike.contract.test.ts` (modified 2026-08-27)
- `story-9.1.watchlist-preview-volume.contract.test.ts` (modified 2026-08-24)
- `story-9.10.rag-endpoints.contract.test.ts` (modified 2026-08-27)
- `story-9.2.metric-explainability.contract.test.ts` (modified 2026-08-27)
- `story-9.3.crisis-templates.contract.test.ts` (modified 2026-08-27)
- `story-9.5.onboarding-checklist-state.contract.test.ts` (modified 2026-08-25)
- `story-9.7.rag-connector.contract.test.ts` (modified 2026-08-27)
- `story-9.8.rag-chunking-pipeline.contract.test.ts` (modified 2026-08-27)
- `story-9.9.rag-vector-rls.contract.test.ts` (modified 2026-08-27)

## 5. ADR Implementation Learnings Status

**Annotated (5):**
- 0036-admin-ui-authentication-session-and-role-gating-mechanism
- 0074-tenant-facing-workspace-and-posts-export
- 0076-composer-deep-research-agent
- 0090-data-export-posts-csv
- 0122-continuous-self-learning-synthesis-and-telemetry-feedback-loop

**Not yet annotated (134):** _Not all ADRs need annotations — only those whose upfront assumptions were refined by implementation._

## 6. Environment Gotchas (Snapshot)

Current gotchas file has 8 sections:

- Real Azure / external-service timing
- Azure CLI / credential context
- Jest parallel-worker collisions against shared real resources
- Test database template (jest.global-setup.js / testDbClone.ts)
- Local dev environment / scripts
- Auth / identity wiring
- Jest environment surprises
- npm / transitive dependency surprises

## 7. Synthesis Recommendations

The following are surfaced from the captured telemetry for manual review:

### Environment Gotchas to Verify

- **`4595a200866fdaa9a8576aa57b1fce05b12ad5f1`** — docs(adr-0122): complete Story 14.5 self-learning synthesis remediation: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.

### ADR In-Place Annotations to Verify

Feature commits reference stories: 6.41, 6.40, 6.39, 6.38, 6.36, 6.35, 6.34, 6.30, 6.33, 6.31, 6.29, 6.20, 6.19, 6.14, 6.18, 6.6, 6.5, 6.4.
Verify that any ADR whose assumptions were refined by these stories carries a `## Implementation Learnings & Real-World Constraints` section with commit references.

### Lessons-Learned-Register Patterns

Check whether any new cross-cutting architectural patterns emerged from this epic's implementation that should be added to the `Reusable Architectural & System Patterns` section.

---

*Generated by `scripts/synthesize-telemetry.mjs --compile` per ADR-0122.*