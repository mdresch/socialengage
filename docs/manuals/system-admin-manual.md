# SocialEngage — System Admin Manual

**Audience:** a `platform_admin` identity — the operator of the SocialEngage platform itself, not a member of any tenant.

**Current coverage, as of 2026-08-06:** only sign-in exists. `social-listening-admin`'s Platform-Admin-facing screen tree is routed separately from the tenant-facing one (Story 6.2), but no actual Platform Admin screens live in it yet — Story 6.6 (the Platform Admin console: tenant list, provisioning, break-glass, audit log) is Ready but not yet built. This manual will grow section by section as that story, and others, actually ship — nothing below describes a screen that doesn't exist yet.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically — there's no separate "log in" button to find first.
2. Sign in with your organization's Microsoft Entra identity. This is the same real sign-in flow every SocialEngage identity (System Admin, Tenant Admin, or ordinary user) uses — there's no separate System Admin login path.
3. Once signed in, SocialEngage recognizes you as a Platform Admin and routes you to the Platform-Admin-facing area of the app, separate from any tenant's own screens (Story 6.2) — a Platform Admin session never renders a tenant's own data.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically — even if you were actively using the app right up to that point. This is a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device; nothing from it can be reused afterward.

## What's not built yet

Everything past sign-in — provisioning a tenant, adjusting a tenant's license seats, executing a break-glass credential reset for a locked-out Tenant-Admin, and reviewing the audit log — already exists as real, working backend capability (`social-listening-core`, Stories 5.12–5.14), but has no screen in `social-listening-admin` yet. There is no way to do any of this from the UI today.

## Infrastructure & credential operations (not app usage — the underlying platform)

This section is different in kind from the rest of this manual: it's for whoever operates the real infrastructure behind SocialEngage (today, Menno, wearing an operator hat distinct from the in-app Platform Admin role above), not something reachable by signing into the app. **Named honestly, not invented:** this project currently has no decided rotation *policy* for any of the credentials below — that gap is already named, in the same terms, in ADR-0037 §1 ("this project has no decided real-production secrets-management strategy for any application-level or database credential today") and is a required gate before this project can leave Stage 0 at all (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §5.1: confirmed Key Vault purge-protection posture and a real credential rotation/expiry monitoring approach are both required before a persistent environment may be stood up). This section inventories what exists; it does not claim a rotation schedule that hasn't been decided.

**Real credential surface, as of 2026-08-06:**
- **Postgres role passwords** — `app_user`, `platform_admin_role`, `identity_resolver_role`, `tenant_signup_role` (migrations 0002/0015/0018/0021). Each is a separate, narrowly-scoped `BYPASSRLS`-or-RLS-governed role specifically so a compromise of one doesn't imply a compromise of another (`.claude/skills/platform-admin-access/SKILL.md`, `.claude/skills/identity-resolution/SKILL.md`) — rotating one does not require rotating the others.
- **Microsoft Entra app registrations/service principals** — the backend API's own registration (Story 5.6), `social-listening-admin`'s confidential Web client (Story 6.1), and the break-glass mechanism's two dedicated, deliberately-never-merged service identities: the "elevator" and the "resetter" (Story 5.7 — see `.claude/skills/platform-admin-access/SKILL.md`'s own Load-bearing constraints for exactly why these two must never share credentials or permissions).
- **The admin UI's session-cookie encryption key** (ADR-0036 §1) — a real, ≥256-bit secret, environment-variable only, never committed.
- **Azure Key Vault** — holds tenant-level connector credentials (envelope encryption, `.claude/skills/credential-envelope-encryption/SKILL.md`); soft-delete is confirmed for ephemeral test keys, but purge-protection posture for a real, standing vault has not yet been confirmed (Go-Live gate §5.1, still open).

**Not decided anywhere yet, named as open, not silently assumed:** rotation cadence for any of the above; who besides Menno can reach any of these credentials; whether a real secrets-management service (as opposed to environment variables) will ever be adopted. Do not treat the presence of this section as evidence any of this has been resolved — it hasn't; it's inventoried so the gap is visible, the same discipline this project's own ADRs already hold themselves to.
