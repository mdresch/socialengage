# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Current coverage, as of 2026-08-20:** sign-in, your tenant's workspace overview landing page (Story 6.2, with real metric cards added 2026-08-20), plus every tenant-facing screen a Tenant User (as opposed to a Tenant-Admin) can actually reach in `social-listening-admin`'s tenant screen tree — connecting your own personal platform credential and turning it on or off, now across GNews, Wikipedia, and your own Facebook Page (Stories 6.3, 6.15, 6.21, 6.23), managing your own watchlists, including Wikipedia as a selectable source (Stories 6.4, 6.22), checking connector status (Story 6.5), viewing your tenant's user list on a redesigned Team & access screen with a real seat-utilization meter (Story 6.8, restyled 2026-08-17), a read-only view of your tenant's own settings (Story 6.9), browsing your tenant's ingested posts — newest-first, with search and filtering that now covers every ingested post rather than just the current page, a real author name on every post (fixed 2026-08-20 for Newswire and Facebook, see below), an AI-generated executive summary where Azure OpenAI produced one, and a manual "run enrichment now" button (Stories 6.11, 6.16, 6.18, 6.19, 6.25, 6.26), and a full Analytics dashboard — substantially rebuilt on 2026-08-19/20 (Story 8.7's Overview tab redesign, Story 8.9's watchlist filter and coverage widget, Story 8.10's Location & Geospatial Insights map) — covering post volume, sentiment, conversations/key phrases, languages, per-source breakdowns, and now country-level location insights (Stories 8.1–8.10). **All of these screens are real, backed by your tenant's actual data, with working actions.** **Corrected 2026-08-19: setting up your own company domain's content feed (Story 6.12) is no longer something a Tenant User can do** — Story 6.20 (2026-08-17) restricted that entire screen to Tenant-Admins only; see "What's not built yet" below. A few things stay a Tenant-Admin's job only, called out plainly wherever that's the case — this manual only ever describes what a Tenant User can actually do, never an admin-only screen in detail. The app also gained its first real stylesheet on 2026-08-12, the main content area was widened from 900px to 1280px on 2026-08-18, and the sidebar navigation gained icons and a collapse control on 2026-08-20 — all three purely visual/navigational changes, nothing about how any screen below works changed because of them.

---

## Signing in (Story 6.1)

1. Go to `social-listening-admin`. If you're not already signed in, you're redirected to a sign-in page automatically.
2. Sign in with your organization's Microsoft Entra identity — the same real sign-in flow every SocialEngage identity uses.
3. Once signed in, SocialEngage recognizes you as a member of your own organization's tenant and routes you to its screens only — never another tenant's, and never the System Admin area.
4. Your session stays signed in for up to 8 hours, then you'll be asked to sign in again automatically, even if you were actively using the app right up to that point — a deliberate security limit, not a bug.
5. To sign out, use the sign-out action — this ends your session immediately on this device.

## Your tenant's workspace overview (Story 6.2, real metric cards added 2026-08-20)

Once you're signed in, this is the first screen you land on.

1. Four metric cards across the top link straight to the relevant screen: **Active Watchlists** (how many of your tenant's watchlists are active out of how many exist), **Ingestion Connectors** (how many platforms are active out of how many are supported), **Ingested Posts** (your tenant's real total post count), and **Seat Utilization** (active users out of your tenant's licensed seats, with a progress bar) — every number is a real, live count from your tenant's own data, not a sample figure.
2. If any active connector is currently reporting degraded or failing health, a warning banner appears above the cards naming which one, with a link straight to the connector status screen.
3. Below the cards, a "Recent Ingestion Stream" panel shows your tenant's three most-recently-ingested posts — newest first — each with its platform, a title/snippet preview, and its sentiment and key phrases if it's already been enriched. A "View all" link goes to the full Posts screen.
4. Alongside it, an "Active Connectors" panel lists just the platforms your tenant currently has switched on, each with its real health badge, and a link through to the fuller connector status screen.

## How you get access

You don't sign yourself up. Your organization's own Tenant-Admin invites you by email; you sign in with that same email using your organization's Entra identity to activate your access. There is no public self-service sign-up open yet (`docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` — this project is at Stage 0).

## Your tenant's shared screens (Story 6.2)

Once you're signed in, SocialEngage shows you your own tenant's screens — connecting a platform, managing watchlists, checking connector status, viewing the tenant's user list, viewing tenant settings, browsing posts, and the Analytics dashboard. You'll never see another tenant's data or the System Admin area. A few screens exist only for your Tenant-Admin — same-domain sign-up review, your own company domain's content feed (as of Story 6.20, corrected below), tenant deletion, and per-user access history — and aren't reachable from your own sign-in at all.

## Connecting your own platform credential (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see every platform SocialEngage currently supports as its own card — GNews, Newswire, Azure AI Language, Azure OpenAI Service, and Wikipedia (Story 6.21) — each shown with its real connection state and whether it's currently Active or Inactive. Facebook is also shown here, but works differently — see "Connecting your own Facebook Page" below.
3. Before you submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.
4. **As an ordinary member of your tenant, only GNews is something you can connect yourself.** Enter your GNews API key and submit — this always creates a personal connection just for you; there's no "tenant-wide, shared by everyone" option on this screen for you. Newswire and Wikipedia need no credential and are always available once your tenant's Tenant-Admin turns them on. **Azure AI Language and Azure OpenAI Service are Tenant-Admin only** — an Azure API key authenticates your organization's own subscription, not an individual's personal account, so neither ever offers you a way to connect it yourself; if one isn't connected yet, you'll see a plain note asking you to have your Tenant-Admin connect it, rather than a button that would just fail.
5. Disconnecting your own GNews connection asks you to confirm before it actually removes it — a two-step "Disconnect," then "Confirm: disconnect," never a single click, and it's immediate.
6. Alongside connect/disconnect, your own personal connection also has its own Activate/Deactivate control (Story 6.15) — a separate switch from the credential itself. Deactivating keeps your stored credential in place but stops it from being used for ingestion.

**Current limitation:** your own personal Activate/Deactivate control always starts by showing Inactive, even if you'd already activated it before — there's no way yet for this screen to read back your own real personal on/off state. If it's actually already on, clicking Activate again is harmless.

## Connecting your own Facebook Page (Story 6.23)

Facebook works differently from every other platform on this screen — it's this app's first connector that uses a real sign-in redirect (OAuth) instead of an API key, and it's always personal, to you specifically, regardless of your role.

1. From "Connect a platform," click "Connect Facebook Page (Owned Feed)." You're taken to a real Facebook sign-in and permission screen, not a form inside SocialEngage.
2. After you approve it, you're brought back and asked to choose which of your own Facebook Pages to connect (if you manage more than one) — SocialEngage lists every Page you're an admin of.
3. Once connected, SocialEngage only ever ingests that one Page's own published posts and engagement — never public Facebook content, never other people's posts, and never comments.
4. Turning it on or off uses the same Activate/Deactivate control every other platform has. There's no Disconnect control for Facebook yet.
5. If Facebook ever revokes your connection, the card shows a distinct "Reconnect required" status — click "Reconnect" to sign in again.

## Managing watchlists (Story 6.4)

1. From your tenant's screens, open "Manage watchlists."
2. You'll see your own watchlists — name, match type (keyword, hashtag, account, or boolean), whether each is active, and which connected platforms it covers. **Watchlists are private to you** — even your Tenant-Admin can't see or manage your watchlists from this screen, and you can't see anyone else's.
3. Below the list, a form lets you create a new watchlist: a name, a match type, either search terms (one per line) or — for a boolean watchlist — a boolean query, and which of your connected platforms it should cover. Only platforms you've actually connected are offered here (GNews, Newswire, and/or Wikipedia, since Story 6.22).
4. Each watchlist can be edited the same way it was created, switched active/inactive with its own dedicated toggle, and deleted. Deleting asks for a separate confirm step before anything is actually removed, and it's permanent.
5. If a watchlist has changed elsewhere since you loaded the page, saving your own change won't silently overwrite the other one — you'll see a message asking you to reload before retrying.

## Checking connector status (Story 6.5)

1. From your tenant's screens, open "View connector status."
2. For every platform SocialEngage supports — GNews, Newswire, Azure AI Language, Azure OpenAI Service, Wikipedia, and Facebook, including ones you haven't connected yet — you'll see whether it's Active or Inactive, and if Active, its real health, the time of its last successful fetch, the time of its last attempt, and its consecutive-failure count.
3. Facebook shows a distinct "Reconnect required" status here too, with its own "Reconnect" action, whenever Facebook itself has revoked your connection.
4. This screen shows status only — never your posts or any other tenant content.

**Current limitations:**
- Watchlist compatibility warnings (which boolean-query features a given connector can't natively evaluate) are not shown here yet.
- For the two AI enrichment providers, this screen structurally can't show a meaningful "last successful fetch" — they're invoked inline while a post is being processed, not on a poll schedule, so they'll always read "no ingestion runs yet" here even after they've genuinely enriched real posts.

## Viewing your tenant's users — Team & access (Story 6.8, redesigned 2026-08-17)

From your tenant's screens, open "Team & access." You can see every user in your tenant — Tenant-Admin or Tenant User — along with their email, role, status, and when their access ends (shown as "active indefinitely" if no end date is set). A seat-utilization card at the top shows how many of your tenant's licensed seats are currently active out of the total, with a real progress meter. **This is a read-only screen for you** — inviting a new user, changing anyone's access, and viewing a user's access history are all your Tenant-Admin's job; you won't see those controls here.

## Viewing your tenant's settings (Story 6.9)

1. From your tenant's screens, open "Tenant settings."
2. You'll see your tenant's real name, status, domain, how many of its licensed seats are currently used out of the total, and when the tenant was created. This is a read-only view — there's no form and no way to change anything from here.
3. You see the identical screen your Tenant-Admin does; there's no role difference on this one.

## Browsing your tenant's posts (Story 6.11, updated by Stories 6.18, 6.19, 6.25, 6.26)

Once your tenant has connected and activated a platform, SocialEngage polls it automatically in the background — GNews, Newswire, and Wikipedia every 15–30 minutes, your own domain's content feed every 30 minutes (Story 1.13) — so posts appear here on their own, with nothing anyone needs to click to make ingestion happen.

1. From your tenant's screens, open "Posts" to see what SocialEngage has ingested for your tenant — **newest-ingested first** (Story 6.25), each with the platform it came from, a real author name where the source provides one, a title and body preview, and its published date. If a post has already been analyzed by an AI provider, you'll also see its sentiment, key phrases, entities, and the detected language right in the list.
2. **Author names are real, not placeholders.** GNews shows the source publication's name, Newswire shows the issuing organization, your tenant's own domain feed shows a per-item byline when the feed itself provides one (Story 2.19), and a connected Facebook Page shows that Page's own name. Two real display bugs — Newswire's author rendering blank, and Facebook's rendering blank with no working "Open original" link — were found and fixed live on 2026-08-20; if you noticed either of those earlier, they're corrected now.
3. A search box and Provider/Sentiment/Watchlist filters sit above the list, and, as of Story 6.18, both search and every filter now cover your tenant's entire ingested history, not just the current page. The Provider filter automatically includes every platform your tenant actually has posts from (Story 6.26).
4. A "Show more" button reveals more of your already-filtered result set in batches; there's no page-number picker or server round trip for paging.
5. Click any post to open a detail panel on the same screen (a slide-over, not a separate page) showing the same information plus the full article body rendered as real, formatted Markdown (Story 6.19). If Azure OpenAI (specifically, not Azure AI Language) produced a concise executive summary for the post, it's shown here too (Story 2.17, first surfaced in this screen 2026-08-19). The panel also shows the post's own internal ID, when it was ingested, and its provider as plain reference telemetry; it does not show which ingestion run brought a post in.

## Running enrichment manually on an older post (Story 6.16)

1. On a post's detail screen, if that post has never been analyzed by an AI provider, you'll see a "Run enrichment now" button — this typically applies to a post that was ingested before your tenant had connected and activated any AI provider.
2. Clicking it asks SocialEngage to analyze that one post right now, using whichever AI provider your tenant currently has connected and active. On success, the screen reloads and shows the real sentiment, key phrases, entities, and which provider produced them.
3. If no AI provider is currently connected and active for your tenant, you'll see a plain message saying so rather than an error.
4. This button only appears on a post with no enrichment yet.

## Your organization's own company domain content feed (Story 6.12, corrected 2026-08-19)

**As of Story 6.20 (2026-08-17), monitoring your organization's own blog or newsroom feed is Tenant-Admin only.** Earlier, a Tenant User could set this up and verify domain ownership themselves; that's no longer true — connecting, viewing, editing, or removing this feed all now require a Tenant-Admin. If your organization needs this, ask your Tenant-Admin to set it up from their own screens.

## Analytics dashboard (Stories 8.1–8.10)

Open "Analytics" from your tenant's screens to see aggregated, dashboard-style views over your tenant's own ingested posts — every number here is computed live from your real posts, never a fabricated or placeholder figure. **The Overview tab was substantially rebuilt on 2026-08-19/20 (Stories 8.7, 8.9, 8.10)** — if you used this screen before then, the layout described below is different from what you saw.

1. **Header controls, shared across every tab.** A "Topic / Watchlist" selector, a date-range picker (standard ranges — Today, Last 7/14/30 Days, This Month, Last Month, All Available History — or a custom start/end date), and a "N matching posts" button all now sit in the page header itself, visible no matter which tab you're on. Picking a watchlist re-queries your tenant's posts server-side (Story 8.9) so every tab reflects just that watchlist's matches. Clicking the matching-posts button opens a two-panel drawer: a list of every currently-matched post, and, when you click one, its full detail alongside the list. The date-range picker still offers a "Compare to previous period" checkbox, but as of Story 8.7's Overview redesign, no tab currently renders the resulting percentage change anywhere on screen — a real, currently-orphaned control, not a hidden feature.
2. **Overview tab**, a three-column widget grid, entirely click-to-filter — clicking almost any value (a sentiment segment, a source, an author, a language, a key phrase, a day on the volume chart, or a country) filters every other widget on the tab down to just matching posts, shown as a dismissable chip at the top; "Clear all" resets everything at once.
   - **Left column:** a Sentiment gauge (a real 0–10 weighted index alongside a positive/neutral/negative percentage bar); an Authors-by-source donut; and a Watchlist Coverage donut (Story 8.9) showing how your tenant's matched posts split across its active watchlists.
   - **Centre column:** a Volume & Projections timeline — actual daily post volume plus a 7-day trailing average, with an optional "Forecast" toggle (clearly labeled as a statistical projection, never a real measurement) and a Crisis Alert Radar banner that only appears when negative-sentiment momentum is genuinely elevated; a Location & Geospatial Insights map (Story 8.10) — a world map shaded by how many of your tenant's matched posts came from each country, fed by real country-level extraction on ingestion (Story 2.20), plus a "Top Countries" list; and, underneath, Sources and Top Authors widgets side by side.
   - **Right column:** a Key Phrases word cloud and a Languages breakdown (Story 8.5, capped to the top 6). A slot for an "AI Spike Storyteller" widget is reserved on this screen but is empty — that story hasn't been built yet.
3. **Sentiment tab.** A sentiment donut and a sentiment-over-time chart, plus your tenant's "Top fans" and "Top critics" — the authors whose posts skew most positive or most negative — and positive/negative key-phrase clouds. Clicking an author or a phrase filters every widget on this tab down to just their matching posts.
4. **Conversations tab.** A key-phrase cloud and a top-phrases-over-time chart, plus a Languages breakdown — the real, detected language of each enriched post, ranked by count.
5. **Sources tab.** Post volume by source, a detail list per source with its own post count, sentiment counts, and a real 0–10 weighted sentiment score — honestly blank when a source has no enriched posts yet — and a volume-over-time chart broken out per source.

**Current limitations:** location insights are country-level only; the reserved "AI Spike Storyteller" widget slot on the Overview tab is empty (not built yet); there's no per-widget export; and the "Compare to previous period" checkbox no longer visibly does anything on any tab, a real regression from the Overview tab redesign named here rather than left for you to discover.

## What's not built yet

- **Which ingestion run brought a post in** isn't shown anywhere on a post's detail screen — the detail panel's telemetry section only shows the post's own ID, ingestion time, and provider.
- **Watchlist compatibility warnings on the connector status screen.**
- **Reading back your own personal activation state for a connector** — the Activate/Deactivate control for your own personal connections always starts assuming it's off, even if it's actually already on.
- **Setting up, viewing, or managing your organization's own company domain content feed** — as of Story 6.20, this is Tenant-Admin only; see above.
- **Disconnecting a connected Facebook Page** — there's no Disconnect control for it yet, only Activate/Deactivate.
- **Your own company domain's content feed and a connected Facebook Page as watchlist sources** — a watchlist can only target GNews, Newswire, or Wikipedia today.
- **An "AI Spike Storyteller" widget on the Analytics Overview tab, finer-than-country location detail, per-widget export, and a working period-over-period comparison display** — see "Analytics dashboard" above.
