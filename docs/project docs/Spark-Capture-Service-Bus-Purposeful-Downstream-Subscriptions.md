# Spark Capture: Service Bus as a Deliberately-Scoped, Not-Yet-Used Capability

**Captured Date:** 18 August 2026
**Originator:** Menno, prompted by a live question during this session — "why did we opt in for the Service Bus if we're not allowed to let tenants use it?" and "how does a Platform Admin know what a tenant wants without seeing tenant information?"
**Status:** Brainstorm — raw material for a future ADR, not a decision. Written so the eventual design starts from an accurate map of what's real today and where the actual boundary sits, the same job [Spark-Capture-AI-Provider-Model-Agnosticism.md](Spark-Capture-AI-Provider-Model-Agnosticism.md) did for AI provider routing.

---

## 1. The question, taken seriously

Service Bus is fully built on the publish side (ADR-0012, ADR-0013, ADR-0019; Stories 5.1, 5.2, 5.5, 5.19) and genuinely proven — every real ingestion event carries `tenantId`/`schemaVersion` as application properties, and a contract test proves a SQL-filtered subscription receives only its own tenant's events. And yet **nothing consumes it**. `ingestion-events/SKILL.md`'s own "Known gaps" section says so directly: *"No real subscriber consumes either event type in production today."* A powerful, correctly-built mechanism sitting unused is exactly the kind of thing worth asking "why," not shrugging off.

The honest answer has two parts, and they resolve each other.

## 2. Part one: it was never meant to be tenant-facing

Per [Spark-Capture.md](Spark-Capture.md) §1 and ADR-0012's own Context, "downstream subsystems" has always meant **the other three planned SocialEngage subsystems** — Brand Reputation & Alerts, Social Care, Social Selling — not a tenant's own external systems. This subsystem (Listening/Insights) is one of four; the other three don't exist yet. Service Bus is SocialEngage's own internal integration bus, connecting its own future services to each other so they don't each rebuild ingestion — the same reason Microsoft Social Engagement's own internal plumbing was never something a customer plugged into directly. A tenant was never going to receive an Azure Service Bus connection string and start creating their own subscriptions against shared multi-tenant infrastructure; that's a real security exposure independent of how good the SQL filters are.

So today's "unused" state isn't neglect — it's correctly sequenced. The publish side had to exist before any subscriber could be built (Story 5.19 proved the pipeline actually calls `publishEvent()` for real), and the *first real subscriber* is naturally a second subsystem, which is a whole separate build this project hasn't reached yet.

## 3. Part two: why that doesn't put Platform Admin in an impossible spot

The sharper question was: if a Platform Admin has to provision a subscription "for the tenants a subsystem serves," don't they need to know what's in those tenants' data — exactly what ADR-0030 locks them out of?

No — because the filter key, `tenantId`, is a **routing identifier**, not tenant *content*. Provisioning a subscription answers one narrow question: *does tenant X have subsystem Y turned on?* That's an entitlement/plan flag — the same category of fact as `status` or `license_seat_count`, both of which `platform_admin_role` already legitimately reads and writes on the `tenants` registry table today (ADR-0030/ADR-0031). It is categorically different from `users`, `watchlists`, `social_posts`, or `platform_credentials` — the tables Platform Admin is actually, deliberately locked out of, because those hold what a tenant's people, searches, and posts actually *are*.

Concretely: a Platform Admin (or, more likely, an automated step at a new subsystem's own deploy time) would create a subscription filtered on the list of `tenantId`s that have a given `enabled_subsystems`-shaped flag set — never by reading a single watchlist, post, or user row to infer intent. "Which tenants opted in" is registry state; "what those tenants are watching for and finding" stays exactly as isolated as it is today.

## 4. What "used wisely and with purpose" would actually mean

Not: provisioning subscriptions speculatively now, for subsystems that don't exist, against tenants who've never been asked to opt into anything. That would be building ahead of a real need — exactly what this project's own conventions (and ADR-0058's own "no real subscriber" note) already caution against.

Instead, purposeful use looks like:

- **An entitlement flag is the trigger, not an afterthought bolted on later.** Whenever the *next* subsystem gets built, "does tenant X use subsystem Y" needs to already be a real, tenant-visible, tenant-controlled setting (most naturally surfaced in the tenant admin UI, the same tier that already manages connectors and watchlists) — not something Platform Admin decides on a tenant's behalf.
- **Subscription lifecycle follows entitlement, not the reverse.** A tenant enabling/disabling a subsystem should be the event that adds/removes them from that subsystem's subscription filter — provisioning as a consequence of a tenant's own choice, not a manual, drifting Platform Admin task (ADR-0013's own Consequences section already names filter/entitlement drift as a real risk to guard against).
- **The subsystem itself owns its subscription, the core doesn't reach into it.** Consistent with ADR-0013's Decision — "each [subsystem] just declares its own subscription filter rather than the core needing to know about per-subsystem tenant scoping" — `social-listening-core` stays the publisher and never becomes the place that manages a downstream subsystem's own consumption logic.
- **If a tenant genuinely needs their own real-time signal (not another SocialEngage subsystem), that's a different, tenant-facing feature — not raw Service Bus access.** A webhook registered through the admin UI, relayed out of an internal subscription social-listening-core itself owns, is the shape that would actually respect the isolation boundary while still being useful. This is a distinct capability from anything ADR-0013 designed and would need its own ADR if it's ever wanted.

## 5. What already exists and should not be rebuilt

- The publish mechanism itself — `publishEvent()`, thin event shapes, `tenantId`/`schemaVersion` as application properties — is real, tested, and wired into every real connector's ingestion path (Story 5.19).
- The filtering *mechanism* — SQL subscription filters scoped to `tenantId` — is proven end-to-end by Story 5.2's contract. What's missing is never "does filtering work," it's "who decides the filter's tenant list, and when."
- `tenants` already being the correct, Platform-Admin-legitimate home for registry-level flags (`status`, `license_seat_count`, `domain`, `name`) — an `enabled_subsystems`-shaped addition would follow an already-established pattern, not invent a new one.

## 6. Deliberately not decided here

- Exact shape of the entitlement flag (a column on `tenants`, or a separate join table once more than one subsystem exists to make "many-to-many" real rather than speculative).
- Whether subscription provisioning is automated (subsystem-owned code reacting to entitlement changes) or a manual Platform Admin/ops step for the first subsystem, matching this project's own precedent of deferring automation until a second real instance of a problem exists (ADR-0020's distributed-rate-limit deferral is the direct analogue).
- Whether a tenant-facing webhook relay is ever built, and if so, whether it reuses this same entitlement concept or is scoped independently.
- None of this is actionable until a second real subsystem (or a concretely-scoped tenant-facing notification feature) is actually being built — this document's job is only to make sure that whenever it is, the design starts from "entitlement is registry data, tenant content stays untouched," not from re-litigating the boundary from scratch.
