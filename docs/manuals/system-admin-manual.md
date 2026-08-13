# SocialEngage — System Admin Manual

**Audience:** a `platform_admin` identity — the operator of the SocialEngage platform itself, not a member of any tenant.

**Current coverage, as of 2026-08-13:** sign-in, plus the real, working Platform Admin console (Story 6.6, first built 2026-08-08, then substantially rebuilt for real 2026-08-12 after an internal review found the first build's controls were non-interactive placeholders — see "Honest history" at the end of the console section) — a database health indicator, the tenant registry, tenant provisioning, per-tenant editing (name, status, license seats), the two-phase break-glass credential reset flow, and a recent-activity audit log. Nothing below describes a screen that doesn't exist yet; a handful of specific gaps are called out in their own place, and summarized together in "What's not built yet" at the end. The app also gained its first real stylesheet on 2026-08-12 — a visual change only, nothing about how the console works changed because of it.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically — there's no separate "log in" button to find first.
2. Sign in with your organization's Microsoft Entra identity. This is the same real sign-in flow every SocialEngage identity (System Admin, Tenant Admin, or ordinary user) uses — there's no separate System Admin login path.
3. Once signed in, SocialEngage recognizes you as a Platform Admin and routes you to the Platform-Admin-facing area of the app, separate from any tenant's own screens (Story 6.2) — both directions (a Platform Admin session on a tenant route, and vice versa) are redirected, contract-verified (`social-listening-admin@1f8960e`). A real misrouting bug existed here earlier the same day this manual was first written (a Platform Admin session's resolved-identity shape didn't match what the routing logic checked for, and neither route tree enforced anything server-side at all) — fixed and logged in `docs/implementation-log.md`, named here only so this manual's own history is honest, not as a currently-open caveat.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically — even if you were actively using the app right up to that point. This is a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device; nothing from it can be reused afterward.

## The Platform Admin console (Story 6.6)

Once you're signed in, SocialEngage takes you straight to the Platform Admin console — a single screen covering everything below. **This console never shows you any tenant's actual content** — no users, watchlists, social posts, or credentials — only the tenant-management and support data described in each section here.

### Database health

At the top of the console, a plain "Status: ok" or "Status: unavailable" line reports whether the backend's own database is currently reachable (reading the backend's own health check, Story 1.10) — a quick sanity check before you rely on anything else on the page.

### The tenant registry

A table lists every tenant on the platform: name, domain (or "n/a" if none was set), status (active or suspended), and how many of its licensed seats are currently in use out of its total. Each row has its own "Update" controls (see "Editing a tenant" below).

### Provisioning a new tenant

A "Provision tenant" form lets you create a brand-new tenant directly: a tenant name (required), an optional domain, and a license seat count (at least 1). Submitting it creates a real, persisted tenant immediately — the tenant registry above reflects it as soon as the page reloads.

### Editing a tenant

Each row in the tenant registry has its own "Update" form, letting you change that tenant's name, status (active/suspended), and license seat count. Saving takes effect immediately. **A tenant's domain cannot be changed from this form** — domain is only set once, at provisioning time.

### Break-glass credential reset

For a Tenant-Admin who's genuinely locked out, the "Break-glass" section runs a deliberate two-step flow, never a single click:
1. **Request reset** — choose the affected tenant from a dropdown, enter that person's target user ID, and submit. This only records the request; nothing happens to their credentials yet.
2. **Execute request** — once a request is recorded, a separate "Execute request" button appears. Clicking it actually performs the reset and returns a one-time Temporary Access Pass.

The Temporary Access Pass is shown **exactly once**, directly on the screen, with a plain instruction to copy it now and hand it to the affected Tenant-Admin through your own out-of-band channel (never through SocialEngage itself). It is never written anywhere else — not logged, not stored in your browser — and once you dismiss it ("I've copied this"), there is no way to see it again from this screen; a new break-glass request would be needed if it's lost before being copied.

### Reviewing the audit log

The console shows your platform's 10 most recent audit log entries — timestamp, operation, and the identity that performed it. **Current limitation:** there is no way yet to see anything older than the 10 most recent entries, or to filter the log by tenant, actor, or date range, from this screen.

**Honest history, not a currently-open caveat:** this console was first marked "Built" on 2026-08-08, but an internal review on 2026-08-12 found that three of its five sections — Provision tenant, Update tenant, and Break-glass — were each rendered as a single descriptive line of text with no actual form or button behind it, even though the backend functions they needed already existed and worked. All three were rebuilt for real the same day; the tenant registry and audit log were already genuine and needed no rework. Named here only so this manual's own history stays honest.

## What's not built yet

- **Infrastructure and cost metrics** are explicitly out of scope for this console — it covers tenant provisioning, break-glass support, and audit review only.
- **Older audit log history, or filtering it** by tenant, actor, or date — the console only ever shows the 10 most recent entries.
- **Changing a tenant's domain after it's been provisioned** — there's no form field for it anywhere in this console.

## Infrastructure & credential operations (not app usage — the underlying platform)

This section is different in kind from the rest of this manual: it's for whoever operates the real infrastructure behind SocialEngage (today, Menno, wearing an operator hat distinct from the in-app Platform Admin role above), not something reachable by signing into the app. **Named honestly, not invented:** this project currently has no decided rotation *policy* for any of the credentials below — that gap is already named, in the same terms, in ADR-0037 §1 ("this project has no decided real-production secrets-management strategy for any application-level or database credential today") and is a required gate before this project can leave Stage 0 at all (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §5.1: confirmed Key Vault purge-protection posture and a real credential rotation/expiry monitoring approach are both required before a persistent environment may be stood up). This section inventories what exists; it does not claim a rotation schedule that hasn't been decided.

**Real credential surface, as of 2026-08-06:**
- **Postgres role passwords** — `app_user`, `platform_admin_role`, `identity_resolver_role`, `tenant_signup_role` (migrations 0002/0015/0018/0021). Each is a separate, narrowly-scoped `BYPASSRLS`-or-RLS-governed role specifically so a compromise of one doesn't imply a compromise of another (`.claude/skills/platform-admin-access/SKILL.md`, `.claude/skills/identity-resolution/SKILL.md`) — rotating one does not require rotating the others.
- **Microsoft Entra app registrations/service principals** — the backend API's own registration (Story 5.6), `social-listening-admin`'s confidential Web client (Story 6.1), and the break-glass mechanism's two dedicated, deliberately-never-merged service identities: the "elevator" and the "resetter" (Story 5.7 — see `.claude/skills/platform-admin-access/SKILL.md`'s own Load-bearing constraints for exactly why these two must never share credentials or permissions).
- **The admin UI's session-cookie encryption key** (ADR-0036 §1) — a real, ≥256-bit secret, environment-variable only, never committed.
- **Azure Key Vault** — holds tenant-level connector credentials (envelope encryption, `.claude/skills/credential-envelope-encryption/SKILL.md`); soft-delete is confirmed for ephemeral test keys, but purge-protection posture for a real, standing vault has not yet been confirmed (Go-Live gate §5.1, still open).

**Not decided anywhere yet, named as open, not silently assumed:** rotation cadence for any of the above; who besides Menno can reach any of these credentials; whether a real secrets-management service (as opposed to environment variables) will ever be adopted. Do not treat the presence of this section as evidence any of this has been resolved — it hasn't; it's inventoried so the gap is visible, the same discipline this project's own ADRs already hold themselves to.
