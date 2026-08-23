# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0053 Canonical Markdown Post Body Normalization At Ingestion — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, ../Business-Requirements/BRD-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0053-canonical-markdown-post-body-normalization-at-ingestion.md and the business requirements in BRD-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md into functional design for **Canonical Markdown Post Body Normalization At Ingestion**.
**What problem are we solving?** SocialEngage's AI enrichment results for Newswire and tenant-owned-feed posts were being computed from only a few words of title text, and GNews enrichment was using title plus description only. The real body of an article — press releases, blog posts, owned content — was never captured by the RSS/Atom parsers or stored anywhere on `social_posts`. Without a body column, no consumer (enrichment, display, export) could use the actual content.

**Who is affected?** Tenant-Users and Tenant-Admins who consume the post feed and rely on enrichment-derived sentiment, entities, and key phrases; anyone who later renders, exports, or analyzes post content.

**What is the proposed solution at a glance?** Introduce a canonical Markdown post-body representation: at ingestion, the richest available body field from each source is converted once to sanitized Markdown and stored on `social_posts` as `body_markdown`, with a companion `body_markdown_version` tracking the conversion pipeline. Newswire and tenant-owned-feed parsers are widened to actually capture `description`, `content:encoded`, and equivalent Atom fields, plus the raw item XML. GNews `content` is folded into the same pipeline. Enrichment is fed `[title, body_markdown]`, replacing title-only or title-plus-description inputs.

**What business value do we expect?** Richer, more accurate AI enrichment; a single, stable intermediate format that decouples every current and future ingestion source from every current and future content consumer; and reduced security/privacy noise through script, style, image, and tracking-parameter removal.

---

### 2.2 Scope
**In scope:**
- A new `social_posts.body_markdown` nullable `TEXT` column, populated once at ingestion.
- A new `social_posts.body_markdown_version` nullable `SMALLINT` column, starting at `1`.
- A shared `htmlToMarkdown()` utility used identically by Newswire, tenant-owned-feed, and GNews ingestion.
- Pre-conversion raw-source length guard (`MAX_BODY_SOURCE_LENGTH = 100,000` characters).
- Pre-conversion sanitization using `sanitize-html` with explicit `allowedTags` and `nonTextTags`.
- HTML-to-Markdown conversion via `turndown` plus `turndown-plugin-gfm` for table support.
- Tracking-query-parameter stripping from `<a href>` and `exclusiveFilter` removal of bare dead tracking domains.
- Widening `rssFeedParser.ts` to capture `description`, `contentEncoded`, and `rawXml`.
- Widening `feedItemParser.ts` to capture RSS `description`/`contentEncoded`, Atom `summary`/`content`, and `rawXml`.
- GNews `content` inclusion in the body source, with a regex trim for its free-tier truncation marker.
- Uniform enrichment input composition: `[title, body_markdown].filter(Boolean).join('. ')` for all three connectors.
- Exact-version pinning of `turndown`, `sanitize-html`, and `turndown-plugin-gfm` with a code comment referencing ADR-0053.
- A durable consumer contract: `body_markdown` is Markdown *source*, not display text; future renderers must convert and sanitize output.

**Out of scope:**
- No Admin UI Markdown rendering is designed or built here (separately delivered by Story 6.19).
- No Markdown → HTML / Word / PDF renderer is selected or specified.
- No historical backfill for already-ingested posts.
- No image preservation or legitimacy filtering for legitimate content images.
- No aggregate enrichment cost or quota ceiling.
- No fix for the pre-existing `enrichPost()` / `insertSocialPost()` write-ordering exposure.
- No Markdown-to-plain-text cleaning step for `enrichmentText` (deferred to a possible future ADR if real usage shows noise).

## 3. Context and Background
See ADR Context.
**What problem are we solving?** SocialEngage's AI enrichment results for Newswire and tenant-owned-feed posts were being computed from only a few words of title text, and GNews enrichment was using title plus description only. The real body of an article — press releases, blog posts, owned content — was never captured by the RSS/Atom parsers or stored anywhere on `social_posts`. Without a body column, no consumer (enrichment, display, export) could use the actual content.

**Who is affected?** Tenant-Users and Tenant-Admins who consume the post feed and rely on enrichment-derived sentiment, entities, and key phrases; anyone who later renders, exports, or analyzes post content.

**What is the proposed solution at a glance?** Introduce a canonical Markdown post-body representation: at ingestion, the richest available body field from each source is converted once to sanitized Markdown and stored on `social_posts` as `body_markdown`, with a companion `body_markdown_version` tracking the conversion pipeline. Newswire and tenant-owned-feed parsers are widened to actually capture `description`, `content:encoded`, and equivalent Atom fields, plus the raw item XML. GNews `content` is folded into the same pipeline. Enrichment is fed `[title, body_markdown]`, replacing title-only or title-plus-description inputs.

**What business value do we expect?** Richer, more accurate AI enrichment; a single, stable intermediate format that decouples every current and future ingestion source from every current and future content consumer; and reduced security/privacy noise through script, style, image, and tracking-parameter removal.

---

## 4. Goals and Objectives
|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Improve AI enrichment quality by including the actual article body, not just the title | Enrichment input for Newswire, tenant-owned-feed, and GNews contains `body_markdown` for all applicable posts |
|| 2 | Establish one canonical, stable content representation for all current and future consumers | `body_markdown` is the single source for enrichment, display, export, and other consumers |
|| 3 | Preserve the original platform payload without silent data loss | New `rawXml` field closes the previously unnamed `raw_payload` under-capture gap for RSS/Atom connectors |
|| 4 | Reduce untrusted-content and tracking noise in stored post bodies | `<script>`, `<style>`, `<img>`, known tracking query parameters, and dead bare-domain links are excluded |
|| 5 | Avoid future N×M conversion sprawl as new connectors or output formats are added | New consumers convert from Markdown only; new connectors convert to Markdown only |

---

**Positive consequences (from ADR):**
**Positive**
- Directly closes the root cause of the "enrichment results not that great" complaint that started this investigation: Newswire and tenant-owned-feed posts currently enrich on title text alone (a few words), not the actual press-release/blog-post body — the single biggest quality gap this ADR closes.
- Closes a real, previously-unnamed, silent `raw_payload` under-capture for two connectors (Context, second finding) — a side effect of widening the parsers for `body_markdown`'s sake, but independently valuable against ADR-0018's own "full original platform JSON, never discarded" framing.
- The N×M value proposition (Context) is real, not decorative: every future connector (Reddit, Wikipedia/Story 2.13) and every future consumption format (HTML render, Word export, PDF export) is decoupled from every other connector's/consumer's own shape, once each side only has to convert to/from the one canonical Markdown representation.
- `enrichment`-shaped storage (computed once, persisted) avoids the correctness trap a naive `ConnectorHealth`-style derivation would hit once `raw_payload` ages past its 90-day hot-storage window (ADR-0018) and is replaced by a blob pointer — `body_markdown` keeps working for old posts because it was captured while `raw_payload` was still live, independent of `raw_payload`'s own archival state.
- GNews's enrichment input gains real signal (`content`, even truncated on the free tier) it did not have before, per Menno's own explicit direction.
- The required pre-conversion `sanitize-html` pass (Decision §3) closes a real risk `turndown`'s own security documentation names directly, and — independently — improves conversion robustness against the malformed markup RSS/Atom feeds are known to contain (unclosed tags, mismatched nesting, vendor quirks), a genuine functional upside alongside the security one.
- `<script>`/`<style>` content, tracking pixels, and known link-tracking query parameters (UTM and equivalents) are all excluded from `body_markdown` by the decided sanitization configuration — real, previously-unaddressed data-quality/privacy concerns Menno raised directly, closed as part of the same pipeline rather than deferred.
- The pre-conversion length guard bounds both parser exposure to untrusted content (the tenant-owned-feed connector's own weaker trust boundary in particular) and per-post enrichment cost, without waiting on ADR-0052 Open Question 4's own broader, still-unresolved aggregate cost-ceiling design.
- Tracking-parameter stripping (Decision §3) no longer leaves behind dead, bare-domain links when a redirect service (e.g. Mailchimp click-tracking, `mc_cid`/`mc_eid`) encoded the destination entirely in the parameters being stripped — a real, concrete failure mode Menno identified directly, closed via `exclusiveFilter` rather than left unspecified.
- Real tabular content (a press release's own pricing/comparison/financial table) survives conversion with its row/column structure intact via `turndown-plugin-gfm`, rather than silently collapsing into unstructured, unreconstructable text — a real data-loss gap found and closed directly, not left as a side effect of the broader `allowedTags` decision.
- `body_markdown_version` means a future pipeline change (a library bump, a config change to `allowedTags`/the tracking-parameter denylist/etc.) never leaves the database silently ambiguous about which ruleset produced a given row — and lets a future backfill (Open Question 1) selectively target only outdated rows.
- The Context "second finding" `raw_payload` under-capture gap is now genuinely closed, not just narrowed — `rawXml` retains each item's entire raw inner XML block (already captured mid-parse, discarded before this addition), matching the same "never discarded" completeness GNews's own full-object `rawPayload` spread already had.

**Negative**
- **Two new dependencies are added to `social-listening-core`** (`turndown` and `sanitize-html` — neither previously existed) — a real, if small, new supply-chain surface for a solo-developer project that has otherwise kept its dependency list deliberately minimal (`package.json`'s current seven runtime dependencies, checked directly this session).
- **`body_markdown` for already-ingested historical rows is not backfilled by this ADR.** Existing Newswire/tenant-owned-feed/GNews posts will have `body_markdown = NULL` until re-ingested or a separate backfill job is run — named as an Open Question, not designed here.
- **GNews's `content` field is confirmed truncated on the free tier** (`docs.gnews.io`, fetched this session) — enrichment quality improves over title+description-only, but is not "full article text" for a free-tier tenant; a false expectation of completeness should not be set.
- **What GlobeNewswire's/PR Newswire's `<description>` typically contains (excerpt vs. full text) could not be confirmed this session** — the parser widening (§4) captures whatever is there, but its practical value for enrichment quality is not independently verified against a real sample, only asserted as plausible.
- **`htmlToMarkdown()` applied to already-plain text (GNews) will backslash-escape Markdown-significant characters** that occur naturally in the source (`*`, `_`, `[`, `]`, etc.) — correct, round-trip-safe Markdown behavior, but means `body_markdown` is not always byte-identical to the pre-conversion text even when no HTML was present, a subtlety worth knowing before assuming "no-op for plain text" means "untouched."
- **No admin UI consumer exists for `body_markdown` yet** — this ADR ships storage and enrichment-input improvements with no user-visible display change; the value is enrichment quality only until a future rendering story is built.
- **Images are dropped entirely, not filtered for legitimacy** — a real press release's own genuine photo or an org's logo is excluded exactly the same way a tracking pixel is, since this ADR does not attempt to distinguish the two. Accepted as the simpler, safer default for this ADR's actual (text-oriented) scope, not a nuanced content-preservation decision — named honestly rather than implied to be more sophisticated than it is.
- **The tracking-parameter denylist (Decision §3) is a fixed, named list, not exhaustive** — a tracking parameter this ADR doesn't name (a platform-specific or newly-invented one) will pass through unstripped until the list is revised; this is an implementation default, deliberately left revisable, not a claim of completeness.
- **An unusually long genuine post (rare, but real) is silently truncated at 100,000 characters, with no indicator in `body_markdown` itself by default** — a caller cannot distinguish "this post's real body was short" from "this post's body was truncated" without a future implementation adding a marker, which this Decision names as optional, not required.
- **`turndown-plugin-gfm` is a third dependency with real, if lower-recency, maintenance activity — last npm release 2018, last GitHub commit 2023.** Named honestly rather than described as actively maintained; accepted because the alternative (silent table-structure data loss) was judged worse, not because the recency gap is dismissed as unimportant.

---

## 5. Functional Requirements
|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|---|
|| BR-001 | The system shall store a canonical Markdown body for each ingested post in `social_posts.body_markdown` | Must | Nullable `TEXT` column added; populated once at ingestion for all three connectors | Product Owner |
|| BR-002 | The system shall track which conversion pipeline produced each `body_markdown` value | Must | Nullable `SMALLINT` `body_markdown_version` column added; `1` when `body_markdown` is non-null | Product Owner |
|| BR-003 | The system shall provide a single shared `htmlToMarkdown()` utility called by every connector | Must | All three `ingestX()` functions call the same module; no per-connector reimplementation | Technical Lead |
|| BR-004 | The system shall guard raw source length before sanitization or conversion | Must | Source string sliced to `MAX_BODY_SOURCE_LENGTH` (100,000 characters) before `sanitize-html`/`turndown` | Technical Lead |
|| BR-005 | The system shall sanitize untrusted source HTML before Markdown conversion | Must | `sanitize-html` with the explicit `allowedTags`/`nonTextTags` lists from ADR-0053 is applied | Technical Lead |
|| BR-006 | The system shall convert sanitized HTML to Markdown and preserve table structure | Must | `turndown@7.2.4` with `turndown-plugin-gfm` produces valid GFM tables | Technical Lead |
|| BR-007 | The system shall strip known tracking query parameters from links and drop bare dead tracking domains | Must | `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid` are removed; post-stripping bare-domain links are unwrapped to plain text | Product Owner |
|| BR-008 | The system shall widen the Newswire parser to capture body fields and raw item XML | Must | `ParsedRssItem` returns `description`, `contentEncoded`, and `rawXml` for RSS `<item>` | Technical Lead |
|| BR-009 | The system shall widen the tenant-owned-feed parser to capture both RSS and Atom body fields and raw XML | Must | `ParsedFeedItem` returns `description`, `contentEncoded`, `summary`, `content`, and `rawXml` | Technical Lead |
|| BR-010 | The system shall include GNews `content` in the body source, trimming the free-tier truncation marker | Must | GNews `content` is preferred over `description`; trailing `[+?N chars]` marker is removed | Technical Lead |
|| BR-011 | The system shall compose enrichment input uniformly from title and body | Must | All three connectors call `enrichPost()` with `[title, body_markdown].filter(Boolean).join('. ')` | Product Owner |
|| BR-012 | The system shall enforce that `body_markdown` is treated as Markdown source, not display text | Must | Consumer contract is documented; any future renderer must convert and sanitize output | Product Owner |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

## 6. User Interaction and Workflows
### 6.1 Primary Actors
|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
|| Tenant-User | Consumer of posts and enrichment results | High | Accurate sentiment, entities, and key phrases; readable post bodies |
|| Tenant-Admin | Configures connectors and watches feed quality | Medium | Better enrichment without per-connector setup changes |
|| AI Enrichment Consumers | Use enrichment output for insights | High | Body content, not just titles, in the analysis input |
|| Platform-Admin | Cross-tenant health and adoption observer | Low | No core-pipeline coupling; versioned, auditable storage |
|| Product Owner (Menno) | Sponsor and decision owner | High | Durable N×M decoupling and no silent data loss |
|| Future Display/Export Builders | Will render `body_markdown` | Medium | Clear contract that Markdown is source, not display text |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.10 | epic-3-data-model-storage-and-archival.md | As Tenant-Admin (or anyone relying on AI enrichment quality for ingested posts), I want Newswire, tenant-owned-feed, and GNews posts to be enriched on their ... | GNews's truncation-marker regex (AC9) is a best-current-understanding pattern, not confirmed against a real truncated response (ADR-0053 Open Question 11) — ... |
| Story 6.19 | epic-6-tenant-admin-ui.md | As tenant user or Tenant-Admin viewing a post's detail, I want the ingested article body shown as real, formatted text — real headers, bold, lists, links — n... | `SocialPostSummary`/`SocialPostFull` (`socialPostStore.ts`) gain `bodyMarkdown: string | null`, read from the already-populated `social_posts.body_markdown` ... |


## 7. Data Requirements
|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|---|
|| `social_posts.body_markdown` | Canonical Markdown post body, computed once at ingestion | Derived from source body field by `htmlToMarkdown()` | Core backend | Medium |
|| `social_posts.body_markdown_version` | Pipeline version that produced the Markdown; starts at `1` | Set alongside `body_markdown` at ingestion | Core backend | Low |
|| `ParsedRssItem.description` | RSS `<description>` body/excerpt field | Newswire RSS feed | Core backend | Medium |
|| `ParsedRssItem.contentEncoded` | RSS `<content:encoded>` full-content field | Newswire RSS feed | Core backend | Medium |
|| `ParsedRssItem.rawXml` | Verbatim raw inner XML of the RSS `<item>` | Newswire RSS feed | Core backend | Medium |
|| `ParsedFeedItem.description` / `contentEncoded` | RSS body/excerpt and full-content fields | Tenant-owned RSS feed | Core backend | Medium |
|| `ParsedFeedItem.summary` / `content` | Atom body/excerpt and full-content fields | Tenant-owned Atom feed | Core backend | Medium |
|| `ParsedFeedItem.rawXml` | Verbatim raw inner XML of the RSS/Atom item | Tenant-owned feed | Core backend | Medium |
|| `GNewsArticle.content` | Article `content` from GNews API | GNews API | Core backend | Medium |
|| `enrichmentText` | Ephemeral `title + '. ' + body_markdown` string passed to `enrichPost()` | Composed at ingestion | Core backend | Medium |

---

## 8. Business Rules and Logic
|| ID | Rule |
|---|---|
|| BRU-001 | `raw_payload`'s "store exactly what the source returned, immutable" discipline and 90-day archival tiering remain unchanged. |
|| BRU-002 | The body source for each post is the richest available field: `content:encoded`/`content` preferred over `description`/`summary`; `null` if none are present and non-empty. |
|| BRU-003 | `body_markdown` and `body_markdown_version` are `NULL` when no body source exists; they are never stored as empty strings. |
|| BRU-004 | The explicit tracking-parameter denylist is: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`. |
|| BRU-005 | Images (`<img>`) are excluded from `body_markdown` by default; this ADR does not distinguish legitimate content images from tracking pixels. |
|| BRU-006 | `body_markdown` is Markdown *source*; any future consumer must render it to the target format and sanitize rendered HTML before DOM insertion. |
|| BRU-007 | The exact versions of `turndown`, `sanitize-html`, and `turndown-plugin-gfm` are pinned, and the `htmlToMarkdown()` call site references ADR-0053. |
|| BRU-008 | Existing posts ingested before this ADR ships keep `body_markdown = NULL` unless a separate backfill or re-ingestion is performed. |

---

## 9. Interfaces and Integrations
|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|---|
|| D-001 | ADR-0016 – `raw_payload` as JSONB, immutable platform payload | Internal / ADR | Menno | Accepted |
|| D-002 | ADR-0018 – `raw_payload` retention and archival tiering | Internal / ADR | Menno | Accepted |
|| D-003 | ADR-0038 – AI enrichment provider selection and `enrichPost()` | Internal / ADR | Menno | Accepted |
|| D-004 | ADR-0050 – Tenant-owned domain RSS/Atom content feed connector | Internal / ADR | Menno | Accepted |
|| D-005 | ADR-0052 – Cursor-based pagination and `ClassifiableError` patterns | Internal / ADR | Menno | Accepted |
|| D-006 | `turndown@7.2.4`, `sanitize-html@2.17.6`, `turndown-plugin-gfm@1.0.2` | External / npm | Core backend | Pinned at Story time |
|| D-007 | Story 3.10 – `body_markdown` storage and `htmlToMarkdown()` implementation | Internal / Story | Core backend | Built |
|| D-008 | Story 6.19 – Admin UI Markdown rendering of `body_markdown` | Internal / Story | Admin UI | Built |

---

- Source body fields (`description`, `content:encoded`, `summary`, `content`, GNews `content`) contain HTML-ish or plain text and are worth preserving.
- GNews free-tier `content` may be truncated by the provider; any received snippet is accepted as more signal than none.
- Tenant-owned-feed sources are arbitrary third-party content selected by the tenant.
- Future consumers will honor the Markdown-source contract and apply their own output sanitization.
- The existing `rawPayload: { providerId, externalId, ...item }` spread pattern continues in Newswire and tenant-owned-feed ingest functions.

**The durable decision — this is what would need superseding, not just amending:**

## 10. Non-Functional Considerations
|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|---|
|| NFR-001 | `turndown`, `sanitize-html`, and `turndown-plugin-gfm` are exact-pinned with an ADR-0053 code comment | Maintainability | Must | `package.json` uses exact versions; call site references ADR-0053 |
|| NFR-002 | The conversion pipeline must tolerate malformed, unclosed, or vendor-specific RSS/Atom HTML | Reliability | Must | Tests pass with real-world malformed samples |
|| NFR-003 | The conversion pipeline must not execute scripts or load external resources | Security | Must | `<script>` and `<style>` content is discarded; `<img>` is excluded |
|| NFR-004 | `body_markdown` is computed and stored at ingestion, not derived on every read | Performance | Must | No read path recomputes Markdown from `raw_payload` |
|| NFR-005 | `body_markdown` and `body_markdown_version` are `NULL` when no body source exists, never empty strings | Data Integrity | Must | Schema and tests confirm no empty-string sentinel values |

---

## 11. Error Handling and Exceptions
**Positive**
- Directly closes the root cause of the "enrichment results not that great" complaint that started this investigation: Newswire and tenant-owned-feed posts currently enrich on title text alone (a few words), not the actual press-release/blog-post body — the single biggest quality gap this ADR closes.
- Closes a real, previously-unnamed, silent `raw_payload` under-capture for two connectors (Context, second finding) — a side effect of widening the parsers for `body_markdown`'s sake, but independently valuable against ADR-0018's own "full original platform JSON, never discarded" framing.
- The N×M value proposition (Context) is real, not decorative: every future connector (Reddit, Wikipedia/Story 2.13) and every future consumption format (HTML render, Word export, PDF export) is decoupled from every other connector's/consumer's own shape, once each side only has to convert to/from the one canonical Markdown representation.
- `enrichment`-shaped storage (computed once, persisted) avoids the correctness trap a naive `ConnectorHealth`-style derivation would hit once `raw_payload` ages past its 90-day hot-storage window (ADR-0018) and is replaced by a blob pointer — `body_markdown` keeps working for old posts because it was captured while `raw_payload` was still live, independent of `raw_payload`'s own archival state.
- GNews's enrichment input gains real signal (`content`, even truncated on the free tier) it did not have before, per Menno's own explicit direction.
- The required pre-conversion `sanitize-html` pass (Decision §3) closes a real risk `turndown`'s own security documentation names directly, and — independently — improves conversion robustness against the malformed markup RSS/Atom feeds are known to contain (unclosed tags, mismatched nesting, vendor quirks), a genuine functional upside alongside the security one.
- `<script>`/`<style>` content, tracking pixels, and known link-tracking query parameters (UTM and equivalents) are all excluded from `body_markdown` by the decided sanitization configuration — real, previously-unaddressed data-quality/privacy concerns Menno raised directly, closed as part of the same pipeline rather than deferred.
- The pre-conversion length guard bounds both parser exposure to untrusted content (the tenant-owned-feed connector's own weaker trust boundary in particular) and per-post enrichment cost, without waiting on ADR-0052 Open Question 4's own broader, still-unresolved aggregate cost-ceiling design.
- Tracking-parameter stripping (Decision §3) no longer leaves behind dead, bare-domain links when a redirect service (e.g. Mailchimp click-tracking, `mc_cid`/`mc_eid`) encoded the destination entirely in the parameters being stripped — a real, concrete failure mode Menno identified directly, closed via `exclusiveFilter` rather than left unspecified.
- Real tabular content (a press release's own pricing/comparison/financial table) survives conversion with its row/column structure intact via `turndown-plugin-gfm`, rather than silently collapsing into unstructured, unreconstructable text — a real data-loss gap found and closed directly, not left as a side effect of the broader `allowedTags` decision.
- `body_markdown_version` means a future pipeline change (a library bump, a config change to `allowedTags`/the tracking-parameter denylist/etc.) never leaves the database silently ambiguous about which ruleset produced a given row — and lets a future backfill (Open Question 1) selectively target only outdated rows.
- The Context "second finding" `raw_payload` under-capture gap is now genuinely closed, not just narrowed — `rawXml` retains each item's entire raw inner XML block (already captured mid-parse, discarded before this addition), matching the same "never discarded" completeness GNews's own full-object `rawPayload` spread already had.

**Negative**
- **Two new dependencies are added to `social-listening-core`** (`turndown` and `sanitize-html` — neither previously existed) — a real, if small, new supply-chain surface for a solo-developer project that has otherwise kept its dependency list deliberately minimal (`package.json`'s current seven runtime dependencies, checked directly this session).
- **`body_markdown` for already-ingested historical rows is not backfilled by this ADR.** Existing Newswire/tenant-owned-feed/GNews posts will have `body_markdown = NULL` until re-ingested or a separate backfill job is run — named as an Open Question, not designed here.
- **GNews's `content` field is confirmed truncated on the free tier** (`docs.gnews.io`, fetched this session) — enrichment quality improves over title+description-only, but is not "full article text" for a free-tier tenant; a false expectation of completeness should not be set.
- **What GlobeNewswire's/PR Newswire's `<description>` typically contains (excerpt vs. full text) could not be confirmed this session** — the parser widening (§4) captures whatever is there, but its practical value for enrichment quality is not independently verified against a real sample, only asserted as plausible.
- **`htmlToMarkdown()` applied to already-plain text (GNews) will backslash-escape Markdown-significant characters** that occur naturally in the source (`*`, `_`, `[`, `]`, etc.) — correct, round-trip-safe Markdown behavior, but means `body_markdown` is not always byte-identical to the pre-conversion text even when no HTML was present, a subtlety worth knowing before assuming "no-op for plain text" means "untouched."
- **No admin UI consumer exists for `body_markdown` yet** — this ADR ships storage and enrichment-input improvements with no user-visible display change; the value is enrichment quality only until a future rendering story is built.
- **Images are dropped entirely, not filtered for legitimacy** — a real press release's own genuine photo or an org's logo is excluded exactly the same way a tracking pixel is, since this ADR does not attempt to distinguish the two. Accepted as the simpler, safer default for this ADR's actual (text-oriented) scope, not a nuanced content-preservation decision — named honestly rather than implied to be more sophisticated than it is.
- **The tracking-parameter denylist (Decision §3) is a fixed, named list, not exhaustive** — a tracking parameter this ADR doesn't name (a platform-specific or newly-invented one) will pass through unstripped until the list is revised; this is an implementation default, deliberately left revisable, not a claim of completeness.
- **An unusually long genuine post (rare, but real) is silently truncated at 100,000 characters, with no indicator in `body_markdown` itself by default** — a caller cannot distinguish "this post's real body was short" from "this post's body was truncated" without a future implementation adding a marker, which this Decision names as optional, not required.
- **`turndown-plugin-gfm` is a third dependency with real, if lower-recency, maintenance activity — last npm release 2018, last GitHub commit 2023.** Named honestly rather than described as actively maintained; accepted because the alternative (silent table-structure data loss) was judged worse, not because the recency gap is dismissed as unimportant.

---

## 12. Assumptions and Dependencies
- Source body fields (`description`, `content:encoded`, `summary`, `content`, GNews `content`) contain HTML-ish or plain text and are worth preserving.
- GNews free-tier `content` may be truncated by the provider; any received snippet is accepted as more signal than none.
- Tenant-owned-feed sources are arbitrary third-party content selected by the tenant.
- Future consumers will honor the Markdown-source contract and apply their own output sanitization.
- The existing `rawPayload: { providerId, externalId, ...item }` spread pattern continues in Newswire and tenant-owned-feed ingest functions.

## 13. Open Questions / Risks
|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
|| R-001 | GNews `content` is truncated on the free tier, reducing enrichment value | High | Medium | Use `description` as fallback; accept partial content as more signal than none; document expectation | Product Owner |
|| R-002 | `turndown-plugin-gfm` has low recent maintenance activity | Low | Low | Scope is narrow and stable; monitor; replace only if a defect appears | Technical Lead |
|| R-003 | Plain-text GNews snippets are not byte-identical after Markdown escaping | Medium | Low | Document as correct round-trip behavior, not a bug | Product Owner |
|| R-004 | Historical posts remain `body_markdown = NULL` with no backfill | High | Medium | Document; prioritize a future backfill Story or re-ingestion path | Product Owner |
|| R-005 | Untrusted tenant-owned-feed content could be large or adversarial | Low | High | Pre-conversion length guard and `sanitize-html` pass bound exposure | Technical Lead |
|| R-006 | Tracking-parameter denylist is not exhaustive | Medium | Low | Treat as revisable implementation default; extend as new parameters are identified | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md`
- BRD: `../Business-Requirements/BRD-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md`
- Feature design: `docs/product-research/feature-designs/``
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above