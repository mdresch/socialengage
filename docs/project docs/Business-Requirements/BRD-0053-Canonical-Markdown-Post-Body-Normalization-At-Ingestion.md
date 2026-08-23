# Business Requirements Document (BRD)

## 1. Document Control

|| Field | Value |
|---|---|---|
|| Document Title | Canonical Markdown Post-Body Normalization at Ingestion – Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-08-19 |
|| Author(s) | AI Business & Requirements Analyst (BRD Writer Agent) |
|| Approver(s) | Menno – Business Sponsor, Product Owner, Technical Lead |
|| Status | Approved |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|---|
|| 0.1 | 2026-08-19 | AI BRD Writer Agent | Initial draft from ADR-0053 and related user stories |
|| 1.0 | 2026-08-19 | Menno | Approved as Accepted with ADR-0053 |

---

## 2. Executive Summary

**What problem are we solving?** SocialEngage's AI enrichment results for Newswire and tenant-owned-feed posts were being computed from only a few words of title text, and GNews enrichment was using title plus description only. The real body of an article — press releases, blog posts, owned content — was never captured by the RSS/Atom parsers or stored anywhere on `social_posts`. Without a body column, no consumer (enrichment, display, export) could use the actual content.

**Who is affected?** Tenant-Users and Tenant-Admins who consume the post feed and rely on enrichment-derived sentiment, entities, and key phrases; anyone who later renders, exports, or analyzes post content.

**What is the proposed solution at a glance?** Introduce a canonical Markdown post-body representation: at ingestion, the richest available body field from each source is converted once to sanitized Markdown and stored on `social_posts` as `body_markdown`, with a companion `body_markdown_version` tracking the conversion pipeline. Newswire and tenant-owned-feed parsers are widened to actually capture `description`, `content:encoded`, and equivalent Atom fields, plus the raw item XML. GNews `content` is folded into the same pipeline. Enrichment is fed `[title, body_markdown]`, replacing title-only or title-plus-description inputs.

**What business value do we expect?** Richer, more accurate AI enrichment; a single, stable intermediate format that decouples every current and future ingestion source from every current and future content consumer; and reduced security/privacy noise through script, style, image, and tracking-parameter removal.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|
|| 1 | Improve AI enrichment quality by including the actual article body, not just the title | Enrichment input for Newswire, tenant-owned-feed, and GNews contains `body_markdown` for all applicable posts |
|| 2 | Establish one canonical, stable content representation for all current and future consumers | `body_markdown` is the single source for enrichment, display, export, and other consumers |
|| 3 | Preserve the original platform payload without silent data loss | New `rawXml` field closes the previously unnamed `raw_payload` under-capture gap for RSS/Atom connectors |
|| 4 | Reduce untrusted-content and tracking noise in stored post bodies | `<script>`, `<style>`, `<img>`, known tracking query parameters, and dead bare-domain links are excluded |
|| 5 | Avoid future N×M conversion sprawl as new connectors or output formats are added | New consumers convert from Markdown only; new connectors convert to Markdown only |

---

## 4. Scope

### 4.1 In Scope

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

### 4.2 Out of Scope

- No Admin UI Markdown rendering is designed or built here (separately delivered by Story 6.19).
- No Markdown → HTML / Word / PDF renderer is selected or specified.
- No historical backfill for already-ingested posts.
- No image preservation or legitimacy filtering for legitimate content images.
- No aggregate enrichment cost or quota ceiling.
- No fix for the pre-existing `enrichPost()` / `insertSocialPost()` write-ordering exposure.
- No Markdown-to-plain-text cleaning step for `enrichmentText` (deferred to a possible future ADR if real usage shows noise).

### 4.3 Assumptions

- Source body fields (`description`, `content:encoded`, `summary`, `content`, GNews `content`) contain HTML-ish or plain text and are worth preserving.
- GNews free-tier `content` may be truncated by the provider; any received snippet is accepted as more signal than none.
- Tenant-owned-feed sources are arbitrary third-party content selected by the tenant.
- Future consumers will honor the Markdown-source contract and apply their own output sanitization.
- The existing `rawPayload: { providerId, externalId, ...item }` spread pattern continues in Newswire and tenant-owned-feed ingest functions.

### 4.4 Constraints

- `raw_payload`'s "store exactly what the source returned, immutable" discipline and 90-day archival tiering are unchanged.
- `body_markdown` must be computed and stored at ingestion, not derived at read time.
- The conversion pipeline must be a single shared utility, not reimplemented per connector.
- New dependencies must be exact-pinned and compatible with the project's Node runtime.
- `body_markdown` and `body_markdown_version` are `NULL` when no body source exists, never empty strings.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
|| Tenant-User | Consumer of posts and enrichment results | High | Accurate sentiment, entities, and key phrases; readable post bodies |
|| Tenant-Admin | Configures connectors and watches feed quality | Medium | Better enrichment without per-connector setup changes |
|| AI Enrichment Consumers | Use enrichment output for insights | High | Body content, not just titles, in the analysis input |
|| Platform-Admin | Cross-tenant health and adoption observer | Low | No core-pipeline coupling; versioned, auditable storage |
|| Product Owner (Menno) | Sponsor and decision owner | High | Durable N×M decoupling and no silent data loss |
|| Future Display/Export Builders | Will render `body_markdown` | Medium | Clear contract that Markdown is source, not display text |

---

## 6. Current State (As-Is)

**Current process:**
1. Newswire and tenant-owned-feed parsers extract only `guid`, `link`, `title`, `pubDate`, and issuer.
2. GNews extracts `title`, `description`, and `content`, but `pollGNewsSearch.ts` only joins `title` + `description` for enrichment.
3. `social_posts` has no body or content column; anything not in `raw_payload` is dropped.
4. `raw_payload` for the two RSS/Atom connectors is the already-parsed `ParsedRssItem`/`ParsedFeedItem` object, so the missing fields are not archived either.
5. `enrichPost()` receives title-only for Newswire/tenant-owned-feed and title+description for GNews.

**Pain points:**
- AI enrichment is starved of real content, producing low-quality results.
- The source's own body fields are silently dropped, contradicting the "never discarded" `raw_payload` intent.
- Every future connector would need bespoke parsing for every future consumer.
- No column exists to support a future post-body display, Word export, PDF export, or similar consumer.

---

## 7. Future State (To-Be)

**New or improved process:**
1. Each connector's parser extracts the richest available body field (Newswire `content:encoded` > `description`; tenant-owned-feed RSS `content:encoded`/`description` or Atom `content`/`summary`; GNews `content` > `description`).
2. The raw source string is truncated to `MAX_BODY_SOURCE_LENGTH`, then sanitized, then converted to Markdown via `turndown` with the GFM table plugin.
3. The resulting Markdown is stored in `social_posts.body_markdown` with `body_markdown_version = 1`.
4. `enrichPost()` is called with `[title, body_markdown].filter(Boolean).join('. ')`.
5. `raw_payload` receives the widened parser fields and the raw item XML automatically through the existing spread.
6. Future consumers read `body_markdown` and convert it to their target format, sanitizing rendered output before DOM insertion.

**Expected capabilities:**
- Enrichment is computed on real body content where it exists.
- One canonical Markdown field serves all current and future consumers.
- RSS/Atom raw item XML is retained, closing the `raw_payload` under-capture gap.
- Tracking pixels, scripts, styles, and known tracking parameters are removed from the stored body.
- Tabular content is preserved as GFM Markdown tables.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|---|
|| NFR-001 | `turndown`, `sanitize-html`, and `turndown-plugin-gfm` are exact-pinned with an ADR-0053 code comment | Maintainability | Must | `package.json` uses exact versions; call site references ADR-0053 |
|| NFR-002 | The conversion pipeline must tolerate malformed, unclosed, or vendor-specific RSS/Atom HTML | Reliability | Must | Tests pass with real-world malformed samples |
|| NFR-003 | The conversion pipeline must not execute scripts or load external resources | Security | Must | `<script>` and `<style>` content is discarded; `<img>` is excluded |
|| NFR-004 | `body_markdown` is computed and stored at ingestion, not derived on every read | Performance | Must | No read path recomputes Markdown from `raw_payload` |
|| NFR-005 | `body_markdown` and `body_markdown_version` are `NULL` when no body source exists, never empty strings | Data Integrity | Must | Schema and tests confirm no empty-string sentinel values |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| Posts with `body_markdown` vs `NULL` | Track adoption of the canonical body field | Product team / Technical Lead | Daily |
|| Average `body_markdown` length by connector | Monitor content volume and truncation exposure | Product team | Weekly |
|| Posts truncated by `MAX_BODY_SOURCE_LENGTH` | Detect unusually long sources or guard effectiveness | Technical Lead | Weekly |
|| GNews free-tier truncation marker hits | Track provider-side truncation frequency | Product team | Weekly |
|| `<a href>` tracking parameters stripped | Verify privacy/data-hygiene effect | Product team | Monthly |
|| Posts with preserved table content | Confirm `turndown-plugin-gfm` value | Product team | Monthly |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
|| R-001 | GNews `content` is truncated on the free tier, reducing enrichment value | High | Medium | Use `description` as fallback; accept partial content as more signal than none; document expectation | Product Owner |
|| R-002 | `turndown-plugin-gfm` has low recent maintenance activity | Low | Low | Scope is narrow and stable; monitor; replace only if a defect appears | Technical Lead |
|| R-003 | Plain-text GNews snippets are not byte-identical after Markdown escaping | Medium | Low | Document as correct round-trip behavior, not a bug | Product Owner |
|| R-004 | Historical posts remain `body_markdown = NULL` with no backfill | High | Medium | Document; prioritize a future backfill Story or re-ingestion path | Product Owner |
|| R-005 | Untrusted tenant-owned-feed content could be large or adversarial | Low | High | Pre-conversion length guard and `sanitize-html` pass bound exposure | Technical Lead |
|| R-006 | Tracking-parameter denylist is not exhaustive | Medium | Low | Treat as revisable implementation default; extend as new parameters are identified | Product Owner |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

1. `social_posts` has nullable `body_markdown` (`TEXT`) and `body_markdown_version` (`SMALLINT`) columns.
2. The shared `htmlToMarkdown()` utility truncates at `MAX_BODY_SOURCE_LENGTH`, sanitizes with the explicit `allowedTags`/`nonTextTags`, and converts via `turndown` + `turndown-plugin-gfm`.
3. `<script>`/`<style>` content, `<img>` tags, known tracking parameters, and bare dead tracking domains are excluded from `body_markdown`.
4. Newswire's `ParsedRssItem` and tenant-owned-feed's `ParsedFeedItem` capture the body fields and `rawXml`, with the correct RSS/Atom precedence.
5. GNews's `content` is included in the body source and the free-tier truncation marker is trimmed.
6. All three connectors call `enrichPost()` with `[title, body_markdown].filter(Boolean).join('. ')`.
7. `body_markdown` and `body_markdown_version` are `NULL` when no body-eligible field exists, never empty strings.
8. `raw_payload` for Newswire and tenant-owned-feed includes the new fields and `rawXml` through the existing spread mechanism.
9. The exact versions of `turndown`, `sanitize-html`, and `turndown-plugin-gfm` are pinned, and the `htmlToMarkdown()` call site references ADR-0053.
10. The consumer contract (Markdown is source, not display text; future renderers must sanitize) is documented.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| `body_markdown` | The canonical Markdown representation of a post's body, stored on `social_posts` once at ingestion. |
|| `body_markdown_version` | A `SMALLINT` tracking the conversion pipeline version that produced a given `body_markdown` value. |
|| `htmlToMarkdown()` | The shared utility that truncates, sanitizes, and converts a raw source string to Markdown. |
|| `enrichmentText` | The ephemeral string `[title, body_markdown].filter(Boolean).join('. ')` passed to `enrichPost()`. |
|| `rawXml` | The verbatim inner XML of an RSS/Atom item, now retained in `raw_payload`. |
|| GFM | GitHub Flavored Markdown, the dialect that includes table syntax. |
|| `sanitize-html` | An allowlist-based HTML sanitizer built on `htmlparser2`. |
|| `turndown` | A JavaScript HTML-to-Markdown converter. |
|| Tracking parameters | Query-string parameters used for analytics/click tracking (e.g., `utm_source`, `fbclid`). |

---

## 16. Appendices

### A. Source Architecture Decision Record

- `docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md`

### B. Related Feature Design and Research

- **No matching feature design document** was found in `docs/product-research/feature-designs/` for this ADR.
- **No matching deep-research brief** was found in `docs/product-research/reports/` for this ADR.
- Both are explicitly noted as missing source material in this BRD.

### C. Related User Stories

- **Story 3.10 – Canonical Markdown post-body storage and enrichment input** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`)
- **Story 6.19 – Render the post detail body as real, formatted Markdown** (`docs/user-stories/epic-6-tenant-admin-ui.md`)

### D. Related ADRs

- ADR-0016 – `raw_payload` as JSONB
- ADR-0018 – Data retention and archival policy
- ADR-0038 – AI enrichment provider selection
- ADR-0050 – Tenant-owned domain RSS/Atom content feed connector
- ADR-0052 – Cursor-based pagination and `ClassifiableError` patterns

---

## 17. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
