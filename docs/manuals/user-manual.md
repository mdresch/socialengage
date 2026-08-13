# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Current coverage, as of 2026-08-13:** sign-in, plus every tenant-facing screen a Tenant User (as opposed to a Tenant-Admin) can actually reach in `social-listening-admin`'s tenant screen tree — connecting your own personal platform credential and turning it on or off (Stories 6.3, 6.15), managing your own watchlists (Story 6.4), checking connector status (Story 6.5), viewing your tenant's user list (Story 6.8), a read-only view of your tenant's own settings (Story 6.9), browsing your tenant's ingested posts including a manual "run enrichment now" button (Stories 6.11, 6.16), and setting up your own company domain's content feed (Story 6.12). **All of these screens are real, backed by your tenant's actual data, with working actions — this manual's earlier note (as of 2026-08-06) that these screens showed only placeholder data with nothing wired up is now stale and has been removed.** A few things stay a Tenant-Admin's job only, called out plainly wherever that's the case — this manual only ever describes what a Tenant User can actually do, never an admin-only screen in detail. The app also gained its first real stylesheet on 2026-08-12 — a visual change only, nothing about how any screen below works changed because of it.

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

Once you're signed in, SocialEngage shows you your own tenant's screens — connecting a platform, setting up your own domain's content feed, managing watchlists, checking connector status, viewing the tenant's user list, viewing tenant settings, and browsing posts. You'll never see another tenant's data or the System Admin area. A couple of screens exist only for your Tenant-Admin — same-domain sign-up review and tenant deletion — and aren't reachable from your own sign-in at all.

## Connecting your own platform credential (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see every platform SocialEngage currently supports — GNews, Newswire, Azure AI Language, and Azure OpenAI Service — each shown with its real connection state and whether it's currently Active or Inactive.
3. Before you submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.
4. To connect GNews, Azure AI Language, or Azure OpenAI Service, enter the credential fields that platform needs (a single API key for GNews; an endpoint and key for Azure AI Language; an endpoint, key, and deployment name for Azure OpenAI Service) and submit. Newswire needs no credential at all.
5. **As an ordinary member of your tenant, connecting a platform always creates a personal connection just for you** — there's no "tenant-wide, shared by everyone" option on this screen for you; that choice is your Tenant-Admin's own to make, on their own connections.
6. Disconnecting asks you to confirm before it actually removes the connection — a two-step "Disconnect," then "Confirm: disconnect," never a single click, and it's immediate.
7. Alongside connect/disconnect, your own personal connection also has its own Activate/Deactivate control (Story 6.15) — a separate switch from the credential itself. Deactivating keeps your stored credential in place but stops it from being used for ingestion.

**Current limitation:** your own personal Activate/Deactivate control always starts by showing Inactive, even if you'd already activated it before — there's no way yet for this screen to read back your own real personal on/off state. If it's actually already on, clicking Activate again is harmless.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see your own watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which connected platforms it covers. **Watchlists are private to you** — even your Tenant-Admin can't see or manage your watchlists from this screen, and you can't see anyone else's.
3. Below the list, a form lets you create a new watchlist: a name, a match type, either search terms (one per line) or — for a boolean watchlist — a boolean query, and which of your connected platforms it should cover. Only platforms you've actually connected are offered here.
4. Each watchlist can be edited the same way it was created, switched active/inactive with its own dedicated toggle, and deleted. Deleting asks for a separate confirm step before anything is actually removed, and it's permanent.
5. If a watchlist has changed elsewhere since you loaded the page, saving your own change won't silently overwrite the other one — you'll see a message asking you to reload before retrying.

## Checking connector status (Story 6.5)

1. From your tenant's screens, open "View connector status."
2. For every platform SocialEngage supports — including ones you haven't connected yet — you'll see whether it's Active or Inactive, and if Active, its real health, the time of its last successful fetch, the time of its last attempt, and its consecutive-failure count.
3. This screen shows status only — never your posts or any other tenant content.

**Current limitations:**
- Watchlist compatibility warnings (which boolean-query features a given connector can't natively evaluate) are not shown here yet.
- For the two AI enrichment providers, this screen structurally can't show a meaningful "last successful fetch" — they're invoked inline while a post is being processed, not on a poll schedule, so they'll always read "no ingestion runs yet" here even after they've genuinely enriched real posts.

## Viewing your tenant's users (Story 6.8)

From your tenant's screens, open "Tenant users." You can see every user in your tenant — Tenant-Admin or Tenant User — along with their email, role, status, and when their access ends (shown as "active indefinitely" if no end date is set). **This is a read-only list for you** — inviting a new user or changing anyone's access is your Tenant-Admin's job; you won't see those controls here.

## Viewing your tenant's settings (Story 6.9)

1. From your tenant's screens, open "Tenant settings."
2. You'll see your tenant's real name, status, domain, how many of its licensed seats are currently used out of the total, and when the tenant was created. This is a read-only view — there's no form and no way to change anything from here.
3. You see the identical screen your Tenant-Admin does; there's no role difference on this one.

## Browsing your tenant's posts (Story 6.11)

Once your tenant has connected and activated a platform, SocialEngage polls it automatically in the background — GNews and Newswire every 15 minutes, your own domain's content feed every 30 minutes (Story 1.13) — so posts appear here on their own, with nothing anyone needs to click to make ingestion happen.

1. From your tenant's screens, open "Posts" to see what SocialEngage has ingested for your tenant — most recent first, each with the platform it came from, a title/snippet, and its published date. If a post has already been analyzed by an AI provider, you'll also see its sentiment, key phrases, and named entities right in the list.
2. A "Next page" link moves through the full list; there's no page-number picker, jump-to-page control, or way yet to filter by watchlist, platform, or date.
3. Click any post to open its own detail screen, which shows the same information plus the author (currently shown as a raw internal identifier — there's no lookup yet to turn it into a friendlier name) and which ingestion run brought it in (also a raw identifier, for the same reason).

## Running enrichment manually on an older post (Story 6.16)

1. On a post's detail screen, if that post has never been analyzed by an AI provider, you'll see a "Run enrichment now" button — this typically applies to a post that was ingested before your tenant had connected and activated any AI provider.
2. Clicking it asks SocialEngage to analyze that one post right now, using whichever AI provider your tenant currently has connected and active. On success, the screen reloads and shows the real sentiment, key phrases, entities, and which provider produced them.
3. If no AI provider is currently connected and active for your tenant, you'll see a plain message saying so rather than an error.
4. This button only appears on a post with no enrichment yet.

## Monitoring your own company domain's content feed (Story 6.12)

If your organization wants SocialEngage to monitor its own blog or newsroom rather than a third-party platform, you can set this up yourself — it's not restricted to your Tenant-Admin.

1. From "Connect a platform," follow "Set up your own domain's content feed."
2. Enter your domain and the feed URL and submit. SocialEngage gives you a DNS TXT record (a host, a value, and an expiry) to publish at your organization's own domain registrar — this can take up to 72 hours to take effect, which is normal.
3. Once published, come back and click "Verify now" (repeatably, if needed, while DNS propagates).
4. **Once verified, only your Tenant-Admin can actually turn this feed on** — you can set it up and verify domain ownership, but the Activate/Deactivate control that starts real monitoring only appears for a Tenant-Admin.

## What's not built yet

- **Filtering or searching your tenant's posts** — by watchlist, by platform, by date range, or by text.
- **A friendlier author or ingestion-run display on a post's detail screen** — both currently show as raw internal identifiers.
- **Watchlist compatibility warnings on the connector status screen.**
- **Reading back your own personal activation state for a connector** — the Activate/Deactivate control for your own personal connections always starts assuming it's off, even if it's actually already on.
- **Recovering a lost DNS TXT record for your own-domain content feed** if you leave the setup screen before publishing it — you'd need to start over.
