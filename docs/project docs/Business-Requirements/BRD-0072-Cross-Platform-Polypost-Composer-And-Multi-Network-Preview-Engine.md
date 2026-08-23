# Business Requirements Document (BRD) — Cross-Platform Polypost Composer and Multi-Network Preview Engine

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Cross-Platform Polypost Composer and Multi-Network Preview Engine — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | BRD Writer Agent (on behalf of product research) |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Accepted |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | BRD Writer Agent | Initial draft from ADR-0072, Story 6.36, and related publishing research |

---

## 2. Executive Summary

Social content authors today draft, proof, and adapt posts across a fragmented set of external tools — separate platform dashboards, formatting helpers, AI prompt sandboxes, file converters, and media editors. Each social network enforces its own character limits, grapheme rules, aspect ratios, link rendering, hashtag conventions, and accessibility requirements. This context switching slows content production, increases the risk of rejected or truncated posts, and makes it hard to maintain brand consistency.

This BRD authorizes the **Cross-Platform Polypost Composer and Multi-Network Preview Engine**, a unified authoring workspace inside `social-listening-admin`. Authors compose once and immediately see side-by-side, pixel-accurate preview rails for seven target networks — LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, and X/Twitter — with real-time character/grapheme counters, OpenGraph link cards, drag-and-drop image uploads with Alt-Text, Markdown/Word document import, multi-draft local autosave, and Azure OpenAI copy assistance.

The initiative turns SocialEngage into a full social-media authoring surface, removing the need for separate publishing tools and ensuring content is validated before it reaches any network. It is intentionally an **authoring and preview engine only**; the real outbound dispatch path is defined separately in ADR-0075 / Story 6.39.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a single workspace for multi-platform social drafting | A `Tenant-User` can open `/tenant/compose` or the modal composer and draft once for all seven preview rails |
| 2 | Prevent post rejections and truncation surprises | Each preview rail enforces the correct character/grapheme limit and warns before truncation |
| 3 | Reduce dependence on external formatting, file-conversion, and AI tools | Authors can import `.md`, `.txt`, and `.docx` files and run Azure OpenAI copy assistance without leaving the composer |
| 4 | Improve accessibility compliance for social media content | Every uploaded image carries an editable Alt-Text field that flows into preview cards and exported payloads |
| 5 | Protect draft work from browser refreshes and disconnects | Drafts auto-persist to tenant-isolated `localStorage` within 500ms of the last edit, up to 50 drafts per tenant |

---

## 4. Scope

### 4.1 In Scope

- A unified `PolypostComposer` authoring surface, available as a dedicated `/tenant/compose` page and as an on-demand `ComposePostModal` overlay.
- `PlatformPreviewRails` rendering seven dedicated, platform-accurate preview cards:
  - LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, X/Twitter.
- Image upload toolbar and drag-and-drop dropzone supporting `image/png`, `image/jpeg`, `image/webp`, and `image/gif`.
- Per-image, editable Alt-Text fields and file dimension/size badges.
- OpenGraph link card auto-detection and asynchronous scraping (`/api/composer/og-preview`) with graceful fallback.
- Document and Markdown file import (`documentImport.ts`) supporting `.md`, `.markdown`, `.txt`, and `.docx` with **Replace Draft** and **Append to Draft** modes.
- Multi-draft management with create, switch, rename, duplicate, and delete; debounced 500ms `localStorage` autosave keyed per tenant.
- Azure OpenAI copywriter integration (`/api/ai/compose-assist`) with pre-engineered prompt presets and streaming diff review.

### 4.2 Out of Scope

- Real outbound publishing to social networks via platform APIs (covered by ADR-0075 / Story 6.39).
- Scheduled or automated posting, queues, and calendar views.
- Paid advertising, boosted posts, or ad campaign creation.
- Video upload and per-platform media trans-coding/deriving.
- Multi-stage approval workflows.
- Server-side persistence or sharing of drafts between devices or users.

### 4.3 Assumptions

- Azure OpenAI endpoint, key, and deployment name are configured per tenant/environment.
- Authors use a modern browser with `localStorage` enabled and sufficient free space.
- Target-network constraints (character limits, aspect ratios, card formats) are known and stable.
- The composer is accessed by authenticated, role-gated `social-listening-admin` users.

### 4.4 Constraints

- Browser `localStorage` is typically capped at ~5MB per domain, limiting in-browser draft and image storage.
- OpenGraph scraping introduces 500–1,500ms latency and cannot be forced through hostile/blocked servers.
- Preview fidelity must not block the editor; asynchronous rendering and skeleton placeholders are required.
- AI-generated copy must always be reviewed and explicitly accepted by the author.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User / Content Marketer | Primary author of social posts | High | Compose, preview, and refine content quickly across all target networks |
| Tenant-Social-Care-Agent | Rapid responder from the unified inbox | Medium | Reuse the composer text area and counters for public replies |
| Tenant-Admin | Workspace owner and content approver | Medium | Ensure brand-safe, accessible drafts and role-gated access |
| Tenant-Brand-Reputation-Manager | Crisis-response content reviewer | Medium | Preview brand messaging before it can be published |
| Menno | Product Owner / Sole Developer | High | A reusable authoring surface that later stories can extend for real publishing |
| UI/Engineering | Implementation team | High | Clear platform constraints, accessibility rules, and Azure OpenAI integration boundaries |

---

## 6. Current State (As-Is)

**Current process:**

1. Content authors leave `social-listening-admin` to compose posts in external editors or platform-specific dashboards.
2. They manually count characters, adapt hashtags and mentions, and guess how link cards will render.
3. Images are prepared in separate tools; Alt-Text is often forgotten or added inconsistently.
4. Drafts are saved locally as files or browser tabs, with no resilient autosave or multi-draft management.
5. AI copy help, if used, comes from standalone prompt tools with no platform-specific constraints.

**Pain points:**

- High context switching between formatting tools, AI sandboxes, file converters, and network dashboards.
- Risk of rejected, truncated, or poorly formatted posts due to differing platform rules.
- Missing or inconsistent Alt-Text, reducing accessibility and exposing brand risk.
- Lost work when browsers refresh or networks drop.
- No single place to preview how the same message appears on every target network.

---

## 7. Future State (To-Be)

**New or improved process:**

1. The author opens `/tenant/compose` or the **Compose Post** modal from the post feed.
2. A single text editor captures the canonical draft; a link or image can be added at any time.
3. `PlatformPreviewRails` updates synchronously, showing how the post renders on LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, and X/Twitter.
4. Network-specific counters and truncation indicators keep drafts within each platform's limits.
5. The author can drag images into the editor, enter Alt-Text, and see the image reflected in each preview.
6. OpenGraph metadata is scraped automatically for the first URL and rendered as a link card on the rails that support it.
7. Existing Markdown, Word, or plain-text files can be imported into or appended to the draft.
8. Multiple drafts can be created, renamed, duplicated, and deleted; each is autosaved after 500ms of idle typing.
9. Azure OpenAI presets offer spelling/grammar fixes, conciseness, viral hooks, expansion, tone adjustment, and hashtag suggestions; the author reviews and applies or discards each suggestion.

**Expected capabilities:**

- One draft, seven accurate previews.
- Local, tenant-isolated, multi-draft autosave.
- In-line accessibility Alt-Text for every image.
- Automatic OpenGraph link card previews.
- File import from Markdown/Word.
- AI-assisted copy refinement with human approval.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a dedicated composer page and a modal composer accessible from the post feed | Must | `/tenant/compose` and `ComposePostModal` are reachable and render the same `PolypostComposer` components | Product Owner |
| BR-002 | The system shall render seven real-time platform preview rails (LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, X/Twitter) | Must | Each rail shows a platform-accurate card and respects the platform's character/grapheme limits | Product Owner |
| BR-003 | The system shall allow authors to upload images via a toolbar button or drag-and-drop over the text area | Must | `png`, `jpeg`, `webp`, and `gif` files are accepted and shown as thumbnails | Product Owner |
| BR-004 | The system shall capture and propagate accessibility Alt-Text for every image | Must | Each thumbnail has an editable Alt-Text field; Alt-Text flows into preview cards and exported payloads | Product Owner |
| BR-005 | The system shall auto-detect the first URL and display an OpenGraph link card preview | Should | Card shows title, description, image, and hostname; falls back to page `<title>`/`<meta name="description">` or domain if tags are missing | Product Owner |
| BR-006 | The system shall import `.md`, `.markdown`, `.txt`, and `.docx` files into the active draft | Should | Author can choose **Replace Draft** or **Append to Draft** | Product Owner |
| BR-007 | The system shall manage multiple concurrent drafts with local autosave | Should | Author can create, switch, rename, duplicate, and delete drafts; changes persist 500ms after the last keystroke | Product Owner |
| BR-008 | The system shall provide Azure OpenAI-assisted copy presets with diff review | Should | Presets include Fix Spelling & Grammar, Make Concise, Generate Viral Hook, Expand & Elaborate, Professional Tone, and Hashtag Suggestions; author can **Apply** or **Discard** | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The composer must meet WCAG 2.1 AA for text entry, image Alt-Text, focus states, and screen-reader labels | Accessibility | Must | Verified by component contract tests and manual a11y checklist |
| NFR-002 | OpenGraph scraping and preview updates must not block the editor | Performance | Must | Skeleton placeholders render during fetch; typing remains responsive |
| NFR-003 | Draft autosave must complete within 500ms of the last keystroke | Performance | Must | Measured by debounce timing and localStorage write observability |
| NFR-004 | Drafts must be isolated per tenant and browser session | Security | Must | `localStorage` key follows `socialengage:drafts:${tenantId}`; no cross-tenant draft leakage |
| NFR-005 | Azure OpenAI credentials must remain server-side | Security | Must | UI calls a same-origin proxy (`/api/ai/compose-assist`); keys never reach the browser |
| NFR-006 | The composer must be keyboard-navigable and responsive on standard desktop viewports | Usability | Should | Tab order, preview rail focus, and modal controls are keyboard accessible |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only `image/png`, `image/jpeg`, `image/webp`, and `image/gif` files may be uploaded or dropped into the composer. |
| BRU-002 | Every uploaded image must display an editable Alt-Text field; empty Alt-Text is allowed but visually prompted. |
| BRU-003 | The first valid `https?://` URL in the draft is used for the OpenGraph card preview. |
| BRU-004 | OpenGraph previews fall back to `<title>`/`<meta name="description">` or the bare hostname when OpenGraph tags are unavailable or the server blocks scraping. |
| BRU-005 | Drafts in `localStorage` are keyed by tenant ID and must not be readable by other tenants. |
| BRU-006 | A maximum of 50 drafts per tenant is retained in local storage; older drafts are pruned automatically. |
| BRU-007 | Azure OpenAI suggestions are preview-only until the author explicitly chooses **Apply to Draft**. |
| BRU-008 | Real outbound publishing is not performed by the composer; it is reserved for ADR-0075 and Story 6.39. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Draft text and per-platform overrides | Canonical message and any per-rail customizations | User input | Tenant-User | Tenant-internal |
| Image attachment metadata | File name, dimensions, size, preview blob/object key, and Alt-Text | User upload / browser | Tenant-User | Tenant-internal |
| OpenGraph card metadata | `og:title`, `og:description`, `og:image`, `og:site_name`, plus fallbacks | Target web page | Third-party (scraped) | Public |
| Draft history | Draft titles, body text, attachments, and timestamps | Browser `localStorage` | Tenant-User | Tenant-internal |
| Azure OpenAI prompt/response | Draft text sent and suggestion text returned | Azure OpenAI service | Tenant-User | Tenant-internal; no PII by default |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Composer open rate | Track adoption of the new authoring workspace | Product team | Weekly |
| Draft save count and autosave success rate | Measure reliability of local autosave | Engineering | Daily |
| OpenGraph scrape success/failure rate | Monitor preview quality and third-party server behavior | Engineering | Daily |
| AI assist usage by preset | Understand which copy-assistance features are used | Product team | Weekly |
| Alt-Text completion rate | Measure accessibility compliance progress | Product / Compliance | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OpenGraph scraping is slow or blocked by target servers | High | Medium | Run asynchronously with skeleton placeholders; fallback to title/description/domain | Engineering |
| R-002 | `localStorage` quota is exceeded for image-heavy drafts | Medium | Medium | Store image references/keys instead of full blobs; cap history at 50 drafts and prune old entries | Engineering |
| R-003 | Authors rely on AI suggestions that misrepresent tone or facts | Medium | High | Always show a diff and require explicit **Apply**; preserve original draft until accepted | Product Owner |
| R-004 | Users ignore Alt-Text prompts, creating accessibility exposure | Medium | Medium | Prominent inline Alt-Text field; include Alt-Text completion metric in monthly review | Product Owner |
| R-005 | Preview cards drift from real platform rendering over time | Medium | Medium | Track platform UI changes quarterly; update card components when network layouts change | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0035 — Admin UI Shape: One App, Role-Gated | Internal / Architectural | Menno | Already Accepted |
| D-002 | ADR-0038 — AI Enrichment Provider Selection: Azure AI Language & Azure OpenAI | Internal / Architectural | Menno | Already Accepted |
| D-003 | Story 6.2 — Role-gated routing shell | Internal / Story | Product Owner | Built |
| D-004 | Story 6.11 — Post feed | Internal / Story | Product Owner | Built |
| D-005 | Azure OpenAI Service credentials and network access | External | Operations | Required for BR-008 |
| D-006 | ADR-0075 / Story 6.39 — Real outbound publishing | Future / Out-of-Scope | Product Owner | Separate ADR; not required for composer v1 |

---

## 14. Acceptance Criteria

- A `Tenant-User` can open a dedicated `/tenant/compose` page and an on-demand **Compose Post** modal from `/tenant/posts`.
- `PlatformPreviewRails` renders the seven defined preview cards with correct platform-specific character/grapheme counters and truncation behavior.
- The composer toolbar allows image upload; the text area accepts drag-and-drop images and shows visual dropzone feedback.
- Every uploaded image displays its dimensions, size, an editable Alt-Text field, and a remove control.
- The first URL in the draft is detected and a rich OpenGraph card preview is shown on the rails that support it, with graceful fallback when tags are missing.
- The author can import `.md`, `.markdown`, `.txt`, or `.docx` files and choose **Replace Draft** or **Append to Draft**.
- Multiple drafts can be created, switched, renamed, duplicated, and deleted; the active draft autosaves to `localStorage` 500ms after the last edit.
- Azure OpenAI presets produce reviewable suggestions that the author can apply or discard.
- The composer does not perform real outbound publishing; the **Publish** action is either simulated or gated to the separate ADR-0075 flow.
- Jest contract tests verify the route, modal, preview rails, image upload, OpenGraph fallback, document import, draft autosave, and AI-assist wiring.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Polypost Composer | The unified social-post authoring and preview workspace inside `social-listening-admin`. |
| Preview Rail | A platform-specific visual card that shows how a draft will render on a target network. |
| OpenGraph | A metadata protocol (`og:*` tags) used by websites to control how links appear when shared. |
| Alt-Text | Descriptive text associated with an image for screen readers and accessibility. |
| Grapheme | A single unit of a writing system; used for counting characters in networks like Bluesky. |
| Local Autosave | Saving draft changes to browser `localStorage` after a short debounce period. |
| Azure OpenAI | Microsoft-hosted OpenAI service used for generative copy assistance. |
| Draft | An in-progress post, including text, images, link preview state, and optional overrides. |

---

## 16. Appendices

### Reference Documents

- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md)
- [Story 6.36 — Cross-Platform Polypost Composer & Multi-Network Preview Engine](../user-stories/epic-6-tenant-admin-ui.md#story-636--cross-platform-polypost-composer--multi-network-preview-engine)
- [ADR-0035: Admin UI Shape — One App, Role-Gated](../adr/0035-admin-ui-shape-one-app-role-gated.md)
- [ADR-0038: AI Enrichment Provider Selection — Azure AI Language & Azure OpenAI](../adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md)

### Related Feature Research

- [Feature Design 07 — Publishing and Scheduling](../product-research/feature-designs/07-publishing-and-scheduling.md): the closest parent feature design; treats the Polypost Composer as the v1 authoring surface.
- [Deep Research Brief — Publishing and Scheduling](../product-research/reports/07-publishing-and-scheduling-deep-research.md): competitive analysis of Sprinklr, Sprout Social, Hootsuite, and Buffer validating the multi-network composer pattern.

### Missing Source Note

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` was found specifically for ADR-0072's composer and preview engine. The BRD therefore draws on the closest available feature design and research brief (07 — Publishing and Scheduling) and the authoritative ADR and user story.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
