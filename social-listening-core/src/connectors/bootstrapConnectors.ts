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
import { registerSocialConnector, registerAIProviderConnector } from './registry';

/** Implementation defaults (ADR-0052 §9) — real, named, revisable numbers. */
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
/** ADR-0050's own already-decided tenant-owned-feed cadence — not re-litigated here. */
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

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

  // Story 2.15 (ADR-0059) — registered WITH a real poll/pollCadenceMs
  // wrapper, matching every other connector's own shape (Story 1.13 AC1's
  // own registration invariant: every registered poll-mode connector has
  // both). Structurally unreachable today, honestly, not silently: the
  // scheduler's own eligibility check (shouldAttemptIngestion(tenantId,
  // platformId), defaulting to ownerType:'tenant') always returns false
  // for this connector, since it is Tier-3-only and can never have a
  // tenant-wide activation — so connector.poll below is never actually
  // invoked by the real running scheduler. It throws a clear, named error
  // rather than silently no-op'ing or faking a result if that assumption
  // is ever violated (e.g. a future scheduler change). Real Facebook
  // ingestion requires pollFacebook(tenantId, userId) invoked directly, or
  // real Tier-3 scheduler support (ADR-0052 Decision §6's own named,
  // not-yet-built gap) — see facebookConnector.ts's own doc comment and
  // this connector's own SKILL.md Known gaps.
  registerSocialConnector({
    ...facebookConnector,
    poll: async () => {
      throw new Error(
        'facebookConnector.poll(tenantId) has no tenant-wide credential to poll — this connector is Tier-3-only ' +
          '(ADR-0059 Decision §4). Real ingestion is pollFacebook(tenantId, userId), invoked directly; this wrapper ' +
          'should be structurally unreachable via the scheduler today (see ADR-0052 Decision §6, this connector\'s own SKILL.md Known gaps).'
      );
    },
    pollCadenceMs: THIRTY_MINUTES_MS,
  });

  registerAIProviderConnector(azureAiLanguageConnector);
  registerAIProviderConnector(azureOpenAiConnector);
}
