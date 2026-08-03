# Future subsystems — scope boundary & parking lot

**Why this file exists:** "Brand Reputation & Alerts, Social Care, Social Selling — out of scope, designed later" is repeated near-verbatim in at least seven places (design spec §9, `implementation-plan.md` line 10, `open-items-and-deferred-work.md` §C, `Project-Charter.md`, `Business-Case-v6.0.md`, `Ideation-Document-v7.2.md`, `Ideation-Enhanced.md`, `Concept-Validation.md`) — but none of them say what each subsystem actually covers, or where a concept discovered while building *this* subsystem should land once it's judged out of scope here. That repetition-without-substance is the gap this file closes: one place that (a) minimally defines each downstream subsystem and (b) tracks concepts parked against a specific one, so "out of scope" always resolves to "tracked, over there" rather than a dead end. Other docs should link here instead of re-stating the exclusion.

**Status of all three, as of 2026-07-31:** no charter, no ADR series, not started — each is "a separate future project with its own charter" per `Project-Charter.md` line 37. Nothing below commits to building any of them; this is a landing place for forward-looking notes only.

---

## Brand Reputation & Alerts

**What it covers** (per `Concept-Validation.md`'s MSE feature-area mapping): brand/reputation monitoring and alerting — the "notice something is happening and tell someone" layer that this subsystem's own spec explicitly excludes (§1: "does not include alerting/crisis detection... deferred to future subsystems"). More concretely, this kind of capability typically bundles:

- **Brand mentions** — monitoring mentions of the company, products, or key people across websites, news, blogs, forums, and social media (this subsystem's own ingestion pipeline is the natural upstream feed for this).
- **Sentiment analysis** — whether mentions are positive, neutral, or negative.
- **Review tracking** — customer reviews from platforms such as Google Reviews, Trustpilot, or app stores.
- **Reputation scorecards** — dashboards showing trends in public perception over time (related to, but narrower than, the "Topic Center" concept tracked separately below — that one turned out not to be Brand-Reputation-shaped once its research/discovery angle was added).
- **Alerts and notifications** — real-time or scheduled, e.g. a negative review appears, mentions spike unexpectedly, a competitor is mentioned alongside the brand, a potential PR crisis emerges, or an influential outlet covers the organization.
- **Competitor monitoring** — comparing brand visibility and sentiment against competitors.

**Example alert rules** this capability would support: notify marketing when a news article mentions the company; alert if social sentiment drops below a threshold; open an incident ticket when a high-profile negative review is detected.

**Business value:** protect brand image, respond quickly to customer concerns, detect emerging issues before they become crises, measure PR/marketing effectiveness, and improve customer trust.

**Parked concepts:** none filed directly here — see **Topic Center** below, which subsumes what would have been listed here but doesn't fit this subsystem cleanly (its research/discovery angle isn't Brand-Reputation-shaped).

## Social Care

**What it covers:** case routing / customer-service workflows off of ingested social mentions — one of MSE's four original feature areas (`Concept-Validation.md`), explicitly named as CRM-adjacent workflow this business case declined to fund (`Business-Case-v6.0.md` line 29). Concretely, this is the process of responding to customer questions, complaints, and support requests through social media channels (X, Facebook, Instagram, LinkedIn, online communities). Social care teams monitor brand mentions and alerts, engage with customers, resolve issues, and protect the organization's reputation this way.

**Example:** a customer posts on X, "My internet has been down for two days." The social care team sees the mention, responds publicly, moves the conversation to direct messages if needed, and works to resolve the problem.

**Parked concepts:**

- **Requirement: any "respond to social media content" capability inherits a fixed credential rule from this subsystem's ADR-0028, not something Social Care would decide on its own.** Surfaced 2026-08-03 while drafting `docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md` (this subsystem's credential-ownership-tier ADR) and confirmed directly by Menno. The rule: any capability that acts *as* a specific platform account — replying to a post, sending a direct message, voting/reacting, submitting a comment — requires that platform's own user-context authentication (e.g. Reddit's `authorization_code` OAuth grant, distinct from the app-only `client_credentials`/`installed_client` grant this subsystem's own public-content monitoring uses — verified against `github.com/reddit-archive/reddit/wiki/OAuth2`), because an app-only, tenant-wide credential has no account identity to act as. Under ADR-0028's Tier 3 rule, that credential can only be created by the individual user's own act of activation — never by Tenant-Admin or Platform Admin on that user's behalf, even for a support/case-routing workflow. Whenever Social Care is actually chartered, its own connect-flow design needs to account for this: responding through a given platform requires that specific tenant user to personally hold and activate their own credential for it, not a shared/organizational one. See ADR-0028's Decision section (Tier 3 worked example) for the fuller reasoning, sourced there rather than duplicated here.

## Social Selling

**What it covers:** lead-generation recommendations off of ingested social activity — the fourth MSE feature area, same explicit exclusion as Social Care. In the context of social media, social selling is the practice of using social networks to build relationships, establish trust, identify prospects, and ultimately influence purchasing decisions — engagement and relationship-building first, rather than pitching products directly.

**How it typically works:**
- **Share valuable content** — industry insights, thought leadership, customer success stories, educational videos.
- **Engage with prospects** — comment on posts, answer questions, participate in discussions, congratulate connections on achievements.
- **Build credibility** — demonstrate expertise, showcase experience, publish case studies and insights.
- **Develop relationships** — connect with potential customers, understand their challenges, advise before pitching.
- **Convert opportunities** — move conversations to DMs/meetings/calls, present solutions once a business need is identified.

**Example:** a managed-services consultant shares Microsoft 365 governance best practices on LinkedIn, comments on posts from IT leaders discussing security challenges, publishes insights on Copilot adoption/compliance, and connects with decision-makers interested in those topics. Over time, prospects come to recognize the consultant as a trusted expert, making later sales conversations easier.

**Social selling vs. traditional selling:**

| Traditional selling | Social selling |
|---|---|
| Cold calls | Warm introductions through networks |
| Sales pitch first | Relationship first |
| One-way communication | Two-way engagement |
| Focus on product | Focus on customer problems |
| Short-term interaction | Long-term trust building |

**Common platforms:** LinkedIn (most common for B2B), X, Facebook, Instagram, TikTok, YouTube, industry communities/forums.

**Typical KPIs:** new connections/followers, engagement rate, conversations started, qualified leads generated, pipeline influenced, revenue attributed to social activity.

**Relationship to the other three functions in this doc** (and to this project's own in-build subsystem):
- **Brand Reputation & Alerts** → monitoring what people say about the brand.
- **Social Care** → responding to customer questions and complaints.
- **Social Listening / Insights** (this project's current, in-build subsystem) → analyzing conversations and trends.
- **Social Selling** → building relationships that generate business opportunities and sales.

In short: social selling uses social media to build trust and relationships that lead to business opportunities and revenue, rather than relying solely on direct sales outreach.

**Parked concepts:** none yet.

---

## Topic Center (parked concept — doesn't fit any subsystem above, assignment unresolved)

**Not one of the four MSE-derived categories** (social insights, brand reputation, social care, social selling — confirmed directly against Microsoft's own archived MSE docs). Introduced 2026-07-31 as a project-original concept: research-oriented, built around a *subject/topic* rather than a brand, aimed at (1) everything MSE's "Search Topic" tracked, (2) finding the leading authors on that subject, and (3) researching novelty/IP — is this subject new/emerging, who spoke first, what's the whitespace.

**Includes everything Search Topic covered** (see the corrected terminology note below): volume trend, sources, languages, location, word cloud, sentiment — all scoped to one tracked subject at a time.

**Extends it with two more capabilities:**

1. **Leading authors on a subject** — given a topic, who are the most authoritative/active voices talking about it. **This is not a gap** — it's already built, today, in this subsystem: `AuthorTopicSignal` (ADR-0007) plus `GET /topics/:topic/authors?sortBy=mentionCount` (Phase 2, shipped) does exactly this, ranking authors by `mentionCount`/`avgEngagement`/`activeMonthsCount`. Nothing new needs building for this half.
2. **Novelty / IP research** — is this subject genuinely new or already well-covered; tracking earliest mentions; whitespace/prior-art-style discovery ("who said this first," "how crowded is this space"). **This is a real gap** — nothing in this project's 25 ADRs, the design spec, or either other future subsystem covers assessing novelty or first-mover timing on a topic. It doesn't fit the three subsystems above either: no alerting/crisis angle (not Brand Reputation & Alerts), no case routing (not Social Care), no lead-gen (not Social Selling).

**Correction (verified 2026-07-31, against Microsoft's archived MSE documentation):** an earlier note in this file assumed "Topic Center" was MSE's own feature name — it isn't. MSE's real terminology was **"Search Topic"**: a tenant-defined saved keyword/hashtag/handle query, with two per-topic analytics views — an **Overview** page (volume, sources, languages, location, word cloud) and a **Sentiment** page (only populated once a specific Search Topic is selected, not "All Search Topics"). No feature literally named "Topic Center" appears in Microsoft's own docs. As now (re)defined by this project, "Topic Center" is Search Topic's scope *plus* leading-authors-discovery *plus* novelty/IP research — broader than anything MSE shipped.

**Mapping to this project's own vocabulary:**
- Search Topic-equivalent tracking ≈ this subsystem's own `Watchlist` (ADR-0006/ADR-0021 — saved keyword/boolean query), which exists conceptually but has no persisted table or CRUD yet (`docs/open-items-and-deferred-work.md` §A).
- Leading-authors discovery ≈ `AuthorTopicSignal` (ADR-0007) — already built.
- Volume/sentiment-over-time charting ≈ `TopicDailyCount`, deferred by ADR-0008.
- Novelty/IP research ≈ **nothing existing** — a new capability with no current owner.

**Example:** researching "quantum-resistant encryption" as a subject (not a brand) — Topic Center would show mention volume and sentiment (Search Topic-equivalent), the authors most actively and knowledgeably discussing it (`AuthorTopicSignal`, already available today), and — the new piece — when the conversation started, whether it's accelerating, and whether a given angle on it is already saturated or still whitespace.

**Open question, not yet resolved:** is the "leading authors + novelty/IP research" combination (1) a natural extension of *this* subsystem's own topic model — meaning a new ADR/story here, through the normal `implement-story` workflow, not a future-subsystem parking-lot note — or (2) a genuinely new, fifth capability area outside the original four-subsystem MSE-derived vision, deserving its own future charter the way the other three do? Recorded here as open rather than guessed at silently, per this file's own convention below.

---

## Open naming gap (unresolved, not just undocumented)

ADR-0008 and spec §4.6/§9 defer `TopicDailyCount` aggregation and all charting UI to **"a future insights/dashboard subsystem"** — that exact phrase, never tied to Brand Reputation & Alerts, Social Care, or Social Selling by name anywhere in the doc corpus. Worth noticing: this subsystem is itself named "Social Listening / **Insights**," so "a future insights subsystem" reads ambiguously — it could mean Brand Reputation & Alerts, a fourth/fifth thing never named in any charter (see Topic Center above), or a later phase of *this* subsystem that just hasn't been scoped. Nothing in this file resolves that ambiguity — Topic Center is deliberately left unassigned above rather than force-fit into one of the three named subsystems, the same way `docs/open-items-and-deferred-work.md` §D tracks other not-yet-decided items.

## Convention for adding to this file

When work on the in-build subsystem surfaces a concept that's out of scope here but belongs to a specific future subsystem, add it under that subsystem's "Parked concepts" above — name, one-line description, source (which conversation/ADR/doc surfaced it), and the underlying data it'd build on if that's already known. If it's unclear which subsystem owns it, say so explicitly (as above) rather than guessing silently.
