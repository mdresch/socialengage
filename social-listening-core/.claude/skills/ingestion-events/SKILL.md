---
name: ingestion-events
description: The thin SocialPostIngestedEvent/ConnectorHealthChangedEvent shapes and the real Service Bus publish path for social-listening-core. Read this before adding a field to either event, before touching serviceBusPublisher.ts, or before touching GET /v1/posts/:id.
---

# Ingestion events (thin event shapes + Service Bus publishing)

## What this is

`buildSocialPostIngestedEvent()`/`buildConnectorHealthChangedEvent()` (`src/events/socialPostIngestedEvent.ts`/`connectorHealthChangedEvent.ts`) construct ADR-0012's deliberately thin event payloads — IDs and status fields only, never post text, engagement metrics, or raw payload. `publishEvent()` (`src/events/serviceBusPublisher.ts`) sends a constructed event body to the real `social-listening-events` topic on the `social-listening-dev` Service Bus namespace, setting `tenantId` as a Service Bus application property (ADR-0013's Clarification — SQL subscription filters can only evaluate message properties, not payload body content). `GET /v1/posts/:id` (`src/http/versions/v1/postsRouter.ts`, backed by `getSocialPostById()` in `socialPostStore.ts`) is the paired REST-fetch-on-demand half of ADR-0012: a subscriber that only got a thin event can fetch full post data by `postId` when it actually needs it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0012 | Events carry IDs and minimal fields only; full data fetched via REST on demand | 5.1 |
| ADR-0013 | Per-tenant event filtering via Service Bus subscription SQL filters on `tenantId`, which must be a message application property, not only a payload field | 5.2 |

<!-- ADR-0019 (schemaVersion property) governs this same event-publishing area but isn't built here — see Known gaps. Add a row once Story 5.5 lands. -->

## Contracts that constrain this component

- `contracts/epic-5/story-5.1.thin-events.contract.test.ts` — `buildSocialPostIngestedEvent()` returns exactly `tenantId`/`postId`/`platformId`/`watchlistId`/`sentiment`/`publishedAt`/`occurredAt`, nothing else; `buildConnectorHealthChangedEvent()` returns exactly `previousStatus`/`newStatus`/`tenantId`/`platformId`/`occurredAt`; `GET /v1/posts/:id` returns full post data for a known id, 404s for an unknown one, and never returns another tenant's post even by the right id (RLS).
- `contracts/epic-5/story-5.2.per-tenant-event-filtering.contract.test.ts` — against the real namespace/topic: a published event carries `tenantId` as a Service Bus application property, readable without deserializing the body; a subscription with a SQL filter on `tenantId` receives only the matching tenant's events; a second, differently-filtered subscription requires no change to `publishEvent()` itself — proven by reusing the same publish calls against a different subscription's filter.

## How to extend this safely

- **Adding a field to an existing event type:** add it to the builder function's return object and its TypeScript interface together — and re-read ADR-0012's Decision text first; a field beyond what it names (e.g. post text, engagement metrics, raw payload) is exactly what this ADR exists to keep out. A genuinely new *optional* field is Story 5.5/ADR-0019's "additive, no schemaVersion bump" case once that story exists — don't bump anything here.
- **Adding `schemaVersion` (Story 5.5, ADR-0019):** set it as another Service Bus application property in `publishEvent()`, alongside `tenantId` — same mechanical reasoning (filters evaluate message properties, not payload body). Not added yet; don't fold it in as a side effect of touching this file for something else.
- **Publishing a real event:** call `publishEvent(tenantId, body)` with the result of a `build*Event()` function — never construct the Service Bus message shape ad hoc elsewhere.

## Load-bearing constraints — do not change casually

- **`publishEvent()` always sets `tenantId` as a Service Bus `applicationProperties` entry, never only inside the JSON body.** This is a mechanical requirement of ADR-0013's SQL-filter mechanism, not a style choice — a filter on `tenantId` literally cannot evaluate against payload-only data. Checked directly by this story's own AC1 contract.
- **The builder functions (`build*Event()`) stay pure — no I/O.** `publishEvent()` is the only place that talks to Service Bus; it takes an already-constructed body, it doesn't build one itself. Keeps the payload-shape contract (Story 5.1) and the transport contract (Story 5.2) independently testable.
- **Namespace/topic come from `SERVICE_BUS_NAMESPACE`/hardcoded `TOPIC_NAME`, following `KEY_VAULT_URI`'s override pattern** — default `social-listening-dev.servicebus.windows.net` / `social-listening-events`. Auth is `DefaultAzureCredential` (the same `az login`-backed chain as Key Vault) — no connection-string secret to manage.
- **`GET /v1/posts/:id` follows the same `X-Tenant-Id` header placeholder as `GET /v1/posts`** — see `posts-api`'s SKILL.md Load-bearing constraints for why that isn't a real security boundary yet (Phase 5's job). The RLS-backed cross-tenant 404 (Story 5.1's own AC) is real isolation; the header itself is not authentication.

## Known gaps / deferred work

- **`schemaVersion` (Story 5.5, ADR-0019) is not set on published messages yet.** The same namespace now technically unblocks it, but it's a separate story, deliberately not folded into Story 5.2.
- **Nothing actually calls `publishEvent()` from the ingestion pipeline yet.** `runIngestionAttempt()`/`connectorHealth.ts` don't publish `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` on real state changes — that wiring is separate, not-yet-storied work (no ADR mandates *when* in the pipeline publishing happens, only the payload shape and transport guarantees).
- **`sentiment` on `SocialPostIngestedEvent`** currently has no real source — nothing in `social_posts`/`enrichment` populates a top-level sentiment value yet (Phase 2's "also build, not storied" enrichment pipeline owns that). The builder accepts it as an input parameter; nothing calls it with real data yet.
- This story's contract creates and deletes its own throwaway subscriptions per run (same pattern as `credential-envelope-encryption`'s test Key Vault key) — no subscription needs to pre-exist, and none are left behind by a clean run (an `autoDeleteOnIdle: PT10M` TTL is the safety net if cleanup itself fails).
