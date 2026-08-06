# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Current coverage, as of 2026-08-06:** sign-in, plus three screens in the tenant-facing screen tree (Story 6.2) that any signed-in member of your tenant can reach, not only your Tenant-Admin — connecting your own platform credential (Story 6.3), managing watchlists (Story 6.4), and checking connector status (Story 6.5). **All three currently display example/placeholder data rather than your tenant's real, live data, and none of their action controls are wired up to actually do anything yet** — see each section's own current-limitation note below. No screens for browsing the posts your watchlists have actually collected, or viewing sentiment/topic signals, are built yet. This manual will grow, and these limitation notes will be removed, as each screen is actually wired up to real data.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes you as a member of your own organization's tenant and routes you to its screens only — never another tenant's, and never the System Admin area.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## How you get access

You don't sign yourself up. Your organization's own Tenant-Admin invites you by email; you sign in with that same email using your organization's Entra identity to activate your access. There is no public self-service sign-up open yet (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — this project is at Stage 0).

## Your tenant's shared screens (Story 6.2)

Once you're signed in, SocialEngage shows you your own tenant's screens — the same ones your Tenant-Admin uses for connecting a platform, managing watchlists, and checking connector status. You'll never see another tenant's data.

## Connecting your own platform credential (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see the platforms SocialEngage currently supports — GNews and Newswire.
3. As an ordinary member of your tenant (not a Tenant-Admin), you can only ever connect your own personal credential for your own use — a tenant-wide connection shared by your whole organization stays your Tenant-Admin's job. Before you'd submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms.

**Current limitation, as of 2026-08-06:** what's shown here today is example connector data, not your tenant's actual connection state, and there is no working "Connect" or "Disconnect" button yet — you can't actually connect a platform from this screen today.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see a list of your tenant's watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which platforms it covers.
3. Below the list, a form lets you enter a name, choose a match type, and (for a boolean watchlist) enter the boolean query text, to create or edit a watchlist.
4. Each watchlist has a delete confirmation step before it's removed.

**Current limitation, as of 2026-08-06:** the watchlists shown here are example data, not your tenant's real watchlists, and neither the "Save" button nor the "Confirm delete" button is wired up yet — submitting the form or clicking delete doesn't actually create, edit, or remove anything today.

## Checking connector status (Story 6.5)

1. From your tenant's screens, open "View connector status."
2. For each connected platform, you'll see its health (healthy, degraded, or failing — a failing connector is visually called out) and the time of its last successful poll.
3. If a watchlist's boolean query uses a feature a connector can't natively evaluate, a warning appears next to that connector, so you understand why a match might rely on fallback filtering rather than the platform's own native search.

**Current limitation, as of 2026-08-06:** the connector health and watchlist warnings shown here are example data, not your tenant's real, live status — this screen isn't wired up to your tenant's actual connector health yet.

## What's not built yet

Browsing the posts your organization's watchlists have actually collected, checking sentiment/topic signals, and anything else about your tenant's real day-to-day activity — all of this already exists as real, working backend capability in `social-listening-core`, but has no screen in `social-listening-admin` yet.
