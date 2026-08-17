# ADR-0055: Language and location enrichment for the Analytics Dashboard — surfacing an already-captured field vs. a still-absent one

**Status:** Proposed
**Source:** Not specified in the design spec or any prior ADR. Requested directly by Menno, 2026-08-17, the same day ADR-0054/Epic 8 shipped, after a structured comparison between the real, built Analytics Dashboard (`social-listening-admin/src/app/tenant/analytics/`) and the earlier Google AI Studio design reference found two categories of widget "NOT BUILDABLE" for lack of a real field: a Languages breakdown (Sources/Conversations tabs in the reference) and everything Location-related (world map, region filters, geo-density). Menno's own words: *"could we add an ADR to build the missing fields in the backend the language and the revisit of the location as it brings many graphical datapoints in the dashboards?"* — this ADR investigates both independently rather than assuming a shared answer.

## Context

### The two gaps, as previously named

`docs/design/Google AI Studio/src/components/ConversationsDashboardTab.tsx` (line 296) and `LocationDashboardTab.tsx` both render a "Languages Breakdown" widget (`languagesData`), and `docs/design/Google AI Studio/src/types/index.ts` (line 135) carries `language?: string` directly on its `FlatPost` type. Neither widget shipped in Epic 8 (Stories 8.1–8.3) because, at ADR-0054's drafting time, nobody had checked whether this project's real enrichment pipeline captures a language field at all — ADR-0054's own Context section researched Location in depth (see below) but is silent on language entirely. This ADR closes that unresearched gap, and separately re-examines Location with one new finding ADR-0054 did not have.

### Language: already computed, already persisted, never surfaced — verified directly, not assumed

**Both of this project's real `AIProviderConnector` implementations already detect and return language on every successful `analyze()` call:**

- `social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts` (Story 2.8, ADR-0038) makes **four** real Azure AI Language capability calls per post, not three — `SentimentAnalysis`, `KeyPhraseExtraction`, `EntityRecognition`, and `LanguageDetection` (`Promise.all([...])`, lines 139–144) — and maps the fourth call's response directly onto the returned `AnalyzeResult`: `detectedLanguage: languageDoc.detectedLanguage?.iso6391Name` (line 169).
- `social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts` (Story 2.9, ADR-0038 §2) requires `detectedLanguage` as one of five fields in its structured-output JSON Schema (`ENRICHMENT_SCHEMA`, line 105, listed in `required`, line 117) and its system prompt explicitly instructs the model to "report... the detected ISO 639-1 language code" (line 153).
- `AnalyzeResult` itself (`social-listening-core/src/connectors/types.ts`, line 135) already declares `detectedLanguage?: string` as part of its shared interface — this is not a connector-local addition, it is the contract both real providers implement.
- `getModelCapabilities()` on both connectors already declares `supportsLanguageDetection: true` (`azureAiLanguageConnector.ts` line 124, `azureOpenAiConnector.ts` line 215) — a capability flag that has been true since Story 2.8/2.9 shipped and has never been read by anything downstream.

**This value already reaches the database and the wire, unmodified, today.** `enrichPost()` (`social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts`) returns the connector's `AnalyzeResult` object as-is; every real ingest path (`pollGNewsSearch.ts` line 105, `pollNewswireFeeds.ts` line 83, `pollTenantOwnedFeed.ts` line 78, and Story 6.16's manual-enrichment route, `postsRouter.ts` line 74) writes it into `social_posts.enrichment` as a single JSONB blob, cast but not filtered (`enrichment as unknown as Record<string, unknown> | undefined`) — confirmed directly against `socialPostStore.ts`'s `enrichment?: Record<string, unknown>` column definition (line 15) and its `INSERT`/`SELECT` statements, which never enumerate or strip individual keys. `SocialPostSummary` (`GET /v1/posts`, `socialPostStore.ts` line 213) returns `enrichment: unknown` — the same unfiltered blob, already confirmed by ADR-0054's own Context as the exact data source Epic 8's client-side aggregation reads. **Any post enriched by either real provider since Story 2.8/2.9 shipped already carries a real `detectedLanguage` value in the JSON this dashboard already fetches — it has simply never been read.**

**The one and only reason this isn't visible today is a client-side parsing gap, not a missing backend field.** `social-listening-admin/src/app/tenant/posts/postDisplay.ts`'s `PostEnrichmentSummary` interface (line 68) declares exactly `sentiment`, `sentimentScores`, `entities`, `keyPhrases`, `modelUsed` — no `language`/`detectedLanguage` field — and `extractEnrichmentSummary()` (line 88) never reads `e.detectedLanguage` from the `enrichment` object it already has in hand. This is the same shared function every Epic 8 widget's data ultimately traces back to (directly or via the paginated `GET /v1/posts` fetch loop Story 8.1 built) and the same function Story 6.11/6.16's post feed and detail view already use.

**Separately, and more weakly: GNews's own raw article response already carries a `lang` field** (`gnewsConnector.ts` line 17, `GNewsArticle.lang`, confirmed against `docs.gnews.io`'s own documented response shape per that file's existing code comment) — spread unmodified into `rawPayload` at ingest (`pollGNewsSearch.ts` line 103, `...article`), so it too is already wire-visible via `SocialPostSummary.rawPayload`. This is source-declared metadata about the article as published, not a per-post AI detection of the actual text — a real, secondary signal, but the AI-detected `enrichment.detectedLanguage` is the stronger, more universal one: it runs (best-effort) against all three connectors' content uniformly, where GNews's `lang` field exists only for GNews and Newswire/tenant-owned-feed's own RSS/Atom parsers carry no comparable field at all (confirmed via `Grep` for `lang`/`language` across `newswireConnector.ts`/`tenantOwnedFeedConnector.ts` and their pollers — no matches).

**Verdict: Language is genuinely buildable now, at very low cost, with no `social-listening-core` change of any kind required.**

### Location: re-investigated, same disqualifying findings as ADR-0054, plus one new nuance considered and declined

ADR-0054's own Context and Decision §4 already researched this in depth and concluded, with two independent, both-disqualifying findings: (1) `social_posts.post_geo_location` is a real, nullable column that **no connector populates** — confirmed again directly this session against `pollGNewsSearch.ts`, and structurally identical for Newswire/tenant-owned-feed, whose RSS/Atom parsers carry no geo-shaped field (`Grep` for `country|region|location|geo` across both poll files returns zero matches); and (2) even a populated column would not be visible to this dashboard's actual data source, because `SocialPostSummary` (what `GET /v1/posts` returns) omits `postGeoLocation` entirely — confirmed again directly this session, `socialPostStore.ts` line 213's `SocialPostSummary` interface still carries no such field; only the single-post `getSocialPostById()`/`SocialPostFull` fetch does (line 108). Nothing has changed since ADR-0054 was accepted hours earlier the same day — no new connector, no new tenant demand beyond the same dashboard-value argument ADR-0054 already weighed and declined to treat as sufficient trigger on its own.

**One new, real finding this ADR's own investigation surfaced that ADR-0054 did not have:** GNews's `GNewsArticle.source.country` (`gnewsConnector.ts` line 18) is a real field, already spread into `rawPayload` the same way `lang` is (`pollGNewsSearch.ts` line 103), and therefore already wire-visible via `SocialPostSummary.rawPayload` with zero backend change. This is genuinely, technically buildable as a "Source Country" widget today. **It is deliberately not recommended for adoption as a Location substitute, for three separate reasons, not one:**

1. It reports the country the *news outlet itself* is based in — not where the article's subject matter is located, not where any reader or engaged audience is, and not per-post geography of any kind. This is a categorically weaker signal than what "Location," a world map, or a geo-density heatmap implies to a viewer.
2. It exists for exactly one of this project's three real connectors. Newswire and tenant-owned-feed carry no country or region signal of any kind (confirmed above) — a "Source Country" widget would silently only ever reflect GNews-sourced posts, the same "coverage this project doesn't have" risk ADR-0054 Decision §2 already named and avoided for the Sources tab by scoping it to the real three-connector roster.
3. Labeling a "which country is the publisher headquartered in" statistic as anything resembling "Location" would risk exactly the failure mode ADR-0054's own Alternatives Considered table already rejected for a different reason — presenting a technically-real number in a way that implies a geographic-conversation-coverage claim it doesn't actually support. A real number, mislabeled, is a different failure than a fabricated one, but not a smaller one for a tenant reading the dashboard at face value.

**Verdict: Location — meaning per-post or per-conversation geography — remains not feasible, unchanged from ADR-0054. The one adjacent, technically-buildable option (GNews-only "Source Country") is named and explicitly declined here as a Location substitute; whether it's worth building as its own small, honestly-labeled, GNews-only widget is left as an Open Question, not decided by this ADR either way.**

### Author-rights standing check (per this role's charter)

This ADR touches ingested content with an `Author` — for all three real connectors, an issuing-organization/publication `Author` under ADR-0004's organization-as-Author clause, not an individual. Checked explicitly: neither `detectedLanguage` (a property of the post's text, not of the author) nor GNews's `source.country` (a property of the publisher's declared location, already visible in `rawPayload` and already displayed today via `extractAuthor()`/the Sources tab's own provider breakdown) introduces any new attribution mechanism, reassigns ownership, or creates a new redistribution path beyond what ADR-0054 already checked and scoped (the per-widget export Open Question, still undecided, inherited unchanged by any new widget this ADR might source). No new author-rights concern is introduced by either finding in this ADR.

---

## Decision

### 1. Language: build it — a `social-listening-admin`-only change, no `social-listening-core` work authorized or required

**Decided: widen `PostEnrichmentSummary`/`extractEnrichmentSummary()` (`postDisplay.ts`) to surface `detectedLanguage` from the `enrichment` object it already receives, and add a Languages breakdown to the Analytics Dashboard (Epic 8) computed from it, client-side, the same aggregation pattern every other Epic 8 widget already uses.** No new `social-listening-core` migration, column, connector change, or endpoint is authorized or required — the data already exists in `enrichment` for every post either real `AIProviderConnector` has enriched, and `GET /v1/posts` already returns it unfiltered.

Concrete shape, left to the sourced story's own implementation-time judgment on exact placement/styling, not fixed here:
- `PostEnrichmentSummary` gains `language: string | null` (an ISO 639-1 code, e.g. `"en"`), read from `enrichment.detectedLanguage`.
- A display-name mapping (ISO 639-1 code → human-readable name, e.g. `"en"` → `"English"`) is real, small, new UI work — not decided here, left to implementation.
- A Languages breakdown widget, aggregating enriched posts' `language` field, placed on the Sources tab (alongside the existing per-`providerId` breakdown, matching the Google AI Studio reference's own Sources-tab placement) or the Conversations tab (matching its Conversations-tab placement) — either is defensible; this ADR does not pick one.
- Posts with no `enrichment` at all (never enriched — no AI provider ever credentialed/active for that tenant) are excluded from the aggregation, the same "posts without a value don't get force-fit into a bucket" rule Sentiment/Sources already follow, not treated as an error state.

### 2. Location: do not build — reaffirms ADR-0054 Decision §4, no scope change

**Decided: no per-post or per-conversation Location feature is authorized by this ADR.** ADR-0054 Decision §4's own conclusion stands, re-verified independently in this ADR's own Context, not merely inherited on trust. **The GNews-only "Source Country" adjacent option (Context, above) is named but not authorized** — if Menno wants it pursued as its own narrow, honestly-labeled ("Source Country (GNews only)," never "Location") widget in a future pass, that is a separate, smaller decision this ADR deliberately leaves open (Open Questions) rather than bundles in here.

### 3. Relationship to ADR-0054

This ADR does not change ADR-0054's Decision or Consequences text. Location (§4/Open Question 1) is independently reconfirmed, not superseded — a dated Clarification note is added to ADR-0054's own Open Question 1 (not its Decision text) naming this ADR's GNews-country finding, per `docs/adr/README.md`'s governance-table row 4 ("implementation/investigation surfaces a constraint or detail that was already logically consistent with the decision, just not previously stated"). Language is new scope ADR-0054 never addressed (its own Decision §2 "In scope for v1" list names Sentiment/Conversations/Sources/Overview widgets exhaustively but is silent on language entirely — not a rejection, an omission) — this ADR, not ADR-0054, is Language's sourcing ADR.

---

## Consequences

**Positive**
- Closes a real, previously-unresearched gap at very low cost: Language requires no backend change at all, because the data has already been computed and persisted by already-shipped code (Story 2.8/2.9) since before Epic 8 even started.
- No historical backfill is needed — any post enriched since Story 2.8/2.9 shipped already carries `detectedLanguage` in its stored `enrichment` blob.
- Keeps the Location question honestly closed rather than reopened on hope: re-investigating it independently, rather than assuming ADR-0054's conclusion still holds, is exactly the discipline this project's own traceability standard requires — and it surfaced one genuine new nuance (GNews `source.country`) worth naming even though it doesn't change the bottom line.

**Negative**
- Language coverage is only as complete as enrichment coverage generally — a tenant with no AI provider ever credentialed/active sees no language data, the same limitation Sentiment/Key-Phrase widgets already have and already accept.
- The GNews-only "Source Country" option, though technically free to build, is named and left unbuilt — a real, if minor, missed opportunity if Menno judges the mislabeling risk (Decision §2, Context) acceptable with sufficiently careful copy; this ADR does not make that call.
- Widening `PostEnrichmentSummary` touches a function also used by the existing post feed/detail view (Story 6.11/6.16) — a shared-surface change, not purely additive to Epic 8 alone, though it changes nothing about those screens unless a future story chooses to render the new field there too.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Surface `detectedLanguage` from the already-persisted `enrichment` blob, zero backend change** | **Chosen (Language).** The data already exists and already flows over the wire; this is a client-side surfacing fix, not new capability. |
| **Add a dedicated `LanguageDetection`-only call/column, independent of the existing enrichment pipeline** | Rejected. Unnecessary — both real providers already call it as part of the existing `analyze()` flow; a separate call would duplicate cost and complexity for data already available. |
| **Build a GNews-only "Source Country" widget as a Location substitute** | Rejected for now, named as a real, technically-free option. Covers one of three connectors, reports publisher location not conversation geography, and risks the same real-but-mislabeled failure mode ADR-0054's Alternatives Considered table already rejected for fabricated data. Left as an Open Question, not decided. |
| **Widen `SocialPostSummary`/`GET v1/posts` and populate `post_geo_location` from a new geo-carrying source, to make a real per-post Location tab shippable** | Rejected for now — reaffirms ADR-0054's own identical rejection. No connector in this project's real roster (news/wire/RSS sources) is an obvious per-post geo-data carrier, and no demonstrated tenant need exists beyond the same dashboard-value argument ADR-0054 already weighed. |

---

## Open Questions

1. **Exact placement (Sources tab vs. Conversations tab) and styling of the Languages widget** — left to Story 8.5's own implementation-time judgment, not fixed here.
2. **Whether a GNews-only "Source Country" widget is worth building, honestly labeled and scoped to GNews alone** — named, not decided. A future, separate, smaller decision if Menno wants it pursued.
3. **ISO 639-1 code → display-name mapping** — a small, real UI detail (a static lookup table, or a library), left to implementation.
4. **Whether the widened `PostEnrichmentSummary.language` field should also be surfaced on the existing post feed/detail view (Story 6.11/6.16), not just the Analytics Dashboard** — a reasonable, low-cost follow-up, not decided or required by this ADR.

---

*Drafted 2026-08-17 by the AI Business & Requirements Analyst persona, at Menno's direct request. Verified directly before drafting, not assumed: `social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts`, `social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts`, and `social-listening-core/src/connectors/types.ts` (all read in full — confirmed `detectedLanguage` already computed by both real `AIProviderConnector`s and already part of the shared `AnalyzeResult` interface); `social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts`, `pollGNewsSearch.ts`, `pollNewswireFeeds.ts`, `pollTenantOwnedFeed.ts`, and `postsRouter.ts` (confirmed the full `AnalyzeResult` object, unfiltered, reaches `social_posts.enrichment` on every real ingest and manual-enrichment path); `social-listening-core/src/posts/socialPostStore.ts` (confirmed `enrichment`/`SocialPostSummary` are both unfiltered `Record<string, unknown>`/`unknown`, and re-confirmed `SocialPostSummary` still excludes `postGeoLocation`, only `SocialPostFull` carries it); `social-listening-admin/src/app/tenant/posts/postDisplay.ts` (confirmed `PostEnrichmentSummary`/`extractEnrichmentSummary()` read no language field today); `gnewsConnector.ts` (confirmed both `lang` and `source.country` are real GNews response fields, spread unmodified into `rawPayload`); a `Grep` for `country|region|location|geo` across `pollNewswireFeeds.ts`/`pollTenantOwnedFeed.ts` (zero matches, confirming neither carries any geo/country signal); `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md` and `docs/adr/0008-defer-topic-time-series-and-charting.md` (both read in full); `docs/design/Google AI Studio/src/components/ConversationsDashboardTab.tsx`, `LocationDashboardTab.tsx`, and `src/types/index.ts` (confirmed the reference design's own Languages Breakdown widget and `FlatPost.language` field, grounding the original gap this ADR closes). Left **Proposed**, per this persona's own charter boundary — Menno (Sponsor) reviews and accepts separately. Per this series' "no story until acceptance" precedent (ADR-0024/0026), **Story 8.5** is drafted alongside this ADR anyway, matching ADR-0054/Epic 8's own precedent for this specific kind of task — see `docs/user-stories/epic-8-analytics-dashboard.md`, Status **Blocked — pending ADR-0055 acceptance**. No story is drafted for Location, per ADR-0054's own "Not storied in this epic: Location tab" precedent — nothing about that conclusion changed.*
