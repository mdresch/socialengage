# SocialEngage — Tenant Admin Manual

**Audience:** a `tenant_admin` identity — manages your own organization's SocialEngage tenant (users, connectors, watchlists).

**Current coverage, as of 2026-08-13:** sign-in, plus every tenant-facing screen currently built in `social-listening-admin`'s tenant screen tree — connecting/disconnecting platforms and turning them on or off (Stories 6.3, 6.15), managing your own watchlists (Story 6.4), checking connector status (Story 6.5), managing your tenant's users (Story 6.8), a read-only view of your tenant's own settings (Story 6.9), the Same-Domain Invite Assist view (Story 6.10), browsing your tenant's ingested posts, including a manual "run enrichment now" button (Stories 6.11, 6.16), setting up and activating your own company domain's content feed (Stories 6.12, 6.17), and requesting deletion of your entire tenant (Story 6.13). **All of these screens are now real, backed by your tenant's actual data, with working actions — this manual's earlier note (as of 2026-08-06) that these screens showed only placeholder data with nothing wired up is now stale and has been removed; it no longer describes any screen in this app.** A handful of specific, narrower gaps remain — each is called out in its own section below, and summarized together in "What's not built yet" at the end. The app also gained its first real stylesheet on 2026-08-12 (every screen before that was bare, unstyled HTML) — a visual change only, nothing about how any screen below works changed because of it.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes your Tenant-Admin role and routes you to your own tenant's screens, never a System Admin's or another tenant's.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## How you get your own tenant today

A self-service sign-up screen now exists and works end to end (Story 6.7) — entering your organization's name and signing in with Microsoft creates a brand-new tenant with you as its first Tenant-Admin, a real, persisted tenant, not a preview. That said, per this project's own current stage (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — Stage 0; no persistent environment or public onboarding is open yet), this path isn't open to the general public today. In practice, a tenant and its first Tenant-Admin are still typically set up by a Platform Admin directly, rather than through public self-service sign-up.

## Your tenant's own screens (Story 6.2)

Once you're signed in, SocialEngage shows you your own tenant's shell — screens for connecting platforms and turning them on or off, setting up your own company domain's content feed, managing your own watchlists, checking connector status, managing your tenant's users, viewing your tenant's own settings, reviewing same-domain sign-up attempts (Tenant-Admins only), browsing your tenant's ingested posts, and — as a Tenant-Admin only — requesting deletion of the entire tenant. You'll never see another tenant's data or the System Admin area from your own sign-in.

## Connecting a platform (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see every platform SocialEngage currently supports — GNews, Newswire, Azure AI Language, and Azure OpenAI Service — each shown with its real connection state (Connected, along with the credential's own status such as valid, expiring soon, expired, or revoked, or Not connected) and whether it's currently Active or Inactive.
3. Before you submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.
4. To connect GNews, Azure AI Language, or Azure OpenAI Service, enter the credential fields that platform needs (a single API key for GNews; an endpoint and key for Azure AI Language; an endpoint, key, and deployment name for Azure OpenAI Service) and submit. Newswire needs no credential at all — there's nothing to submit, and it always shows as connected.
5. As a Tenant-Admin, you can choose whether a new connection is "Tenant-wide" (shared by everyone in your tenant) or "Just for me" (a personal connection only you can use). As a Tenant User, connecting a platform always creates a personal connection just for you.
6. Disconnecting asks you to confirm before it actually removes the connection — it's a two-step "Disconnect," then "Confirm: disconnect," never a single click, and it's immediate.
7. Alongside connect/disconnect, each platform also has its own Activate/Deactivate control (Story 6.15) — a separate switch from the credential itself. Deactivating a platform keeps its stored credential in place (so you can reactivate it later without reconnecting) but stops it from being used for ingestion. A newly connected platform, and Newswire in particular, is not automatically Active — a Tenant-Admin has to explicitly turn it on.

**Current limitation:** the personal ("Just for me") Activate/Deactivate control always starts by showing Inactive, even if you'd already activated it before — there's no way yet for this screen to read back your own real personal on/off state; only the tenant-wide state can be read today. If it's actually already on, clicking Activate again is harmless.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see your own watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which connected platforms it covers. **Watchlists are private to you** — even as a Tenant-Admin, you can't see or manage another user's watchlists from this screen; there is no tenant-wide oversight view of everyone's watchlists.
3. Below the list, a form lets you create a new watchlist: a name, a match type, either search terms (one per line) or — for a boolean watchlist — a boolean query, and which of your connected platforms it should cover. Only platforms you've actually connected (GNews and/or Newswire) are offered here; the two AI enrichment providers never appear as watchlist platforms, since a watchlist matches ingested posts by the source platform they came from, not by which AI provider might later analyze them.
4. Each watchlist can be edited the same way it was created, switched active/inactive with its own dedicated toggle, and deleted. Deleting asks for a separate confirm step ("Delete," then "Confirm delete") before anything is actually removed, and it's permanent.
5. If a watchlist has changed elsewhere since you loaded the page (for example, edited in a second browser tab), saving your own change won't silently overwrite the other one — you'll see a message telling you it changed elsewhere and asking you to reload the page before retrying.

## Checking connector status (Story 6.5)

1. From your tenant's screens, open "View connector status."
2. For every platform SocialEngage supports — including ones you haven't connected yet — you'll see whether it's Active or Inactive, and if Active, its real health (a failing connector is visually flagged distinctly from a healthy or degraded one), the time of its last successful fetch, the time of its last attempt, and its consecutive-failure count.
3. As a Tenant-Admin, you get the same Activate/Deactivate control here that's available from the Connect a platform screen.
4. This screen shows status only — never your posts or any other tenant content.

**Current limitations:**
- Watchlist compatibility warnings (which boolean-query features a given connector can't natively evaluate) are not shown here yet — the screen says so directly rather than showing fake data. Surfacing this needs a new backend endpoint that doesn't exist yet.
- For the two AI enrichment providers (Azure AI Language, Azure OpenAI Service), this screen structurally can't show a meaningful "last successful fetch" — they're invoked inline while a post is being processed, not on a poll schedule, so they'll always read "no ingestion runs yet" here even after they've genuinely enriched real posts. This is a known, deliberately-left-as-is gap, not an error in the numbers you do see for GNews, Newswire, or the connector's own Active/Inactive state.

## Managing your tenant's users (Story 6.8)

1. From your tenant's screens, open "Tenant users." Every user in your tenant — Tenant-Admin or Tenant User — can see this list: email, role, status, and when their access ends (shown as "active indefinitely" if no end date is set).
2. As a Tenant-Admin, you additionally get an "Invite a user" form — enter an email address, choose a role (`tenant_user` or `tenant_admin`), and send the invite.
3. If your tenant is already at its licensed seat limit, inviting one more person is rejected with a plain explanation — free up a seat, or ask your Platform Admin to raise the limit, before inviting anyone else.
4. As a Tenant-Admin, each user row also has access controls: end that user's access immediately, schedule an end date for later, or — once someone's access has an end date, whether already passed or still scheduled — reactivate them. Each of these asks you to confirm before it takes effect, and the confirmation text itself makes clear whether the change is immediate or scheduled for later, so you can't mistake one for the other.

## Viewing your tenant's settings (Story 6.9)

1. From your tenant's screens, open "Tenant settings."
2. You'll see your tenant's real name, status, domain, how many of your licensed seats are currently used out of your total, and when the tenant was created. This is a read-only view — there's no form and no way to change anything from here.
3. Both Tenant-Admins and Tenant Users see the identical screen; there's no role difference on this one.

## Reviewing same-domain sign-up attempts (Story 6.10)

1. As a Tenant-Admin, open "Same-Domain Invite Assist" from your tenant's screens. This screen is Tenant-Admin only — a Tenant User is redirected away from it, not shown a stripped-down version.
2. You'll see a list of email domains that already match your tenant's own domain, where someone tried to sign themselves up rather than being invited, grouped one entry per domain. A domain with repeated attempts is flagged "⚠ Escalated."
3. Expand a domain to see the individual email addresses that attempted sign-up under it.
4. Next to each email, an "Invite this person" link takes you straight to the Tenant Users screen with that email already filled into the invite form — it doesn't send the invite for you; you still review it and click "Send invite" yourself.

## Browsing your tenant's posts (Story 6.11)

Once you've connected and activated a platform, SocialEngage now polls it automatically in the background — GNews and Newswire every 15 minutes, your own domain's content feed every 30 minutes (Story 1.13) — so posts appear here on their own, with nothing you need to click to make ingestion happen. (Before this scheduler shipped, on 2026-08-13, there was no automatic ingestion in this app's real running instance at all; only what's described here reflects real, live behavior.)

1. From your tenant's screens, open "Posts" to see what SocialEngage has ingested for your tenant — most recent first, each with the platform it came from, a title/snippet, and its published date. If a post has already been analyzed by an AI provider, you'll also see its sentiment, key phrases, and named entities right in the list.
2. A "Next page" link moves through the full list; there's no page-number picker, jump-to-page control, or way yet to filter by watchlist, platform, or date.
3. Click any post to open its own detail screen, which shows the same information plus the author (currently shown as a raw internal identifier — there's no lookup yet to turn it into a friendlier name) and which ingestion run brought it in (also a raw identifier, for the same reason).

## Running enrichment manually on an older post (Story 6.16)

1. On a post's detail screen, if that post has never been analyzed by an AI provider, you'll see a "Run enrichment now" button — this typically applies to a post that was ingested before your tenant had connected and activated any AI provider.
2. Clicking it asks SocialEngage to analyze that one post right now, using whichever AI provider your tenant currently has connected and active. On success, the screen reloads and shows the real sentiment, key phrases, entities, and which provider produced them.
3. If no AI provider is currently connected and active for your tenant, you'll see a plain message saying so rather than an error — connect and activate one first (see "Connecting a platform" above) if you want to enrich posts this way.
4. This button only appears on a post with no enrichment yet — once a post has been analyzed, there's no button here to re-run it.

## Monitoring your own company domain's content feed (Stories 6.12, 6.17)

If you want SocialEngage to monitor your own company blog or newsroom rather than a third-party platform, this is a separate flow from "Connect a platform," with no credential to submit — instead, you prove you control the domain.

1. From "Connect a platform," follow "Set up your own domain's content feed" (or go directly to "Monitor your own domain's content feed"). **Both a Tenant-Admin and a Tenant User can set this up** — it isn't restricted to Tenant-Admins the way tenant-wide credential connections are.
2. Enter your domain and the feed URL (your blog or newsroom's RSS/Atom feed) and submit.
3. SocialEngage gives you a DNS TXT record (a host, a value, and an expiry) to publish at your own domain registrar, proving you actually control that domain. Publishing it can take anywhere from a few minutes up to 72 hours to take effect — this is normal DNS propagation, not a stuck or broken state.
4. Once you've published the record, come back and click "Verify now." If it's not detected yet, you'll see a plain message to try again shortly — this isn't an error, and you can click "Verify now" as many times as you need.
5. Once verified, this feed still isn't monitored yet — as a Tenant-Admin, you get an Activate/Deactivate control right there to turn it on. (A Tenant User who set the feed up can verify it, but only a Tenant-Admin can actually activate or deactivate it — the same tenant-wide-only rule as everywhere else this control appears; this connector has no personal, "just for me" option at all.)

**Current limitation:** if you leave this screen after publishing the TXT record and come back later (for example, after a page reload), the DNS record's own host/value/expiry details cannot be shown to you again — only the ability to re-click "Verify now" survives. If you lose those details before publishing the record, you'll need to start the connect step over.

## Deleting your tenant (Story 6.13)

This is the one truly irreversible action available anywhere in SocialEngage — read this section in full before starting. **This screen and everything in it is Tenant-Admin only** — a Tenant User has no entry point to it anywhere, not even a hidden or greyed-out one; going to `/tenant/settings/delete` directly redirects them back to the ordinary tenant settings screen. There is also no link to this screen from the ordinary Tenant settings screen (Story 6.9) today — you currently have to navigate to it directly.

1. Open the tenant deletion screen and choose "Request deletion." This starts a 30-day grace period — nothing is deleted yet, and your tenant keeps working normally.
2. During the grace period, you'll see the date your tenant will actually be deleted unless you cancel before then. You can export your tenant's data as JSON or CSV any number of times before that date.
3. To change your mind, choose "Cancel deletion request," then confirm — ingestion resumes immediately and your tenant carries on as if nothing happened.
4. Once the 30-day grace period has actually elapsed, a "Confirm deletion" button becomes available (it's disabled, with a plain explanation, before then). Confirming asks you to confirm a second time, with an explicit warning that this is final and cannot be undone, and that all of your tenant's data — posts, watchlists, and credentials — will be permanently deleted.
5. After you confirm, deletion runs in the background. The screen shows a plain "in progress" message and does not update further — your own session will simply stop working once deletion actually completes.

**Current limitation:** if a deletion request is already active when you open this screen, there's no way for the screen itself to tell you exactly when the grace period ends (only the moment you first request deletion shows that date) — the "Confirm deletion" button still correctly stays disabled until the backend itself confirms the grace period has elapsed, so you can't accidentally jump ahead, but the countdown display itself may be missing on a return visit.

## What's not built yet

- **Public self-service sign-up is not open.** The sign-up screen itself (Story 6.7) is real and works, but per this project's own current stage (Stage 0, no persistent environment or public onboarding), it isn't offered to the general public today — see "How you get your own tenant today" above.
- **Filtering or searching your tenant's posts** — by watchlist, by platform, by date range, or by text — doesn't exist yet; the Posts screen only supports paging through everything in order.
- **A friendlier author or ingestion-run display on a post's detail screen** — both currently show as raw internal identifiers, since no lookup exists yet to resolve either one into something more readable.
- **Watchlist compatibility warnings on the connector status screen** — which boolean-query features a connector can't natively evaluate — are named on that screen as a real, deliberate gap, not shown.
- **Reading back your own personal (as opposed to tenant-wide) activation state for a connector** — the Activate/Deactivate control for "just for me" connections always starts assuming it's off, even if it's actually already on, since there's no way yet to read that back.
- **A real, live "list this tenant's connectors" view** — the Connect a platform and connector status screens both show a fixed list of the platforms SocialEngage currently supports (GNews, Newswire, Azure AI Language, Azure OpenAI Service) rather than a dynamically discovered one. In practice this makes no difference today, since that fixed list already matches every platform that actually exists.
- **Recovering a lost DNS TXT record for your own-domain content feed** — if you leave the setup screen after connecting but before publishing the record, there's no way yet to see those exact instructions again; you'd need to start over.
- **A link from the ordinary Tenant settings screen to tenant deletion** — the deletion screen (Story 6.13) exists and works, but there's currently no in-app link to it from anywhere; you have to navigate to it directly.
- **Seeing the exact grace-period end date on a return visit to the tenant deletion screen** — it's only shown at the moment you first request deletion.
- **A screen for reviewing your tenant's user access history** (who was invited, when access ended or was reactivated, and by whom) — the backend endpoint for this exists (Story 5.17), but no screen in `social-listening-admin` calls it yet (Story 6.14 is drafted but not built).
