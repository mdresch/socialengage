---
name: self-service-signup-ui
description: social-listening-admin's own self-service tenant sign-up flow — the "Sign up" entry point, the Entra prompt=create trigger, and the token-exchange -> redirect dispatch that turns core's POST /v1/tenants/self-service-signup response into the right screen. Read this before touching src/app/sign-up/**, src/app/api/auth/signup/route.ts, src/lib/signupFlow.ts, or the sign-up branch of src/app/api/auth/callback/route.ts.
---

# Self-service sign-up UI

## What this is

The UI-side half of ADR-0037: a brand-new, not-yet-tenant-linked caller signs up and, if their email domain isn't already claimed by another tenant, becomes the first `tenant_admin` of a newly-provisioned tenant. This component reuses Story 6.1's own BFF session mechanism end to end — same app registration, same Authorization Code + PKCE exchange, same OAuth-state cookie, same session cookie — rather than inventing a second auth mechanism. The only new wire-level thing this component adds is a `prompt=create` authorization-request parameter (a standard OAuth `prompt` value Entra honors, confirmed directly against `learn.microsoft.com/entra/msal/javascript/browser/prompt-behavior`: "Triggers a sign-up dialog allowing external users to create an account" — not MSAL-specific plumbing, works identically via `openid-client`'s `buildAuthorizationUrl()`, which passes arbitrary parameters straight through, per `github.com/panva/openid-client`'s own docs) and a tenant-name field the OAuth state cookie carries across the redirect round trip.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0037 | Self-service sign-up authorization mechanism, domain-match handling (never names the matched org), public-email-provider exclusion, `tenant_signup_role`, §8's noisy-but-non-enumerable rejection recording | 6.7 (this component), 5.15/5.16 (core) |
| ADR-0036 | The BFF session/auth mechanism this component reuses without modification for its own sign-in half | 6.1 |
| ADR-0029 §2 | Role/tenant identity is Postgres-owned, never inferred from an Entra token claim | applied here via `GET /v1/me` hydration on success, identical to ordinary sign-in |
| ADR-0027 | Disclosure discipline — sign-up copy states "free/self-service at this step," invents no pricing/contract commercial copy | 6.7 AC8, same discipline Story 6.3 already applied to connector copy |

## Contracts that constrain this component

- `contracts/epic-6/story-6.7.self-service-signup.contract.test.ts` — the `/sign-up` entry point and its tenant-name field; the signup Route Handler's real `prompt=create` redirect against the real Entra tenant, with the OAuth state cookie carrying `mode: 'signup'` + the collected tenant name; `completeSelfServiceSignup()`'s mapping of core's `POST /v1/tenants/self-service-signup` response (201 / domain-match 409 / already-belongs 409 / 5xx) to the right redirect; the domain-taken page's own non-org-naming copy; `core-client.ts` remaining the sole Bearer-attachment choke point (re-checked, not just inherited from Story 6.1).
- `social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts` — the backend endpoint this component calls; owns denylist/domain-match/invited-row/audit-log/partial-failure behavior. Not re-proven here.

## How to extend this safely

- The token-exchange -> redirect decision lives in `signupFlow.ts`'s `completeSelfServiceSignup()`, not inline in the callback route — keep it there. It's the one place that's actually unit-testable without a real interactive Entra sign-in (which needs a live email-OTP round trip this environment can't automate).
- Any new response shape core's self-service-signup endpoint might add later gets a new branch in `completeSelfServiceSignup()`'s status/message dispatch, not a new ad hoc fetch call elsewhere — `selfServiceSignup()` in `core-client.ts` stays the sole call site (ADR-0036 §2's existing choke-point rule, re-verified by this story's own contract, not just inherited).
- New public `/sign-up*` routes must be added to `proxy.ts`'s `PUBLIC_PATHS` explicitly, the same rule `admin-auth-session/SKILL.md` already states for `/sign-in`/`/signed-out`.
- The domain-taken page must stay static, generic copy — never interpolate anything about the matched tenant into it. There is nothing to leak by construction today (the redirect path carries no tenant data at all); keep it that way rather than "helpfully" passing a query param through from core's response.

## Load-bearing constraints — do not change casually

- **The domain-taken and already-have-account outcomes are told apart only by core's own response text** (`/already belong/i` vs. everything else on a 409) — `selfServiceSignupRouter.ts` (core) has exactly two 409 causes today. If core ever adds a third distinguishable 409 case, `completeSelfServiceSignup()`'s dispatch needs a real new branch, not a guess folded into the existing two.
- **`fetchResolvedIdentity()` is only called after a confirmed 201 from the self-service-signup endpoint**, never before — hydrating identity before provisioning succeeded would read `GET /v1/me` for a caller who still has no `users` row, which core already treats as "identity not resolvable" (returns null), silently producing a signed-in-but-unhydrated session. The ordering is asserted directly in the contract's success-path test (call order, not just call count).
- **The OAuth state cookie's `mode`/`tenantName` fields are optional and additive** — Story 6.1's own ordinary sign-in path never sets them, so `mode === 'signup'` is the one and only branch point in the shared callback route; don't restructure the ordinary sign-in path to also route through `signupFlow.ts`, it doesn't need to and Story 6.1's contract assumes it doesn't.
- **`prompt=create` is sent on the authorization request, never assumed as a default** — omitting it would send the caller through the ordinary sign-in view of the same combined sign-up-and-sign-in user flow (Microsoft Entra External ID customer tenants support exactly one user-flow type covering sign-in, sign-up, and password reset together — confirmed directly, not assumed, via `learn.microsoft.com/dynamics365/commerce/dev-itpro/set-up-external-entra-id`: "Currently, Microsoft Entra External ID only supports one type of flow"). There is no separate sign-up-only user flow to point at instead.

## Known gaps / deferred work

- **ADR-0037 §8a's email-OTP-verification precondition is a configuration/deployment check, not code this component builds** — confirming `social-listening-admin`'s configured Entra user flow actually has email verification enabled (Email-with-password or Email-OTP, both verify via OTP per Microsoft's own docs) is a manual step for whoever operates this tenant, named here so it isn't silently assumed. No runtime check exists in this codebase for it.
- **§8b (Same-Domain Invite Assist) and §8c (Platform-Admin escalation visibility) are not built by this component** — Story 6.7's own Acceptance Criteria stop at core recording the rejection (Story 5.15/5.16, already built); the Tenant-Admin-facing surface is Story 6.10, not yet built as of this component's own creation.
- **§7's rate-limiting/abuse-prevention mechanism does not exist** — this UI-side story explicitly excludes it from its own Acceptance Criteria (ADR-0037 §7 names it as a precondition for exposing the backend endpoint to real, untrusted traffic — Story 5.18, Ready but unbuilt). This screen is not yet safe to expose to real, untrusted traffic.
- **No real, end-to-end interactive sign-up is exercised by this story's own contract** — unlike Story 6.1's own live sign-in E2E test, a fresh self-service sign-up requires completing a live email-OTP challenge against a brand-new mailbox this environment cannot read. The redirect-construction half (real Entra discovery, real `prompt=create` URL) is proven for real; the post-callback dispatch logic is proven at the unit level against a mocked `fetch`, the same seam Story 6.1's own AC7 test already established.
