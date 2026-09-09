# Platform Library Specification: X (Twitter) API v2 Outbound Publishing

**Platform ID:** `twitter`  
**Display Name:** X (formerly Twitter) — X API v2  
**Build Sequence:** Step 5 of 5 (Wave 2)  
**Governing Architecture Decision:** [ADR-0118: Additional Social Platform Publishing](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md)  
**Foundational Specifications:** [ADR-0075: Outbound Social Post Publishing](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0075-outbound-social-post-publishing.md) & [ADR-0027: Connector Is Technical Intermediary](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0027-connector-is-technical-intermediary-not-contracting-party.md)  
**Source Story:** [Story 14.1 (ADR-0118)](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/user-stories/epic-14-adr-0118-to-0122.md#L7-L27)  

---

## 1. Architectural Overview & Critical Economic Gate

X (Twitter) exposes outbound posting via **X API v2** (`POST https://api.twitter.com/2/tweets`). While technically straightforward, X is scheduled as the **final platform** in Wave 2 due to restrictive developer pricing and severe commercial paywalls.

### 1.1 The Mandatory Economic Viability Gate
Per [ADR-0118 Decision §1 and Consequences](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0118-additional-social-platform-publishing.md#L41-L43):
> *"X/Twitter — last, due to cost and review barriers; explicit re-evaluation before building."*

#### API Tier Pricing Breakdown (Current X Developer Platform):
- **Free Tier:** Limited to **1,500 Tweet writes per month at the application level** across all users. This equates to ~50 tweets per day for the entire SocialEngage platform, making multi-tenant production unviable under a shared app key.
- **Basic Tier ($100 / month):** Permits **10,000 Tweet writes per month** at the app level.
- **Pro Tier ($5,000 / month):** Permits **1,000,000 Tweet writes per month**.

#### Alignment with [ADR-0027](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0027-connector-is-technical-intermediary-not-contracting-party.md) (Technical Intermediary):
SocialEngage operates strictly as software, not an aggregator absorbing external platform costs on behalf of users. To enable X publishing cleanly without imposing cost liability on the platform operator, implementation requires:
1. **Bring Your Own Developer App (BYODA):** The tenant/user provides their own X Developer App Client ID and Secret, ensuring they pay X directly according to their usage.
2. **Alternative:** Tenant-level enterprise add-on billing verifying the tenant has subscribed to a dedicated publishing tier.

---

## 2. Authentication & Credential Architecture

### 2.1 OAuth 2.0 with PKCE Flow
X API v2 requires OAuth 2.0 User Context with Proof Key for Code Exchange (PKCE):
1. **Authorization URL:** `https://twitter.com/i/oauth2/authorize` with `code_challenge`, `code_challenge_method=S256`.
2. **Token Exchange:** `POST https://api.twitter.com/2/oauth2/token` returning short-lived `access_token` and `refresh_token`.
3. **Token Refresh:** Automatic renewal via `grant_type=refresh_token`.

### 2.2 Tier-3 Credential Structure
Stored in `platform_credentials` as an envelope-encrypted JSON string ([ADR-0014](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md), [ADR-0028](file:///c:/Users/MennoDrescher/source/repos/socialengage/docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md)):

```typescript
export interface TwitterCredential {
  /** User's Twitter User ID (e.g. '2244994945') */
  twitterUserId: string;
  /** Public Twitter screen name / handle (e.g. 'SocialEngageApp') */
  screenName: string;
  /** OAuth 2.0 Bearer Access Token */
  accessToken: string;
  /** OAuth 2.0 Refresh Token */
  refreshToken: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt: string;
  /** Optional custom developer app credentials if using BYODA model */
  customClientId?: string;
  customClientSecret?: string;
}
```

### 2.3 Required OAuth 2.0 Scopes
- `tweet.read`: Read user profile and tweet metadata.
- `tweet.write`: Create and delete tweets on behalf of the user.
- `users.read`: Retrieve user profile details (`GET /2/users/me`).
- `offline.access`: Receive a refresh token that does not expire after 2 hours.

---

## 3. Outbound Publishing API Contract

### 3.1 Endpoint Specification
Creating a post uses X API v2:

```http
POST https://api.twitter.com/2/tweets
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### 3.2 Request Payload Schema

```json
{
  "text": "Empowering organizations with governed adaptability loops! Read our latest release notes: https://example.com/notes",
  "reply_settings": "everyone"
}
```

| Field | Type | Description |
|---|---|---|
| `text` | string | Post text (max 280 weighted characters). |
| `reply_settings` | enum (optional) | `'everyone'`, `'mentionedUsers'`, or `'following'`. Default: `'everyone'`. |
| `in_reply_to_tweet_id` | string (optional) | Target tweet ID when executing a threaded reply (ADR-0073). |
| `quote_tweet_id` | string (optional) | Tweet ID being quote-tweeted. |

### 3.3 Link Card & OpenGraph Behavior
Unlike Bluesky, X automatically crawls URLs embedded in the `text` string and generates a **Twitter Card** (Summary or Summary with Large Image) based on the target website's `<meta name="twitter:card">` and OpenGraph tags.

### 3.4 Success Response & Permalinks
A successful tweet creation returns HTTP `201 Created`:

```json
{
  "data": {
    "id": "1831234567890123456",
    "text": "Empowering organizations with governed adaptability loops! Read our latest release notes: https://example.com/notes"
  }
}
```

The connector maps this into the SocialEngage publish result:
- `externalId = response.data.id`
- `externalUrl = https://x.com/${credential.screenName}/status/${response.data.id}`

---

## 4. Text Validation & Character Counting Rules

### 4.1 Weighted Character Counting Algorithm
X enforces a **280 weighted character limit**. Character weighting follows the Twitter text specification, implemented in [`social-listening-admin/src/components/composer/lib/counting.ts`](file:///c:/Users/MennoDrescher/source/repos/socialengage/social-listening-admin/src/components/composer/lib/counting.ts#L57-L89):

1. **URLs:** Any URL matching `URL_PATTERN` counts as **exactly 23 characters**, regardless of whether the URL is 10 characters or 120 characters long.
2. **Latin / ASCII Characters:** Standard Latin alphanumeric characters and punctuation count as **1 weight**.
3. **CJK, Arabic, Cyrillic, & Emojis:** Characters outside basic Latin ranges count as **2 weights**.

$$\text{Weight} = \sum_{\text{chars}} \text{Weight}(c) + (N_{\text{URLs}} \times 23) \le 280$$

Posts exceeding 280 weighted units are rejected client-side in the composer and server-side in the connector before dispatch.

---

## 5. Rate Limiting & RequestGate Configuration

### 5.1 Platform Rate Limits
- **User-Level Cap:** **200 tweets per 15-minute rolling window** per authenticated user.
- **Application-Level Cap (Basic Tier):** 10,000 tweets per month.
- **Rate Limit Headers:**
  - `x-rate-limit-limit`: Maximum calls permitted in the 15-minute window.
  - `x-rate-limit-remaining`: Remaining calls in the current window.
  - `x-rate-limit-reset`: UNIX epoch timestamp of window reset.

### 5.2 RequestGate Declaration
The X connector declares:

```typescript
getOutboundRateLimitConfig: (): RateLimitConfig => ({
  requestsPerWindow: 50,
  windowSeconds: 15 * 60, // 15 minutes (900 seconds)
}),
```

Gated under:
$$\text{GateKey} = (\text{tenantId}, \text{'twitter'}, \text{'outbound\_post'})$$

---

## 6. Error Classification & Resilience

| HTTP Status | Error Detail | ErrorKind | Severity / Action |
|---|---|---|---|
| `400 Bad Request` | `Duplicate content: Status is a duplicate` | `missing_permission` | Terminal: X rejects identical tweets posted within a short interval. |
| `401 Unauthorized` | `Unauthorized: Token invalid or expired` | `http_401` | Transient: Trigger OAuth 2.0 refresh token rotation. If refresh fails, mark terminal. |
| `403 Forbidden` | `UsageCapExceeded: Monthly tier limit reached` | `rate_limit` | Terminal: App-level monthly write cap exhausted. Requires tier upgrade or BYODA. |
| `429 Too Many Requests` | `Rate limit exceeded` | `rate_limit` | Transient: User hit the 15-minute window. Wait until `x-rate-limit-reset`. |
| `500 / 503` | `InternalServerError` | `http_5xx` | Transient: X server disruption. Retryable. |

---

## 7. Connector Implementation Blueprint

### 7.1 Directory Layout
Isolated under `social-listening-core/src/connectors/twitter/`:

```
social-listening-core/src/connectors/twitter/
├── twitterConnector.ts        # SocialConnector implementation
├── twitterClient.ts           # X API v2 HTTP client with token refresh
├── twitterTypes.ts            # API v2 schemas & Credential definitions
├── twitterWeightCalculator.ts # 280-weighted character counting validator
└── index.ts                   # Public exports
```

### 7.2 Implementation Code Outline

```typescript
// social-listening-core/src/connectors/twitter/twitterConnector.ts

import { SocialConnector, OutboundPostPayload, RateLimitConfig } from '../types';
import { parseTwitterCredential, postTweetToXApi } from './twitterClient';
import { validateTwitterWeight } from './twitterWeightCalculator';

export const TWITTER_PROVIDER_ID = 'twitter';

export const twitterConnector: SocialConnector = {
  providerId: TWITTER_PROVIDER_ID,
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 50,
    windowSeconds: 900,
  }),

  getOutboundRateLimitConfig: (): RateLimitConfig => ({
    requestsPerWindow: 50,
    windowSeconds: 900,
  }),

  async targetAssets(tenantId: string, userId: string, credential: string) {
    const cred = parseTwitterCredential(credential);
    return [{ id: cred.twitterUserId, type: 'twitter_user', name: `@${cred.screenName}` }];
  },

  async publish(tenantId: string, userId: string, payload: OutboundPostPayload, credential: string) {
    const cred = parseTwitterCredential(credential);
    validateTwitterWeight(payload.text);

    const result = await postTweetToXApi(cred, {
      text: payload.text,
      replySettings: 'everyone',
    });

    return {
      externalId: result.data.id,
      externalUrl: `https://x.com/${cred.screenName}/status/${result.data.id}`,
    };
  },

  normalize: (rawItem: unknown) => {
    throw new Error('Twitter polling is deferred to follow-up story');
  }
};
```

---

## 8. Contract Test Suite Plan

The contract test suite (`social-listening-core/contracts/epic-14/story-14.1.x-twitter-publishing.contract.test.ts`) verifies:
1. **Contract Registration:** Verifies `getSocialConnector('twitter')` is registered and exports `publish`.
2. **Weighted Character Validation:** Asserts that 280-character text with mixed CJK/Latin/URLs correctly validates or rejects.
3. **OAuth 2.0 Bearer Authorization:** Asserts that HTTP requests include `Authorization: Bearer <accessToken>`.
4. **Rate Limit Gating:** Asserts calls acquire the gate key `(${tenantId}:twitter:outbound_post)` with a 15-minute window.
5. **Economic Cap Handling:** Asserts that `UsageCapExceeded` errors map to `rate_limit`.
