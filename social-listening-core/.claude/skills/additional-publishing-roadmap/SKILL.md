---
name: additional-publishing-roadmap
description: Governs the sequence, prerequisites, credential constraints, rate gates, and acceptance criteria for extending outbound publishing to Wave 2 platforms (Mastodon, Bluesky, Instagram, Threads, X). Read before implementing any new publishing connector.
---

# Additional Social Platform Publishing Roadmap

## What this is

This component establishes the architectural roadmap and governance rules for extending `SocialConnector.publish?()` to the second wave of social platforms: Mastodon, Bluesky, Instagram, Threads, and X/Twitter. It defines the mandatory build order following Wave 1 (Facebook and LinkedIn), enforces reuse of the existing `outbound_activities` audit table, ensures rate limiting isolation via `RequestGate`, restricts credentials to Tier-3 (user-bound), and mandates that each platform obtain an accepted per-platform ADR before implementation begins.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0118 | Additional Social Platform Publishing Roadmap and build order | 14.1 |
| ADR-0075 | Outbound Social Post Publishing framework and `outbound_activities` table | 2.28, 2.29, 2.30, 3.15 |
| ADR-0028 | Connector Credential Ownership and Storage Tiering (Tier-3 user credentials) | 1.7 |
| ADR-0014 | Connector OAuth and Credential Storage Architecture | 1.7 |
| ADR-0048 | No-Core-Pipeline-Change Verification for New Connector Registration | 2.10 |
| ADR-0027 | Connector Is Technical Intermediary, Not Contracting Party | 2.10 |
| ADR-0115 | Publishing Media Upload and Asset Targeting (deferred media dependency) | 13.9, 13.10 |

## Contracts that constrain this component

- `contracts/epic-14/story-14.1.additional-social-platform-publishing-roadmap.contract.test.ts` — Locks down Wave 2 build order, prerequisite enforcement, rate gate key isolation, Tier-3 credentials, v1 text/link-card scope, and X/Twitter economic re-evaluation barrier.
- `contracts/epic-2/story-2.28.connector-publish-framework.contract.test.ts` — Governs the `SocialConnector.publish?()` interface and `outboundPublishService.invoke()` pipeline.

## How to extend this safely

1. **Do not implement a platform without an accepted ADR:** Every Wave 2 platform (`mastodon`, `bluesky`, `instagram`, `threads`, `twitter`) requires its own primary-source-verified, accepted ADR before code is written.
2. **Follow the explicit build order:**
   `Facebook` (Story 2.29) & `LinkedIn` (Story 2.30) → `Mastodon` → `Bluesky` → `Instagram` → `Threads` → `X/Twitter`.
3. **Re-use `SocialConnector.publish?()`:** Do not invent a bespoke publishing pipeline. Implement `SocialConnector.publish(tenantId, userId, payload, credential)` returning `{ externalId, externalUrl }`.
4. **Isolate rate limits in `RequestGate`:** Always use `outboundPostKey(tenantId, connector)` which resolves to `(tenantId, providerId, 'outbound_post')`.
5. **Enforce Tier-3 (user-bound) credentials:** Callers must supply credentials with `owner_type = 'user'` (`getLatestCredentialId(tenantId, providerId, 'user', userId)`). Never pool credentials across tenants or users.
6. **Limit v1 to text and link-card:** Image and video media upload must wait for ADR-0115 asset pipelines.
7. **Instagram requires media:** Note that Instagram Content Publishing does not support text-only posting; it is explicitly blocked until media upload is available.
8. **X/Twitter requires economic review:** Do not proceed with X/Twitter without confirming API pricing viability for this project.

## Load-bearing constraints — do not change casually

- **Build Order:** `mastodon` -> `bluesky` -> `instagram` -> `threads` -> `twitter`.
- **Credential Tier:** `tier3_user` (`owner_type: 'user'`) is mandatory; tenant-wide credentials (`owner_type: 'tenant'`) must never be used for outbound personal posting.
- **Gate Separation:** The gate key `${tenantId}:${providerId}:outbound_post` must remain strictly isolated from `${tenantId}:${providerId}` (ingestion) and `${tenantId}:${providerId}:outbound` (reply).
- **Outbound Activities Schema:** All platforms write to `outbound_activities` with `activity_type = 'post'`.

## Known gaps / deferred work

- Per-platform ADRs for Mastodon, Bluesky, Instagram, Threads, and X are not yet drafted or accepted.
- Concrete connector publish methods for these 5 platforms will be implemented under their respective future stories once ADRs are accepted.

## Relations to other components

- Calls into `src/connectors/requestGate.ts` (`outboundPostKey`, `acquireForOutboundPost`) for outbound rate limiting.
- Reuses `src/outbound/outboundPublishService.ts` (`invoke`) for executing publishing runs.
- Aligns with `src/publishing/outboundPublishingService.ts` for orchestrating multi-platform posts and database persistence.
- Referenced by the Polypost Composer preview rails in `social-listening-admin`.
