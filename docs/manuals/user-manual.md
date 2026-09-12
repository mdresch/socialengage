# SocialEngage — User Manual

**Audience:** a `tenant_user` identity — an ordinary member of your organization's SocialEngage tenant, invited by your own Tenant-Admin.

**Learning & Development Writer addendum, 2026-09-12 (scheduled queue pass, continuing oldest-first from `4eac552` through `754db11`):** two more real, previously-undocumented capabilities confirmed and added — escalating a post or a prospecting-list lead to an external CRM (Dynamics 365, Salesforce, or HubSpot) via a real send-with-duplicate-detection dialog (Stories 11.1/11.2), and a personal daily digest email with its own schedule, content, and watchlist-scope preferences and a real preview (Story 11.4). Both are confirmed gated to any tenant identity (not admin-only), by reading `CRMHandoffModal.tsx`/`PostDetailPanel.tsx`/`ProspectingListDetailView.tsx` and `DigestPreferencesView.tsx`'s own real shell gates. Several `docs(adr)`/`docs`-only commits in this same range (`4eac552`, `4dedbff`, `cff52e1`) touched only ADR/BRD/FDD/story documents, not shipped code — nothing to document from those. Two backend-only commits in this range (`264c4fd` CRM connector/case-handoff backend, `0052a8f` daily-digest backend) shipped no screen of their own at the time — each is superseded by its own UI commit reviewed in the same pass.

**Learning & Development Writer addendum, 2026-09-10 (scheduled queue pass, continuing oldest-first from `4ae7f92`):** added three new screens confirmed built and contract-verified from Epic 10 — Prospecting lists (Story 10.2), ad-hoc analytics query (Story 10.5), and real-time alerts (Story 10.10) — plus YouTube Data API as an eleventh connector, Tenant-Admin-connected only (Story 10.13; this project's own epic-10 story document mislabels 10.13 as "Compliance audit pack" — flagged for the Documentation Steward, not resolved here). Epic-10 story numbers 10.11/10.12/10.14 appear mislabelled in `docs/user-stories/epic-10-adr-0086-to-0094.md`; there is no in-app Trust/Compliance UI to document here, and takedown/DSR backend work is tracked under later stories (e.g. Stories 16.1/16.2).

**Current coverage, as of 2026-09-09 (Learning & Development Writer, scheduled queue pass):** sign-in, plus every tenant-facing screen a Tenant User can actually reach that this pass has traced through real source and confirmed built, processing the `docs/pending-learning-development-reviews.md` backlog oldest-first from commit `aa2488b` through `4ae7f92` (2026-08-25 through 2026-08-27 by commit date). Three genuinely new, previously-undocumented capabilities were confirmed and added this pass: a getting-started checklist on the Workspace Overview page (Story 9.6), a "Crisis Threshold Wizard" on the Manage watchlists screen for activating a standardized risk-monitoring template (Stories 9.3/9.4), and a semantic-search-and-AI-assistant "Discovery" screen over your tenant's own posts (Stories 9.7–9.11) — all three documented in their own sections below. (Two of these three were only found by reading real source, since the commit that actually shipped them, `social-listening-admin@c4021b3`, was never itself queued for this role's review by the post-commit hook; flagged for awareness, not something this role's own file can fix.) Also corrected this pass: your own connected Facebook Page is now confirmed to be auto-polled every 30 minutes (Story 1.15) — before that story shipped, a connected Facebook Page was never actually polled at all despite showing as connected; and Facebook's own engagement counts (Story 2.18) are now captured by the connector but still not shown anywhere in the post feed, named as a gap below. **This pass did not reach every pending queue entry** — the tenant sidebar now also lists Inbox, Prospecting, Alerts, and Plan & Seats screens (shipped via Epics 10–11 and beyond) that this pass's oldest-first review had not yet reached and that are therefore deliberately not described here yet; they'll be added once a future scheduled pass reaches and verifies them. Before this pass, as of 2026-08-26: sign-in, plus every tenant-facing screen a Tenant User could then reach. Since that note, one genuinely new capability had shipped: replying to a Facebook post directly from its detail panel, with a real (not simulated) send and its own audit trail (Stories 2.26, 2.27, 3.14, 6.38) — documented in its own section below. A large amount of outbound-publishing backend work also landed in the same window (Stories 2.28–2.30, ADR-0075; Story 3.15's outbound-post audit table; Story 3.16's tenant/posts export; Story 3.17's Deep Research composer endpoint; Story 9.1's watchlist preview-volume endpoint) — all real, contract-verified `social-listening-core` backend, but none of it has a screen in `social-listening-admin` yet, so none of it is documented here as something you can actually do; see "What's not built yet." The connector roster has grown substantially since this note was last written (2026-08-19): connecting your own personal platform credential and turning it on or off now spans GNews, Wikipedia, Facebook (with support for more than one of your own connected Pages, since Story 6.27), Instagram Business, and LinkedIn (Stories 6.3, 6.15, 6.21, 6.23, 6.27, 6.34, 6.35), managing your own watchlists, now with Brave Search and Bing Search as additional selectable sources alongside GNews/Newswire/Wikipedia once your Tenant-Admin has connected them (Stories 6.4, 6.22, 6.30, 6.32), checking connector status, now split into a "Connectors" section and a separate "AI Providers" section, plus real ingestion status badges (including a new "stalled" state) and a dismissible stalled/failing/reconnect-required alerts banner (Stories 6.5, 6.24, 6.29), viewing your tenant's user list on a redesigned Team & access screen with a real seat-utilization meter (Story 6.8, restyled 2026-08-17), a read-only view of your tenant's own settings (Story 6.9), browsing your tenant's ingested posts — newest-first, with search and filtering that now covers every ingested post rather than just the current page, entity/key-phrase chips, per-post Facebook Page and matched-watchlist attribution, and a manual "run enrichment now" button plus a full manual-override editing drawer for a post's AI-assigned sentiment, key phrases, language, country, and summary (Stories 6.11, 6.16, 6.18, 6.19, 6.25, 6.26, 6.31, 6.33, 6.37), a full Analytics dashboard whose Overview tab was substantially rebuilt into an eight-widget grid — including a new Location & geospatial insights widget with a real country map, and a Watchlist Coverage widget with a topic/watchlist selector — alongside the existing Sentiment, Conversations, and Sources tabs (Stories 8.1–8.7, 8.9, 8.10), and a cross-platform post composer with live preview rails for seven networks and an AI rewrite assistant, where drafting and previewing are real, and publishing to your own connected Facebook Pages is now genuinely real too (Story 6.39, extended by Story 13.10) — other networks remain simulated. **All of these screens are real, backed by your tenant's actual data, with working actions**, except where a section below says otherwise. **Corrected 2026-08-19, still true today: setting up your own company domain's content feed (Story 6.12) is no longer something a Tenant User can do** — Story 6.20 (2026-08-17) restricted that entire screen to Tenant-Admins only; see "What's not built yet" below. A few things stay a Tenant-Admin's job only, called out plainly wherever that's the case — this manual only ever describes what a Tenant User can actually do, never an admin-only screen in detail. The app also gained its first real stylesheet on 2026-08-12, the main content area was widened from 900px to 1280px on 2026-08-18, and the sidebar navigation gained icons and became collapsible on 2026-08-20 — all purely visual/navigational changes, nothing about how any screen below works changed because of any of them. **Merge-conflict resolution correction, 2026-09-09:** this note's own body previously said Facebook publishing was still simulated — Story 6.39 (`social-listening-admin@e0abfdd`, 2026-08-26), later extended by Story 13.10, made it genuinely real; corrected here since `e0abfdd` was never queued by the post-commit hook and so fell outside every oldest-first pass's own queue range, this one included.

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

Once you're signed in, SocialEngage shows you your own tenant's screens — connecting a platform, managing watchlists, checking connector status, viewing the tenant's user list, viewing tenant settings, browsing posts, replying to a Facebook post (Story 6.38), drafting cross-platform posts (Story 6.36), searching your posts semantically or asking an AI assistant about them (Stories 9.7–9.11), and the Analytics dashboard. You'll never see another tenant's data or the System Admin area. A few screens exist only for your Tenant-Admin — same-domain sign-up review, your own company domain's content feed (as of Story 6.20, corrected below), tenant deletion, and per-user access history — and aren't reachable from your own sign-in at all.

## Your tenant's workspace overview (Story 6.2, visually refreshed 2026-08-20)

Signing in takes you to a "Workspace Overview" landing page — this section names it directly since it was never previously described in this manual, even though it's real and has existed since Story 6.2.

1. Four real metric cards — Active Watchlists, Ingestion Connectors, Ingested Posts, and Seat Utilization — each a live count from your tenant's own data, and each links straight to the fuller screen it summarizes.
2. If any connector is currently degraded or failing, a warning banner names it and links straight to the connector status screen.
3. A "Recent Ingestion Stream" shows your tenant's most recently ingested posts, newest first, and an "Active Connectors" list on the side shows which platforms are currently active.
4. The quick-action buttons here ("+ New Watchlist," "Tenant-wide connect") are Tenant-Admin only; you won't see them.

## Getting-started checklist (Story 9.6)

The Workspace Overview page (see above) also shows a "Get Started with SocialEngage" checklist card whenever your tenant has one.

1. Four core steps — Connect an Ingestion Source, Create a Brand Watchlist, Invite a Team Member, Verify Ingested Posts — each shown with a checkmark once genuinely completed, a plain description, and a link straight to the screen where you'd do it. A "Show Advanced Setup Steps" toggle reveals two more: Enable AI Enrichment and Configure Crisis Monitoring. A progress percentage and a filled bar reflect your tenant's real, computed completion state.
2. You can click "Dismiss ✕" to hide the card, with a "Show Setup Checklist" button appearing in its place if you want it back. **As an ordinary Tenant User (not a Tenant-Admin), this dismissal is only remembered for your own current browser session** — it isn't saved to your tenant's record, so the checklist reappears the next time you load the page. Only a Tenant-Admin's dismissal is saved for everyone.

## Semantic search and an AI assistant over your posts — Discovery (Stories 9.7–9.11)

Open "Discovery" from your tenant's screens to search your tenant's ingested posts by meaning rather than exact keywords, or ask a natural-language question and get a generated answer grounded in your own posts.

1. A status indicator at the top shows how many post chunks are currently indexed for semantic search, and a green or amber dot for whether indexing is healthy.
2. Two modes, switched with a tab: **Semantic Search** (a ranked list of matching post snippets, each with a percentage match badge and a link back to that post in your Posts feed) and **Ask AI Assistant** (a written answer with numbered citation markers, each backed by a real indexed post snippet shown alongside the answer, plus a plain-language confidence label). Press `Cmd/Ctrl+K` to jump straight to the search box.
3. You can narrow either mode by Platform, Watchlist, or Sentiment before searching or asking.
4. If your tenant's own indexed posts don't contain enough to answer a question, the Ask assistant tells you so directly rather than inventing an answer.

**Current limitation:** a post is only searchable or citable here once it's been indexed into this feature's own separate index, which is not yet wired into live ingestion — a newly ingested post may not show up in Discovery right away, even though it's already visible in your ordinary Posts feed.

## Connecting your own platform credential (Story 6.3)

1. From your tenant's screens, open "Connect a platform."
2. You'll see every platform SocialEngage currently supports as its own card — GNews, Newswire, Azure AI Language, Azure OpenAI Service, Wikipedia (Story 6.21), Brave Search (Story 6.30), Bing Search/Azure (Story 6.32), and YouTube Data API (Story 10.13) — each shown with its real connection state and whether it's currently Active or Inactive. Facebook, Instagram, and LinkedIn are also shown here, but work differently — see "Connecting your own social accounts" below.
3. Before you submit any credential, the screen states plainly that you're creating your own account or API key directly with that provider, under that provider's own terms — SocialEngage is not signing you up with the provider and is not a billing intermediary for it.
4. **As an ordinary member of your tenant, only GNews is something you can connect yourself with an API key.** Enter your GNews API key and submit — this always creates a personal connection just for you; there's no "tenant-wide, shared by everyone" option on this screen for you. Newswire and Wikipedia need no credential and are always available once your tenant's Tenant-Admin turns them on. **Azure AI Language, Azure OpenAI Service, Brave Search, Bing Search, and YouTube Data API are Tenant-Admin only** — each authenticates your organization's own subscription, not an individual's personal account, so none of the five ever offers you a way to connect it yourself; if one isn't connected yet, you'll see a plain note asking you to have your Tenant-Admin connect it, rather than a button that would just fail.
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

### Crisis Threshold Wizard (Story 9.4)

An "⚡ Crisis Wizard" button on the Manage watchlists screen (also offered from the empty-watchlists state) opens a 3-step wizard for activating a standardized reputation-risk monitoring template instead of building a watchlist by hand — available to you the same way as to a Tenant-Admin.

1. **Step 1 — Select a template.** Choose from a small set of pre-built scenarios (for example, Brand Crisis, Product Recall, Executive Attack, Competitor Surge, Data Breach), each with a plain description and a severity badge.
2. **Step 2 — Variables.** Fill in the specific names or keywords the template needs — a live preview shows the exact search query your values will produce.
3. **Step 3 — Thresholds & playbook.** Adjust the volume-spike and negative-sentiment percentages that would flag this as a crisis (sensible defaults are pre-filled), and review the template's own advisory response playbook — a numbered list of steps with a named owner role and an SLA in minutes, shown for reference only.
4. Clicking "⚡ Activate Crisis Watchlist" creates a real, active watchlist immediately — private to you, like every other watchlist.

**Current limitation, disclosed directly in the wizard itself:** activating a template creates a real monitoring watchlist right away, but automated alert dispatch (email, Slack, or webhook) for a crossed threshold is not built yet.

### Boolean query visual builder (Story 12.4)

When you choose the "Boolean" match type for a watchlist, you get a real visual query builder instead of just a text box — confirmed against the real `BooleanQueryBuilder.tsx` component.

1. Switch between **🧭 Guided Builder** — add clauses one at a time (Keyword, Phrase, Hashtag, Mention, Author, Source, Sentiment, or Date, plus a nested group for more complex logic) joined by AND/OR/NOT — and **⚡ Advanced Text**, where you can type or paste a boolean query directly. Editing in either mode keeps the other in sync.
2. As you build a query, SocialEngage checks it against every platform your watchlist actually targets and shows two kinds of feedback: an amber "⚠️ Platform Query Warnings" notice when a clause type a platform can't natively evaluate would be silently dropped for that platform, and a red "🚫 Cannot save" error when your query exceeds a platform's own limits — a query with real errors can't be saved until you fix it.
3. A "View AST JSON" toggle shows the underlying structured query, for reference.

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

Once your tenant has connected and activated a platform, SocialEngage polls it automatically in the background — GNews, Newswire, and Wikipedia every 15–30 minutes, your own domain's content feed every 30 minutes (Story 1.13), and your own connected Facebook Page every 30 minutes (Story 1.15) — so posts appear here on their own, with nothing anyone needs to click to make ingestion happen.

1. From your tenant's screens, open "Posts" to see what SocialEngage has ingested for your tenant — **newest-ingested first** (Story 6.25), each with the platform it came from, the author where known, a title and body preview, and its published date. If a post has already been analyzed by an AI provider, you'll also see its sentiment, key phrases, entities, and the detected language right in the list, along with up to three entity and three key-phrase chips.
2. A search box and Provider/Sentiment/Watchlist filters sit above the list, and, as of Story 6.18, both search and every filter now cover your tenant's entire ingested history, not just the current page. The Provider filter automatically includes every platform your tenant actually has posts from (Story 6.26).
3. A "Show more" button reveals more of your already-filtered result set in batches; there's no page-number picker or server round trip for paging.
4. Click any post to open a detail panel on the same screen (a slide-over, not a separate page) showing the same information plus the full article body rendered as real, formatted Markdown (Story 6.19), the author (currently shown as a raw internal identifier — there's no lookup yet to turn it into a friendlier name) and which ingestion run brought it in (also a raw identifier, for the same reason).
5. **A post from Facebook shows which of your connected Pages it came from** (Story 6.33), plus a separate "By: <author>" line whenever Facebook reports a real author distinct from the Page itself. **Any post matched by one of your watchlists shows that watchlist's name** in the card and detail view too (Stories 6.37, 3.11–3.12). An Instagram post shows its own media type and a thumbnail, with a gallery for a multi-image carousel; a LinkedIn post shows its own reaction/comment/share counts. **A YouTube video or comment shows its real title (or comment text), the channel name as its author, and links directly to the video on YouTube** (Story 6.11's post-feed contract, extended for the YouTube connector — confirmed against `postDisplay.ts`).

## Replying to a post (Stories 2.26, 2.27, 3.14, 6.38)

1. On a post's detail panel, next to the "Details" tab, there's a "Replies" tab and, alongside it, a "Reply" button. Today the "Reply" button is only ever enabled for a post from Facebook, and only when you personally have a connected, active Facebook Page credential — for any other platform, or if you haven't connected your own Facebook Page, the button is disabled with a tooltip explaining why.
2. Clicking "Reply" opens a composer drawer next to the post detail panel. Write your reply (up to Facebook's own character limit, shown live as you type) and click "Send Reply."
3. **Sending a reply is real, not simulated** — unlike the cross-platform post composer's "Publish" action, this actually posts a live comment to that post on Facebook through Facebook's own API, immediately, with no draft, review, or scheduling step.
4. Whether it succeeded or failed, you'll see a toast, and the attempt is added to that post's own "Replies" tab, showing its status (sent or failed), when it happened, and — for a sent reply — a "View live reply" link straight to the real comment on Facebook.
5. Every reply you send is recorded permanently against that post, whether it succeeded or failed, so the Replies tab is a genuine audit trail, not just a live status indicator.

**Current limitations:** replying only works for Facebook today — no other platform's connector supports it yet, so the button stays disabled everywhere else. If you have more than one of your own Facebook Pages connected, replying currently uses whichever Page you connected most recently, not necessarily the Page the post actually came from — if those two differ, Facebook will reject the reply with a permission error. The reply composer also has no media attachment or AI-rewrite option, unlike the full cross-platform post composer.

## Running enrichment manually, and correcting it by hand (Story 6.16, extended by Stories 3.13, 6.31, and 12.6)

1. On a post's detail screen, if that post has never been analyzed by an AI provider, you'll see a "Run enrichment now" button — this typically applies to a post that was ingested before your tenant had connected and activated any AI provider.
2. Clicking it asks SocialEngage to analyze that one post right now, using whichever AI provider your tenant currently has connected and active. On success, the screen reloads and shows the real sentiment, key phrases, entities, and which provider produced them.
3. If no AI provider is currently connected and active for your tenant, you'll see a plain message saying so rather than an error.
4. **The sentiment badge itself shows a confidence percentage and a plain-language confidence tier — Strong, Moderate, or Needs review** (Story 12.6) — and, when the AI provider detects distinct opinions about different things within the same post, an "Aspect-Level Sentiment Breakdown" list shows each aspect with its own sentiment badge and a short supporting quote.
5. **As of Story 6.31, a post that has been analyzed also has an "Edit" button** on its AI analysis card. It opens a second panel letting you correct the AI's own sentiment (now including a "Mixed" option, Story 12.6), key phrases, detected language, country, and summary by hand — plus an optional free-text "Override Reason" field to note why — this isn't a Tenant-Admin-only action, any Tenant User can use it. Saving marks the post with an amber "Edited by user" badge showing who made the change and when.
6. Once a post has been manually corrected, clicking "Run enrichment now" again asks you to confirm first, since re-running would otherwise overwrite the correction with a fresh AI result.
7. This button only appears on a post with no enrichment yet, or after you've explicitly confirmed re-running it on a corrected one.

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

## Topic evolution timeline (Story 11.6)

Go directly to `/tenant/analytics/topics` (there's no link to this screen from the Analytics dashboard or the sidebar yet, so you have to type or bookmark the address) to see how a topic's volume and sentiment have moved over time — confirmed against the real `TopicEvolutionTimeline.tsx` component, gated to any tenant identity.

1. Pick a topic from a dropdown — today this is a fixed list of five built-in topics (Artificial Intelligence, Customer Support, Product Feedback, Pricing, Security), not your own custom topics — and a granularity (day, week, or month).
2. A stacked bar chart shows real mention volume per period, split into positive/neutral/negative sentiment, with a 🔥 "Rising Trend" or 📉 "Falling Trend" badge shown for the most recent period and per individual bar.
3. A "Compare Previous" checkbox overlays the prior period's data as a dashed reference line.

**Current limitation:** the topic list is fixed to five built-in names, not derived from your tenant's own real topics, and there's no in-app link to this screen yet.

## Drafting a cross-platform post (Story 6.36, publishing made real by Story 6.39)

Open "Compose" from your tenant's screens (or the "Compose Post" button on the Posts screen) to draft a single message and preview how it would look on up to seven different networks (Facebook, Instagram, LinkedIn, X/Twitter, Bluesky, Mastodon, and Threads) side by side.

1. Write your message once; each network's own live preview card updates as you type. You can attach images with accessibility alt-text, import a Markdown or plain-text document as a starting draft, and ask an AI assistant to rewrite your copy.
2. Drafts save automatically to your own browser as you work — not to shared tenant storage, so a draft made on one device isn't visible from another.
3. **As of Story 6.39, publishing to Facebook is genuinely real, not simulated.** The "Publish" button opens a dialog listing your active, connected Facebook Pages; select which ones to send to and confirm, and SocialEngage actually posts your message to each one through Facebook's own API — you'll see a real link to the published post on success, or a plain per-Page error on failure.
4. **Every other network — Instagram, LinkedIn, X/Twitter, Bluesky, Mastodon, Threads — still can't actually be published to.** The same dialog shows each of them as "not yet available for publishing." You can still draft and preview a message for them; only Facebook can actually be sent to today.

## Scheduling an outbound post (Stories 11.7, 11.8, 11.12)

Go directly to `/tenant/posts/outbound` — this screen isn't linked from the sidebar, the Posts screen, or anywhere else in the app yet, so you have to type or bookmark the address — for a second way to send and schedule outbound posts, separate from the "Compose" screen described above. Confirmed against the real `OutboundComposerModal.tsx` and `OutboundPostsView.tsx` components.

1. Click "Create Outbound Post" to open a composer. Write your message, and choose one or more target networks: LinkedIn, Facebook, Bluesky, or X/Twitter.
2. **As you type, a "Finding relevant authors to tag..." suggestion list appears (Story 11.12)** — a short pause after you stop typing, SocialEngage suggests real authors from your own tenant's data you might want to @mention, each tagged with why it was suggested (a matching topic, a matching keyword, or a semantic/RAG match). Click a suggestion to insert `@theirhandle` into your text.
3. For LinkedIn or Facebook, also pick which of your connected Pages or accounts to send to.
4. Choose "Publish now" to send immediately, or pick a future date and time to schedule it instead.
5. The main screen lists every outbound post you've created here, filterable by tab: All, Scheduled, Published, or Failed. A still-scheduled post can be Cancelled or Rescheduled to a new date and time.

**Current limitation — please read before using Bluesky or X/Twitter here:** sending to LinkedIn or Facebook from this screen is real, using the same real connection this app uses elsewhere. **Bluesky and X/Twitter are offered as selectable targets on this screen, but there is no real connector behind either one yet** — unlike the ordinary Compose screen, which plainly labels them "not yet available for publishing," this screen shows no such warning. Selecting one and publishing immediately creates an activity that never resolves to success or failure; it's simply left stuck. Stick to LinkedIn and Facebook here until this is fixed.

## Unified social inbox (Stories 11.9, 11.10)

Open "Inbox" from your tenant's screens for a dedicated triage queue over incoming social mentions, separate from the ordinary Posts feed — confirmed against the real `InboxView.tsx`/`InboxItemDetail.tsx` components, gated to any tenant identity.

1. Filter the queue by tab: All Items, 🔥 Urgent, ⚠️ High Priority, 💤 Snoozed, or ✓ Resolved, plus a free-text search box.
2. Selecting an item opens its detail: the post content, its priority, provider, and status, an internal notes field, and three actions — **Reply**, **Snooze** (for a chosen number of hours), and **Resolve**.

**Current limitation — a real, serious one, please read before relying on Reply here:** clicking "Reply" always reports success, but **sending a real reply currently only actually works for Facebook**, the only provider with a real reply capability behind it. For every other provider (LinkedIn, Instagram, and everything else), this screen's backend silently records a *fake* "sent" result with a made-up link instead of warning you or disabling the button — unlike the ordinary post detail panel's own Reply button, which correctly disables itself for anything but Facebook. **Do not trust a "sent" confirmation from this screen for a non-Facebook item — it does not mean anything was actually posted.**

## Prospecting lists (Story 10.2)

Open "Prospecting" from your tenant's screens to manage lists of authors you're tracking as potential leads.

1. Create a list by giving it a name and an optional description, and choosing whether it's shared with the rest of your tenant or private to you.
2. Inside a list, each author entry has a relationship stage — New, Contacted, Engaged, Converted, or Passed — and an optional free-text note; both can be edited at any time.
3. **Export CSV** and **Push to CRM** (sending the list's entries to a connected CRM system such as Dynamics 365) are both available from a list's own page, but only to the list's owner — not to anyone it's merely shared with.

## Ad-hoc analytics query (Story 10.5)

Open "Query" from the Analytics section to build your own custom data slice without writing SQL: pick one or more dimensions (e.g. platform, sentiment) and metrics (e.g. post count, engagement) from checklists, add filters, and run the query to see a results table you can export as CSV. Available to any tenant member, not just Tenant-Admins.

## Real-time alerts (Story 10.10)

Open "Alerts" from your tenant's screens for two things:

1. **Alert rules** — create a rule by naming it and choosing a trigger type (Volume Spike, Negative Sentiment Outcry, Influential/VIP Author Post, Connector Error/Ingestion Failure, or Keyword Burst) and a cooldown period between repeat firings. New rules start enabled and notify in-app.
2. **Alert feed** — a filterable list (All / Active / Acknowledged / Resolved) of alerts your rules have actually triggered, each showing its severity. Mark an alert Acknowledged or Resolved from this feed.

## Escalating a post or lead to CRM (Stories 11.1, 11.2)

From a post's detail panel, or from an author's row inside a prospecting list, you can push that item to your organization's own CRM system as a real record — confirmed against the real `CRMHandoffModal.tsx` component, wired into both `PostDetailPanel.tsx` and `ProspectingListDetailView.tsx`, and available to any tenant member, not just Tenant-Admins.

1. On a post's detail panel, click "💼 Push to CRM." On an author's row inside a prospecting list, click "💼 CRM" instead — this pushes that one author as a lead, separately from a list's own bulk "Push to CRM" action described above.
2. Choose which CRM connector to send it to — Microsoft Dynamics 365, Salesforce, or HubSpot — and a record type (Support Case/Incident, Lead/Prospect, Opportunity/Deal, Account, or Contact). You can optionally add an assignee and internal notes.
3. Click "Escalate to CRM" to send it. **This is a real send, not a preview** — it creates or updates an actual record in your organization's connected CRM.
4. If that same post or author was already escalated to that CRM connector before, you'll see a duplicate warning with a link to the existing record, and the option to create a duplicate anyway rather than being silently blocked.
5. On success, you get the CRM's own record ID and a direct link to open it in the CRM.

**Current limitation:** this only works once your organization's CRM connector has real credentials configured — that setup is a separate, tenant-wide screen this pass has not yet traced through and confirmed in full, so it isn't described here; if no credential is configured yet, the push will fail rather than silently succeeding.

## Daily digest email (Story 11.4)

From "Tenant settings," under "Notification Preferences," click "Manage Daily Digest Email" to set up your own personal morning summary email — confirmed against the real `DigestPreferencesView.tsx` component, gated to any tenant identity; these are your own preferences, not a tenant-wide setting.

1. Turn the "Daily Digest Subscription" switch on or off.
2. Pick a delivery time and your own timezone from a list of common timezones.
3. Choose what to include: an AI-generated executive summary, your top 5 highest-impact conversations, and/or a trending-topics breakdown.
4. Optionally narrow the digest to specific watchlists — leave none selected to include all of your active watchlists.
5. Click "Preview Daily Digest" at any time to see a real rendered sample of the email with your current settings, before saving.
6. Click "Save Preferences" to save your choices.

## What's not built yet

- **A friendlier author or ingestion-run display on a post's detail screen** — both currently show as raw internal identifiers.
- **A concise AI-generated summary field** — Azure OpenAI now computes one per post, and you can view/edit it via the manual enrichment-override drawer (Story 6.31), but no screen displays it as its own field otherwise.
- **Watchlist compatibility warnings on the connector status screen.**
- **Reading back your own personal activation state for a connector** — the Activate/Deactivate control for your own personal connections always starts assuming it's off, even if it's actually already on.
- **Setting up, viewing, or managing your organization's own company domain content feed** — as of Story 6.20, this is Tenant-Admin only; see above.
- **Triggering an on-demand re-sync of a connector** — that action is Tenant-Admin only.
- **Your own company domain's content feed and your connected Facebook/Instagram/LinkedIn accounts as watchlist sources** — a watchlist can only target GNews, Newswire, Wikipedia, Brave Search, or Bing Search today.
- **Per-widget export and full period-over-period comparison on the Analytics dashboard, and geographic coverage beyond GNews/Newswire/tenant-owned-feed/Instagram** — see above.
- **Publishing from the cross-platform post composer to anything but Facebook** — drafting and previewing work for all seven networks, and publishing to your own connected Facebook Pages is now genuinely real (Story 6.39, extended by Story 13.10), but Instagram, LinkedIn, X/Twitter, Bluesky, Mastodon, and Threads are still "not yet available for publishing" from this screen.
- **Replying to a post works for Facebook only** (Stories 2.26/2.27/3.14/6.38) — the Reply button stays disabled for every other platform. If you have more than one of your own Facebook Pages connected, replying uses your most-recently-connected Page's credential, not necessarily the Page the post came from.
- **Outbound publishing to LinkedIn now has a working backend endpoint** (Stories 2.28–2.30) and **exporting your tenant's posts and workspace data does too** (Story 3.16) — neither has a screen that calls it yet, so neither is something you can do from the app today (Facebook publishing, by contrast, is now real from the post composer — see above).
- **Facebook post engagement counts (reactions, comments, shares) are now captured by the connector** (Story 2.18) but aren't shown anywhere in the post feed or detail panel — unlike LinkedIn's or Instagram's own engagement counts, which are displayed.
- **A backend endpoint for a plain-language explanation of any dashboard metric now exists** (Story 9.2) but no screen calls it yet — separate from the real Discovery "Ask AI Assistant" feature described above.
- **Automated alert dispatch for a Crisis Threshold Wizard template is not built yet** (Story 9.4) — activating a template creates a real watchlist immediately, but nothing is sent yet when a threshold is actually crossed, exactly as the wizard's own banner discloses.
- **Discovery's semantic search/Ask index (Stories 9.7–9.11) is not kept current with live ingestion** — a post only becomes searchable or citable there once an operator has run a backend indexing process, which can lag behind what's already visible in your ordinary Posts feed.
