# Platform Library Specification: Mastodon Outbound Publishing

**Platform ID:** `mastodon`  
**Display Name:** Mastodon (ActivityPub Federated Network)  
**Build Sequence:** Step 1 of 5 (Wave 2)  
**Governing Architecture Decision:** [ADR-0118: Additional Social Platform Publishing](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md)  
**Source Story:** [Story 14.1 (ADR-0118)](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/user-stories/epic-14-adr-0118-to-0122.md#L7-L27)  

---

## 1. Architectural Overview & Context

Mastodon is an open-source, decentralized social networking platform running on the W3C ActivityPub protocol. Unlike centralized services, there is no single "Mastodon API server." Instead, millions of users reside across thousands of autonomous, federated instances (e.g., `mastodon.social`, `fosstodon.org`, `techhub.social`, or private enterprise instances).

Per [ADR-0118 Decision §1](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md#L33-L43), Mastodon is scheduled as the **first** platform to be built in the second wave of publishing connectors because:
1. **Frictionless Developer Access:** Does not require a developer portal application review, corporate business verification, or recurring developer subscriptions.
2. **Open Standards:** Implements a stable, well-documented REST API (`/api/v1/statuses`) with transparent error codes and HTTP headers.
3. **Rich Publishing Primitives:** Native first-class support for text, link cards, content warnings (`spoiler_text`), and visibility scopes (`public`, `unlisted`, `private`).

---

## 2. Federated Instance Discovery & Credential Model

### 2.1 Dynamic Instance Resolution
Because each user belongs to a specific Mastodon instance, the connector cannot hardcode an API base URL. The instance URL must be captured during the user's connection flow and persisted as part of the Tier-3 credential.

```typescript
export interface MastodonCredential {
  /** Fully-qualified base URL of the user's Mastodon instance (e.g. 'https://mastodon.social') */
  instanceUrl: string;
  /** OAuth 2.0 User Access Token with 'write:statuses' permission */
  accessToken: string;
  /** Mastodon Account ID on the instance */
  accountId: string;
  /** Full webfinger username handle (e.g. '@user@mastodon.social') */
  username: string;
}
```

### 2.2 Dynamic Capability Probing
Different Mastodon instances can customize configuration parameters (such as maximum status character limits). The connector checks instance capabilities via:
```http
GET {instanceUrl}/api/v2/instance
```
Expected response:
```json
{
  "domain": "mastodon.social",
  "title": "Mastodon",
  "version": "4.3.0",
  "configuration": {
    "statuses": {
      "max_characters": 500,
      "max_media_attachments": 4,
      "characters_reserved_per_url": 23
    }
  }
}
```
If `/api/v2/instance` returns 404 (on legacy v2/v3 instances), fallback to `/api/v1/instance` is used, defaulting to `500` characters.

### 2.3 Tier-3 Storage Conformance
- **Ownership Tier:** Tier-3 (User-bound per [ADR-0028](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md)).
- **Storage:** Persisted in `platform_credentials` with `provider_id = 'mastodon'` and `owner_type = 'user'`.
- **Encryption:** Stored as an envelope-encrypted JSON string conforming to [ADR-0014](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md).

---

## 3. Outbound Publishing API Contract

### 3.1 Endpoint Specification
Outbound post creation uses the official Mastodon Status Creation REST endpoint:

```http
POST {instanceUrl}/api/v1/statuses
Authorization: Bearer {accessToken}
Content-Type: application/json
Idempotency-Key: {outboundActivityId}
```

### 3.2 Request Payload Schema

```json
{
  "status": "Check out our latest open-source telemetry engine! https://example.com/telemetry",
  "spoiler_text": "Optional Content Warning",
  "visibility": "public",
  "sensitive": false,
  "language": "en"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | string | The text content of the post (required). |
| `spoiler_text` | string (optional) | Content warning subject line. When provided, the status body is collapsed behind a "Show more" button in Mastodon clients. |
| `visibility` | enum (optional) | `'public'` (federated timeline), `'unlisted'` (public URL but hidden from public timelines), `'private'` (followers only). Default: `'public'`. |
| `sensitive` | boolean (optional) | Flags media/content as sensitive. Default: `false`. |
| `in_reply_to_id` | string (optional) | Target status ID when executing a threaded reply (ADR-0073). |
| `language` | string (optional) | ISO 639-1 language code. |

### 3.3 Idempotency Header
Every dispatch sets the `Idempotency-Key` HTTP header to the SocialEngage `outboundActivityId`. This guarantees that in the event of a transient network timeout or gateway retry, the Mastodon instance will never duplicate the status.

### 3.4 Success Response & Permalinks
A successful status creation returns HTTP `200 OK` or `201 Created`:

```json
{
  "id": "112345678901234567",
  "created_at": "2026-09-04T16:00:00.000Z",
  "url": "https://mastodon.social/@user/112345678901234567",
  "uri": "https://mastodon.social/users/user/statuses/112345678901234567",
  "content": "<p>Check out our latest open-source telemetry engine! <a href=\"https://example.com/telemetry\">https://example.com/telemetry</a></p>",
  "visibility": "public"
}
```

The connector maps this into the standard SocialEngage publish result:
- `externalId = response.id`
- `externalUrl = response.url` (or fallback to `response.uri`)

---

## 4. Text Validation & Character Counting Rules

### 4.1 Counting Algorithm Alignment
Mastodon character counting uses the official Mastodon URL-weighting specification, implemented in [`social-listening-admin/src/components/composer/lib/counting.ts`](file:///c:/Users/MennoDrescher/source/repos/socialengage/social-listening-admin/src/components/composer/lib/counting.ts#L29-L43):
- **Base Text:** NFC-normalized character length (`Array.from(normalized).length`).
- **URL Weight:** Every URL matching `URL_PATTERN` counts as exactly **23 characters**, regardless of its actual character count.
- **Combined Length:**
  $$\text{Length} = \text{NonURLCharacters} + (N_{\text{URLs}} \times 23)$$
- **Default Limit:** 500 characters.

### 4.2 Content Warning (`spoiler_text`) Considerations
When a user sets a Content Warning via `perPlatformOverrides.mastodon_cw`:
- The character count of `spoiler_text` is added to the total character count on standard Mastodon instances.
- The backend validator rejects posts where:
  $$\text{Length}(\text{status}) + \text{Length}(\text{spoiler\_text}) > \text{max\_characters}$$

---

## 5. Rate Limiting & RequestGate Configuration

### 5.1 Instance Rate Limits
Standard Mastodon instances enforce rate limits via NGINX or Rack::Attack:
- **Default Limit:** **300 requests per 5-minute rolling window** per authenticated user.
- **Rate Limit Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed in the window (e.g. `300`).
  - `X-RateLimit-Remaining`: Number of requests remaining.
  - `X-RateLimit-Reset`: ISO 8601 or UNIX timestamp when the window resets.

### 5.2 RequestGate Declaration
Per [ADR-0075](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0075-outbound-social-post-publishing.md) and [ADR-0020](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md), the Mastodon connector declares:

```typescript
getOutboundRateLimitConfig: (): RateLimitConfig => ({
  requestsPerWindow: 300,
  windowSeconds: 5 * 60, // 300 seconds
}),
```

This ensures that `acquireForOutboundPost(tenantId, mastodonConnector)` throttles outgoing calls under:
$$\text{GateKey} = (\text{tenantId}, \text{'mastodon'}, \text{'outbound\_post'})$$

---

## 6. Error Classification & Resilience

The connector maps HTTP response status codes and Mastodon API error payloads into SocialEngage's [`ClassifiableError`](file:///c:/Users/MennoDrescher/source/repos/socialengage/social-listening-core/src/ingestion/errorClassification.ts):

| HTTP Status | Platform Code / Message | ErrorKind | Severity / Action |
|---|---|---|---|
| `401 Unauthorized` | `The access token is invalid` | `http_401` | Terminal: Credential revoked or expired. Triggers auto-disable warning. |
| `403 Forbidden` | `This action is outside authorized scopes` | `http_403` | Terminal: Missing `write:statuses` scope. Prompt user to re-authorize. |
| `422 Unprocessable` | `Validation failed: Text is too long` | `missing_permission` | Terminal: Post exceeds instance character limit or contains banned phrase. |
| `429 Too Many Requests` | `Throttled` | `rate_limit` | Transient: RequestGate will queue with exponential backoff until `X-RateLimit-Reset`. |
| `502 / 503 / 504` | Gateway / Bad Gateway | `http_5xx` | Transient: Federation lag or instance maintenance. Retryable. |
| `ENOTFOUND / ETIMEDOUT`| DNS / Connection timeout | `network` | Transient: Instance offline or unreachable. |

---

## 7. Connector Implementation Blueprint

### 7.1 Directory & File Layout
Following [ADR-0048](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md), all connector code is strictly isolated inside `social-listening-core/src/connectors/mastodon/`:

```
social-listening-core/src/connectors/mastodon/
├── mastodonConnector.ts      # SocialConnector implementation
├── mastodonClient.ts         # HTTP client handling instance routing & Idempotency-Key
├── mastodonTypes.ts          # Request/Response DTOs & Credential parser
├── mastodonFormatter.ts      # URL weighting & CW override resolution
└── index.ts                  # Public exports
```

### 7.2 Implementation Code Outline

```typescript
// social-listening-core/src/connectors/mastodon/mastodonConnector.ts

import { SocialConnector, OutboundPostPayload, RateLimitConfig } from '../types';
import { parseMastodonCredential, postMastodonStatus } from './mastodonClient';
import { formatMastodonPayload } from './mastodonFormatter';

export const MASTODON_PROVIDER_ID = 'mastodon';

export const mastodonConnector: SocialConnector = {
  providerId: MASTODON_PROVIDER_ID,
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 300,
    windowSeconds: 300,
  }),

  getOutboundRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 300,
    windowSeconds: 300,
  }),

  async targetAssets(tenantId: string, userId: string, credential: string) {
    const cred = parseMastodonCredential(credential);
    return [{ id: cred.accountId, type: 'mastodon_account', name: cred.username }];
  },

  async publish(tenantId: string, userId: string, payload: OutboundPostPayload, credential: string) {
    const cred = parseMastodonCredential(credential);
    const formatted = formatMastodonPayload(payload);
    
    const result = await postMastodonStatus(cred, formatted);
    return {
      externalId: result.id,
      externalUrl: result.url || result.uri,
    };
  },

  normalize: (rawItem: unknown) => {
    // Normalization logic for ingested statuses
    throw new Error('Mastodon polling is deferred to follow-up story');
  }
};
```

---

## 8. Contract Test Suite Plan

The contract test suite will be implemented in `social-listening-core/contracts/epic-14/story-14.1.mastodon-publishing.contract.test.ts` verifying:
1. **Contract Registration:** Verifies `getSocialConnector('mastodon')` is registered and exports `publish`.
2. **Payload Formatting:** Asserts that URL length is weighted at 23 characters and Content Warnings map to `spoiler_text`.
3. **Idempotency Header:** Asserts that `Idempotency-Key` is sent matching the activity ID.
4. **Rate Limit Gating:** Asserts that calls acquire the gate key `(${tenantId}:mastodon:outbound_post)`.
5. **Error Classification:** Asserts that 401 maps to `http_401` and 429 maps to `rate_limit`.
