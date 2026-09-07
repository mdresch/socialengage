---
name: data-governance
description: Author-initiated takedown requests, SLA tracking, bot mitigation, reviewer advisory risk-flagging, and deep AI enrichment redaction cascade.
---

# Data Governance & Privacy Takedown

## What this is

This component implements data-subject rights and author-initiated content takedown workflows. It provides public bot-protected rights request submission endpoints, magic-link verification with statutory SLA initialization, advisory reviewer queues, and deep redaction cascades that scrub content-derived AI enrichment across Postgres, watchlists, and RAG vector stores.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0092 | Author-initiated takedown: public form, `data_subject_requests` table, reviewer queue, soft-redaction of posts and RAG vector deletion | 10.11 |
| ADR-0125 | Author-initiated takedown refinements: 45-day statutory SLA clock, mandatory CAPTCHA bot mitigation, advisory risk-flagging without auto-deny, and deep AI enrichment redaction cascade | 16.1 |

## Contracts that constrain this component

- `contracts/epic-16/story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts` — Verifies mandatory CAPTCHA validation, 45-day SLA initialization upon magic-link verification, advisory risk-flagging, strict human-in-the-loop decision rule, and deep AI enrichment redaction cascade.

## How to extend this safely

1. **Public Submission Endpoint:** Any addition to `POST /public/v1/takedowns` must preserve both the 3-requests/IP/hour rate limit and the mandatory CAPTCHA challenge requirement.
2. **SLA Calculation:** SLA calculation defaults to 45 calendar days (`INTERVAL '45 days'`) upon magic-link verification. If tenant settings provide a customized SLA, it may only shorten the window, never extend past 45 days without Platform-Admin override.
3. **Reviewer Decision Boundary:** Automated or heuristic risk evaluation (`risk_flag`, `risk_reason`) must remain advisory. Programmatic auto-deny or auto-grant logic is strictly forbidden.
4. **Redaction Cascade Scope:** Any new derived-data table or column computed from `social_posts.body_markdown` must be added to `executeRedactionCascade` in `src/governance/takedownStore.ts`.

## Load-bearing constraints — do not change casually

- **Human-in-the-loop Only:** Under ICO and CCPA guidelines, rights requests require case-by-case evaluation. Automated denial (`AUTO_DECISION_FORBIDDEN`) is blocked by system invariants.
- **Deep Redaction Cascade:** In addition to soft-redacting `social_posts.body_markdown` and `raw_payload`, all content-derived AI enrichment fields (`sentiment`, `sentimentConfidence`, `keyPhrases`, `topicClusters`) must be cleared or stripped, while technical metadata (`detectedLanguage`, audit traces) is preserved.
- **Synchronous Vector Purge:** `RAGConnector.deletePost(tenantId, postId)` and `post_watchlist_matches` cleanup must execute during the redaction transaction to prevent information leakage in vector search or alert matching.

## Known gaps / deferred work

- Automated email reminder notifications to Tenant-Admin on approaching SLA deadlines (30 days / 40 days) left open per Q-0125-1.
- Public requester risk transparency (default: internal reviewer only per Q-0125-2).

## Relations to other components

- Calls `RAGConnector.deletePost(tenantId, postId)` in `src/rag/` to synchronously purge vector embeddings upon takedown grant.
- Cleans up `post_watchlist_matches` rows associated with redacted posts.
- Updates `social_posts` soft-redaction status and scrubs `social_posts.enrichment` fields.
- Consumed by `social-listening-admin` takedown review queues and public takedown form.
