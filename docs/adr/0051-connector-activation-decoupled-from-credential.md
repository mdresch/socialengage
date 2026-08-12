# ADR-0051: Connector activation decoupled from credential storage — two new, ownership-scoped `connector_activations`/`connector_user_activations` tables

**Status:** Accepted (2026-08-12)
**Source:** Resolves an explicitly-left-open question in ADR-0034 (Open Questions for decision: *"whether connector activation needs its own table separate from `platform_credentials`... not resolved by this ADR"*). Drafted from two real gaps found via direct code inspection this session — a live UX bug in `social-listening-admin`'s connector screens, and an implementation gap against ADR-0010's own already-stated Decision text in `social-listening-core/src/connectors/connectorHealth.ts` — and from Menno's own directly-recalled failure mode in the discontinued Microsoft Social Engagement product this rebuild replaces: a connector getting disconnected merely for exhausting its available rate-limit quota. This ADR originates a new persisted concept (connector activation); it does not document a decision the design spec or original design conversation made.

**Acceptance note (2026-08-12):** Accepted by Menno (Sponsor), verbatim: *"This scoped ADR is approved and perfectly alligns with the inteded connector related activation. Approved. Great piece of wor."* Accepted as revised — seven in-place revisions were made during live review before acceptance (two-table ownership-scoped redesign; platform-wide-availability axis named as Decision §9/Open Question 7; lazy row-creation semantics; pre-activation impact estimation named in Decision §2/Open Question 8; scope-independence stated as its own explicit invariant in Decision §3; activation-timing semantics added to Decision §2; Open Question 8 elaborated with the concrete watchlist/post-volume shape Menno named at review) — see the Amendment Log below for the full record of each. Story 1.11 (`docs/user-stories/epic-1-repository-and-api-foundation.md`) is added at this acceptance, per this series' own "no story until acceptance" precedent (ADR-0024/0026).

---

## Context

### Bug 1: "connected" is hardcoded true for `authMode: 'none'` connectors, with no way to turn it off

Newswire (ADR-0024, `authMode: 'none'`) is the one real, shipped connector with no credential to store. Both places `social-listening-admin` renders connector state hardcode it as always-on:

- `social-listening-admin/src/app/tenant/connectors/page.tsx`, `loadConnectorState()`:
  ```ts
  if (platform.authMode === 'none') {
    return { platform, connected: true, credentialStatus: null as ConnectorState['credentialStatus'] };
  }
  ```
  with its own comment directly above the `PLATFORMS` array admitting the intent: *"`newswire` is `authMode: 'none'` (ADR-0024) — no credential exists to submit, so it renders as always-active with no connect/disconnect action."*
- `social-listening-admin/src/app/tenant/connectors/status/page.tsx`, `loadConnectorStatusRow()`: `const connected = platform.authMode === 'none' || health.credentialStatus !== null;` — the same unconditional `true` for any `authMode: 'none'` platform.

Nothing in `social-listening-core` or `social-listening-admin` distinguishes "this tenant chose to turn Newswire on" from "hasn't decided" or "wants it off." A Tenant-Admin has no lever at all for this connector — it is on for every tenant, permanently, by construction.

### Bug 2 (structural, not yet UI-visible): credentialed connectors conflate "has a stored secret" with "is turned on," and disconnect is destructive

For `authMode: 'api_key'`/`'oauth'` connectors (GNews, Azure AI Language, Azure OpenAI), "connected" is derived purely from row presence in `platform_credentials` (`social-listening-core/src/credentials/credentialStore.ts`) — `status.credentialStatus !== null`. There is no independent "is this turned on" concept; the credential's mere existence *is* the on/off signal. And `deleteCredential(tenantId, platformId, ownerType, userId?)` (same file, reworked by Story 1.7/ADR-0034) is a hard `DELETE FROM platform_credentials`:

```ts
await client.query(
  `DELETE FROM platform_credentials
   WHERE tenant_id = $1 AND platform_id = $2 AND owner_type = 'tenant'`,
  [tenantId, platformId]
);
```

There is no way for a Tenant-Admin to pause a connector without losing the stored key and having to re-enter it later. Today's only two states are "credential exists, therefore connected" and "credential gone, forever, until re-entered."

### Bug 3: `deriveConnectorHealth()` does not read the `retryable` column it already has available, and `shouldAttemptIngestion()` acts on that undifferentiated signal

`social-listening-core/src/ingestion/runIngestionAttempt.ts` already classifies every failure and writes it: `completeIngestionRun(options.tenantId, run.id, { status: 'failed', ..., retryable: isRetryable(err.kind) })`, in both places it can fail (OAuth-refresh failure and the general non-retryable/retries-exhausted branch). `ingestionRunStore.ts` persists that `retryable` boolean on the `ingestion_runs` row.

`connectorHealth.ts`'s `deriveConnectorHealth()` never reads it. Its query is:

```sql
SELECT status, started_at, completed_at, error_summary FROM ingestion_runs
WHERE platform_id = $1 ORDER BY started_at DESC
```

— `retryable` is not selected, and every failed run (`status === 'failed'`) is counted identically toward both ADR-0023's rate-relative `failing` derivation (`recentFailures`, `consecutiveFailures`) and the absolute 20-consecutive-failure ceiling, regardless of whether the failure was a rate-limit/network/5xx (retryable) or a revoked credential/malformed watchlist (non-retryable). `shouldAttemptIngestion()` then acts directly on that undifferentiated `status`:

```ts
export async function shouldAttemptIngestion(tenantId: string, platformId: string): Promise<boolean> {
  const health = await deriveConnectorHealth(tenantId, platformId);
  return health.status !== 'failing';
}
```

This is a real behavioral halt on the connector — not a cosmetic status label — gated on a computation that does not implement the distinction ADR-0010's own Decision text already states:

> "Retryable errors (rate limit, transient network, 5xx) → exponential backoff, automatic retry. Non-retryable errors (401/403, malformed watchlist) → immediate `failing` status, surfaced to the tenant, no blind retry."

A connector that is merely rate-limited can trip the exact same `failing`/ingestion-halt path as one with a genuinely revoked credential, because the rate-math in ADR-0023's derivation treats every `status = 'failed'` row the same way. This is precisely the historical Microsoft Social Engagement anti-pattern Menno described directly from experience — a connector disconnected for exhausting quota — reproduced here by an implementation gap against this project's own three-ADR-old stated policy, not by a deliberate decision.

### Why this is a unifying problem, not two unrelated ones

Both bugs collapse the same two genuinely separate concepts into one signal:

1. **Does this connector have what it needs to poll** (a valid credential, or nothing needed at all for `authMode: 'none'`) — a *capability* question.
2. **Has a human chosen for this connector to actually run for this tenant right now** — an *intent* question.

Today, (1) alone stands in for both, for credentialed connectors (credential-row-presence answers both at once), and for `authMode: 'none'` connectors neither is asked at all (Newswire is simply always "on"). Neither shape gives a Tenant-Admin a way to say "I want this off temporarily" without also destroying (1)'s stored state, and neither gives the system a way to distinguish "administratively paused" from "genuinely broken" when deciding whether to keep attempting ingestion.

### This is not a retroactive criticism of ADR-0050's tenant-owned-feed connector

ADR-0050's tenant-owned-domain RSS connector is also `authMode: 'none'` — no vendor credential, same as Newswire. It is **not** currently exhibiting Bug 1's failure mode, because its own DNS TXT domain-ownership verification flow (ADR-0050 Decision §3) already requires an explicit, deliberate Tenant-Admin action — publish a TXT record, then call `verify-domain` — before polling of any feed URL is ever enabled. ADR-0050's own verification-state machine (pending/verified/expired/failed) already functions as a de facto activation gate for that connector, decided independently and before this ADR existed. This ADR generalizes the same principle (a human, explicit, persisted "on" signal, independent of credential state) into a single project-wide mechanism that every `authMode: 'none'` connector — Newswire today, any future one — can rely on, rather than requiring each such connector to invent its own bespoke gate the way ADR-0050 happened to.

### ADR-0034's own left-open question

ADR-0034's Decision text (Story 1.7's ownership-tier rework of `platform_credentials`) never states whether connector activation needs a table of its own. Its Open Questions section names this directly, with only an implicit, non-binding reading:

> "whether connector *activation* needs its own table separate from `platform_credentials` (this ADR's answer, implicitly: no, `owner_type`/`user_id` columns on the existing table suffice for what's currently named); ... not resolved by this ADR"

This ADR resolves that question, and reaches the opposite conclusion from ADR-0034's own implicit reading: activation does need its own table, separate from `platform_credentials`, because `authMode: 'none'` connectors have no credential row at all for an activation flag to live on, and because conflating "has a secret" with "is turned on" is exactly Bug 2 above.

---

## Decision

**The durable decision — this is what would need superseding, not just amending:**

### 1. Two new tables — one per ownership scope, mirroring `platform_credentials`' own already-decided tenant/user split

`platform_credentials` (ADR-0028/ADR-0034) already supports two independent ownership tiers coexisting for the same `(tenant, platform)`: a tenant-wide credential (Tier 2, `owner_type: 'tenant'`) and any number of individual users' own personal credentials (Tier 3, `owner_type: 'user'`, one per `user_id`). Activation must be scoped the same way — a single per-`(tenantId, platformId)` flag would be wrong, because deactivating the tenant-wide credential must never silently also deactivate a specific user's own personal credential for the same platform, and vice versa; the two are independently owned and must stay independently controllable.

Rather than one table with a nullable `owner_type`/`user_id` discriminator, activation uses **two separate tables**, one per scope — each with an unambiguous shape and no conditional-uniqueness rule to get wrong:

**Implementation defaults (adjustable via Amendment Log; does not require superseding this ADR):**

```
connector_activations            -- tenant-wide scope (Tier 2), one row per (tenant_id, platform_id)
  tenant_id      uuid not null references tenants(id)
  platform_id    text not null
  is_active      boolean not null default false
  activated_at   timestamptz
  deactivated_at timestamptz
  updated_by     uuid references users(id)
  -- unique (tenant_id, platform_id)

connector_user_activations       -- user-specific scope (Tier 3), one row per (tenant_id, platform_id, user_id)
  tenant_id      uuid not null references tenants(id)
  platform_id    text not null
  user_id        uuid not null references users(id)
  is_active      boolean not null default false
  activated_at   timestamptz
  deactivated_at timestamptz
  updated_by     uuid references users(id)
  -- unique (tenant_id, platform_id, user_id)
```

Together, this project now answers "is this connector currently turned on" by checking exactly one of these two tables, chosen by which ownership scope is in question — never a single, scope-blind flag. Exact column types, RLS policy (tenant-isolation predicate on both tables, consistent with every other tenant-scoped table per ADR-0015; `connector_user_activations` additionally scoped so a user can only ever see/modify their own row, mirroring `platform_credentials`' own existing user-bound-row RLS treatment), and whether a synthetic `id` is added alongside the natural unique key are implementation-time decisions for the Story that picks this up — not fixed permanently by this ADR.

**Rows are created lazily, on explicit action only — never pre-populated.** A row in either table is written only when a Tenant-Admin (`connector_activations`) or the individual user themselves (`connector_user_activations`) explicitly activates or deactivates that connector for the first time. **Absence of a row means "never activated," treated identically to `is_active = false`** — reading activation state is always "does a row exist with `is_active = true`," never "does a row exist at all." Rows are never pre-created for all `(tenantId, platformId)` pairs at tenant creation, at connector registration, or by any migration — there is no background process that seeds one row per known platform per tenant. This keeps `createTenant()` (`social-listening-core/src/tenants/tenantStore.ts`) exactly as simple as it is today (a single `INSERT` into `tenants`, nothing else, per Bug 1's own Context discussion above) and means a newly shipped connector requires zero backfill against any existing tenant — every tenant already correctly reads as "not activated" for a connector that has no row, with no migration step needed.

For `authMode: 'none'` connectors (Newswire; no credential of any kind, tenant-wide or personal, ever exists for these — Tier 3 doesn't apply to a connector with no credential to own personally): activation only ever uses `connector_activations` (the tenant-wide table). `connector_user_activations` is never written for an `authMode: 'none'` platform, consistent with how these connectors have never offered a personal/"just for me" option anywhere else in this project (Story 6.3's own `ConnectForm` is never rendered for `authMode: 'none'` platforms at all).

### 2. Activation is a pure tenant-intent signal — it asserts nothing about whether the connector actually works

`is_active = true` on either table means exactly one thing: **the owner of that scope — a Tenant-Admin for `connector_activations`, or the individual user themselves for their own row in `connector_user_activations` (mirroring ADR-0028 Tier 3's "self-activated by the user" rule) — has chosen for this connector to be on, for that scope.** It does not imply, and must never be read or implemented as implying, that a stored credential is present or valid, that the connector's derived health is anything other than `failing`, or that ingestion has ever succeeded or ever will. Symmetrically, `is_active = false` does not imply anything is broken — a connector can be perfectly healthy and simply turned off by choice.

Activation (intent), credential validity/presence (capability, where `authMode` requires one), and derived `ConnectorHealth.status` (ADR-0009, unaffected by this ADR) are three orthogonal signals. **Whether a connector actually polls for a tenant requires all of them to hold together** — `is_active = true`, a valid stored credential if `authMode` requires one, and a health status that isn't `failing` (`shouldAttemptIngestion()`'s own existing check, which this ADR does not change and which continues to gate on health alone, unaware of activation until whoever builds the Story wires the two together). None of the three is a substitute for, or evidence of, either of the others. This distinction exists specifically so a future reader — or a future ADR revisiting any one of these three signals — cannot conflate "the tenant turned it on" with "it's actually running," which is precisely the conflation each of Bug 1/Bug 2/Bug 3 above made, in three different ways, before this ADR.

**Activation alone never triggers ingestion — confirmed explicitly, since a future capability depends on this staying true.** A row with `is_active = true` and nothing else is inert by design; ingestion still requires the credential and health conditions above to also hold. This matters beyond the immediate scope of this ADR: because activation is a real, queryable "the tenant is about to turn this on" signal that exists *before* ingestion can start, it creates the precondition for a future pre-activation impact estimate — a Tenant-Admin querying "what would activating this connector cost/generate downstream" before committing, particularly relevant for `AIProviderConnector`s (ADR-0038), whose enrichment calls are billed per-invocation and whose volume is driven directly by how much a newly activated `SocialConnector` ingests. See Consequences and Open Questions below — this ADR names the opportunity and confirms its design doesn't foreclose it, but does not build any estimation mechanism.

**Activation changes take effect on the next ingestion cycle, not immediately.** Flipping `is_active` to `true` or `false` is a synchronous write to the activation table only — it does not itself invoke `runIngestionAttempt()` or any other ingestion code path as a side effect, and there is no immediate poll-on-activate behavior. The effect becomes visible starting from whenever ingestion is next actually attempted for that `(tenantId, platformId[, userId])` — today that means whenever something next invokes `runIngestionAttempt()` (manually or via a test, since no scheduler exists yet, per Open Question 1); once a real scheduler exists, its next scheduled cycle. There is symmetrically no immediate poll-*cancellation* on deactivate either: an `IngestionRun` already in flight when a Tenant-Admin deactivates the connector completes normally, uninterrupted — the deactivation is only honored starting from the next attempt, never by reaching into a run that's already started.

### 3. Credentialed connectors (`authMode: 'api_key'` / `'oauth'`): both a stored credential AND an active row, in the same ownership scope, are required to poll

Presence of a `platform_credentials` row is necessary but no longer sufficient. A connector actually polls, **for a given ownership scope**, only when both conditions hold *for that same scope*: a valid credential exists at `(tenantId, platformId, ownerType, userId?)`, and the matching activation table (`connector_activations` for `ownerType: 'tenant'`, `connector_user_activations` for `ownerType: 'user'`) has `is_active = true` at that identical `(tenantId, platformId[, userId])`.

**Tenant-wide activation does not affect user-specific activation, and user-specific activation does not affect tenant-wide activation — in either direction, for either action.** Activating, deactivating, or simply reading `connector_activations` (the tenant-wide table) has zero effect on any row in `connector_user_activations` (any user's own personal scope) for that same platform, and vice versa: a user activating or deactivating their own personal credential never touches, and is never affected by, the tenant-wide row. This holds by construction, not by convention — the two live in genuinely separate tables, with no foreign key, trigger, or application-layer cross-write between them, so there is no code path capable of propagating a change from one scope into the other even accidentally.

**Deactivate and disconnect become two distinct, separately-named actions, both available, at whichever ownership scope the caller is acting on:**

- **Disconnect** (Story 1.7/ADR-0034's existing action, unchanged) — hard-deletes the credential via `deleteCredential()`. "Forget this connector entirely." The credential must be re-entered from scratch to reconnect.
- **Deactivate** (new) — flips `is_active` to `false` on the matching activation-table row for that scope. The credential is preserved untouched in `platform_credentials`. "Pause this connector." Reactivating requires no new credential entry, only flipping `is_active` back to `true` on that same row.

These are not two names for the same operation — they have materially different consequences (data loss vs. no data loss) and must be presented to the caller as separate, clearly distinguished actions, not a single toggle that quietly does one or the other.

### 4. `authMode: 'none'` connectors: `connector_activations` (the tenant-wide table) is the ONLY signal, defaulting to inactive

For Newswire (the concrete, currently-broken case) and any future `authMode: 'none'` connector without ADR-0050's own bespoke verification gate, there is no credential to check, and no Tier 3/personal scope is possible (per §1 above). `connector_activations.is_active` — the tenant-wide table only, never `connector_user_activations` — is the sole determinant of "connected."

**A newly created tenant has no `connector_activations` row for any `authMode: 'none'` connector — read identically to `is_active = false`, per §1's own lazy-creation rule.** No automatic activation of any kind, for any connector, ever, on tenant creation; no row is inserted for Newswire (or any future connector of this shape) just because a tenant now exists. An explicit Tenant-Admin action (`POST /v1/connectors/newswire/activate`) is required — the first such action for a given tenant is what creates the row at all — before Newswire begins polling for that tenant. This directly closes Bug 1.

### 5. New REST surface, named but not designed in exhaustive detail

Two new endpoints, deliberately separate from the existing `connect`/`disconnect` endpoints (Story 1.7/ADR-0034), which stay scoped to credential storage specifically and are not renamed or repurposed by this ADR:

- `POST /v1/connectors/:platformId/activate`
- `POST /v1/connectors/:platformId/deactivate`

**Discriminated by `ownerType` in the body, exactly the same way `connect`/`disconnect` already are** (ADR-0034 §3): `ownerType: 'tenant'` writes to `connector_activations` and requires the caller's resolved role to be `tenant_admin` (ADR-0028 Tier 2, mirroring `connect`'s own existing tenant-wide gate); `ownerType: 'user'` writes to `connector_user_activations` and always uses the caller's own resolved identity as `userId` — never a client-supplied value (ADR-0028 Tier 3's anti-spoofing rule, mirroring how `connect` already handles a personal credential). A `tenant_user` may activate/deactivate their own personal credential's activation row without `tenant_admin` authority, the same self-service Tier 3 already allows for creating the credential itself. Exact request/response shape is an implementation-time decision for whichever future Story builds this, once this ADR is Accepted. Named here as required scope, not designed in further detail.

### 6. Live credential validation is explicitly out of scope

Whether a stored credential is actually still valid — independent of whether it's merely present — is a genuinely separate question this ADR does not attempt to answer. Confirmed via direct code research this session: none of the four real connectors (`gnews`, `newswire`, `azure-ai-language`, `azure-openai`) has any existing lightweight "test the connection" call anywhere in `social-listening-core/src/connectors/` (verified: no `testConnection`, `validateCredential`, `healthCheck`, or `ping` function exists in that directory). Adding one would mean a genuinely new, real provider API call per connector — with real cost implications for at least one of them: Azure OpenAI's completions calls are billed per invocation, so a "test my key" button would itself cost real money on every click. This is named here as a real, confirmed, deliberately deferred gap for a future ADR/Story, not designed or built here.

### 7. Activation stays strictly human-controlled — no system-driven auto-deactivation in this pass

Every activation and deactivation in this ADR's scope is a human action — a Tenant-Admin for `connector_activations`, the individual user themselves for their own `connector_user_activations` row — recorded via `updated_by`. The system itself never flips either flag on its own. Whether the system may ever auto-deactivate a connector — for example, on sustained quota exhaustion, once real quota-consumption tracking exists — is a deliberately **unresolved Open Question**, not decided here (see Open Questions below). No scheduler or cron exists anywhere in this project today (confirmed directly — the only per-attempt choke point is `runIngestionAttempt()` itself, per ADR-0043 §3's own same finding for the tenant-deletion ingestion-halt), so there is no trigger mechanism to design against yet. Designing an automatic-disable policy now would be speculative. This also directly serves the historical-MSE-avoidance goal underlying this whole ADR: the fix here is making a *manual* pause non-destructive, not adding a *new* automatic disable path that could itself become another version of the same mistake this ADR exists to prevent.

### 8. The retryable/non-retryable conflation fix is separate, smaller, corrective work — not part of this ADR's own decision

Bug 3 (above) is a real implementation gap against ADR-0010's own already-Accepted Decision text, not a new decision this ADR is making. It is addressed via dated correction notes appended directly to ADR-0010 (and ADR-0023, since ADR-0023's own rate-math would also need to change), not as part of this ADR's Decision — see "Cross-ADR notes" below and each of those ADRs' own new Amendment Log entries.

### 9. Platform-wide connector availability (staged rollout) is a different axis entirely — named, not designed here

This ADR's two tables answer "has a tenant/user chosen to turn a connector on" — they say nothing about whether a connector *exists for any tenant to activate in the first place*. Today, a connector's existence is a code-deployment fact, not a database row: a `providerId` hardcoded into `social-listening-admin`'s `PLATFORMS` arrays and registered per ADR-0048's own no-core-pipeline-change policy. The moment a connector ships, every tenant sees it simultaneously — there is no staged-rollout, canary-cohort, or "Platform Admin built it but tenants can't see it yet" concept anywhere in this project.

**Confirmed with Menno: this is not a speculative concern, but it is not a current one either.** Every connector shipped to date has gone straight to general availability with no need for staging, because this project has not yet operated with real tenants under real load. The concrete, specific trigger this ADR names for when it *would* become real: once real tenants are live and a *new* connector needs to be rolled out gradually — a genuine canary/gradual-rollout need to validate the new connector's performance (rate-limit behavior, ingestion volume, provider reliability) under real traffic before enabling it for every tenant at once — rather than staging it because it's incomplete or untested in the ordinary development sense. Until that trigger condition exists (a live environment with real tenants, and a new connector specifically needing gradual, performance-validating rollout), designing a connector catalog now would be exactly the kind of speculative machinery ADR-0020's own "defer until a second concurrent instance is ever actually run" precedent already warns against building ahead of a demonstrated need. Whether this project ever needs a connector *catalog* — platform-wide availability state, sitting above both of this ADR's tables, not a variation of either — is a real, separate question this ADR does not attempt to answer. Named here, with its specific trigger condition, so a future ADR doesn't have to rediscover either the gap or the reasoning from scratch.

---

## Consequences

**Positive**
- Closes a real, currently-shipped bug: Newswire can finally be turned off for a tenant that doesn't want it, and every tenant no longer gets it silently on by default.
- Makes "pause" non-destructive for credentialed connectors — a Tenant-Admin no longer has to choose between "stay connected" and "lose the stored key," directly addressing the historical MSE failure mode Menno described (a connector disconnected — meaning credential lost — merely for exhausting quota) by ensuring that even if a future auto-pause mechanism is ever built, pausing will never mean losing the credential.
- Resolves ADR-0034's own named-but-unresolved Open Question with a concrete answer, rather than leaving it open indefinitely.
- A single, uniform mechanism (`connector_activations`) covers both `authMode: 'none'` and credentialed connectors, rather than each connector type inventing its own on/off gate the way ADR-0050 happened to for its own DNS-verification flow.
- Deliberately narrow scope (manual-only, no live validation) avoids building speculative machinery — no quota-tracking-driven auto-disable, no per-connector cost-incurring validation calls — ahead of an actual, named trigger or need.
- Creates the precondition for a future pre-activation impact estimate: because activation is now a real, queryable "about to turn this on" signal that exists before ingestion can start, a future capability could let a Tenant-Admin see an estimated downstream impact (ingestion volume, and — critically for `AIProviderConnector`s whose enrichment calls are billed per-invocation, ADR-0038 — estimated cost) before committing to activation, rather than discovering it only after real traffic starts. This ADR doesn't build that estimation mechanism, but its design doesn't foreclose it either — see Decision §2 and Open Question 8.

**Negative**
- Two new tables and two new endpoints are real, non-trivial implementation work for whoever picks up the resulting Story — two schema migrations, RLS policy on both tables, ownership-tier-aware authorization checks (mirroring `connect`/`disconnect`'s own existing split), and two new route handlers, plus a UI change to `social-listening-admin`'s connector and status screens to replace both hardcoded `authMode === 'none' → connected: true` branches.
- `GET /v1/connectors/:platformId`'s response shape (and the `ConnectorHealth` derivation/cache it wraps) will need to combine two now-separate signals — activation state and derived health — into one coherent "is this connector usable" answer; this ADR names the requirement (see ADR-0022's new dated note) without designing the combined response shape.
- Two distinct, similarly-named actions (deactivate vs. disconnect) for credentialed connectors is more UI surface and more opportunity for a Tenant-Admin to pick the wrong one — the Admin UI copy needs to make the destructive-vs-non-destructive distinction unmistakable, not assumed self-evident from a button label alone.
- Live credential validation remains a real, unaddressed gap: a Tenant-Admin can activate a connector whose stored credential is already dead, and won't find out until the next ingestion attempt fails — this ADR does not close that gap, only names it.
- The system-driven auto-deactivation question is left open rather than decided, which means the exact MSE-style failure mode this ADR exists to fix could theoretically resurface later if a future auto-disable mechanism is designed carelessly — named explicitly as a risk to weigh carefully whenever that future ADR is drafted, not a promise that it can't happen again.
- Platform-wide connector availability (staged/gradual rollout to validate a new connector's real-world performance before general availability) is a real, related gap this ADR does not close — a connector still goes from nonexistent to available-to-every-tenant the instant its code ships, with no in-between state. Not a current need (this project has no live tenants under real load yet), but a concrete, specific future trigger is named in Decision §9, not designed here.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Add `is_active boolean` directly to `platform_credentials`** | Rejected. Doesn't work for `authMode: 'none'` connectors, which have no credential row at all — Newswire's exact problem. Would require inserting a synthetic/placeholder credential row purely to hold an activation flag, conflating "do we have a secret to poll with" with "has the tenant chosen to turn this on" — the exact two concepts this ADR needs to keep separate. |
| **One `connector_activations` table with an `owner_type`/`user_id` discriminator column, instead of two separate tables** | Considered, rejected in favor of two tables. Would have mirrored `platform_credentials`' own single-table shape more literally, but requires a conditional-uniqueness rule (unique on `(tenant_id, platform_id)` only when `owner_type = 'tenant'`; unique on `(tenant_id, platform_id, user_id)` only when `owner_type = 'user'`) and a nullable `user_id` — real, avoidable complexity. Two tables, each with a single unambiguous unique key, is simpler to reason about, query, and apply RLS to; the cost is one extra table and one extra query (checking the right table by `ownerType`) instead of one filtered query. |
| **Soft-delete the credential** (add `deleted_at` to `platform_credentials`, "deactivate" = soft-delete) | Rejected. Still doesn't solve the no-credential (`authMode: 'none'`) case, and conflates pause-state with the credential's own lifecycle when the actual requirement is that activation be credential-independent by construction. |
| **Infer "inactive" from absence of recent ingestion runs, no new persisted state at all** | Rejected. This is Bug 1 in a different guise — there is no way to distinguish "an administrator deliberately turned this off" from "never decided" or "genuinely broken" purely from run history; it conflates observed activity/health with deliberate intent, which is exactly the distinction this ADR needs to introduce. |
| **Decide the system-driven auto-deactivation policy now** (e.g., auto-pause after N consecutive rate-limit hits) | Considered, explicitly rejected as premature. No quota-consumption tracking or scheduler exists anywhere in this project yet to trigger such a policy against, and designing an automatic disable path now would risk building a new version of the exact MSE-style mistake this ADR exists to avoid. Named as an Open Question instead of designed here. |
| **Add live credential validation now** (a "test connection" call per connector) | Considered, rejected as out of scope. None of the four connectors has an existing lightweight validation call; building one is genuinely new provider-API surface with real cost implications (Azure OpenAI's per-call billing). A separate future ADR/Story, not bundled into this one. |
| **Fold the retryable/non-retryable fix into this ADR's own Decision** | Rejected. That fix corrects an implementation gap against ADR-0010's own already-stated Decision intent — it is a clarification/correction, not a new decision, and belongs as dated notes on ADR-0010 (and ADR-0023) per this series' own governance-table convention, not as new content inside a new ADR number. |

---

## Open Questions

1. **Whether the system may ever auto-deactivate a connector** (e.g., on sustained quota exhaustion, once real quota-consumption tracking exists) — deliberately unresolved by this ADR. No scheduler/cron and no quota-consumption tracking exist yet anywhere in this project to design a trigger against; revisit only once both exist, and weigh the historical-MSE risk explicitly when doing so.
2. **Live credential validation** — confirmed, real, deliberately deferred. Named as a candidate for a future ADR/Story once its cost/value tradeoff (particularly for Azure OpenAI's per-call billing) has been weighed directly, not designed here.
3. **Exact `connector_activations`/`connector_user_activations` schema** (column types, RLS policy, whether a synthetic `id` is added) — implementation-time decision for the Story that picks this up.
4. ~~Whether activation is purely tenant-wide or needs its own `owner_type`/`user_id` scoping to mirror how credentials can be tenant-wide or user-bound.~~ **Resolved in this revision (2026-08-12):** yes — two separate tables, `connector_activations` (tenant-wide) and `connector_user_activations` (user-specific), mirroring ADR-0028/ADR-0034's own tenant/user ownership-tier split exactly. See Decision §1/§3/§5. Exact request/response shape for the two new endpoints remains an implementation-time decision, not designed here.
5. **How `GET /v1/connectors/:platformId}` combines activation state with derived `ConnectorHealth`** into one response — named as a requirement (see the new dated note on ADR-0022) but not designed here.
6. **Whether a deactivated `authMode: 'none'` connector should surface a distinct "why is this off" reason** (never activated vs. deliberately paused) in the Admin UI — a UX question, not decided here.
7. **Platform-wide connector availability / staged rollout** (Decision §9) — confirmed with Menno not to be a current need; this project has no live tenants under real load yet, and every connector shipped to date has gone straight to general availability. Named with its specific trigger condition: revisit once real tenants are live and a *new* connector needs genuine gradual/canary rollout to validate its real-world performance (rate-limit behavior, ingestion volume, provider reliability) before enabling it for every tenant at once. Not designed here, per the same "don't build ahead of a demonstrated need" discipline ADR-0020 already established for this project.
8. **Pre-activation impact estimation** — a real, valuable future capability this ADR's design enables but does not build: letting a Tenant-Admin query an estimated downstream impact (ingestion volume; cost, for `AIProviderConnector`s whose enrichment calls are billed per-invocation, ADR-0038) *before* activating a connector, to avoid a costly or high-volume surprise after the fact — raised directly by Menno, who explicitly connected it to §2's "activation alone never triggers ingestion" property. **The concrete shape this estimate would need, per Menno's own follow-up:** a per-watchlist dimension (each of a tenant's active watchlists' own boolean-query terms drive how much a newly activated connector would actually match and ingest — a broad watchlist against a high-volume connector produces a very different estimate than a narrow one) crossed with a quota/volume dimension expressed in terms of posts (an estimated post-count-per-cycle figure, not just a binary "will generate data or not"), so a Tenant-Admin can see *before* flipping `is_active` roughly how many posts a connector would start pulling in given their tenant's actual current watchlists — which is what would let a downstream `AIProviderConnector`'s per-invocation billing be estimated at all, since its own volume is driven directly by how many posts an ingestion connector produces. No estimation mechanism (historical volume sampling, per-watchlist match-rate modeling, per-connector cost modeling, a dry-run endpoint) exists anywhere in this project today, and this ADR does not design one — this paragraph only makes the shape of the future ask concrete, since the underlying capability was already named in the paragraph above. Named so a future ADR/Story can build it against this ADR's own activation signal directly, rather than needing to invent a substitute "about to activate" hook from scratch.

---

## Amendment Log

- **2026-08-12** — Drafted by the AI Business & Requirements Analyst persona, at Menno's direct request this session, from two real gaps found via direct code inspection (`social-listening-admin`'s connector/status screens hardcoding `connected: true` for `authMode: 'none'` platforms; `connectorHealth.ts`'s `deriveConnectorHealth()` not reading the `retryable` column `ingestion_runs` already has) and from Menno's own directly-recalled Microsoft Social Engagement quota-exhaustion disconnect failure mode. Resolves ADR-0034's own named-but-unresolved Open Question on whether connector activation needs its own table. Left **Proposed** — this persona does not hold ADR-acceptance authority; Menno (Sponsor) reviews and accepts separately.
- **2026-08-12, later the same day — first revision, before acceptance.** Menno flagged that the original single-table design (one `connector_activations` table with an implicit tenant-only scope) didn't account for `platform_credentials`' own already-decided tenant/user ownership-tier split (ADR-0028/ADR-0034) — a tenant-wide credential's activation state and an individual user's own personal credential's activation state need to be independently controllable, the same way the credentials themselves already are. Redesigned around **two tables** (`connector_activations` for the tenant-wide scope, `connector_user_activations` for the user-specific scope) rather than one table with an `owner_type`/`user_id` discriminator column — considered and rejected in the same pass, now recorded in Alternatives Considered. Decision §3 (credentialed connectors) and §5 (REST surface) revised to route by ownership scope accordingly; former Open Question 4 marked resolved with a strikethrough, per this series' own convention for a question settled before acceptance. A new Decision §2 was also added, at Menno's own direct request, stating explicitly that activation is a pure intent signal, orthogonal to credential validity and derived health, to head off a future reader conflating the three.
- **2026-08-12, later still the same day — second revision, before acceptance.** Menno asked whether this ADR should also cover a Platform Admin building a new connector that isn't yet available to any tenant (staged rollout). Confirmed directly this is a genuinely different axis from tenant/user activation (a connector's existence is a code-deployment fact today, not a database row) and, on Menno's own reflection, not a current need — this project has no live tenants under real load yet, and every connector shipped to date has gone straight to general availability. Added as Decision §9, a matching Consequences bullet, and Open Question 7, named with a concrete, specific trigger condition (revisit once real tenants are live and a new connector needs genuine gradual/canary rollout to validate real-world performance before general availability) rather than designed now, per the same "don't build ahead of a demonstrated need" discipline ADR-0020 already established for this project.
- **2026-08-12, later still the same day — third revision, before acceptance.** Menno specified explicit row-creation semantics: activation rows are created only on an explicit activate/deactivate action (never pre-populated for every `(tenantId, platformId)` pair at tenant creation, connector registration, or by any migration/backfill), and the absence of a row means "never activated," read identically to `is_active = false`. Added to Decision §1 (a new paragraph directly under the table schema) and Decision §4's own tenant-creation sentence corrected to remove language that could be read as implying a row gets pre-created with `is_active = false` at tenant-creation time — it does not; no row of any kind exists until the first real action. Keeps `createTenant()` exactly as simple as it is today and means a newly shipped connector needs no backfill against existing tenants.
- **2026-08-12, later still the same day — fourth revision, before acceptance.** Menno connected §2's "activation alone never triggers ingestion" property to a real future opportunity: a pre-activation impact estimate, letting a Tenant-Admin query an estimated downstream volume/cost impact — particularly for `AIProviderConnector`s (ADR-0038), whose enrichment calls are billed per-invocation — before actually activating a connector, to avoid a costly surprise after the fact. Added a confirming paragraph to Decision §2 (this ADR's design doesn't foreclose the idea, since activation is a real, queryable pre-ingestion signal), a new Positive Consequence, and Open Question 8. No estimation mechanism exists anywhere in this project today and none is designed here — named for a future ADR/Story to build directly against this ADR's own activation signal.
- **2026-08-12, later still the same day — fifth revision, before acceptance.** Menno asked for the tenant-wide/user-specific scope independence to be stated as its own explicit, unambiguous invariant rather than embedded inside the "deactivating one never touches the other" sentence in Decision §3. Added a standalone paragraph there stating the invariant symmetrically (either scope, either action — activate or deactivate — never affects the other) and grounding it structurally (no foreign key, trigger, or cross-write between the two tables, so no code path could propagate a change even accidentally). No substantive change to the design — this was already true by construction (two separate tables, per the first revision above) — only the ADR's own text made it explicit.
- **2026-08-12, later still the same day — sixth revision, before acceptance.** Menno asked for the timing semantics of an activation change to be made explicit: it takes effect on the next ingestion cycle, not immediately. Added a paragraph to Decision §2 stating that flipping `is_active` is a synchronous write with no side-effecting call into `runIngestionAttempt()` or any other ingestion path — no immediate poll-on-activate, and symmetrically no immediate poll-cancellation on deactivate (an in-flight `IngestionRun` completes normally, uninterrupted, even if deactivated mid-run). Ties explicitly to Open Question 1's own already-named fact that no scheduler exists yet, so "next cycle" today means "whenever `runIngestionAttempt()` is next actually invoked," not a concrete recurring schedule.
- **2026-08-12, later still the same day — seventh revision, immediately before acceptance.** Menno connected this ADR's own design directly to a further future capability: quota and impact analysis for watchlists and post volume, estimated *before* a connector actually starts ingesting live data — confirming this is exactly the room Decision §2's "activation alone never triggers ingestion" property and Open Question 8's pre-activation impact estimate were already built to leave open. Elaborated Open Question 8 with the concrete shape Menno named, rather than adding a new Open Question: a per-watchlist dimension (a tenant's own active watchlists' boolean-query terms drive how much a connector would actually match) crossed with a post-volume/quota dimension (an estimated post-count-per-cycle figure, not just a yes/no), so a Tenant-Admin could see roughly how many posts activating a connector would pull in, given their own tenant's real watchlists, before committing — and, downstream, so an `AIProviderConnector`'s per-invocation cost could eventually be estimated from that same post-volume figure. No new mechanism designed or built here; this only sharpens the shape of an already-named future ask. Confirmed by Menno as aligned with this ADR's intended scope — no further design change needed before acceptance.
- **2026-08-12, later still the same day — Accepted.** Menno (Sponsor) reviewed and accepted this ADR, verbatim: *"This scoped ADR is approved and perfectly alligns with the inteded connector related activation. Approved. Great piece of wor."* Accepted as revised (all seven pre-acceptance revisions above in effect) — see the ADR's own Status line and Acceptance note below. Story 1.11 (`docs/user-stories/epic-1-repository-and-api-foundation.md`) is added, covering the backend schema and REST-surface work named in Decision §1/§3/§4/§5 — the admin-UI wiring (activate/deactivate controls on the existing Story 6.3/6.5 screens) is deliberately left for a separate future story once Story 1.11's endpoints actually exist, per Consequences' own "UI change... to replace both hardcoded branches" Negative bullet, rather than bundled in speculatively now.
