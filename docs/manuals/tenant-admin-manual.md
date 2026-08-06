# SocialEngage — Tenant Admin Manual

**Audience:** a `tenant_admin` identity — manages your own organization's SocialEngage tenant (users, connectors, watchlists).

**Current coverage, as of 2026-08-06:** sign-in, plus three real tenant-facing screens now exist in `social-listening-admin`'s tenant-facing screen tree (Story 6.2) — connecting a platform (Story 6.3), managing watchlists (Story 6.4), and checking connector status (Story 6.5). **All three currently display example/placeholder data rather than your tenant's real, live data, and none of their action controls (connect/disconnect, save, delete) are wired up to actually do anything yet** — see each section's own current-limitation note below; this is a genuine, verified limitation of the screens as they exist today, not a formality. Inviting or managing users (Story 6.8), a read-only tenant settings view (Story 6.9), and the Same-Domain Invite Assist view (Story 6.10) are all still unbuilt — see "What's not built yet" below. This manual will grow, and these limitation notes will be removed, as each screen is actually wired up to real data.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes your Tenant-Admin role and routes you to your own tenant's screens, never a System Admin's or another tenant's.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## How you get your own tenant today

There is no public self-service sign-up open yet (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — this project is at Stage 0; public self-onboarding is explicitly gated until a later, explicitly-declared stage). A self-service backend endpoint exists (Story 5.15), but the sign-up screen itself (Story 6.7) isn't built, and even once it is, it won't be open to the public until that gate is formally lifted. Today, a tenant and its first Tenant-Admin are set up directly by a Platform Admin.

## Your tenant's own screens (Story 6.2)

Once you're signed in, SocialEngage shows you your own tenant's shell — the small set of screens below, for connecting platforms, managing watchlists, and checking connector status. You'll never see another tenant's data or the System Admin area from your own sign-in.

## Connecting a platform (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see the platforms SocialEngage currently supports — GNews and Newswire — each shown with a connection state and whether it would be a tenant-wide or a personal connection.
3. Before you'd submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.

**Current limitation, as of 2026-08-06:** what's shown here today is example connector data, not your tenant's actual connection state, and there is no working "Connect" or "Disconnect" button yet — you can't actually connect or disconnect a platform from this screen today. Connecting or disconnecting a platform for real currently requires direct API access, which is developer/operator territory, not something this manual documents.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see a list of your tenant's watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which platforms it covers.
3. Below the list, a form lets you enter a name, choose a match type, and (for a boolean watchlist) enter the boolean query text, to create or edit a watchlist.
4. Each watchlist has a delete confirmation step before it's removed.

**Current limitation, as of 2026-08-06:** the watchlists shown here are example data, not your tenant's real watchlists, and neither the "Save" button nor the "Confirm delete" button is wired up yet — submitting the form or clicking delete doesn't actually create, edit, or remove anything today. Watchlists can be created, edited, and deleted for real only via direct API access right now (the real capability behind this screen, Story 1.5, is fully built and working), which is developer/operator territory, not something this manual documents.

## Checking connector status (Story 6.5)

1. From your tenant's screens, open "View connector status."
2. For each connected platform, you'll see its health (healthy, degraded, or failing — a failing connector is visually called out) and the time of its last successful poll.
3. If a watchlist's boolean query uses a feature a connector can't natively evaluate, a warning appears next to that connector, so you understand why a match might rely on fallback filtering rather than the platform's own native search.
4. This screen shows status only — never your posts or any other tenant content.

**Current limitation, as of 2026-08-06:** the connector health and watchlist warnings shown here are example data, not your tenant's real, live status — this screen isn't wired up to your tenant's actual connector health yet.

## What's not built yet

- **Inviting or removing a colleague from your tenant, and setting when their access ends** (Story 6.8) — neither this screen nor its backend (Story 1.9) exists yet.
- **Viewing your own tenant's name, status, domain, and seat counts** (Story 6.9) — neither this screen nor its backend (Story 1.8) exists yet.
- **Reviewing same-domain sign-up attempts against your tenant, with a one-click way to invite a legitimate colleague** (Story 6.10) — the backend that records these attempts already exists and works (Story 5.16), but there's no screen yet to see them from.
- Connecting a platform, managing watchlists, and checking connector status (Stories 6.3–6.5, above) have real screens now, but as noted in each section above, none of them is wired up to your tenant's real, live data yet.

There is no way to do any of the above (invites, tenant settings, same-domain invite review) from the UI today; every one of these actions currently requires direct API access, which is developer/operator territory, not something this manual documents.
