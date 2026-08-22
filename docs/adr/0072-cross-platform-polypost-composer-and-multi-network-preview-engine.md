# ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine

**Status:** Accepted (2026-08-22)

**Accepted by Menno 2026-08-22.** Authorizes the cross-platform Polypost Composer and real-time multi-network preview engine within `social-listening-admin`, incorporating 7 network preview rails (LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, X/Twitter), OpenGraph link card scraping, local image uploads with accessibility Alt-Text, Markdown and Document file importers, client-side multi-draft autosave, and Azure OpenAI-assisted copy enhancements.

**Source:** Requested by Menno (2026-08-21): *"could you extract the polypost features and implement those? Draft History & Local Autosave, Document & Markdown File Importer, Live Azure OpenAI Connection, Auto-Link OpenGraph Card Previews, upload and include image with alt text."*

---

## Context

### 1. The Multi-Platform Authoring Complexity
In modern social engagement and listening, brand communications must be tailored across fragmented social networks. Each platform enforces distinct structural, technical, and typographic constraints:
- **Character Limits & Grapheme Counting:** X/Twitter (280 characters with URL shortener weights), Bluesky (300 graphemes), Threads (500 characters), Mastodon (500 characters default), LinkedIn (3,000 characters), Facebook (63,206 characters), Instagram (2,200 characters).
- **Visual Presentation & Typography:** Networks differ drastically in how they render links (card vs. inline), avatar/header layouts, media galleries, action buttons, and character truncations ("...see more").
- **Accessibility & Media Specifications:** Networks mandate descriptive Alt-Text for image attachments and enforce disparate aspect ratio cutoffs (e.g. Instagram 1:1 / 4:5 vs. Twitter 16:9).
- **Hashtag & Mention Conventions:** Networks treat hashtags as primary indexers (Instagram/Twitter/Mastodon) or lower-priority signals (LinkedIn/Threads).

### 2. Workflow Inefficiency & Context Switching
Content authors frequently switch between external formatting tools, AI prompt sandboxes, file converters, and platform-specific web dashboards. Authors need an all-in-one workspace within `social-listening-admin` that allows them to compose once, view live side-by-side renders across all target networks, refine copy with generative AI, import drafts from Markdown or Word documents, and manage multiple drafts locally with resilient autosave.

---

## Decision

### 1. Modular Composer Architecture (`social-listening-admin`)

The Polypost subsystem is implemented as a cohesive suite of UI modules in `src/components/composer/`:

1. **`PolypostComposer.tsx`**: Core orchestration container managing text state, active platform tabs, media attachments, link previews, AI assist drawers, and document imports. Available both as a standalone dedicated page (`/tenant/compose`) and as an on-demand modal overlay (`ComposePostModal.tsx`).
2. **`PlatformPreviewRails.tsx`**: Synchronous layout engine rendering multi-column or tabbed visual preview cards for selected target networks.
3. **`previews/`**: Dedicated, pixel-accurate platform card components:
   - `LinkedInPreviewCard.tsx` (Professional post format with connection badge, timestamp, post body with "see more" truncation, image gallery, and OpenGraph link card).
   - `InstagramPreviewCard.tsx` (Mobile card format with Instagram handle, location badge, image preview, like/comment action bar, and caption formatting).
   - `FacebookPreviewCard.tsx` (Facebook Page header, verified badge, post message, OpenGraph card, and engagement metrics).
   - `BlueskyPreviewCard.tsx` (AT Protocol handle layout, 300-grapheme counter, and domain-grounded link card).
   - `MastodonPreviewCard.tsx` (Federated handle presentation, content warning toggle, and 500-char counter).
   - `ThreadsPreviewCard.tsx` (Meta Threads minimal typography, reply thread aesthetic, and media cards).
   - `XPreviewCard.tsx` (X/Twitter post card with avatar, handle, verified badge, 280-char progress ring, and link summary card).

---

### 2. Local Media Management with Drag-and-Drop & Accessibility Alt-Text

1. **Image Upload Toolbar Button:** A dedicated **"📷 Upload Images"** button invokes the native browser file picker (`image/png, image/jpeg, image/webp, image/gif`).
2. **Drag-and-Drop Dropzone:** The main draft text area acts as a direct drag-and-drop target. Dragging files over the editor provides visual dropzone feedback (`dragover` state) and instantly loads dropped images into the draft.
3. **Thumbnail Previews & Editable Alt-Text:** Uploaded images render as thumbnails directly above the editor. Each thumbnail includes:
   - File dimensions and size badge.
   - An inline, editable **"Alt text (for accessibility)"** input field.
   - Remove attachment button (`✕`).
   - Propagates Alt-Text into preview cards and exported payloads to ensure compliance with WCAG 2.1 AA accessibility standards.

---

### 3. OpenGraph Link Card Preview Engine (`CardLinkPreview.tsx`)

1. **Auto-Detection:** As the author types or pastes content, the composer automatically detects the first valid URL (`https?://...`) in the text.
2. **Scraper Route (`/api/composer/og-preview`):** Fetches the target webpage server-side, extracts OpenGraph meta tags (`og:title`, `og:description`, `og:image`, `og:site_name`), and returns normalized JSON.
3. **Graceful Fallback:** If OpenGraph tags are missing or the target server rejects automated requests, falls back to standard `<title>` and `<meta name="description">` tags or domain hostname.
4. **Rich Card Rendering:** Previews display the featured thumbnail image, bolded article title, snippet description, and target hostname across LinkedIn, Facebook, X, and Bluesky cards.

---

### 4. Document & Markdown File Importer (`documentImport.ts`)

1. **Format Support:** Supports direct importing of `.md`, `.markdown`, `.txt`, and `.docx` (Microsoft Word) documents into the draft editor.
2. **Client-Side Parsing:**
   - Markdown / Plain text files are read via `FileReader.readAsText()` and populated immediately into the draft.
   - `.docx` files are parsed client-side extracting plain text and basic headings.
3. **Import Mode Options:** Authors can choose between **"Replace Draft"** or **"Append to Draft"**.

---

### 5. Multi-Draft Management & Resilient Local Autosave (`draftStorage.ts`)

1. **Local Isolation:** Drafts are stored in browser `localStorage` keyed by tenant ID (`socialengage:drafts:${tenantId}`), ensuring complete data isolation between browser sessions and tenants.
2. **Multi-Draft Tabs & History Drawer (`DraftHistoryDrawer.tsx`):**
   - Authors can create new drafts, switch between concurrent drafts, rename draft titles, duplicate drafts, or delete drafts.
3. **Debounced Autosave:** The editor automatically persists modifications to `localStorage` 500ms after the last keystroke, with visual timestamp indicators ("Autosaved at 14:32").

---

### 6. Live Azure OpenAI Copywriter Integration (`/api/ai/compose-assist`)

1. **Enterprise LLM Grounding:** Connects to Azure OpenAI Service using existing tenant credentials / environment configuration (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME`).
2. **Pre-Engineered AI Prompt Presets:**
   - **Fix Spelling & Grammar:** Corrects typographical and syntax errors while preserving author tone.
   - **Make Concise:** Condenses long-form copy to fit strict network limits (e.g. 280 chars for X / 300 graphemes for Bluesky).
   - **Generate Viral Hook:** Restructures post opener with high-engagement introductory hooks.
   - **Expand & Elaborate:** Enriches bullet points into a detailed thought-leadership post.
   - **Professional Tone Adjustment:** Translates casual phrasing into business-appropriate executive communication.
   - **Hashtag Suggestions:** Generates context-aware, trending hashtags for the post topic.
3. **Streaming & Diff Review:** Authors can preview the AI output and choose to **"Apply to Draft"** or **"Discard"**.

---

## Consequences

### Positive
- **Single Source of Truth for Social Publishing:** Content creators can draft and proof multi-platform campaigns in a single unified workspace.
- **Accurate Pre-Flight Validation:** Real-time character counters, grapheme calculators, and platform-accurate preview rails prevent post rejections, text truncation surprises, or missing Alt-Text.
- **Offline & Autosave Resilience:** Local storage autosave prevents accidental work loss during network disconnects or browser reloads.
- **Enhanced Accessibility:** Direct, in-line Alt-Text prompts encourage compliance with social media accessibility guidelines.

### Negative / Mitigations
- **OpenGraph Scraping Latency:** Scraping target URLs can take 500–1,500ms. *Mitigation:* The composer performs OpenGraph extraction asynchronously in the background, showing a shimmering skeleton placeholder without blocking the editor.
- **Client-Side Storage Limits:** `localStorage` is typically capped at ~5MB per domain. *Mitigation:* Draft storage persists image references as object keys or lightweight blobs, and limits stored draft history to the 50 most recent drafts.

---

## Related Documents
- Feeds user story: [Story 6.36 — Cross-Platform Polypost Composer & Multi-Network Preview Engine](../user-stories/epic-6-tenant-admin-ui.md#story-636--cross-platform-polypost-composer--multi-network-preview-engine)
- Extends: [ADR-0035 (Admin UI Shape: One App, Role-Gated)](0035-admin-ui-shape-one-app-role-gated.md)
- Integrates with: [ADR-0038 (AI Enrichment Provider Selection: Azure AI Language & Azure OpenAI)](0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md)
