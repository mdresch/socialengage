# ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI

**Status:** Accepted (2026-08-20)

**Accepted by Menno 2026-08-20.** Authorizes human-in-the-loop post enrichment overrides and the cascading drawer UI on the Posts page, incorporating the backend re-enrichment precedence guard (`409 Conflict` unless `force: true`), `overriddenFields[]` tracking, AI history preservation, cross-field geo/language validation, key-phrase sanitization constraints, and comprehensive drawer accessibility (a11y) standards.

**Source:** Requested by Menno (2026-08-20): *"On the Posts page can select one post and it opens the Post Details Drawer on the right of the screen. The post details drawer displays the post title, details and the card with enrichment data. Could you add a icon button on the enrichment data card that will open a new drawer pushing the current post details to the left and opening a Enrichment Details page allowing the user to edit the enrichment details as they are populated and overwrite the sentiment from one to another for example from Sentiment Neutral to Positive Sentiment. All the enriched post details should be editable in the drawers details. This will allow the end user to always be able to overwrite an AI generated enhanced post and will allow the user to always change any of the data enrichments points in each post."*

---

## Context

### 1. AI Enrichment Immutability Gap

The platform currently enriches ingested posts via Azure AI Language (ADR-0038) and Azure OpenAI LLM pipelines, extracting:
- **Sentiment classification** (`positive`, `neutral`, `negative` with confidence score)
- **Key phrases** (`keyPhrases: string[]`)
- **Detected language** (`detectedLanguage: string` per ADR-0055)
- **Geospatial origin** (`geoCountry`, `geoCountryName` per ADR-0064)
- **Grounding summary** (`groundingContext` / `summary` per ADR-0065)

These fields are persisted in PostgreSQL within the `social_posts.enrichment` `JSONB` column. 

However, AI sentiment and key-phrase extractors are inherently heuristic. In real-world social listening, automated models frequently misclassify sarcasm, industry-specific jargon, brand-specific sentiment, or regional dialects. Currently, post enrichment is strictly **immutable** once written. There is no API endpoint or user interface mechanism for a tenant analyst or administrator to correct an inaccurate sentiment classification or refine extracted key phrases.

### 2. Downstream Impact on Analytics and Reporting

Because executive dashboards (Overview tab, Sentiment gauge, Crisis Alert Radar, Topic Watchlist Coverage, and Location Insights) derive their aggregations directly from `social_posts.enrichment`, uncorrectable AI misclassifications skew tenant sentiment metrics, alert thresholds, and reporting accuracy without recourse.

### 3. User Experience on the Posts Feed (`/tenant/posts`)

Selecting a post on `/tenant/posts` currently opens a slideover drawer (`PostDetailPanel.tsx`) on the right side of the screen displaying the post body, metadata, and the AI Enrichment card. To enable frictionless review and correction without losing context, users need a seamless way to edit enrichment details side-by-side with the original post content.

---

## Decision

### 1. In-Place Enrichment Override Schema with Audit & AI History

When a user modifies enrichment fields, the top-level values in `social_posts.enrichment` (`JSONB`) are updated directly in-place, while preserving the original AI-generated values, tracking the specific overridden fields, and recording full audit metadata in a dedicated `override` sub-object:

```json
{
  "sentiment": "positive",
  "sentimentScore": 0.8,
  "keyPhrases": ["product launch", "market expansion"],
  "detectedLanguage": "en",
  "geoCountry": "US",
  "geoCountryName": "United States",
  "summary": "Positive analyst assessment of US market launch",
  "override": {
    "isOverridden": true,
    "overriddenAt": "2026-08-20T18:25:00.000Z",
    "overriddenByUserId": "usr_789abc",
    "overriddenFields": ["sentiment", "keyPhrases", "summary"],
    "originalValues": {
      "sentiment": "neutral",
      "sentimentScore": 0.52,
      "keyPhrases": ["product launch"],
      "detectedLanguage": "en",
      "geoCountry": "US",
      "geoCountryName": "United States",
      "summary": "Automated summary of market release"
    },
    "aiHistory": [
      {
        "generatedAt": "2026-08-20T17:00:00.000Z",
        "model": "azure-ai-language",
        "values": {
          "sentiment": "neutral",
          "sentimentScore": 0.52,
          "keyPhrases": ["product launch"],
          "detectedLanguage": "en"
        }
      }
    ]
  }
}
```

**Architectural Rationale:**
- **Zero Schema Migration:** Leveraging the existing `JSONB` column eliminates database schema migrations and avoids table locks.
- **Immediate Analytics Parity:** Because all analytics aggregation pipelines (`computeSentimentSplit()`, `computeSentimentIndex()`, `computeCountryBreakdown()`, `computePhraseFrequency()`) query top-level `enrichment.*` fields directly, human corrections are **instantly reflected** across the entire analytics dashboard and filter models without requiring schema rewrites or custom aggregation predicates.
- **Selective Overridden Field Tracking (`overriddenFields`):** Storing `overriddenFields: string[]` makes rendering the "Edited by user" badges fast and precise, and enables future reporting on human-corrected volume by dimension.
- **Preserved AI Lineage (`aiHistory`):** Appending previous AI generation passes into `aiHistory[]` ensures that even across forced re-enrichment cycles, the initial automated baseline is never permanently erased.

---

### 2. Backend REST API Surface & Re-Enrichment Precedence Guard (`social-listening-core`)

#### A. Post Enrichment Override Endpoint (`PATCH /v1/posts/:id/enrichment`)

A dedicated REST endpoint is added to `postsRouter.ts`:

- **Route:** `PATCH /v1/posts/:id/enrichment`
- **Authentication & Authorization:** Gated behind tenant RLS context and bearer token. Authorized for both `tenant_user` and `tenant_admin` roles. The caller's user ID from `req.identity.userId` is recorded as `overriddenByUserId`.
- **Request Payload:**
```ts
export interface UpdatePostEnrichmentRequest {
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  keyPhrases?: string[];
  detectedLanguage?: string | null;
  geoCountry?: string | null;
  geoCountryName?: string | null;
  summary?: string | null;
}
```

- **Strict Validation & Normalization Rules:**
  - **Sentiment & Score Consistency:**
    - `sentiment`: must be one of `'positive'`, `'neutral'`, `'negative'` if supplied.
    - `sentimentScore`: optional float clamped to `0.0..1.0`. If omitted when `sentiment` is changed, the backend auto-assigns a consistent default (`positive` → `0.8`, `neutral` → `0.5`, `negative` → `0.2`) to prevent data inconsistency with old neutral scores.
  - **Key Phrases Sanitization:**
    - Allowed to be empty array `[]` (if the user clears all phrases).
    - Max 50 phrases, max 200 characters per phrase.
    - Strips HTML tags, trims leading/trailing whitespace, discards blank strings, and deduplicates case-insensitively while preserving the entered casing of the first instance.
  - **Language Code Validation:**
    - `detectedLanguage`: validated against an ISO 639-1 two-letter lowercase allowlist or `null` (e.g. `'en'`, `'nl'`, `'de'`). Malformed values (such as `'eng'`) return `400 Bad Request`.
  - **Cross-Field Geospatial Validation:**
    - If `geoCountry` is `null`, `geoCountryName` is automatically cleared to `null`.
    - If `geoCountry` is provided, it is validated and normalized to uppercase ISO 3166-1 alpha-2 (e.g. `'us'` → `'US'`), and `geoCountryName` is validated or derived (e.g. `'United States'`). Inconsistent states (e.g. `geoCountry: 'US'`, `geoCountryName: null`) are normalized automatically.
  - **Summary / Grounding Notes:**
    - `summary`: string up to 1,000 characters (or `null`), mapped to `enrichment.summary` and `enrichment.groundingContext`.
- **Response:** Returns the full updated `SocialPostSummary` with HTTP `200 OK`. Returns `404 Not Found` if the post does not exist or belongs to another tenant.

#### B. Re-Enrichment Precedence Guard (`POST /v1/posts/:id/enrich` & Background Schedulers)

To prevent automated or scheduled AI pipelines from silently obliterating human edits:

1. **Precedence Check:** Any operation that regenerates post enrichment (whether the on-demand `POST /v1/posts/:id/enrich` endpoint or an automated background re-enricher) must inspect `enrichment->'override'->>'isOverridden'`.
2. **Conflict Prevention (`409 Conflict`):**
   - If `isOverridden === true` and `force !== true`: the backend **aborts the re-enrichment** and returns HTTP `409 Conflict` with the override metadata:
     ```json
     {
       "error": "Post enrichment has been manually overridden by a user",
       "code": "ENRICHMENT_MANUALLY_OVERRIDDEN",
       "override": {
         "overriddenAt": "2026-08-20T18:25:00.000Z",
         "overriddenByUserId": "usr_789abc",
         "overriddenFields": ["sentiment", "keyPhrases"]
       }
     }
     ```
3. **Explicit Force Overwrite (`force: true`):**
   - Only when the request explicitly passes `force: true` will the backend overwrite the active top-level fields with new AI predictions.
   - On force re-run: the backend archives the previous AI values into `override.aiHistory[]`, updates `override.originalValues` to the new AI output, and resets `override.isOverridden = false`.

---

### 3. Cascading Dual-Drawer UI Interaction & Accessibility (`social-listening-admin`)

A multi-drawer cascading interaction is introduced on the Posts Feed screen (`/tenant/posts`):

```
+-------------------------------------------------------------------------------+
| Posts Feed Table / Grid                                                       |
|                               +-----------------------+-----------------------+
|                               | Post Details Drawer   | Enrichment Edit Drawer|
|                               | (Pushed Left)         | (Active Right Edge)   |
|                               |                       |                       |
|                               | Title: "Acme Launch"  | Edit Sentiment:       |
|                               | Body: "..."           | ( ) Pos  (*) Neu ( ) Neg|
|                               |                       |                       |
|                               | [Enrichment Card]     | Key Phrases:          |
|                               | [ Edit Icon Button ]->| [tag] [tag] [+ Add]   |
|                               |                       |                       |
|                               |                       | Country / Language:   |
|                               |                       | [ United States v ]   |
|                               |                       |                       |
|                               |                       | [Save]  [Cancel]      |
+-------------------------------+-----------------------+-----------------------+
```

1. **Edit Action Trigger:** An edit icon button (`aria-label="Edit enrichment details"`, styled with a pencil icon) is placed in the header of the AI Enrichment card within `PostDetailPanel.tsx`.
2. **Cascading Animation & Spatial Layout:**
   - Clicking "Edit" does not replace or dismiss the Post Details drawer.
   - The primary `PostDetailPanel` drawer smoothly translates leftward (`transform: translateX(-420px)` or side-by-side flex layout) while the new **Enrichment Details Drawer** (`EnrichmentEditDrawer.tsx`) slides in flush to the right viewport edge.
   - This maintains the complete reading context of the original post on the left while editing enrichment parameters on the right.
3. **Form Controls:**
   - **Sentiment Toggle:** Interactive segmented buttons for `Positive` (green), `Neutral` (slate), `Negative` (red).
   - **Key Phrases Tag Editor:** Interactive tag list allowing users to remove existing phrases with `×` and input new phrases with an `<input>` tag adder.
   - **Detected Language Selector:** Dropdown selector populated with ISO 639-1 languages.
   - **Country / Region Selector:** Country dropdown supporting ISO 3166-1 alpha-2 selection or clearing to "Unknown".
   - **Summary / Grounding Textarea:** Multi-line text field for custom analyst notes or corrected summary.
4. **Optimistic Updates, Double-Submit Guard, & Error Rollback:**
   - Submitting "Save" immediately applies an optimistic update to the local post state in `PostsFeedClient` and closes the secondary edit drawer.
   - The "Save Changes" button displays a loading spinner and is disabled while the request is in-flight to prevent duplicate submissions.
   - If the `PATCH` request fails, the local state automatically rolls back to previous values and an error toast notification is displayed.
5. **Accessibility (a11y) Standards:**
   - Both drawers implement `role="dialog"`, `aria-modal="true"`, and descriptive `aria-labelledby` headers.
   - Focus is trapped within the currently active (rightmost) drawer.
   - Keyboard Navigation on `Escape`: If the Enrichment Edit drawer is open, pressing `Escape` closes **only** the edit drawer, restores the primary post details drawer position, and returns focus directly to the "Edit enrichment" trigger button.
6. **Responsive Layout Breakpoints:**
   - On large viewports (`>= 1200px`): Full dual-drawer cascading layout is active side-by-side.
   - On compact viewports (`< 1200px`): The Enrichment Edit drawer slides in as a full-width overlay over the post details panel (avoiding awkward cramped stacking), with a back button returning to the post details panel.
7. **Conflict Handling with Manual Re-Enrichment:**
   - If a user clicks `RunEnrichmentButton` on an already-overridden post, the UI displays a confirmation dialog: *"This post contains manual enrichment edits by [User]. Running AI re-enrichment will overwrite these changes. Proceed with forced re-enrichment?"* Confirming triggers `POST /v1/posts/:id/enrich` with `force: true`.

---

## Consequences

### Positive

- **Complete Human-in-the-Loop (HITL) Control:** Eliminates helplessness against AI misclassifications by giving users full editorial authority over every enriched data point.
- **Accurate Analytics & Sentiment Scoring:** Overridden sentiment immediately fixes skewed brand reputation scores and executive KPIs in the Analytics dashboard.
- **Protected User Edits:** The backend precedence guard (`409 Conflict`) strictly guarantees that human edits cannot be silently overwritten by automated re-enrichment jobs.
- **Superior Contextual UX:** The cascading drawer pattern enables analysts to reference long-form post text and quotes while adjusting tags and sentiment side-by-side.
- **Zero Database Migration Overhead:** Schema updates utilize existing `JSONB` structures and standard REST endpoints without table locks.
- **Full Traceability:** Preserves original AI predictions in `override.originalValues` and subsequent runs in `aiHistory[]` for ML quality monitoring and audit trails.

### Negative

- **Client State Synchronization:** Updating a post's enrichment requires synchronizing local state across the active drawer and the posts feed table without requiring a full page refresh.
- **Dual Drawer State Management:** Requires clean coordination of drawer translation states, focus traps, and keyboard event bubbling in the admin UI.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Modal dialog instead of secondary drawer** | Rejected. A modal overlay darkens or obscures the underlying post body, preventing the user from reading the article text while deciding on correct sentiment or key phrases. |
| **Separate database table `post_enrichment_overrides`** | Rejected. Creating a separate table would require JOINs across every analytics query and feed fetch, degrading read performance. In-place `JSONB` updates with an `override` metadata block are cleaner and faster. |
| **Inline editing directly inside PostDetailPanel** | Considered. While compact, inline form controls make the primary view cluttered when reading posts. A dedicated secondary drawer provides ample workspace for tag management, country selection, and notes without compromising read mode. |

---

## Resolved Questions

1. **Role Gating:** Both `tenant_user` and `tenant_admin` roles are authorized to perform enrichment overrides. The acting user's ID is recorded in `override.overriddenByUserId`.
2. **Re-enrichment Conflict Precedence:** Enforced at the backend API layer via `409 Conflict` unless `force: true` is explicitly provided.
3. **Audit Tracking Granularity:** Detailed at the field level via `overriddenFields: string[]`, while preserving prior AI outputs in `aiHistory[]`.

---

*Drafted and Accepted 2026-08-20 with full Menno review recommendations incorporated. Unblocks Human-in-the-Loop post enrichment editing, sentiment correction, and the cascading multi-drawer workflow on the Posts page.*
