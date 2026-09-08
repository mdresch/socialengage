# Platform Library Specification: Bluesky Outbound Publishing

**Platform ID:** `bluesky`  
**Display Name:** Bluesky (AT Protocol Network)  
**Build Sequence:** Step 2 of 5 (Wave 2)  
**Governing Architecture Decision:** [ADR-0118: Additional Social Platform Publishing](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md)  
**Source Story:** [Story 14.1 (ADR-0118)](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/user-stories/epic-14-adr-0118-to-0122.md#L7-L27)  

---

## 1. Architectural Overview & Context

Bluesky is an open social network built on the **AT Protocol (Authenticated Transfer Protocol)**, a decentralized specification for large-scale social applications. Content in the AT Protocol is organized as cryptographic records stored in repositories owned by Decentralized Identifiers (DIDs), hosted by Personal Data Servers (PDSs).

Per [ADR-0118 Decision §1](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md#L33-L43), Bluesky follows Mastodon as the second platform to be built because:
1. **Open Ecosystem:** Requires no business verification or partner application approvals.
2. **Accessible Authentication:** Supports App Passwords, allowing instant, self-service user onboarding without complex enterprise OAuth approval workflows.
3. **Modern Publishing Architecture:** Leverages strongly-typed Lexicon schemas (`app.bsky.feed.post`) and XRPC endpoints.

---

## 2. AT Protocol Architecture & Credential Model

### 2.1 AT Protocol Identity & PDS Resolution
In the AT Protocol:
- A user's public handle (e.g., `alice.bsky.social`) resolves to a persistent Decentralized Identifier (e.g., `did:plc:z72i7hdynmk6r22z27h6tvur`).
- The user's account repository is hosted on a PDS (default: `https://bsky.social`).
- Authenticated requests are executed over **XRPC** (a lightweight RPC protocol over HTTP POST/GET).

### 2.2 Tier-3 Credential Structure
Bluesky authentication is user-bound (Tier-3 per [ADR-0028](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md)). Stored in `platform_credentials` as an envelope-encrypted JSON string ([ADR-0014](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md)):

```typescript
export interface BlueskyCredential {
  /** User's handle (e.g. 'brand.bsky.social') */
  identifier: string;
  /** App Password generated in Bluesky Settings -> App Passwords */
  appPassword: string;
  /** Resolved DID (e.g. 'did:plc:...') */
  did: string;
  /** PDS Service URL (defaults to 'https://bsky.social') */
  pdsUrl: string;
  /** Cached session access token (JWT) */
  accessJwt?: string;
  /** Session refresh token (JWT) */
  refreshJwt?: string;
  /** Expiration timestamp for accessJwt */
  expiresAt?: string;
}
```

### 2.3 Session Initialization & Token Refresh
Before publishing, the connector ensures an active XRPC session using `com.atproto.server.createSession`:

```http
POST {pdsUrl}/xrpc/com.atproto.server.createSession
Content-Type: application/json

{
  "identifier": "brand.bsky.social",
  "password": "xxxx-xxxx-xxxx-xxxx"
}
```

Response:
```json
{
  "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
  "handle": "brand.bsky.social",
  "accessJwt": "eyJhbGciOi...",
  "refreshJwt": "eyJhbGciOi..."
}
```

---

## 3. Outbound Publishing API Contract

### 3.1 Endpoint Specification
Creating a post on Bluesky writes a record to the user's repository via the XRPC procedure:

```http
POST {pdsUrl}/xrpc/com.atproto.repo.createRecord
Authorization: Bearer {accessJwt}
Content-Type: application/json
```

### 3.2 Request Payload Schema (`app.bsky.feed.post`)

```json
{
  "repo": "did:plc:z72i7hdynmk6r22z27h6tvur",
  "collection": "app.bsky.feed.post",
  "record": {
    "$type": "app.bsky.feed.post",
    "text": "Introducing our new live analytics dashboard! Read more at https://example.com/blog",
    "createdAt": "2026-09-04T16:00:00.000Z",
    "facets": [
      {
        "index": {
          "byteStart": 57,
          "byteEnd": 83
        },
        "features": [
          {
            "$type": "app.bsky.richtext.facet#link",
            "uri": "https://example.com/blog"
          }
        ]
      }
    ],
    "embed": {
      "$type": "app.bsky.embed.external",
      "external": {
        "uri": "https://example.com/blog",
        "title": "Live Analytics Dashboard",
        "description": "High-velocity real-time social metrics."
      }
    }
  }
}
```

### 3.3 Success Response & Permalinks
A successful record creation returns:

```json
{
  "uri": "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kabc123def45",
  "cid": "bafyreihdwdcefghij..."
}
```

The connector maps this into the SocialEngage result:
- `externalId = response.uri` (the canonical AT-URI)
- `externalUrl`: Formatted for web viewing on the official Bluesky client:
  ```typescript
  const rkey = response.uri.split('/').pop();
  const externalUrl = `https://bsky.app/profile/${credential.identifier}/post/${rkey}`;
  ```

---

## 4. Rich Text, Graphemes, and Facet Calculation

### 4.1 Unicode Grapheme Limit (300 Graphemes)
Bluesky strictly enforces a **300-grapheme limit** per post.
- Measured via `Intl.Segmenter(undefined, { granularity: 'grapheme' })`.
- Implemented in [`social-listening-admin/src/components/composer/lib/counting.ts`](file:///c:/Users/MennoDrescher/source/repos/socialengage/social-listening-admin/src/components/composer/lib/counting.ts#L45-L55).
- Multi-byte characters (emojis, accented glyphs, combining marks) count as **one grapheme**, whereas JavaScript string `.length` would count them as 2 or more.

### 4.2 Critical Requirement: UTF-8 Byte-Offset Facets
In the AT Protocol, **links, mentions, and hashtags are NOT automatically parsed from plain text by the server.**
If a client posts text containing a URL without attaching a facet, the text appears as static, non-clickable characters.

Furthermore, facet offsets (`byteStart`, `byteEnd`) are **UTF-8 encoded byte indices**, NOT JavaScript UTF-16 character indices:

```typescript
// social-listening-core/src/connectors/bluesky/blueskyFacets.ts

export interface RichTextFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; uri?: string; did?: string; tag?: string }>;
}

export function calculateFacets(text: string): RichTextFacet[] {
  const encoder = new TextEncoder();
  const facets: RichTextFacet[] = [];
  
  // URL detection regex
  const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gu;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const prefix = text.slice(0, match.index);
    const byteStart = encoder.encode(prefix).byteLength;
    const byteLength = encoder.encode(url).byteLength;

    facets.push({
      index: {
        byteStart,
        byteEnd: byteStart + byteLength,
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: url,
        },
      ],
    });
  }

  return facets;
}
```

---

## 5. Rate Limiting & RequestGate Configuration

### 5.1 AT Protocol Rate Limits
The Bluesky PDS enforces point-based rate limits:
- **General Points:** 5,000 points per hour per IP / user.
- **Post Creations:** Maximum 1,666 posts per rolling 24-hour window (~69 posts per hour).
- **Burst Ceiling:** Maximum 30 post creations per 5-minute burst.

### 5.2 RequestGate Declaration
Per [ADR-0075](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0075-outbound-social-post-publishing.md) and [ADR-0020](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md), the Bluesky connector declares a conservative outbound rate-limit:

```typescript
getOutboundRateLimitConfig: (): RateLimitConfig => ({
  requestsPerWindow: 30,
  windowSeconds: 5 * 60, // 300 seconds
}),
```

Gated under:
$$\text{GateKey} = (\text{tenantId}, \text{'bluesky'}, \text{'outbound\_post'})$$

---

## 6. Error Classification & Resilience

| HTTP Status | XRPC Error Code | ErrorKind | Severity / Action |
|---|---|---|---|
| `400 Bad Request` | `InvalidRequest` | `missing_permission` | Terminal: Payload exceeds 300 graphemes or facet byte offsets are misaligned. |
| `401 Unauthorized` | `AuthenticationRequired` / `ExpiredToken` | `http_401` | Transient/Recoverable: Token expired. Trigger `createSession` refresh. If refresh fails, mark terminal. |
| `403 Forbidden` | `AccountTakedown` / `AccountDeactivated` | `http_403` | Terminal: Account suspended or deactivated. |
| `429 Too Many Requests` | `RateLimitExceeded` | `rate_limit` | Transient: Queue request and respect `Retry-After` header. |
| `500 / 502 / 503` | Internal Server Error | `http_5xx` | Transient: PDS service disruption or relay lag. |

---

## 7. Connector Implementation Blueprint

### 7.1 Directory & File Layout
Following [ADR-0048](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md), all connector code is strictly isolated inside `social-listening-core/src/connectors/bluesky/`:

```
social-listening-core/src/connectors/bluesky/
├── blueskyConnector.ts      # SocialConnector implementation
├── blueskyClient.ts         # XRPC client handling session auth & createRecord
├── blueskyTypes.ts          # Lexicon schemas & Credential definitions
├── blueskyFacets.ts         # UTF-8 byte-offset calculation for links & mentions
└── index.ts                 # Public exports
```

### 7.2 Implementation Code Outline

```typescript
// social-listening-core/src/connectors/bluesky/blueskyConnector.ts

import { SocialConnector, OutboundPostPayload, RateLimitConfig } from '../types';
import { parseBlueskyCredential, createBlueskyRecord } from './blueskyClient';
import { calculateFacets } from './blueskyFacets';

export const BLUESKY_PROVIDER_ID = 'bluesky';

export const blueskyConnector: SocialConnector = {
  providerId: BLUESKY_PROVIDER_ID,
  authMode: 'api_key',
  deliveryMode: 'poll',

  getRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 30,
    windowSeconds: 300,
  }),

  getOutboundRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 30,
    windowSeconds: 300,
  }),

  async targetAssets(tenantId: string, userId: string, credential: string) {
    const cred = parseBlueskyCredential(credential);
    return [{ id: cred.did, type: 'bluesky_profile', name: cred.identifier }];
  },

  async publish(tenantId: string, userId: string, payload: OutboundPostPayload, credential: string) {
    const cred = parseBlueskyCredential(credential);
    const facets = calculateFacets(payload.text);

    const record = {
      $type: 'app.bsky.feed.post',
      text: payload.text,
      createdAt: new Date().toISOString(),
      ...(facets.length > 0 ? { facets } : {}),
      ...(payload.linkPreview ? { embed: formatLinkEmbed(payload.linkPreview) } : {}),
    };

    const result = await createBlueskyRecord(cred, 'app.bsky.feed.post', record);
    const rkey = result.uri.split('/').pop();
    
    return {
      externalId: result.uri,
      externalUrl: `https://bsky.app/profile/${cred.identifier}/post/${rkey}`,
    };
  },

  normalize: (rawItem: unknown) => {
    throw new Error('Bluesky polling is deferred to follow-up story');
  }
};
```

---

## 8. Contract Test Suite Plan

The contract test suite (`social-listening-core/contracts/epic-14/story-14.1.bluesky-publishing.contract.test.ts`) verifies:
1. **Contract Registration:** Verifies `getSocialConnector('bluesky')` is registered and exports `publish`.
2. **UTF-8 Byte Facet Calculation:** Asserts that emoji-prefixed strings calculate exact UTF-8 byte offsets (preventing misaligned link highlights).
3. **External Link Embeds:** Asserts that OpenGraph link card data maps to `app.bsky.embed.external`.
4. **Rate Limit Gating:** Asserts calls acquire the gate key `(${tenantId}:bluesky:outbound_post)`.
5. **Grapheme Rejection:** Asserts that posts exceeding 300 graphemes fail fast before API dispatch.
