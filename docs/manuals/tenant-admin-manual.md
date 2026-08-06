# SocialEngage — Tenant Admin Manual

**Audience:** a `tenant_admin` identity — manages your own organization's SocialEngage tenant (users, connectors, watchlists).

**Current coverage, as of 2026-08-06:** only sign-in exists. `social-listening-admin`'s tenant-facing screen tree is routed separately from the Platform-Admin-facing one (Story 6.2), but no tenant-facing screens (connect flow, watchlist management, connector status, user invites) live in it yet — Stories 6.3–6.5/6.8/6.9 are Ready but not yet built. This manual will grow section by section as those stories actually ship — nothing below describes a screen that doesn't exist yet.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes your Tenant-Admin role and routes you to your own tenant's screens, never a System Admin's or another tenant's.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## How you get your own tenant today

There is no public self-service sign-up open yet (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — this project is at Stage 0; public self-onboarding is explicitly gated until a later, explicitly-declared stage). A self-service backend endpoint exists (Story 5.15), but the sign-up screen itself (Story 6.7) isn't built, and even once it is, it won't be open to the public until that gate is formally lifted. Today, a tenant and its first Tenant-Admin are set up directly by a Platform Admin.

## What's not built yet

Inviting a colleague, connecting a social platform, creating and managing watchlists, and checking a connector's health status all already exist as real, working backend capability in `social-listening-core`, but none has a screen in `social-listening-admin` yet. There is no way to do any of this from the UI today — every one of these actions currently requires direct API access, which is developer/operator territory, not something this manual documents (this manual is for using the product, not calling its API directly).
