# ADR-0013: Per-tenant event filtering via Service Bus subscription SQL filters

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §7 "Service Bus Event Schema"

## Context

Downstream subsystems typically serve a subset of tenants, not all of them (e.g., only tenants who've enabled Brand Reputation & Alerts). Every `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` carries `tenantId`, and events must reach only the subscribers entitled to that tenant's data — never all subscribers regardless of which tenants they serve.

## Decision

Use Azure Service Bus subscription SQL filters on `tenantId` so each downstream subscription only receives events for the tenants it actually serves, rather than every subscriber receiving the full event stream and filtering client-side.

## Consequences

**Positive**
- Filtering happens at the messaging layer, so a subscriber never even receives (and can't accidentally process or leak) events for tenants outside its scope — this is a stronger boundary than trusting every subscriber to filter correctly in application code.
- Keeps subscriber-side code simpler: no need to implement and maintain a tenant-scope filter in every downstream subsystem.
- Scales naturally as new subsystems come online with different tenant subsets — each just declares its own subscription filter rather than the core needing to know about per-subsystem tenant scoping.

**Negative**
- Subscription filters need to be kept in sync with which tenants each subsystem serves (e.g., as tenants enable/disable a downstream subsystem), which is operational state living in Service Bus configuration rather than in this subsystem's own database — a potential source of drift if not automated.
- SQL filter rules on Service Bus topics have practical limits on count/complexity per topic; a very large number of individually-scoped subscriptions could approach those limits and needs monitoring as the tenant/subsystem count grows.

## Alternatives Considered

- **Single shared topic, no filtering — every subscriber gets every event** — simplest to set up, but every downstream subsystem would need to filter by tenant itself, and any bug in that filtering is a cross-tenant data exposure risk rather than a messaging-layer guarantee.
- **One topic per tenant** — strong isolation, but doesn't scale operationally with a growing tenant count, and subscribers serving many tenants would need to subscribe to many topics instead of applying one filter expression.

## Clarification (2026-07-28)

Per-tenant SQL subscription filters require `tenantId` to be emitted as a Service Bus application property, not only as a field inside the JSON payload — subscription rules evaluate message properties, not payload body content, so filtering on `tenantId` cannot work from the payload alone. This isn't a new decision; it's a mechanical requirement of the one already made above (SQL filters as the filtering mechanism), made explicit here because it surfaced while designing ADR-0019's `schemaVersion` property, which follows the same pattern for the same reason.
