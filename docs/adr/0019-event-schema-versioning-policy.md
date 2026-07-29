# ADR-0019: Event schema versioning policy

**Status:** Accepted (2026-07-29) — decided ahead of its natural implementation phase (see below)
**Source:** Not specified in the design spec or the linked design conversation. Flagged independently in a Copilot review of this ADR series. This ADR originates the policy; it does not document a prior decision.
**Acceptance note:** accepted deliberately early, in Phase 0 of `docs/implementation-plan.md`, even though events aren't published until Phase 3 — the `schemaVersion` property is cheap to attach to every event from the very first one published and materially more expensive to retrofit after multiple event types and a real subscriber exist. The "coordinated cutover" open question below is unaffected by this early acceptance — it's still genuinely open until a real subscriber exists to test it against.

## Context

ADR-0012 established that Service Bus events (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`, §7) are deliberately thin — a handful of ID and status fields, with full data fetched via REST on demand. Multiple independently deployable downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will each subscribe and parse these payloads. Nothing in the spec says what happens when an event payload's shape needs to change after subscribers already exist — whether that's adding a field, changing one, or introducing genuinely new event types.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

Events version independently from, and more lightly than, the REST API (ADR-0017), because they're intentionally thin (a handful of fields, not full resource bodies, per ADR-0012). New event types are pure additions with no versioning question — only changes to an *existing* event type's shape need a policy. A version signal must be inspectable by Service Bus itself (routing, filters, observability), not only visible after a consumer deserializes the JSON body — this mirrors a constraint that already exists implicitly in ADR-0013: subscription SQL filters can only evaluate Service Bus message properties, not payload body content, so `tenantId` must already be set as a message property (in addition to appearing in the payload) for ADR-0013's per-tenant filtering to work as described at all. `schemaVersion` should follow the same pattern, for the same reason.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- `schemaVersion` (a number, starting at `1`) is set as a **Service Bus custom application property** on every event message — this is the authoritative copy, inspectable by filters and tooling without deserializing the body. It may optionally also be mirrored into the JSON payload for consumers that only look at the deserialized body, but the property is the source of truth.
- Additive, backward-compatible changes to an existing event type (new optional payload field) do **not** bump `schemaVersion` — subscribers ignoring unknown fields (the expected behavior) are unaffected.
- A breaking change to an existing event type's shape (removing/renaming a field, changing a field's type or meaning) bumps `schemaVersion` for that event type. The publisher emits both the old and new `schemaVersion` in parallel during a coordinated cutover — not an indefinite dual-publish window like ADR-0017's REST deprecation period — because the subscriber list here is small and known (internal downstream subsystems, not a public API), making a "confirm you've upgraded, then we stop publishing the old shape" cutover realistic in a way it isn't for a public REST API.
- Because `schemaVersion` is a message property, a subscriber can reject or dead-letter an incompatible version at the transport level, or even filter it out via its own SQL filter, without ever deserializing a payload shape it doesn't understand.

## Consequences

**Positive**
- Matches the proportionality of ADR-0012's original thin-events decision — a 7-field payload doesn't need the same versioning machinery as a full REST resource surface with dozens of fields and nested objects.
- Coordinated cutover (rather than long-lived dual-publishing) avoids building and maintaining a multi-version event-publishing system for what is, by design, a small and stable payload shape.
- `schemaVersion` as a message property, consistent with how `tenantId` already needs to work for ADR-0013 to function, lets Service Bus itself — filters, routing, observability tooling — act on version without any consumer deserializing the body, and lets a subscriber reject an incompatible version before paying the cost of parsing it.

**Negative**
- A coordinated cutover requires actually knowing who's subscribed and confirming they've upgraded before dropping the old shape — this needs a real subscriber registry or at minimum a manual coordination process, which doesn't exist yet since no downstream subsystem has been built.
- If the subscriber list grows large or includes external/third-party consumers later (not anticipated by this spec, which scopes downstream consumers to sibling subsystems within the same platform), "coordinate a cutover" stops being realistic and this policy would need to be revisited in favor of something closer to ADR-0017's approach.
- Using a message property as the authoritative version signal (rather than only a payload field) means publisher and consumer code must handle Service Bus message metadata explicitly, not just deserialize a JSON body — marginally more surface than a payload-only approach, though it's the same surface `tenantId` handling already requires.

## Alternatives Considered

- **`schemaVersion` as a payload field only, no message property** — this was this ADR's original draft. Rejected on reflection: it's inconsistent with how `tenantId` already must work for ADR-0013's filters to function at all, and it loses the ability to filter/reject on version before deserializing the body.
- **Version in the event type name** (e.g. `social.post.ingested.v2` as a distinct type, mirroring REST's `/v2/` path) — keeps old and new fully independent with no shared-type ambiguity, but means every breaking change multiplies the number of distinct event types subscribers need to know about.
- **No versioning; additive-only forever** — simplest, and arguably sufficient given how thin these events are — but same objection as ADR-0017: no escape hatch if a field genuinely needs to change meaning, which is possible even in a small payload (e.g., if `sentiment`'s enum values ever need to change).

## Open question for decision

Whether "coordinated cutover" is actually operationally realistic depends on how downstream subsystems get built and deployed — this should be revisited once the first real subscriber (likely Brand Reputation & Alerts) exists. This is a decision-level question, not an implementation-default one.

## Amendment Log

Changes to implementation defaults (property name, whether the version is also mirrored in-payload, cutover coordination mechanics) are logged here, dated, instead of superseding this ADR.

- 2026-07-28 — Initial proposal: `schemaVersion` as a payload-only field.
- 2026-07-28 — Revised after review: `schemaVersion` moved to a Service Bus application property (authoritative), for consistency with how `tenantId` must already work for ADR-0013's filters to function.
