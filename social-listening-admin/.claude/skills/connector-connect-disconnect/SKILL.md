---
name: connector-connect-disconnect
description: The real, working connector connect/disconnect flow at /tenant/connectors — dynamic connection state and real credential submission for GNews, Newswire, Azure AI Language, and Azure OpenAI. Read this before touching src/app/tenant/connectors/**, the connector functions in src/lib/core-client.ts, or before adding a fifth connectable platform.
---

# Connector connect/disconnect flow

## What this is

`/tenant/connectors` lets a tenant see each real, shipped connector's actual connection state and submit or remove a credential — the only path by which a real tenant can ever connect `gnews`, `azure-ai-language`, or `azure-openai` (all `authMode: 'api_key'`) to their own account. `newswire` (`authMode: 'none'`) has no credential to connect/disconnect, but is **no longer rendered as always-active** — see Story 6.15 below. Every state shown and every action taken goes through a real HTTP call to `social-listening-core`'s existing connect/disconnect endpoints (Story 1.7, ADR-0034) — nothing here is hardcoded or simulated.

**Healed 2026-08-10 (Menno's explicit authorization), not built new.** The version of this screen originally shipped under Story 6.3 was a static placeholder: a hardcoded `[gnews, newswire]` array with hardcoded `connected` booleans, no credential form, and no backend API call anywhere in `core-client.ts`. Story 6.3's own contract at the time only checked the page existed and contained specific text strings — it never proved a real credential could be submitted. Discovered while confirming whether the two new AI provider connectors (Story 2.8, Story 2.9) could actually be used by a real tenant — they couldn't, and neither could GNews/Newswire despite Story 6.3 being marked built. See `docs/implementation-log.md`'s healing-pass entry for the full account.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0034 | Ownership-tier-aware connector connect/disconnect — `POST /v1/connectors/:platformId/connect` (body-discriminated `ownerType`), `DELETE /v1/connectors/:platformId/disconnect` (query-discriminated `ownerType`) | 6.3 |
| ADR-0027 | The connect flow's own copy must disclose the caller is signing up directly with the provider, not through SocialEngage | 6.3 |
| ADR-0028 | Tier 2 (tenant-wide, `tenant_admin`-only) vs. Tier 3 (personal, self-activated) credential ownership | 6.3 |
| ADR-0038 §2 | Azure AI Language and Azure OpenAI both need this screen to be real, not a placeholder, to be usable at all | 6.3 (healed) |
| ADR-0051 | Connector activation, decoupled from credential presence — real `isActive`-driven Active/Inactive state and activate/deactivate controls, replacing the old credential-presence/`authMode`-based inference | 6.15 |

## Contracts that constrain this component

- `contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts` — the connector list and each platform's connection state come from a real `getConnectorStatus()` call, not a hardcoded literal; `ownerType: 'tenant'` is offered only when the resolved session is `tenant_admin`; a 403 from either `connectPlatform()` or `disconnectPlatform()` surfaces the real backend error text; disconnect requires an explicit two-click confirm sub-state, never `window.confirm()`; `core-client.ts` stays the sole Bearer-attachment choke point.
- `contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts` — `activatePlatform()`/`deactivatePlatform()` and their proxy routes; `ConnectorStatus.isActive`; the Active/Inactive label is driven by real `isActive`, never `authMode`/`credentialStatus`; `ActivateDeactivateButton` (new, `.claude`-adjacent component, `ActivateDeactivateButton.tsx`) is rendered for every platform, never gated behind `connected`; the personal control is hidden for `authMode: 'none'` platforms; the tenant-wide control is gated on `tenant_admin`; deactivating never removes `ConnectForm`/`DisconnectButton`.

## How to extend this safely

- **Adding a fifth connectable platform**: add one entry to `PLATFORMS` in `page.tsx` (id, name, `authMode`, `credentialFields` if `api_key`) — no other file needs to change. This mirrors `azure-openai-connector/SKILL.md`'s own "adding a third `AIProviderConnector`" guidance on the core side; the two lists (core's real connectors, this screen's `PLATFORMS` array) are not automatically kept in sync — there is no "list all registered connectors" backend endpoint (see Known gaps) — so a new core connector must be added here by hand.
- **A platform needing a multi-field credential**: give it `credentialFields` with more than one entry — `ConnectForm.tsx` automatically JSON-encodes multiple fields into the single opaque `credential` string the backend expects (ADR-0014, no new storage pattern); a single-field platform submits that one value raw, unencoded.
- **A platform with `authMode: 'none'`** (like Newswire): omit `credentialFields` — no connect/disconnect action renders, but the platform still gets a real Active/Inactive label and a tenant-wide-only activation control (Story 6.15), since it has no personal/Tier-3 scope to activate.
- **`ActivateDeactivateButton`'s tenant-wide vs. personal controls**: gate exactly like `ConnectForm`'s own `allowTenantWide` (`isTenantAdmin`) and `authMode !== 'none'` — don't invent a third gating condition. The personal control's own `isActive` prop is always passed `false` (see Load-bearing constraints below) — never wire it to the tenant-wide `isActive` value.

## Load-bearing constraints — do not change casually

- **Connection state is always derived from `credentialStatus !== null`, computed client-side (well, server-side in the Server Component) from `GET /v1/connectors/:platformId`'s response — never a separate "is connected" field or a client-tracked boolean.** This is the same derivation `deriveConnectorHealth()` uses on the backend (ADR-0009) — don't introduce a second, independently-tracked notion of "connected."
- **Disconnect is always a two-click confirm sub-state (`useState`), never `window.confirm()`.** Matches `AccessControl.tsx`'s (Story 6.8) own established pattern for every destructive action in this repo — a native browser dialog is untestable in this project's own contract style and inconsistent with every other confirm flow here.
- **`core-client.ts` is the sole place a bearer token is attached (ADR-0036 §2)** — `ConnectForm.tsx`/`DisconnectButton.tsx` (Client Components) never call `social-listening-core` directly; they call this repo's own same-origin proxy routes (`/api/connectors/[platformId]/connect|disconnect`), which call `core-client.ts`'s `connectPlatform()`/`disconnectPlatform()`. Don't add a second way for a Client Component to reach core.
- **A failed `getConnectorStatus()` call for one platform degrades that platform to "not connected," not a failed page render.** A transient core-side issue affecting one connector must never block a tenant from seeing or acting on the others — `loadConnectorState()`'s own `try/catch` is load-bearing, not incidental.
- **`credential` on the wire is always a single string** — `connectPlatform()`/the backend's own `POST .../connect` never inspect or reshape it. Multi-field JSON-encoding is a `ConnectForm.tsx`-only concern; don't push that logic into `core-client.ts`, which stays a thin, credential-shape-agnostic transport layer.
- **Activation and credential management are separate, visibly distinct actions (ADR-0051 Decision §3) — never merge `ActivateDeactivateButton` into `ConnectForm`/`DisconnectButton`, and never let deactivating a connector hide or disable either.** A credential can be connected-but-inactive or disconnected-but-was-once-active; the two states are independent by construction.
- **`ConnectorStatus.isActive` (Story 1.12) is tenant-wide scope only.** There is no per-user (`ownerType: 'user'`) read yet — the personal `ActivateDeactivateButton` on both screens is always rendered with `isActive={false}` (an honest "unknown, assume off" default, not a real read of the user's own personal state) rather than reusing the tenant-wide value, which would misrepresent a user's own activation state. Don't "fix" this by wiring the personal control to the tenant-wide `isActive` — that's actively wrong, not an approximation improvement.

## Known gaps / deferred work

- **No "list all registered connectors" backend endpoint exists** — `PLATFORMS` in `page.tsx` is a manually-maintained list, not fetched dynamically from core. Story 6.5's own SKILL.md already names this same gap from the status-view side. A real fix would be a core endpoint this screen (and Story 6.5's) could both query; not built here.
- **The disconnect-personal / Tenant-Admin-offboarding-a-user's-own-credential case (ADR-0034 §3's own named dual-actor rule) is not distinguished in the UI** — `DisconnectButton` always passes the caller's own resolved `ownerType`; a Tenant-Admin disconnecting a *different* user's personal credential on their behalf (the offboarding case ADR-0034 explicitly permits) has no UI path yet, only the backend's own `?userId=` query param support.
- **No credential validation before submission** — a malformed `{endpoint,key}` JSON for Azure AI Language, or a wrong-shaped key for GNews, is only caught when the backend actually tries to use it (or not even then — `storeCredential()` stores whatever string it's given). No client-side or connect-time format check exists.
- **The personal `ActivateDeactivateButton`'s own initial `isActive` state is always assumed `false` on page load** (Story 6.15) — `GET /v1/connectors/:platformId` only exposes tenant-wide activation (Story 1.12's own named scope limit). A user who already personally activated a connector sees "Activate" instead of "Deactivate" until they interact with it or a real per-user read is built. Named, not silently wrong-by-accident.
- **Live credential validation, system-driven auto-deactivation, and `GET /v1/connectors/:platformId`'s own activation+health response-shape design remain out of scope** (ADR-0051 Decision §6/§7, Open Question 5/6) — see `.claude/skills/connector-activation/SKILL.md` (in `social-listening-core`) for the fuller account of what's deferred and why.
