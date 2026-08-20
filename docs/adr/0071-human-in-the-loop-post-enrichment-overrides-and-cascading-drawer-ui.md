# ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI

**Status:** Proposed (2026-08-20)

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

### 1. In-Place Enrichment Override Schema with Audit History

When a user modifies enrichment fields, the top-level values in `social_posts.enrichment` (`JSONB`) are updated directly in-place, while preserving the original AI-generated values and recording audit metadata in a dedicated `override` sub-object:

```json
{
  "sentiment": "positive",
  "sentimentScore": 1.0,
  "keyPhrases": ["product launch", "market expansion"],
  "detectedLanguage": "en",
  "geoCountry": "US",
  "geoCountryName": "United States",
  "summary": "Positive feedback regarding regional expansion",
  "override": {
    "isOverridden": true,
    "overriddenAt": "2026-08-20T18:25:00.000Z",
    "overriddenByUserId": "usr_789abc",
    "originalValues": {
      "sentiment": "neutral",
      "sentimentScore": 0.52,
      "keyPhrases": ["product launch"],
      "detectedLanguage": "en",
      "geoCountry": null
    }
  }
}
```

**Architectural Rationale:**
- **Zero Schema Migration:** Leveraging the existing `JSONB` column eliminates database schema migrations and avoids table locks.
- **Immediate Analytics Parity:** Because all analytics aggregation pipelines (`computeSentimentSplit()`, `computeSentimentIndex()`, `computeCountryBreakdown()`, `computePhraseFrequency()`) query top-level `enrichment.*` fields directly, human corrections are **instantly reflected** across the entire analytics dashboard and filter models without requiring schema rewrites or custom aggregation predicates.
- **Auditability & Traceability:** The `override` block preserves the original AI extraction and records who made the change and when, satisfying compliance and data-lineage requirements.

---

### 2. Backend REST API Surface (`social-listening-core`)

A dedicated REST endpoint is added to `postsRouter.ts`:

- **Route:** `PATCH /v1/posts/:id/enrichment`
- **Authentication & Authorization:** Gated behind tenant RLS context and bearer token. Authorized for both `tenant_user` and `tenant_admin` roles.
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
- **Validation Rules:**
  - `sentiment`: must be one of `'positive'`, `'neutral'`, `'negative'` if provided.
  - `sentimentScore`: numeric value clamped between `0.0` and `1.0`.
  - `keyPhrases`: array of non-empty strings (trimmed, sanitized, deduplicated).
  - `geoCountry`: normalized to uppercase ISO 3166-1 alpha-2 or `null`.
- **Response:** Returns the updated `SocialPostSummary` with HTTP `200 OK`. Returns `404 Not Found` if the post does not exist or belongs to another tenant.

---

### 3. Cascading Dual-Drawer UI Interaction (`social-listening-admin`)

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
   - The primary `PostDetailPanel` drawer smoothly translates leftward (e.g. `transform: translateX(-420px)` or side-by-side flex layout) while the new **Enrichment Details Drawer** (`EnrichmentEditDrawer.tsx`) slides in flush to the right viewport edge.
   - This maintains the complete reading context of the original post on the left while editing enrichment parameters on the right.
3. **Editable Fields:**
   - **Sentiment Toggle:** Interactive segmented buttons or colored radio cards for `Positive` (green), `Neutral` (slate), `Negative` (red).
   - **Key Phrases Tag Editor:** Interactive tag list allowing users to remove existing phrases with `×` and input new phrases with an `<input>` tag adder.
   - **Detected Language Selector:** Dropdown selector populated with standard languages.
   - **Country / Region Selector:** Country dropdown supporting ISO 3166-1 alpha-2 selection or clearing to "Unknown".
   - **Summary / Grounding Textarea:** Multi-line text field for custom analyst notes or corrected summary.
4. **Optimistic Updates & Visual Feedback:**
   - Submitting "Save" calls `PATCH /api/posts/[id]/enrichment` (via Next.js BFF proxy).
   - Updates post state optimistically in the feed and drawer.
   - The AI Enrichment card displays an **"Edited by user"** badge (`StatusBadge` or metadata pill) with timestamp tooltip.
   - The secondary drawer closes with smooth transition, returning the primary drawer to its default position.
5. **Conflict Handling with Re-Enrichment:**
   - If a user triggers manual re-enrichment (`RunEnrichmentButton`, Story 6.16) on an already-overridden post, the UI prompts a confirmation warning (*"This post contains manual enrichment edits. Running AI re-enrichment will overwrite these changes. Proceed?"*).

---

## Consequences

### Positive

- **Complete Human-in-the-Loop (HITL) Control:** Eliminates helplessness against AI misclassifications by giving users full editorial authority over every enriched data point.
- **Accurate Analytics & Sentiment Scoring:** Overridden sentiment immediately fixes skewed brand reputation scores and executive KPIs in the Analytics dashboard.
- **Superior Contextual UX:** The cascading drawer pattern enables analysts to reference long-form post text and quotes while adjusting tags and sentiment side-by-side.
- **Zero Database Migration Overhead:** Schema updates utilize existing `JSONB` structures and standard REST endpoints without table locks.
- **Full Traceability:** Preserves original AI predictions in `override.originalValues` for ML quality monitoring and audit trails.

### Negative

- **Client State Synchronization:** Updating a post's enrichment requires synchronizing local state across the active drawer, the posts feed table, and any open analytics cache without requiring a full page refresh.
- **CSS Layout Complexity:** Supporting dual sliding drawers on smaller viewports requires responsive viewport breakpoints (on screens `< 1200px`, the primary drawer can temporarily stack beneath the editing panel).

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Modal dialog instead of secondary drawer** | Rejected. A modal overlay darkens or obscures the underlying post body, preventing the user from reading the article text while deciding on correct sentiment or key phrases. |
| **Separate database table `post_enrichment_overrides`** | Rejected. Creating a separate table would require JOINs across every analytics query and feed fetch, degrading read performance. In-place `JSONB` updates with an `override` metadata block are cleaner and faster. |
| **Inline editing directly inside PostDetailPanel** | Considered. While compact, inline form controls make the primary view cluttered when reading posts. A dedicated secondary drawer provides ample workspace for tag management, country selection, and notes without compromising read mode. |

---

## Open Questions

1. **Role Gating for Overrides:** Should regular `tenant_user` members be permitted to edit post enrichments, or should edits be restricted to `tenant_admin`? *Recommendation: Allow both roles by default (matching the collaborative nature of social listening analysts), but record `overriddenByUserId` for auditability.*
2. **Bulk Enrichment Editing:** Should users be able to select multiple posts on the feed and batch-override sentiment (e.g. mark 10 selected posts as Positive)? *Deferred to v2 as a follow-up story once single-post editing is established.*
3. **ML Re-training Export:** Should overridden posts be flagged for export as few-shot training examples for fine-tuning future prompt templates? *Supported naturally by filtering on `enrichment->'override'->>'isOverridden' = 'true'`.*

---

*Drafted 2026-08-20 pursuant to Menno's request. Unblocks Human-in-the-Loop post enrichment editing, sentiment correction, and the cascading multi-drawer workflow on the Posts page. Left **Proposed** per project ADR-acceptance authority convention.*
