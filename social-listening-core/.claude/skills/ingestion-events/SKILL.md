---
name: ingestion-events
description: The thin SocialPostIngestedEvent/ConnectorHealthChangedEvent shapes social-listening-core will eventually publish to Azure Service Bus. Read this before adding a field to either event, before building the actual publish-to-Service-Bus step, or before touching GET /v1/posts/:id.
---

# Ingestion events (thin event shapes)

## What this is

`buildSocialPostIngestedEvent()`/`buildConnectorHealthChangedEvent()` (`src/events/socialPostIngestedEvent.ts`/`connectorHealthChangedEvent.ts`) construct ADR-0012's deliberately thin event payloads — IDs and status fields only, never post text, engagement metrics, or raw payload. `GET /v1/posts/:id` (`src/http/versions/v1/postsRouter.ts`, backed by `getSocialPostById()` in `socialPostStore.ts`) is the paired REST-fetch-on-demand half of the same decision: a subscriber that only got a thin event can fetch full post data by `postId` when it actually needs it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0012 | Events carry IDs and minimal fields only; full data fetched via REST on demand | 5.1 |

<!-- ADR-0013 (per-tenant SQL filtering) and ADR-0019 (schemaVersion property) both govern this same event-publishing area but aren't built here — see Known gaps. Add rows here once Stories 5.2/5.5 land. -->

## Contracts that constrain this component

- `contracts/epic-5/story-5.1.thin-events.contract.test.ts` — `buildSocialPostIngestedEvent()` returns exactly `tenantId`/`postId`/`platformId`/`watchlistId`/`sentiment`/`publishedAt`/`occurredAt`, nothing else; `buildConnectorHealthChangedEvent()` returns exactly `previousStatus`/`newStatus`/`tenantId`/`platformId`/`occurredAt`; `GET /v1/posts/:id` returns full post data for a known id, 404s for an unknown one, and never returns another tenant's post even by the right id (RLS).

## How to extend this safely

- **Adding a field to an existing event type:** add it to the builder function's return object and its TypeScript interface together — and re-read ADR-0012's Decision text first; a field beyond what it names (e.g. post text, engagement metrics, raw payload) is exactly what this ADR exists to keep out. A genuinely new *optional* field is Story 5.5/ADR-0019's "additive, no schemaVersion bump" case once that story exists — don't bump anything here.
- **Actually publishing to Service Bus:** no namespace is provisioned for this project yet (confirmed 2026-07-30) — building a real `publishEvent()` that sends to `@azure/service-bus` is future work once one exists, following the same real-infrastructure pattern `credential-envelope-encryption`'s `keyVaultProvider.ts` already uses (a live resource + `DefaultAzureCredential`, not a mock). Don't add the SDK dependency or a publish path speculatively before that.

## Load-bearing constraints — do not change casually

- **These builder functions are pure — no I/O, no Service Bus call.** They exist to make the payload *shape* a single, testable source of truth independent of transport, which is what lets this story ship without a Service Bus namespace existing yet. Don't fold a live send into them; a future `publishEvent()` should call these to get the body, not the other way around.
- **`GET /v1/posts/:id` follows the same `X-Tenant-Id` header placeholder as `GET /v1/posts`** — see `posts-api`'s SKILL.md Load-bearing constraints for why that isn't a real security boundary yet (Phase 5's job). The RLS-backed cross-tenant 404 (this story's own AC) is real isolation; the header itself is not authentication.

## Known gaps / deferred work

- **No actual publish-to-Service-Bus path exists.** These builders construct the message body; nothing calls Azure Service Bus with it yet. That's blocked on an actual namespace being provisioned (not on any ADR — ADR-0012/0013/0019 are all Accepted), tracked separately from this story.
- **Story 5.2 (ADR-0013, per-tenant SQL filtering)** and **Story 5.5 (ADR-0019, `schemaVersion` message property)** both build directly on top of whatever publish step eventually gets built here — neither is built yet, for the same infrastructure reason.
- **`sentiment` on `SocialPostIngestedEvent`** currently has no real source — nothing in `social_posts`/`enrichment` populates a top-level sentiment value yet (Phase 2's "also build, not storied" enrichment pipeline owns that). The builder accepts it as an input parameter; nothing calls it with real data yet.
