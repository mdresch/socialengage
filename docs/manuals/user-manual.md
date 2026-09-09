# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Current coverage, as of 2026-08-27 (Learning & Development Writer, scheduled queue pass):** sign-in, plus every tenant-facing screen a Tenant User (as opposed to a Tenant-Admin) can actually reach in `social-listening-admin`'s tenant screen tree. The connector roster has grown substantially since this note was last written (2026-08-19): connecting your own personal platform credential and turning it on or off now spans GNews, Wikipedia, Facebook (with support for more than one of your own connected Pages, since Story 6.27), Instagram Business, and LinkedIn (Stories 6.3, 6.15, 6.21, 6.23, 6.27, 6.34, 6.35), managing your own watchlists, now with Brave Search and Bing Search as additional selectable sources alongside GNews/Newswire/Wikipedia once your Tenant-Admin has connected them (Stories 6.4, 6.22, 6.30, 6.32), checking connector status, now split into a "Connectors" section and a separate "AI Providers" section, plus real ingestion status badges (including a new "stalled" state) and a dismissible stalled/failing/reconnect-required alerts banner (Stories 6.5, 6.24, 6.29), viewing your tenant's user list on a redesigned Team & access screen with a real seat-utilization meter (Story 6.8, restyled 2026-08-17), a read-only view of your tenant's own settings (Story 6.9), browsing your tenant's ingested posts — newest-first, with search and filtering that now covers every ingested post rather than just the current page, entity/key-phrase chips, per-post Facebook Page and matched-watchlist attribution, a manual "run enrichment now" button plus a full manual-override editing drawer for a post's AI-assigned sentiment, key phrases, language, country, and summary, and — new since 2026-08-24 — a real, live Reply action on a Facebook post's detail view with its own Replies tab (Stories 6.11, 6.16, 6.18, 6.19, 6.25, 6.26, 6.31, 6.33, 6.37, 6.38), a full Analytics dashboard whose Overview tab was substantially rebuilt into an eight-widget grid — including a new Location & geospatial insights widget with a real country map, and a Watchlist Coverage widget with a topic/watchlist selector — alongside the existing Sentiment, Conversations, and Sources tabs (Stories 8.1–8.7, 8.9, 8.10), and a cross-platform post composer with live preview rails for seven networks and an AI rewrite assistant, where drafting and previewing are real but actually publishing is still a simulated, not a real, action (Story 6.36). **All of these screens are real, backed by your tenant's actual data, with working actions**, except where a section below says otherwise. **Corrected 2026-08-19, still true today: setting up your own company domain's content feed (Story 6.12) is no longer something a Tenant User can do** — Story 6.20 (2026-08-17) restricted that entire screen to Tenant-Admins only; see "What's not built yet" below. A few things stay a Tenant-Admin's job only, called out plainly wherever that's the case — this manual only ever describes what a Tenant User can actually do, never an admin-only screen in detail. The app also gained its first real stylesheet on 2026-08-12, the main content area was widened from 900px to 1280px on 2026-08-18, and the sidebar navigation gained icons and became collapsible on 2026-08-20 — all purely visual/navigational changes, nothing about how any screen below works changed because of any of them.

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

Once you're signed in, SocialEngage shows you your own tenant's screens — connecting a platform, managing watchlists, checking connector status, viewing the tenant's user list, viewing tenant settings, browsing posts, drafting cross-platform posts (Story 6.36), and the Analytics dashboard. You'll never see another tenant's data or the System Admin area. A few screens exist only for your Tenant-Admin — same-domain sign-up review, your own company domain's content feed (as of Story 6.20, corrected below), tenant deletion, and per-user access history — and aren't reachable from your own sign-in at all.

## Your tenant's workspace overview (Story 6.2, visually refreshed 2026-08-20)

Signing in takes you to a "Workspace Overview" landing page — this section names it directly since it was never previously described in this manual, even though it's real and has existed since Story 6.2.

1. Four real metric cards — Active Watchlists, Ingestion Connectors, Ingested Posts, and Seat Utilization — each a live count from your tenant's own data, and each links straight to the fuller screen it summarizes.
2. If any connector is currently degraded or failing, a warning banner names it and links straight to the connector status screen.
3. A "Recent Ingestion Stream" shows your tenant's most recently ingested posts, newest first, and an "Active Connectors" list on the side shows which platforms are currently active.
4. The quick-action buttons here ("+ New Watchlist," "Tenant-wide connect") are Tenant-Admin only; you won't see them.

## Connecting your own platform credential (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see every platform SocialEngage currently supports as its own card — GNews, Newswire, Azure AI Language, Azure OpenAI Service, Wikipedia (Story 6.21), Brave Search (Story 6.30), and Bing Search/Azure (Story 6.32) — each shown with its real connection state and whether it's currently Active or Inactive. Facebook, Instagram, and LinkedIn are also shown here, but work differently — see "Connecting your own social accounts" below.
3. Before you submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.
4. **As an ordinary member of your tenant, only GNews is something you can connect yourself with an API key.** Enter your GNews API key and submit — this always creates a personal connection just for you; there's no "tenant-wide, shared by everyone" option on this screen for you. Newswire and Wikipedia need no credential and are always available once your tenant's Tenant-Admin turns them on. **Azure AI Language, Azure OpenAI Service, Brave Search, and Bing Search are Tenant-Admin only** — each authenticates your organization's own subscription, not an individual's personal account, so none of the four ever offers you a way to connect it yourself; if one isn't connected yet, you'll see a plain note asking you to have your Tenant-Admin connect it, rather than a button that would just fail.
5. Disconnecting your own GNews connection asks you to confirm before it actually removes it — a two-step "Disconnect," then "Confirm: disconnect," never a single click, and it's immediate.
6. Alongside connect/disconnect, your own personal connection also has its own Activate/Deactivate control (Story 6.15) — a separate switch from the credential itself. Deactivating keeps your stored credential in place but stops it from being used for ingestion.

**Current limitation:** your own personal Activate/Deactivate control always starts by showing Inactive, even if you'd already activated it before — there's no way yet for this screen to read back your own real personal on/off state. If it's actually already on, clicking Activate again is harmless.

## Connecting your own social accounts — Facebook, Instagram, LinkedIn (Stories 6.23, 6.27, 6.34, 6.35)

Facebook, Instagram, and LinkedIn work differently from every other platform on this screen — each uses a real sign-in redirect (OAuth) instead of an API key, and all three are always personal, to you specifically, regardless of your role.

1. Click that platform's own "Connect" button. You're taken to a real sign-in and permission screen on that provider's own site, not a form inside SocialEngage.
2. **Facebook:** after you approve it, you're brought back and shown checkboxes for every Facebook Page you're an admin of — as of Story 6.27, you can connect more than one of your own Pages at once, not just a single one. Each connected Page gets its own row with its own health and its own "Reconnect" or "Disconnect" action, and "Connect another Page" is always available to add more later. Only your own connected Page's own published posts and engagement are ever ingested — never public Facebook content, never other people's posts, and never comments.
3. **Instagram Business:** connects your own Instagram Business or Creator account via Meta's Graph API. Only your own connected account's own published photos, videos, carousels, and reels are ingested.
4. **LinkedIn:** connects your own LinkedIn member account. If LinkedIn hasn't yet approved this app for organization-level access, a plain banner says so without blocking ingestion of your own posts.
5. Turning any of the three on or off uses the same Activate/Deactivate control every other platform has.
6. If a provider ever revokes your connection, the affected card shows a distinct "Reconnect required" status — click "Reconnect" to sign in again.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see your own watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which connected platforms it covers. **Watchlists are private to you** — even your Tenant-Admin can't see or manage your watchlists from this screen, and you can't see anyone else's.
3. Below the list, a form lets you create a new watchlist: a name, a match type, either search terms (one per line) or — for a boolean watchlist — a boolean query, and which of your connected platforms it should cover. Only platforms you've actually connected are offered here (GNews, Newswire, Wikipedia, Brave Search, and/or Bing Search, since Stories 6.22, 6.30, and 6.32).
4. Each watchlist can be edited the same way it was created, switched active/inactive with its own dedicated toggle, and deleted. Deleting asks for a separate confirm step before anything is actually removed, and it's permanent.
5. If a watchlist has changed elsewhere since you loaded the page, saving your own change won't silently overwrite the other one — you'll see a message asking you to reload before retrying.

## Checking connector status (Story 6.5, restructured by Stories 6.24 and 6.29)

1. From your tenant's screens, open "View connector status."
2. **As of Story 6.24, this screen is split into two sections: "Connectors" and "AI Providers."** GNews, Newswire, Wikipedia, Facebook, Brave Search, Bing Search, Instagram, and LinkedIn — every platform that's actually polled for content — appear under "Connectors," including ones you haven't connected yet, with whether each is Active or Inactive, and if Active, its real health, the time of its last successful fetch (now shown together with how many posts that run ingested), the time of its last attempt, and its consecutive-failure count. Azure AI Language and Azure OpenAI Service appear separately, under "AI Providers," with a plain note that they're invoked on demand rather than polled on a schedule.
3. **A connector can now show a "Stalled" status** (Story 1.16, Story 6.29) — distinct from "Failing" — when it hasn't successfully polled in a while even though it isn't actively erroring. A dismissible banner at the top of this screen (and on the Analytics dashboard) lists every connector currently Stalled, Failing, or needing reconnection.
4. Facebook, Instagram, and LinkedIn each show a distinct "Reconnect required" status here too, whenever that provider itself has revoked your connection.
5. This screen shows status only — never your posts or any other tenant content. Triggering an on-demand re-sync of a stalled or failing connector is your Tenant-Admin's job, not something you can do from here.

**Current limitations:**
- Watchlist compatibility warnings (which boolean-query features a given connector can't natively evaluate) are not shown here yet.
- For the two AI enrichment providers, this screen structurally can't show a meaningful "last successful fetch" — they're invoked inline while a post is being processed, not on a poll schedule, so they'll always read "no ingestion runs yet" here even after they've genuinely enriched real posts.

## Viewing your tenant's users — Team & access (Story 6.8, redesigned 2026-08-17)

From your tenant's screens, open "Team & access." You can see every user in your tenant — Tenant-Admin or Tenant User — along with their email, role, status, and when their access ends (shown as "active indefinitely" if no end date is set). A seat-utilization card at the top shows how many of your tenant's licensed seats are currently active out of the total, with a real progress meter. **This is a read-only screen for you** — inviting a new user, changing anyone's access, and viewing a user's access history are all your Tenant-Admin's job; you won't see those controls here.

## Viewing your tenant's settings (Story 6.9)

1. From your tenant's screens, open "Tenant settings."
2. You'll see your tenant's real name, status, domain, how many of its licensed seats are currently used out of the total, and when the tenant was created. This is a read-only view — there's no form and no way to change anything from here.
3. You see the identical screen your Tenant-Admin does; there's no role difference on this one.

## Browsing your tenant's posts (Story 6.11, updated by Stories 6.18, 6.19, 6.25, 6.26, 6.33, 6.37)

Once your tenant has connected and activated a platform, SocialEngage polls it automatically in the background — GNews, Newswire, and Wikipedia every 15–30 minutes, your own domain's content feed every 30 minutes (Story 1.13) — so posts appear here on their own, with nothing anyone needs to click to make ingestion happen.

1. From your tenant's screens, open "Posts" to see what SocialEngage has ingested for your tenant — **newest-ingested first** (Story 6.25), each with the platform it came from, the author where known, a title and body preview, and its published date. If a post has already been analyzed by an AI provider, you'll also see its sentiment, key phrases, entities, and the detected language right in the list, along with up to three entity and three key-phrase chips.
2. A search box and Provider/Sentiment/Watchlist filters sit above the list, and, as of Story 6.18, both search and every filter now cover your tenant's entire ingested history, not just the current page. The Provider filter automatically includes every platform your tenant actually has posts from (Story 6.26).
3. A "Show more" button reveals more of your already-filtered result set in batches; there's no page-number picker or server round trip for paging.
4. Click any post to open a detail panel on the same screen (a slide-over, not a separate page) showing the same information plus the full article body rendered as real, formatted Markdown (Story 6.19), the author (currently shown as a raw internal identifier — there's no lookup yet to turn it into a friendlier name) and which ingestion run brought it in (also a raw identifier, for the same reason).
5. **A post from Facebook shows which of your connected Pages it came from** (Story 6.33), plus a separate "By: <author>" line whenever Facebook reports a real author distinct from the Page itself. **Any post matched by one of your watchlists shows that watchlist's name** in the card and detail view too (Stories 6.37, 3.11–3.12). An Instagram post shows its own media type and a thumbnail, with a gallery for a multi-image carousel; a LinkedIn post shows its own reaction/comment/share counts.
6. **Replying to a post (Story 6.38, added 2026-08-24) — Facebook only today.** A post's detail panel has a "Reply" button, enabled only when the post is from Facebook and you have your own connected Facebook Page; for any other platform, or if you haven't connected a Page yourself, it's shown disabled with a tooltip explaining why. Clicking it opens a plain-text composer drawer with a character counter (no media attachment or AI rewrite assist yet). Submitting sends a real, live reply to that post on Facebook — not a simulation — and adds it to a new "Replies" tab on the post, showing its text, a sent/failed status, when it was sent, and a link to the live reply on Facebook once sent.

## Running enrichment manually, and correcting it by hand (Story 6.16, extended by Stories 3.13 and 6.31)

1. On a post's detail screen, if that post has never been analyzed by an AI provider, you'll see a "Run enrichment now" button — this typically applies to a post that was ingested before your tenant had connected and activated any AI provider.
2. Clicking it asks SocialEngage to analyze that one post right now, using whichever AI provider your tenant currently has connected and active. On success, the screen reloads and shows the real sentiment, key phrases, entities, and which provider produced them.
3. If no AI provider is currently connected and active for your tenant, you'll see a plain message saying so rather than an error.
4. **As of Story 6.31, a post that has been analyzed also has an "Edit" button** on its AI analysis card. It opens a second panel letting you correct the AI's own sentiment, key phrases, detected language, country, and summary by hand — this isn't a Tenant-Admin-only action, any Tenant User can use it. Saving marks the post with an amber "Edited by user" badge showing who made the change and when.
5. Once a post has been manually corrected, clicking "Run enrichment now" again asks you to confirm first, since re-running would otherwise overwrite the correction with a fresh AI result.
6. This button only appears on a post with no enrichment yet, or after you've explicitly confirmed re-running it on a corrected one.

## Your organization's own company domain content feed (Story 6.12, corrected 2026-08-19)

**As of Story 6.20 (2026-08-17), monitoring your organization's own blog or newsroom feed is Tenant-Admin only.** Earlier, a Tenant User could set this up and verify domain ownership themselves; that's no longer true — connecting, viewing, editing, or removing this feed all now require a Tenant-Admin. If your organization needs this, ask your Tenant-Admin to set it up from their own screens.

## Analytics dashboard (Stories 8.1–8.7, 8.9, 8.10)

Open "Analytics" from your tenant's screens to see aggregated, dashboard-style views over your tenant's own ingested posts — every number here is computed live from your real posts, never a fabricated or placeholder figure. The dashboard still has four tabs — Overview, Sentiment, Conversations, and Sources — but the Overview tab was substantially rebuilt on 2026-08-19/20; the description below reflects the rebuilt version.

1. **Date range.** A date-range picker at the top controls every tab at once — pick a standard range (Today, Last 7/14/30 Days, This Month, Last Month, All Available History) or a custom start/end date. A "Compare to previous period" checkbox is still present and still fetches comparison data, but it's no longer visibly shown anywhere on the current Overview tab — a real, known gap.
2. **Overview tab.** An eight-widget grid: a Sentiment gauge, an Authors-by-source donut, a Watchlist Coverage donut with its own topic/watchlist selector (Story 8.9) that narrows every widget on the tab to one watchlist's matched posts, a Volume & projections chart with an optional forecast toggle, a Location & geospatial insights widget (Story 8.10, below), a Sources breakdown, a Top authors list, a Key phrases cloud, and a Languages breakdown. Clicking almost any row, segment, or chart point filters every other widget on the tab to match, with a dismissible chip per active filter and a "Clear all" to reset. A "N matching posts" button opens the exact filtered list.
   - **Location & geospatial insights.** An interactive country map and a ranked "Top Countries" list, built from a real per-post country field that GNews, Newswire, tenant-owned-feed articles, and Instagram's own location tag can now carry (Story 2.20). A post with no country information is counted honestly in its own "Unknown / Unmapped" bucket. Clicking a country filters the rest of the tab to that country.
3. **Sentiment tab.** A sentiment donut and a sentiment-over-time chart, plus your tenant's "Top fans" and "Top critics" — the authors whose posts skew most positive or most negative — and positive/negative key-phrase clouds. Clicking an author or a phrase filters every widget on this tab down to just their matching posts.
4. **Conversations tab.** A key-phrase cloud and a top-phrases-over-time chart, plus a Languages breakdown — the real, detected language of each enriched post, ranked by count.
5. **Sources tab.** Post volume by source, a detail list per source with its own post count, sentiment counts, and a real 0–10 weighted sentiment score — honestly blank when a source has no enriched posts yet — and a volume-over-time chart broken out per source.

**Current limitations:** the "Compare to previous period" checkbox doesn't visibly change anything on the current Overview tab. Location coverage only reflects GNews, Newswire, tenant-owned-feed, and Instagram posts today — every other platform's posts land in "Unknown / Unmapped." No per-widget export exists, and period-over-period comparison, where shown, only ever appears on the Overview tab's own totals.

## Drafting a cross-platform post (Story 6.36)

Open "Compose" from your tenant's screens (or the "Compose Post" button on the Posts screen) to draft a single message and preview how it would look on up to seven different networks (Facebook, Instagram, LinkedIn, X/Twitter, Bluesky, Mastodon, and Threads) side by side.

1. Write your message once; each network's own live preview card updates as you type. You can attach images with accessibility alt-text, import a Markdown or plain-text document as a starting draft, and ask an AI assistant to rewrite your copy.
2. Drafts save automatically to your own browser as you work — not to shared tenant storage, so a draft made on one device isn't visible from another.
3. **Actually publishing is not real yet.** The "Publish" button opens a dialog to pick connected Facebook Pages, but the send itself is currently simulated — nothing is actually delivered to any network from this screen (ADR-0072).

## What's not built yet

- **A friendlier author or ingestion-run display on a post's detail screen** — both currently show as raw internal identifiers.
- **A concise AI-generated summary field** — Azure OpenAI now computes one per post, and you can view/edit it via the manual enrichment-override drawer (Story 6.31), but no screen displays it as its own field otherwise.
- **Watchlist compatibility warnings on the connector status screen.**
- **Reading back your own personal activation state for a connector** — the Activate/Deactivate control for your own personal connections always starts assuming it's off, even if it's actually already on.
- **Setting up, viewing, or managing your organization's own company domain content feed** — as of Story 6.20, this is Tenant-Admin only; see above.
- **Triggering an on-demand re-sync of a connector** — that action is Tenant-Admin only.
- **Your own company domain's content feed and your connected Facebook/Instagram/LinkedIn accounts as watchlist sources** — a watchlist can only target GNews, Newswire, Wikipedia, Brave Search, or Bing Search today.
- **Per-widget export and full period-over-period comparison on the Analytics dashboard, and geographic coverage beyond GNews/Newswire/tenant-owned-feed/Instagram** — see above.
- **Actually publishing from the cross-platform post composer** — drafting and previewing are real; publishing is a simulated action today.
