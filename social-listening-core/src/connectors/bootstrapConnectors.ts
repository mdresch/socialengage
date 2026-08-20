import { gnewsConnector } from './gnews/gnewsConnector';
import { pollGNewsSearch } from './gnews/pollGNewsSearch';
import { newswireConnector } from './newswire/newswireConnector';
import { pollNewswireFeeds } from './newswire/pollNewswireFeeds';
import { tenantOwnedFeedConnector } from './tenantOwnedFeed/tenantOwnedFeedConnector';
import { pollTenantOwnedFeed } from './tenantOwnedFeed/pollTenantOwnedFeed';
import { wikipediaConnector } from './wikipedia/wikipediaConnector';
import { pollWikipedia } from './wikipedia/pollWikipedia';
import { azureAiLanguageConnector } from './azureAiLanguage/azureAiLanguageConnector';
import { azureOpenAiConnector } from './azureOpenAi/azureOpenAiConnector';
import { facebookConnector } from './facebook/facebookConnector';
import { pollFacebook } from './facebook/pollFacebook';
import { braveSearchConnector } from './braveSearch/braveSearchConnector';
import { pollBraveSearch } from './braveSearch/pollBraveSearch';
import { registerSocialConnector, registerAIProviderConnector } from './registry';

/** Implementation defaults (ADR-0052 §9) — real, named, revisable numbers. */
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
/** ADR-0050's own already-decided tenant-owned-feed cadence — not re-litigated here. */
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
/** ADR-0065 quota-safe active watchlist search cadence — 1 hour default. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Story 1.13 (ADR-0052 Decision §3) — the one real production call site
 * that populates the shared connector registry (`registry.ts`). Before this
 * story, `registerSocialConnector()`/`registerAIProviderConnector()` were
 * only ever called from Jest contract test setup (plus, for the two
 * AIProviderConnectors, `enrichPost.ts`'s own pre-existing module-load side
 * effect) — `getSocialConnector()`/`listSocialConnectors()` returned
 * `undefined`/`[]` in the real running server. Must be called from
 * server.ts's `main()` before the scheduler's first tick and before the
 * HTTP listener starts accepting traffic (ADR-0052 Decision §3) — never
 * from `createApp()`.
 *
 * Each poll-mode SocialConnector is registered as a thin wrapper —
 * `{ ...connector, poll, pollCadenceMs }` — a new object, never a mutation
 * of the connector's own exported const or a rewrite of its already-
 * contract-verified pollX() function (ADR-0052 Decision §4). The spread
 * (rather than adding `poll`/`pollCadenceMs` directly inside
 * gnewsConnector.ts/newswireConnector.ts/tenantOwnedFeedConnector.ts's own
 * object literal) exists specifically to avoid a circular import: each
 * pollX() function already imports its own connector object, so the
 * connector object importing pollX() back would cycle.
 *
 * Bootstrap failure handling (ADR-0052 Open Question 6, left to this
 * story): a registration error here is allowed to propagate and crash
 * startup, same as `waitForPostgresReady()`'s own failure handling in
 * server.ts — fail loud on a startup-time misconfiguration rather than
 * silently run with a reduced connector set.
 */
export function bootstrapConnectors(): void {
  registerSocialConnector({
    ...gnewsConnector,
    poll: (tenantId: string) => pollGNewsSearch(tenantId),
    pollCadenceMs: FIFTEEN_MINUTES_MS,
  });

  registerSocialConnector({
    ...newswireConnector,
    poll: (tenantId: string) => pollNewswireFeeds(tenantId),
    pollCadenceMs: FIFTEEN_MINUTES_MS,
  });

  registerSocialConnector({
    ...tenantOwnedFeedConnector,
    poll: (tenantId: string) => pollTenantOwnedFeed(tenantId),
    pollCadenceMs: THIRTY_MINUTES_MS,
  });

  // Story 2.13 (ADR-0042) — no confirmed real-world edit-frequency
  // constraint drives this number; matches tenant-owned-feed's own
  // "not urgent breaking news" cadence rather than GNews/Newswire's
  // 15-minute one. A real, revisable implementation default, not a
  // Wikimedia-mandated value.
  registerSocialConnector({
    ...wikipediaConnector,
    poll: (tenantId: string) => pollWikipedia(tenantId),
    pollCadenceMs: THIRTY_MINUTES_MS,
  });

  // Story 1.15 (ADR-0061 Decision §3) — registered with `pollUser`, never
  // `poll`/`pollCadenceMs`: this connector is Tier-3-only (ADR-0059
  // Decision §4) and can never have a tenant-wide activation, so it must
  // never be picked up by the scheduler's tenant-wide enumeration loop.
  // The scheduler's separate per-user loop calls pollUser(tenantId, userId)
  // once per due (tenant, user) tuple instead — see this connector's own
  // SKILL.md and .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
  registerSocialConnector({
    ...facebookConnector,
    pollUser: pollFacebook,
    pollCadenceMs: THIRTY_MINUTES_MS,
  });

  // Story 2.21 (ADR-0065) — Active watchlist sourcing via Brave Search API.
  // 1-hour default cadence balances discovery freshness against search quota.
  registerSocialConnector({
    ...braveSearchConnector,
    poll: (tenantId: string) => pollBraveSearch(tenantId),
    pollCadenceMs: ONE_HOUR_MS,
  });

  registerAIProviderConnector(azureAiLanguageConnector);
  registerAIProviderConnector(azureOpenAiConnector);
}
