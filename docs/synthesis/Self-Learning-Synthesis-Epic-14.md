# Self-Learning Synthesis: Epic 14 (Continuous Self-Learning Synthesis & Feedback)

**Compiled Date:** 2026-09-14
**Source Capture:** `raw/synthesis-epic-14-2026-09-14/`
**Git HEAD:** `99fb4a563299846cdd829856c9ae3aa20db94bf9`
**Branch:** `feat/story-19.3`
**Governing Architecture:** ADR-0122 / FDD-0122 / Story 14.5

---

## 1. Telemetry Summary

| Metric | Value |
|--------|-------|
| Git commits scanned | 292 |
| Healing / fix commits | 51 |
| Feature commits (this epic) | 20 |
| Contract test files | 237 |
| ADRs with Implementation Learnings | 10/140 |

## 2. Healing & Fix Passes

| Commit | Subject |
|--------|---------|
| `787b94599b994686fb9c24205ec2a9a6ae1e1fe4` | fix(deps): resolve 6 Dependabot alerts (4 high, 2 moderate) |
| `69dfcfaf9fddec923101562f1848774d4bae2e4f` | fix(second-brain-sync): call full heal-obsidian-brain instead of export+backfill only |
| `cad31cad441fee4dba31dece501a7e1474eb8cb3` | fix(obsidian-brain): expand type aliases and auto-heal duplicate artifact_ids |
| `dc3958f4b9bbdce2945826c668c5ce4d73107d59` | fix(docs): resolve unresolved merge-conflict markers left in onboarding-checklist-ui SKILL.md |
| `421a4c12e1525d431a2098b397f0478a214014fb` | fix(core): heal story-13.8 contract test isolation and gate platform metrics worker |
| `acb77fa368a8214a9040e6ab2a15de3891cec2fd` | heal(story-6.41 8.6) Healing Stories 6.41 and 8.6 failing contracts now healed |
| `cf425ddc7bd4abd8265e5f07679d4c06eb0ecc7b` | fix(admin): heal contract failures and typecheck errors across admin and analytics |
| `4edf26fac3b84b3063200636f9e19f704c17c2e4` | fix(posts-csv-export): drain background export jobs before Jest teardown |
| `7850f1d9d27ba737ab32aae5387cef6ad475caf3` | fix(feature-gating): avoid 500 from requireFeatureGate on synthetic test tenant ids |
| `e493fb479930cddf4d094e33759b1d1f2cd7732c` | heal(contract): Story 3.8 self-service tenant deletion |
| `be5702dadae2e902c423241e339104f176e8d4ba` | heal(contract): Story 6.27 multi-Page status assertion |
| `a5c926c9cd44fb6f6343f125d913a8ef66ce9c2a` | heal(story-11.5): use resolved identity and validate granularity in /v1/topics/evolution |
| `daf9c3f36146ca508f00cd64736be2c4b77295fb` | fix(posts): Facebook post display regression — extractDisplayText returns empty title + snippet |
| `37d0bf5fa6598ca71da418976b3395aa5d3d3a59` | fix(events): skip Service Bus publish when SERVICE_BUS_NAMESPACE is unset |
| `2a4ea316d3c661e405a6d1f6099fa0b1e156764b` | fix(connectors): add youtube, brave-search, and bing-search cadences to status view |
| `57a0dacfb7c4448b975d167fcf9ce1d9bbce5c44` | fix(youtube): support API key credential envelope encryption and activation in youtube connect route |
| `58895f01d8c24bba9061cc8a1b9f052c20bd2a29` | fix(contracts): heal story-1.13, story-3.15, story-4.2, and story-9.7/9.9/9.10 contracts |
| `994b4b8fac6b382a44a7fbbfa3a0b88176e4e05e` | fix(contracts): heal story-6.39 contract for story-11.8 outbound publishing |
| `a4dbb663a292007930d6d2632dfc3c67429a7832` | fix(rag): fetch live status on mount in RAGDiscoveryClient |
| `a57a0d5f29ff0faee0c4fcb272060e6269fe238b` | fix(rag): add migration 0047 granting app_user permissions on rag_chunks and rag_chunks_sync |
| `4ae7f926ee52e562673a8ca36e0573cefbf84ddb` | fix(admin): eliminate duplicate onboarding checklist exports and fix typing in OnboardingChecklist |
| `2ccc739d97c475292e1fc1e233b1d886343bec49` | fix(dashboard): recognize Relocated story status so Story 6.6 stub is not counted as pending |
| `c490a9969df68a220df1403dc4accf1d9057b78e` | fix(dashboard): recognize Retired story status so Story 3.7 is not counted as pending |
| `0a7def75f57922f064ce0277641b40dfd543516a` | fix(synthesis): run capture-compile sequentially in post-commit hook |
| `4595a200866fdaa9a8576aa57b1fce05b12ad5f1` | docs(adr-0122): complete Story 14.5 self-learning synthesis remediation |
| `3cb453d5a0a0b08906108f0b6a81e6fe05766469` | heal(story-6.2): add CSS module mapper to Jest config for page.module.css import |
| `01bce70d1e9d74c31131a128eaaf6b98e1ab3629` | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist |
| `55a2014dfb0bc94aa6f53243ae87dcc896202037` | fix(composer): add linkPreview to LinkedInPreviewCard props destructuring |
| `48c77c4633d99a092a984b7a91811dd65f4c8ee0` | fix(composer): destructure linkPreview prop in PlatformPreviewRails and pass to all preview cards |
| `e31fe98e69ea14dfa2867fb0dfe569a09848ea93` | fix(core): improve LinkedIn credential parsing, profile fetching, and version handling |
| `1713a095ae74641e7a627bcbfee82e241ce61cad` | fix(core): enable configurable lookback and ingest historical Instagram posts |
| `3318b2b6f356dd7f634b21f7a85cef4e67671e41` | fix(core): update scheduler test provider roster, refine reconnect_required derivation, and handle Graph API error bodies |
| `d0094f6abee8dedca9656280453003ea213596a5` | fix(core+admin): heal postgres connection pool deadlock and scope facebook page health |
| `30ed2dffbe1ca01d31ff0d36081a4ae3952dc75f` | fix(analytics): add resilient error handling for watchlist coverage and analytics initial load |
| `cb953f1d197bf09f6c7cfc1cbcc57950d5276038` | fix(tenant): show most-recently ingested posts first in recent ingestion stream |
| `3d7d7435a8a67f17d4e68b6b165e3772c8e747f6` | fix(analytics): align topic selector, date range picker, and matching posts count on a single control line |
| `aa1e7f5802d2ca7af48ef119aca91f365af3af50` | fix(analytics): sort watchlist coverage descending by post count and limit to top 6 items |
| `2fa45ba5bfb07660987e34c90019241081e50094` | fix(post-feed): surface Facebook Page author and original-post link |
| `75362d338413dd2a1e2cc36d12219b48798f9118` | fix(facebook-connector): denormalize Page id/name into rawPayload |
| `cd6f41e08dea95d06748056c97e54802e35c6fb7` | fix(post-feed): allocate the Newswire issuer to the author position |
| `efa96e8869d1b24b396cb2f7e9d00e872e20acc4` | fix(analytics-overview): unreadable white-on-white post title in drawer rows |
| `66735370992a4a48420236e90a5b97ddf339ed8c` | fix(post-commit hook): stop the queue files from re-queuing their own bookkeeping commits |
| `1974d1dd363242eae763e49c9db48c9a5cc2eb48` | heal(story-6.27): give the fan-out test enough real-world margin |
| `23e94fc7c9ff52db4e2274d258b2afcbbd0dc8c4` | heal(story-6.1): fix broken local-dev login and Jest TLS-trust gap |
| `fc011dff25330c55d8c3b930e443dba51cbda272` | fix(post-feed): normalize Facebook post titles instead of raw JSON |
| `3fedac3ce1436b0e3384bd1d4acfa3d56c35fcdb` | fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document |
| `4bea1b849d0601c6d88c43607d969c5679d930a0` | fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved) |
| `ff66d311baf94aa1edf370d4f3453a6dbc1fbfa8` | fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing |
| `5886a3e87b9ac3c6c4cb33bca77ee3840ea0fe18` | fix(admin): Provider filter's tenant-owned-feed option used the wrong value |
| `eeb9c8c317d2430820a024c3a7a9ec45d53a54c1` | fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured |
| `5d0fb49d7174e4941e770ffd0baef4534cd67e98` | fix(core): reject personal-scope connect/activate for AI provider connectors |

## 3. Feature Commits (This Epic)

| Commit | Date | Subject |
|--------|------|---------|
| `9dd1747464b9538ccee14b25cfbefd5f7fb398ce` | 2026-09-07 13:10:24 +0200 | docs(plan): archive Story 14.5 pre-execution implementation plan |
| `84a92eb3c2441e2facf4f18ee27f77482dea5cc9` | 2026-09-07 13:08:13 +0200 | docs(walkthrough): archive Story 14.5 empirical verification walkthrough |
| `ca0383ea93028abd3eae38b4a47a5cda484e6ae0` | 2026-09-07 11:10:37 +0200 | chore(synthesis): refresh Epic 14 synthesis artifact with Story 14.5 merge telemetry |
| `c951ecbd857f60b9b832b4985d863eaa02ff09d0` | 2026-09-07 11:09:25 +0200 | chore: record post-commit hook metadata for Story 14.5 |
| `02e27bb1b1c01a210305f454a9da556d9c367e1f` | 2026-09-07 11:09:02 +0200 | feat(epic-14): implement Story 14.5 Continuous Self-Learning Synthesis and Telemetry Feedback Architecture |
| `4b8bea8bca3b07e0a8b7ab4ff026762969a00b2b` | 2026-09-06 00:18:53 +0200 | chore(telemetry): sync dashboard telemetry for Story 14.4 |
| `82b276e8347850ebf485c2b30b3ec8cef8c3b685` | 2026-09-06 00:18:42 +0200 | docs(epic-14): record Story 14.4 build in implementation log and user stories |
| `d2bd77979b88017746bf7f799d324687efc507f2` | 2026-09-06 00:17:33 +0200 | feat(epic-14): implement Story 14.4 Composer Deep Research caching, re-trigger, caps, and telemetry |
| `77a8e02fe9c6ae4d268c57dc1b00f62a1a77b1ad` | 2026-09-05 22:10:20 +0200 | docs(epic-14): record Story 14.3 build and dashboard sync |
| `c9037238ac90eaae565594f81b045e5a3123c578` | 2026-09-05 22:04:42 +0200 | feat(epic-14): implement Story 14.3 SearchProviderConnector abstraction |
| `d2aeb80610bfde1b6153eece71a59b30e420bfaa` | 2026-09-04 17:20:27 +0200 | chore(telemetry): update implementation log, user stories, and dashboard sync for Story 14.2 |
| `c1ab9b297a5a7a279da99825432d27319e3ab69a` | 2026-09-04 17:06:18 +0200 | feat(publishing): implement Story 14.2 — Editing and deleting published outbound posts (ADR-0119) |
| `f53a870143c97aa723711eba3cf20dd2eec3a53e` | 2026-09-04 16:31:39 +0200 | Merge remote-tracking branch 'origin/main' |
| `8cde283a9dc0bdd74e2aeb1e6e8f499e4bbba921` | 2026-09-04 16:18:24 +0200 | chore(telemetry): update implementation log, user stories, and dashboard sync for Story 14.1 |
| `c68c1a13814e47e19627dd8ad8c6ee2540261673` | 2026-09-04 16:18:12 +0200 | docs(platform-library): build specifications for Mastodon, Bluesky, Instagram, Threads, and X publishing connectors (Story 14.1) |
| `1d03403524f6855863156ef054fe1cc50f4dff2c` | 2026-09-04 16:17:04 +0200 | feat(publishing): implement Story 14.1 — Additional social platform publishing roadmap (ADR-0118) |
| `d1ab715cc34ffede1dd5545fed688e3ea7e92a25` | 2026-08-27 12:40:57 +0200 | feat(synthesis): wire ADR-0122 capture-compile into post-commit hook for Story 14.5 |
| `6f4f25eaf4cc158c643a5d53de064e7cbe44a078` | 2026-08-27 12:36:19 +0200 | feat(synthesis): wire full raw/ capture-compile pipeline for ADR-0122 |
| `4595a200866fdaa9a8576aa57b1fce05b12ad5f1` | 2026-08-27 12:10:27 +0200 | docs(adr-0122): complete Story 14.5 self-learning synthesis remediation |
| `0a7c4500cadcd5b4d0e481e2bf314365be321934` | 2026-08-24 20:24:30 +0200 | docs(trace): fix ADR-0080 README status, create Epic 14, update no-story ADR list |

## 4. Contract Test Inventory

Total: 237 contract test files.

### social-listening-admin/contracts (83 files)

- `story-1.1.rest-only-boundary.contract.test.ts` (modified 2026-09-14)
- `story-10.10.real-time-alert-ui.contract.test.ts` (modified 2026-09-14)
- `story-10.12.webhook-management-ui.contract.test.ts` (modified 2026-09-14)
- `story-10.13.youtube-admin-ui.contract.test.ts` (modified 2026-09-14)
- `story-10.2.prospecting-list-ui.contract.test.ts` (modified 2026-09-14)
- `story-10.5.ad-hoc-query-ui.contract.test.ts` (modified 2026-09-14)
- `story-10.7.platform-operations-dashboard.contract.test.ts` (modified 2026-09-14)
- `story-11.10.social-inbox-ui.contract.test.ts` (modified 2026-09-14)
- `story-11.12.mention-suggestions-ui.contract.test.ts` (modified 2026-09-14)
- `story-11.2.case-handoff-ui.contract.test.ts` (modified 2026-09-14)
- `story-11.4.daily-digest-ui.contract.test.ts` (modified 2026-09-14)
- `story-11.6.topic-evolution-ui.contract.test.ts` (modified 2026-09-14)
- `story-11.8.publishing-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.10.dashboard-widget-renderer.contract.test.ts` (modified 2026-09-14)
- `story-12.12.webhook-management-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.14.workspace-settings-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.16.influencer-discovery-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.2.connector-capability-matrix-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.4.boolean-query-visual-builder.contract.test.ts` (modified 2026-09-14)
- `story-12.6.ai-sentiment-aspect-ui.contract.test.ts` (modified 2026-09-14)
- `story-12.8.topic-curation-selected-topic-ui.contract.test.ts` (modified 2026-09-14)
- `story-13.10.media-upload-and-asset-targeting-ui.contract.test.ts` (modified 2026-09-14)
- `story-13.12.semantic-drift-ui.contract.test.ts` (modified 2026-09-14)
- `story-13.14.prospecting-export-and-crm-push-ui.contract.test.ts` (modified 2026-09-14)
- `story-13.3.query-capability-warnings-in-watchlist-builder.contract.test.ts` (modified 2026-09-14)
- `story-13.6.plan-and-seat-management-ui.contract.test.ts` (modified 2026-09-14)
- `story-16.4.platform-ops-quota-burn-rate-ui.contract.test.ts` (modified 2026-09-14)
- `story-18.1.watchlist-volume-confidence-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` (modified 2026-09-14)
- `story-6.10.same-domain-invite-assist-view.contract.test.ts` (modified 2026-09-14)
- `story-6.11.post-feed.contract.test.ts` (modified 2026-09-14)
- `story-6.12.tenant-owned-feed-connector-setup.contract.test.ts` (modified 2026-09-14)
- `story-6.13.tenant-deletion-offboarding.contract.test.ts` (modified 2026-09-14)
- `story-6.14.access-history-view.contract.test.ts` (modified 2026-09-14)
- `story-6.15.connector-activation-controls.contract.test.ts` (modified 2026-09-14)
- `story-6.16.manual-enrichment-button.contract.test.ts` (modified 2026-09-14)
- `story-6.17.tenant-owned-feed-activation-control.contract.test.ts` (modified 2026-09-14)
- `story-6.18.post-feed-search-all-posts.contract.test.ts` (modified 2026-09-14)
- `story-6.19.post-body-markdown-rendering.contract.test.ts` (modified 2026-09-14)
- `story-6.2.resolved-identity-migration-ripple.contract.test.ts` (modified 2026-09-14)
- `story-6.2.role-gated-routing-shell.contract.test.ts` (modified 2026-09-14)
- `story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts` (modified 2026-09-14)
- `story-6.21.wikipedia-connector-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.22.wikipedia-watchlist-platform-source.contract.test.ts` (modified 2026-09-14)
- `story-6.23.facebook-oauth-connect-flow.contract.test.ts` (modified 2026-09-14)
- `story-6.24.connector-status-ai-provider-grouping.contract.test.ts` (modified 2026-09-14)
- `story-6.25.post-feed-newest-first.contract.test.ts` (modified 2026-09-14)
- `story-6.26.post-feed-dynamic-provider-filter.contract.test.ts` (modified 2026-09-14)
- `story-6.27.facebook-multi-page-picker.contract.test.ts` (modified 2026-09-14)
- `story-6.28.tenant-owned-feed-friendly-naming.contract.test.ts` (modified 2026-09-14)
- `story-6.29.connector-ingestion-status-and-stalled-alerts.contract.test.ts` (modified 2026-09-14)
- `story-6.3.connector-connect-disconnect.contract.test.ts` (modified 2026-09-14)
- `story-6.30.brave-search-connector-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.31.post-enrichment-cascading-edit-drawer.contract.test.ts` (modified 2026-09-14)
- `story-6.32.bing-search-connector-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.33.facebook-page-attribution-display.contract.test.ts` (modified 2026-09-14)
- `story-6.34.instagram-connector-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.35.linkedin-connector-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.36.polypost-composer.contract.test.ts` (modified 2026-09-14)
- `story-6.37.post-page-and-watchlist-attribution.contract.test.ts` (modified 2026-09-14)
- `story-6.38.post-detail-reply-action.contract.test.ts` (modified 2026-09-14)
- `story-6.39.polypost-composer-real-publish-flow.contract.test.ts` (modified 2026-09-14)
- `story-6.4.watchlist-management-screen.contract.test.ts` (modified 2026-09-14)
- `story-6.40.tenant-settings-export-actions.contract.test.ts` (modified 2026-09-14)
- `story-6.41.composer-deep-research-panel-ui.contract.test.ts` (modified 2026-09-14)
- `story-6.5.connector-status-view.contract.test.ts` (modified 2026-09-14)
- `story-6.6.platform-admin-console.contract.test.ts` (modified 2026-09-14)
- `story-6.7.self-service-signup.contract.test.ts` (modified 2026-09-14)
- `story-6.8.user-invitation-management-screen.contract.test.ts` (modified 2026-09-14)
- `story-6.9.tenant-settings-screen.contract.test.ts` (modified 2026-09-14)
- `story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts` (modified 2026-09-14)
- `story-8.10.location-and-geospatial-insights.contract.test.ts` (modified 2026-09-14)
- `story-8.2.sentiment-tab.contract.test.ts` (modified 2026-09-14)
- `story-8.3.conversations-tab.contract.test.ts` (modified 2026-09-14)
- `story-8.4.overview-enrichment-period-comparison.contract.test.ts` (modified 2026-09-14)
- `story-8.5.languages-breakdown-widget.contract.test.ts` (modified 2026-09-14)
- `story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts` (modified 2026-09-14)
- `story-8.7.overview-tab-enhancement.contract.test.ts` (modified 2026-09-14)
- `story-8.8.spike-storyteller-widget.contract.test.ts` (modified 2026-09-14)
- `story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts` (modified 2026-09-14)
- `story-9.11.rag-discovery-ui.contract.test.ts` (modified 2026-09-14)
- `story-9.4.crisis-threshold-wizard.contract.test.ts` (modified 2026-09-14)
- `story-9.6.onboarding-checklist-ui.contract.test.ts` (modified 2026-09-14)

### social-listening-core/contracts (154 files)

- `story-1.1.independent-repo-scaffold.contract.test.ts` (modified 2026-09-14)
- `story-1.10.postgres-readiness-and-health.contract.test.ts` (modified 2026-09-14)
- `story-1.11.connector-activation.contract.test.ts` (modified 2026-09-14)
- `story-1.12.connector-status-includes-activation.contract.test.ts` (modified 2026-09-14)
- `story-1.13.live-ingestion-polling-scheduler.contract.test.ts` (modified 2026-09-14)
- `story-1.14.poll-scheduler-skip-in-flight.contract.test.ts` (modified 2026-09-14)
- `story-1.15.tier3-poll-scheduling.contract.test.ts` (modified 2026-09-14)
- `story-1.16.ingestion-watchdog-and-stalled-alerts.contract.test.ts` (modified 2026-09-14)
- `story-1.2.postgres-jsonb.contract.test.ts` (modified 2026-09-14)
- `story-1.3.api-versioning.contract.test.ts` (modified 2026-09-14)
- `story-1.4.persistent-local-dev-database.contract.test.ts` (modified 2026-09-14)
- `story-1.5.watchlist-crud.contract.test.ts` (modified 2026-09-14)
- `story-1.6.connector-connect-disconnect.contract.test.ts` (modified 2026-09-14)
- `story-1.7.ownership-tier-connect-disconnect.contract.test.ts` (modified 2026-09-14)
- `story-1.8.tenant-self-view.contract.test.ts` (modified 2026-09-14)
- `story-1.9.user-invite-offboard.contract.test.ts` (modified 2026-09-14)
- `story-10.1.prospecting-list-model.contract.test.ts` (modified 2026-09-14)
- `story-10.11.webhook-notifications.contract.test.ts` (modified 2026-09-14)
- `story-10.13.youtube-connector.contract.test.ts` (modified 2026-09-14)
- `story-10.14.ai-insights-digest.contract.test.ts` (modified 2026-09-14)
- `story-10.3.preconfigured-analytics-views.contract.test.ts` (modified 2026-09-14)
- `story-10.4.ad-hoc-query-endpoint.contract.test.ts` (modified 2026-09-14)
- `story-10.6.platform-metrics.contract.test.ts` (modified 2026-09-14)
- `story-10.8.data-export-posts-csv.contract.test.ts` (modified 2026-09-14)
- `story-10.9.real-time-alert-rules.contract.test.ts` (modified 2026-09-14)
- `story-11.1.crm-connector-and-case-handoff.contract.test.ts` (modified 2026-09-14)
- `story-11.11.mention-suggestions.contract.test.ts` (modified 2026-09-14)
- `story-11.3.daily-digest-email.contract.test.ts` (modified 2026-09-14)
- `story-11.5.topic-evolution.contract.test.ts` (modified 2026-09-14)
- `story-11.7.publishing-and-scheduling.contract.test.ts` (modified 2026-09-14)
- `story-11.9.social-inbox-and-reply.contract.test.ts` (modified 2026-09-14)
- `story-12.1.connector-capability-matrix.contract.test.ts` (modified 2026-09-14)
- `story-12.11.public-api-and-webhooks.contract.test.ts` (modified 2026-09-14)
- `story-12.13.multi-user-workspaces-rbac.contract.test.ts` (modified 2026-09-14)
- `story-12.15.influencer-discovery-and-scoring.contract.test.ts` (modified 2026-09-14)
- `story-12.3.boolean-query-ast.contract.test.ts` (modified 2026-09-14)
- `story-12.5.ai-sentiment-aspect-schema.contract.test.ts` (modified 2026-09-14)
- `story-12.7.ai-topic-clustering-post-topics-schema.contract.test.ts` (modified 2026-09-14)
- `story-12.9.dashboard-widget-contracts.contract.test.ts` (modified 2026-09-14)
- `story-13.1.connector-health-auto-disable-and-recovery.contract.test.ts` (modified 2026-09-14)
- `story-13.11.semantic-drift-detection.contract.test.ts` (modified 2026-09-14)
- `story-13.13.prospecting-list-export-and-crm-push.contract.test.ts` (modified 2026-09-14)
- `story-13.2.per-connector-query-translation-and-validation.contract.test.ts` (modified 2026-09-14)
- `story-13.4.export-bounding-streaming-and-size-caps.contract.test.ts` (modified 2026-09-14)
- `story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts` (modified 2026-09-14)
- `story-13.6.admin-tenant-plan-read.contract.test.ts` (modified 2026-09-14)
- `story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` (modified 2026-09-14)
- `story-13.8.platform-metrics-table-and-azure-metrics.contract.test.ts` (modified 2026-09-14)
- `story-13.9.publishing-media-upload-and-asset-targeting.contract.test.ts` (modified 2026-09-14)
- `story-14.1.additional-social-platform-publishing-roadmap.contract.test.ts` (modified 2026-09-14)
- `story-14.2.editing-and-deleting-published-outbound-posts.contract.test.ts` (modified 2026-09-14)
- `story-14.3.search-provider-connector-abstraction.contract.test.ts` (modified 2026-09-14)
- `story-14.4.composer-deep-research-caching.contract.test.ts` (modified 2026-09-14)
- `story-14.5.self-learning-telemetry.contract.test.ts` (modified 2026-09-14)
- `story-15.1.alert-rules-refinements.contract.test.ts` (modified 2026-09-14)
- `story-15.2.data-export-sampling.contract.test.ts` (modified 2026-09-14)
- `story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts` (modified 2026-09-14)
- `story-16.2.dsr-article-18-restriction.contract.test.ts` (modified 2026-09-14)
- `story-16.3.audit-hash-chaining-manifest.contract.test.ts` (modified 2026-09-14)
- `story-16.4.platform-ops-quota-burn-rate.contract.test.ts` (modified 2026-09-14)
- `story-17.1.prospecting-list-refinements.contract.test.ts` (modified 2026-09-14)
- `story-17.3.crisis-baseline-escalation.contract.test.ts` (modified 2026-09-14)
- `story-18.1.watchlist-cost-projection.contract.test.ts` (modified 2026-09-14)
- `story-18.2.preconfigured-analytics-views-rls.contract.test.ts` (modified 2026-09-14)
- `story-19.1.rag-connector-namespace-isolation.contract.test.ts` (modified 2026-09-14)
- `story-19.2.rag-chunking-embedding-namespace-routing.contract.test.ts` (modified 2026-09-14)
- `story-19.3.rag-vector-store-namespace-isolation.contract.test.ts` (modified 2026-09-14)
- `story-2.1.provider-connector-framework.contract.test.ts` (modified 2026-09-14)
- `story-2.10.connector-registration-transparency.contract.test.ts` (modified 2026-09-14)
- `story-2.11.tenant-owned-feed-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts` (modified 2026-09-14)
- `story-2.13.wikipedia-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts` (modified 2026-09-14)
- `story-2.15.facebook-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.16.azure-ai-language-classified-document-error.contract.test.ts` (modified 2026-09-14)
- `story-2.17.azure-openai-summary-field.contract.test.ts` (modified 2026-09-14)
- `story-2.18.facebook-engagement-counts.contract.test.ts` (modified 2026-09-14)
- `story-2.19.tenant-owned-feed-naming-and-byline.contract.test.ts` (modified 2026-09-14)
- `story-2.2.per-tenant-rate-limiting.contract.test.ts` (modified 2026-09-14)
- `story-2.20.geospatial-enrichment.contract.test.ts` (modified 2026-09-14)
- `story-2.21.brave-search-active-watchlist-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.22.bing-search-active-watchlist-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.23.facebook-page-dependency-and-author-resolution.contract.test.ts` (modified 2026-09-14)
- `story-2.24.instagram-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.25.linkedin-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.26.connector-reply-framework.contract.test.ts` (modified 2026-09-14)
- `story-2.27.facebook-page-reply-implementation.contract.test.ts` (modified 2026-09-14)
- `story-2.28.connector-publish-framework.contract.test.ts` (modified 2026-09-14)
- `story-2.29.facebook-page-post-publishing.contract.test.ts` (modified 2026-09-14)
- `story-2.3.error-handling-auto-disable.contract.test.ts` (modified 2026-09-14)
- `story-2.30.linkedin-post-publishing.contract.test.ts` (modified 2026-09-14)
- `story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts` (modified 2026-09-14)
- `story-2.32.azure-openai-research-capability.contract.test.ts` (modified 2026-09-14)
- `story-2.4.bounded-queues-and-dead-lettering.contract.test.ts` (modified 2026-09-14)
- `story-2.5.proportional-failure-threshold.contract.test.ts` (modified 2026-09-14)
- `story-2.6.newswire-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.7.gnews-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.8.azure-ai-language-connector.contract.test.ts` (modified 2026-09-14)
- `story-2.9.second-ai-provider-connector.contract.test.ts` (modified 2026-09-14)
- `story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts` (modified 2026-09-14)
- `story-6.27.facebook-multi-page-support.contract.test.ts` (modified 2026-09-14)
- `story-6.37.watchlist-raw-payload.contract.test.ts` (modified 2026-09-14)
- `story-3.1.author-normalization.contract.test.ts` (modified 2026-09-14)
- `story-3.10.canonical-markdown-post-body-normalization.contract.test.ts` (modified 2026-09-14)
- `story-3.11.post-watchlist-match-persistence.contract.test.ts` (modified 2026-09-14)
- `story-3.12.post-watchlist-match-backfill-and-discovery-attribution.contract.test.ts` (modified 2026-09-14)
- `story-3.13.post-enrichment-overrides.contract.test.ts` (modified 2026-09-14)
- `story-3.14.outbound-reply-audit.contract.test.ts` (modified 2026-09-14)
- `story-3.15.outbound-post-publishing-audit.contract.test.ts` (modified 2026-09-14)
- `story-3.16.tenant-workspace-and-posts-export.contract.test.ts` (modified 2026-09-14)
- `story-3.17.composer-deep-research.contract.test.ts` (modified 2026-09-14)
- `story-3.2.ingestion-run-audit-anchor.contract.test.ts` (modified 2026-09-14)
- `story-3.2.ingestion-run-retryable-field.contract.test.ts` (modified 2026-09-14)
- `story-3.3.watchlist-matching.contract.test.ts` (modified 2026-09-14)
- `story-3.4.cursor-pagination.contract.test.ts` (modified 2026-09-14)
- `story-3.5.tiered-retention-and-archival.contract.test.ts` (modified 2026-09-14)
- `story-3.6.watchlist-boolean-ast.contract.test.ts` (modified 2026-09-14)
- `story-3.8.self-service-tenant-initiated-deletion.contract.test.ts` (modified 2026-09-14)
- `story-3.9.author-follower-count-at-publish.contract.test.ts` (modified 2026-09-14)
- `story-6.16.post-manual-enrich-endpoint.contract.test.ts` (modified 2026-09-14)
- `story-6.19.post-body-markdown-exposure.contract.test.ts` (modified 2026-09-14)
- `story-4.1.author-topic-signals.contract.test.ts` (modified 2026-09-14)
- `story-4.2.topic-time-series-deferred.contract.test.ts` (modified 2026-09-14)
- `story-4.3.derived-connector-health.contract.test.ts` (modified 2026-09-14)
- `story-4.3.health-derivation-index.contract.test.ts` (modified 2026-09-14)
- `story-4.4.derived-data-caching-and-refresh.contract.test.ts` (modified 2026-09-14)
- `story-5.1.thin-events.contract.test.ts` (modified 2026-09-14)
- `story-5.10.retire-x-tenant-id.contract.test.ts` (modified 2026-09-14)
- `story-5.11.get-v1-me.contract.test.ts` (modified 2026-09-14)
- `story-5.12.platform-admin-tenant-management.contract.test.ts` (modified 2026-09-14)
- `story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts` (modified 2026-09-14)
- `story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts` (modified 2026-09-14)
- `story-5.15.self-service-tenant-signup.contract.test.ts` (modified 2026-09-14)
- `story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts` (modified 2026-09-14)
- `story-5.17.access-history-read-endpoint.contract.test.ts` (modified 2026-09-14)
- `story-5.18.signup-rate-limiting.contract.test.ts` (modified 2026-09-14)
- `story-5.19.wire-ingestion-events.contract.test.ts` (modified 2026-09-14)
- `story-5.2.per-tenant-event-filtering.contract.test.ts` (modified 2026-09-14)
- `story-5.3.credential-envelope-encryption.contract.test.ts` (modified 2026-09-14)
- `story-5.4.tenant-isolation-rls.contract.test.ts` (modified 2026-09-14)
- `story-5.5.event-schema-versioning.contract.test.ts` (modified 2026-09-14)
- `story-5.6.entra-authentication.contract.test.ts` (modified 2026-09-14)
- `story-5.7.platform-admin-rls-bypass.contract.test.ts` (modified 2026-09-14)
- `story-5.8.tenants-table-rls.contract.test.ts` (modified 2026-09-14)
- `story-5.9.users-table-identity-resolution.contract.test.ts` (modified 2026-09-14)
- `story-8.8.posts-explain-spike.contract.test.ts` (modified 2026-09-14)
- `story-9.1.watchlist-preview-volume.contract.test.ts` (modified 2026-09-14)
- `story-9.10.rag-endpoints.contract.test.ts` (modified 2026-09-14)
- `story-9.2.metric-explainability.contract.test.ts` (modified 2026-09-14)
- `story-9.3.crisis-templates.contract.test.ts` (modified 2026-09-14)
- `story-9.5.onboarding-checklist-state.contract.test.ts` (modified 2026-09-14)
- `story-9.7.rag-connector.contract.test.ts` (modified 2026-09-14)
- `story-9.8.rag-chunking-pipeline.contract.test.ts` (modified 2026-09-14)
- `story-9.9.rag-vector-rls.contract.test.ts` (modified 2026-09-14)

## 5. ADR Implementation Learnings Status

**Annotated (10):**
- 0036-admin-ui-authentication-session-and-role-gating-mechanism
- 0074-tenant-facing-workspace-and-posts-export
- 0076-composer-deep-research-agent
- 0090-data-export-posts-csv
- 0118-additional-social-platform-publishing
- 0119-editing-and-deleting-published-outbound-posts
- 0120-search-provider-connector
- 0121-composer-deep-research-caching-retrigger-cost
- 0122-continuous-self-learning-synthesis-and-telemetry-feedback-loop
- 0123-real-time-alert-rules-and-delivery-refinements

**Not yet annotated (130):** _Not all ADRs need annotations — only those whose upfront assumptions were refined by implementation._

## 6. Environment Gotchas (Snapshot)

Current gotchas file has 9 sections:

- Real Azure / external-service timing
- Azure CLI / credential context
- Jest parallel-worker collisions against shared real resources
- Test database template (jest.global-setup.js / testDbClone.ts)
- Caching & Hashing (composerResearchService.ts)
- Local dev environment / scripts
- Auth / identity wiring
- Jest environment surprises
- npm / transitive dependency surprises

## 7. Synthesis Recommendations

The following are surfaced from the captured telemetry for manual review:

### Environment Gotchas to Verify

- **`787b94599b994686fb9c24205ec2a9a6ae1e1fe4`** — fix(deps): resolve 6 Dependabot alerts (4 high, 2 moderate): verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`69dfcfaf9fddec923101562f1848774d4bae2e4f`** — fix(second-brain-sync): call full heal-obsidian-brain instead of export+backfill only: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`cad31cad441fee4dba31dece501a7e1474eb8cb3`** — fix(obsidian-brain): expand type aliases and auto-heal duplicate artifact_ids: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`dc3958f4b9bbdce2945826c668c5ce4d73107d59`** — fix(docs): resolve unresolved merge-conflict markers left in onboarding-checklist-ui SKILL.md: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`421a4c12e1525d431a2098b397f0478a214014fb`** — fix(core): heal story-13.8 contract test isolation and gate platform metrics worker: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`acb77fa368a8214a9040e6ab2a15de3891cec2fd`** — heal(story-6.41 8.6) Healing Stories 6.41 and 8.6 failing contracts now healed: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`cf425ddc7bd4abd8265e5f07679d4c06eb0ecc7b`** — fix(admin): heal contract failures and typecheck errors across admin and analytics: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`4edf26fac3b84b3063200636f9e19f704c17c2e4`** — fix(posts-csv-export): drain background export jobs before Jest teardown: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`7850f1d9d27ba737ab32aae5387cef6ad475caf3`** — fix(feature-gating): avoid 500 from requireFeatureGate on synthetic test tenant ids: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`e493fb479930cddf4d094e33759b1d1f2cd7732c`** — heal(contract): Story 3.8 self-service tenant deletion: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`be5702dadae2e902c423241e339104f176e8d4ba`** — heal(contract): Story 6.27 multi-Page status assertion: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`a5c926c9cd44fb6f6343f125d913a8ef66ce9c2a`** — heal(story-11.5): use resolved identity and validate granularity in /v1/topics/evolution: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`daf9c3f36146ca508f00cd64736be2c4b77295fb`** — fix(posts): Facebook post display regression — extractDisplayText returns empty title + snippet: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`37d0bf5fa6598ca71da418976b3395aa5d3d3a59`** — fix(events): skip Service Bus publish when SERVICE_BUS_NAMESPACE is unset: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`2a4ea316d3c661e405a6d1f6099fa0b1e156764b`** — fix(connectors): add youtube, brave-search, and bing-search cadences to status view: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`57a0dacfb7c4448b975d167fcf9ce1d9bbce5c44`** — fix(youtube): support API key credential envelope encryption and activation in youtube connect route: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`58895f01d8c24bba9061cc8a1b9f052c20bd2a29`** — fix(contracts): heal story-1.13, story-3.15, story-4.2, and story-9.7/9.9/9.10 contracts: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`994b4b8fac6b382a44a7fbbfa3a0b88176e4e05e`** — fix(contracts): heal story-6.39 contract for story-11.8 outbound publishing: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`a4dbb663a292007930d6d2632dfc3c67429a7832`** — fix(rag): fetch live status on mount in RAGDiscoveryClient: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`a57a0d5f29ff0faee0c4fcb272060e6269fe238b`** — fix(rag): add migration 0047 granting app_user permissions on rag_chunks and rag_chunks_sync: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`4ae7f926ee52e562673a8ca36e0573cefbf84ddb`** — fix(admin): eliminate duplicate onboarding checklist exports and fix typing in OnboardingChecklist: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`2ccc739d97c475292e1fc1e233b1d886343bec49`** — fix(dashboard): recognize Relocated story status so Story 6.6 stub is not counted as pending: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`c490a9969df68a220df1403dc4accf1d9057b78e`** — fix(dashboard): recognize Retired story status so Story 3.7 is not counted as pending: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`0a7def75f57922f064ce0277641b40dfd543516a`** — fix(synthesis): run capture-compile sequentially in post-commit hook: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`4595a200866fdaa9a8576aa57b1fce05b12ad5f1`** — docs(adr-0122): complete Story 14.5 self-learning synthesis remediation: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`3cb453d5a0a0b08906108f0b6a81e6fe05766469`** — heal(story-6.2): add CSS module mapper to Jest config for page.module.css import: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`01bce70d1e9d74c31131a128eaaf6b98e1ab3629`** — heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`55a2014dfb0bc94aa6f53243ae87dcc896202037`** — fix(composer): add linkPreview to LinkedInPreviewCard props destructuring: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`48c77c4633d99a092a984b7a91811dd65f4c8ee0`** — fix(composer): destructure linkPreview prop in PlatformPreviewRails and pass to all preview cards: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`e31fe98e69ea14dfa2867fb0dfe569a09848ea93`** — fix(core): improve LinkedIn credential parsing, profile fetching, and version handling: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`1713a095ae74641e7a627bcbfee82e241ce61cad`** — fix(core): enable configurable lookback and ingest historical Instagram posts: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`3318b2b6f356dd7f634b21f7a85cef4e67671e41`** — fix(core): update scheduler test provider roster, refine reconnect_required derivation, and handle Graph API error bodies: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`d0094f6abee8dedca9656280453003ea213596a5`** — fix(core+admin): heal postgres connection pool deadlock and scope facebook page health: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`30ed2dffbe1ca01d31ff0d36081a4ae3952dc75f`** — fix(analytics): add resilient error handling for watchlist coverage and analytics initial load: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`cb953f1d197bf09f6c7cfc1cbcc57950d5276038`** — fix(tenant): show most-recently ingested posts first in recent ingestion stream: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`3d7d7435a8a67f17d4e68b6b165e3772c8e747f6`** — fix(analytics): align topic selector, date range picker, and matching posts count on a single control line: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`aa1e7f5802d2ca7af48ef119aca91f365af3af50`** — fix(analytics): sort watchlist coverage descending by post count and limit to top 6 items: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`2fa45ba5bfb07660987e34c90019241081e50094`** — fix(post-feed): surface Facebook Page author and original-post link: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`75362d338413dd2a1e2cc36d12219b48798f9118`** — fix(facebook-connector): denormalize Page id/name into rawPayload: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`cd6f41e08dea95d06748056c97e54802e35c6fb7`** — fix(post-feed): allocate the Newswire issuer to the author position: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`efa96e8869d1b24b396cb2f7e9d00e872e20acc4`** — fix(analytics-overview): unreadable white-on-white post title in drawer rows: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`66735370992a4a48420236e90a5b97ddf339ed8c`** — fix(post-commit hook): stop the queue files from re-queuing their own bookkeeping commits: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`1974d1dd363242eae763e49c9db48c9a5cc2eb48`** — heal(story-6.27): give the fan-out test enough real-world margin: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`23e94fc7c9ff52db4e2274d258b2afcbbd0dc8c4`** — heal(story-6.1): fix broken local-dev login and Jest TLS-trust gap: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`fc011dff25330c55d8c3b930e443dba51cbda272`** — fix(post-feed): normalize Facebook post titles instead of raw JSON: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`3fedac3ce1436b0e3384bd1d4acfa3d56c35fcdb`** — fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`4bea1b849d0601c6d88c43607d969c5679d930a0`** — fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved): verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`ff66d311baf94aa1edf370d4f3453a6dbc1fbfa8`** — fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`5886a3e87b9ac3c6c4cb33bca77ee3840ea0fe18`** — fix(admin): Provider filter's tenant-owned-feed option used the wrong value: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`eeb9c8c317d2430820a024c3a7a9ec45d53a54c1`** — fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.
- **`5d0fb49d7174e4941e770ffd0baef4534cd67e98`** — fix(core): reject personal-scope connect/activate for AI provider connectors: verify this is indexed in `docs/environment-gotchas.md`. If not, add an entry with root cause and permanent guardrail.

### ADR In-Place Annotations to Verify

Feature commits reference stories: 14.5, 14.4, 14.3, 14.2, 14.1.
Verify that any ADR whose assumptions were refined by these stories carries a `## Implementation Learnings & Real-World Constraints` section with commit references.

### Lessons-Learned-Register Patterns

Check whether any new cross-cutting architectural patterns emerged from this epic's implementation that should be added to the `Reusable Architectural & System Patterns` section.

---

*Generated by `scripts/synthesize-telemetry.mjs --compile` per ADR-0122.*