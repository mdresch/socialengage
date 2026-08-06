# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Current coverage, as of 2026-08-06:** only sign-in exists. No day-to-day screens (browsing posts, viewing watchlists, checking topic/author signals) are built in `social-listening-admin` yet. This manual will grow section by section as those screens actually ship — nothing below describes a screen that doesn't exist yet.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes you as a member of your own organization's tenant and routes you to its screens only — never another tenant's, and never the System Admin area.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## How you get access

You don't sign yourself up. Your organization's own Tenant-Admin invites you by email; you sign in with that same email using your organization's Entra identity to activate your access. There is no public self-service sign-up open yet (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — this project is at Stage 0).

## What's not built yet

Everything past sign-in — browsing the posts your organization's watchlists have collected, checking sentiment/topic signals, and anything else a day-to-day user would actually do — already exists as real, working backend capability in `social-listening-core`, but has no screen in `social-listening-admin` yet.
