---
name: canonical-markdown-conversion
description: The shared htmlToMarkdown() utility (ADR-0053) that normalizes any connector's raw body field (HTML or plain text) into canonical Markdown, stored once on social_posts.body_markdown. Read this before touching src/content/htmlToMarkdown.ts, before changing the sanitize-html/turndown/turndown-plugin-gfm pipeline, or before adding a fourth connector's own body-field precedence rule.
---

# Canonical Markdown conversion

## What this is

A single shared function, `htmlToMarkdown()` (`src/content/htmlToMarkdown.ts`), that every real connector's own `ingestX()` function calls to convert its richest available raw body field into one stable, canonical Markdown representation, stored on `social_posts.body_markdown` (Story 3.10, ADR-0053). It exists to collapse an N-ingestion-sources × M-future-consumers problem into N (ingestion → Markdown) + M (Markdown → output) — no future connector or consumer ever needs its own bespoke parsing logic for another's shape. Not owned by any one connector: `rssFeedParser.ts`, `feedItemParser.ts`, and `gnewsConnector.ts` each extract raw field values only; this module is the one, shared conversion step downstream of all three.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0053 | New `body_markdown`/`body_markdown_version` columns, computed once at ingestion (`enrichment`-shaped, not `ConnectorHealth`-shaped); the full sanitize-then-convert pipeline (`sanitize-html` → `turndown` + `turndown-plugin-gfm`), its exact configuration, and the pre-conversion length guard; the widened RSS/Atom parsers; GNews's `content` inclusion and truncation-marker trim; the `enrichmentText` composition rule; the `body_markdown` consumer contract (source, not display text) | 3.10 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts` — the full pipeline (plain-text pass-through, `<script>`/`<style>` discarded, `<img>` excluded, tracking-parameter stripping + bare-dead-link dropping, GFM table conversion, pre-conversion length truncation); exact dependency pins + ADR-0053-naming call-site comment; `rssFeedParser.ts`/`feedItemParser.ts` widening; the richest-field precedence rule per connector; `body_markdown`/`body_markdown_version` populated exactly once via this utility; `raw_payload.rawXml` propagation for Newswire/tenant-owned-feed; GNews's truncation-marker trim; the `enrichmentText` composition rule; this file's own documentation of the consumer contract.

## How to extend this safely

- **A fourth connector needing body content:** extract its own raw body field(s) in its own parser (never inside this module), apply that connector's own richest-field precedence with plain `??` chains in its `ingestX()` function (see Newswire's/tenant-owned-feed's/GNews's own ingest functions for the pattern), then call `htmlToMarkdown()` on the selected source — never reimplement sanitize/convert logic per connector.
- **Changing the sanitization configuration** (`ALLOWED_TAGS`, `NON_TEXT_TAGS`, the tracking-parameter denylist): these are named, revisable implementation defaults (ADR-0053 Decision §3), not durable decisions — but a real, output-altering change should bump `BODY_MARKDOWN_VERSION` (see Load-bearing constraints below) so already-ingested rows stay distinguishable from rows produced under the new ruleset.
- **A future Markdown→HTML/Word/PDF renderer**: explicitly out of scope for this component (ADR-0053 Open Question 2) — that future consumer owns its own conversion *from* `body_markdown`, and must uphold the consumer contract below.

## Load-bearing constraints — do not change casually

- **`body_markdown` holds Markdown source, never display-ready text.** Any future consumer (an admin UI post-body render, a Word export, a PDF export) must convert it to that surface's own native formatting before showing it to a human — displaying the raw column value (literal `**bold**`, `# heading` syntax) is a defect in that future consumer, not a valid reading of this column (ADR-0053 Decision §8).
- **A second, independent sanitization boundary applies at render time, not just at ingestion.** `body_markdown` ultimately originates from untrusted third-party content (an arbitrary news API, wire service, or — via the tenant-owned-feed connector — any domain a tenant points at). Any future Markdown→HTML rendering step **must sanitize its own rendered output** before DOM insertion — this is in addition to, not instead of, this module's own pre-conversion `sanitize-html` pass, because Markdown itself can carry raw inline HTML that survives an allowlist-sanitized source intact (e.g. an allowlisted `<a href>`).
- **The pre-conversion length guard (`MAX_BODY_SOURCE_LENGTH = 100,000` characters) runs before sanitization, not after** — bounding both untrusted-parser exposure and per-post enrichment cost. Don't reorder sanitize/convert ahead of truncation.
- **`src/content/htmlToMarkdown.ts` carries an explicit `/// <reference path="./turndown-plugin-gfm.d.ts" />`, not just tsconfig's own `include` glob.** `turndown-plugin-gfm` ships no types and has no `@types` package (this module's own `turndown-plugin-gfm.d.ts` is a minimal ambient shim) — `tsc --noEmit` and the Jest suite both resolve a stray ambient `.d.ts` fine via `tsconfig.json`'s `include`, but `ts-node` type-checks per-file, on demand, and only follows the reachable import/reference graph, so it silently misses an unreferenced ambient declaration file (found directly: `ts-node src/http/server.ts`, Story 1.10's own real-process spawn, failed with `TS7016` until this reference was added). Don't remove the reference directive even if it looks redundant next to `tsconfig.json`.
- **`package.json` pins a transitive dependency via `overrides`: `"htmlparser2": "9.1.0"`.** Found directly during implementation, not anticipated by ADR-0053: `sanitize-html@2.17.6` depends on `htmlparser2@^12.0.0`, and `htmlparser2` went ESM-only (`"type": "module"`, no CJS build) starting at its own `10.0.0` — without this override, `sanitize-html` fails to load at all under this project's CommonJS/ts-jest test setup (`SyntaxError: Cannot use import statement outside a module`). `9.1.0` is the last CJS-compatible `htmlparser2` release; don't remove this override without confirming either `sanitize-html` has moved off `htmlparser2` entirely or this project has moved to real ESM.
- **`sanitize-html`, `turndown`, and `turndown-plugin-gfm` are pinned to exact versions, never a semver range** — a version bump could silently change library-internal behavior even with this module's own configuration unchanged (ADR-0053 Decision §3). Bump deliberately, re-verify the pipeline's own tests, and note the bump in this SKILL.md's Corrections if it changes documented behavior.
- **`allowedTags`/`nonTextTags` are literal arrays in this module's own source, not references to `sanitize-html`'s current defaults** — an implicit dependency on library defaults would let a future version bump silently widen or narrow what's permitted with no corresponding code change to catch it.
- **`BODY_MARKDOWN_VERSION` (currently `1`) must be bumped whenever a pipeline change could plausibly alter output for real content** (a library version bump, or a configuration change to `allowedTags`/the tracking-parameter denylist/etc.) — judged at implementer discretion (ADR-0053 Decision §2), not mechanically triggered by every dependency update. This is what lets a future backfill (Open Question 1) selectively target only outdated-version rows.
- **`body_markdown`/`body_markdown_version` are `NULL` exactly when no body source was available or it converted to empty text — never an empty string.** Each connector's own `ingestX()` is responsible for collapsing an empty converted string to `NULL` before calling `insertSocialPost()`; this module's own `htmlToMarkdown()` returns `''` for empty/whitespace-only input (verified directly: `turndown('')` and `turndown('   ')` both return `''`), it does not itself decide the column's nullability.

## Known gaps / deferred work

- **No backfill for already-ingested historical rows** (ADR-0053 Open Question 1) — a real, standing gap for pre-Story-3.10 data, deliberately not built here; a future backfill Story would reuse `resolveSocialPostsForExport()`'s already-shipped, tiering-aware `raw_payload` read-back path (Story 3.8) rather than needing new architecture.
- **No Markdown→HTML (or any other format) renderer exists yet** — `body_markdown` has no consumer today; the value is enrichment-quality only until a future rendering story is built (ADR-0053 §7, Open Question 2).
- **Images are dropped entirely, not filtered for legitimacy** — `<img>` is absent from `allowedTags` by deliberate scope choice, not a nuanced tracking-pixel-vs-content-image distinction (ADR-0053 Open Question 7).
- **The tracking-parameter denylist is fixed and named, not exhaustive** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`) — a parameter not on this list passes through unstripped until the list is revised (ADR-0053 Open Question 8).
- **Whether raw Markdown syntax in `enrichmentText` measurably degrades enrichment accuracy is untested** — accepted as a working assumption, not verified against real enrichment output; a real, watched-for trigger for a separate future ADR, not this component (ADR-0053 Open Question 9).
- **GNews's truncation-marker regex is a best-current-understanding pattern, not confirmed against a real truncated response** (ADR-0053 Open Question 11) — verify and adjust if a real GNews credential surfaces a differently-shaped marker.

## Relations to other components

- **`newswire-connector`**, **`tenant-owned-feed-connector`**, **`gnews-connector`**: each calls `htmlToMarkdown()` from its own `ingestX()` function, having already resolved its own richest-available body source via its own precedence rule.
- **`social-post-lineage`**: `body_markdown`/`body_markdown_version` are two more `insertSocialPost()` input fields, alongside `enrichment` and `author_follower_count_at_publish` — same "computed once at insert, immutable afterward" shape.
- **`azure-ai-language-connector`**: `enrichPost()`'s input text now includes `body_markdown` (via `enrichmentText` composition), not just title, for all three connectors that call it.
