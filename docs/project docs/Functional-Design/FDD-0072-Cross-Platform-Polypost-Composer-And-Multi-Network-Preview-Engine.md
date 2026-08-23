# Business Requirements Document (BRD) — Cross-Platform Polypost Composer and Multi-Network Preview Engine

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Cross-Platform Polypost Composer and Multi-Network Preview Engine |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md, ../Business-Requirements/BRD-0072-Cross-Platform-Polypost-Composer-And-Multi-Network-Preview-Engine.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md and the business requirements in BRD-0072-Cross-Platform-Polypost-Composer-And-Multi-Network-Preview-Engine.md into functional design for **Cross Platform Polypost Composer And Multi Network Preview Engine**.
Social content authors today draft, proof, and adapt posts across a fragmented set of external tools — separate platform dashboards, formatting helpers, AI prompt sandboxes, file converters, and media editors. Each social network enforces its own character limits, grapheme rules, aspect ratios, link rendering, hashtag conventions, and accessibility requirements. This context switching slows content production, increases the risk of rejected or truncated posts, and makes it hard to maintain brand consistency.

This BRD authorizes the **Cross-Platform Polypost Composer and Multi-Network Preview Engine**, a unified authoring workspace inside `social-listening-admin`. Authors compose once and immediately see side-by-side, pixel-accurate preview rails for seven target networks — LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, and X/Twitter — with real-time character/grapheme counters, OpenGraph link cards, drag-and-drop image uploads with Alt-Text, Markdown/Word document import, multi-draft local autosave, and Azure OpenAI copy assistance.

The initiative turns SocialEngage into a full social-media authoring surface, removing the need for separate publishing tools and ensuring content is validated before it reaches any network. It is intentionally an **authoring and preview engine only**; the real outbound dispatch path is defined separately in ADR-0075 / Story 6.39.

---

### 2.2 Scope
**In scope:**
- A unified `PolypostComposer` authoring surface, available as a dedicated `/tenant/compose` page and as an on-demand `ComposePostModal` overlay.
- `PlatformPreviewRails` rendering seven dedicated, platform-accurate preview cards:
  - LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, X/Twitter.
- Image upload toolbar and drag-and-drop dropzone supporting `image/png`, `image/jpeg`, `image/webp`, and `image/gif`.
- Per-image, editable Alt-Text fields and file dimension/size badges.
- OpenGraph link card auto-detection and asynchronous scraping (`/api/composer/og-preview`) with graceful fallback.
- Document and Markdown file import (`documentImport.ts`) supporting `.md`, `.markdown`, `.txt`, and `.docx` with **Replace Draft** and **Append to Draft** modes.
- Multi-draft management with create, switch, rename, duplicate, and delete; debounced 500ms `localStorage` autosave keyed per tenant.
- Azure OpenAI copywriter integration (`/api/ai/compose-assist`) with pre-engineered prompt presets and streaming diff review.

**Out of scope:**
- Real outbound publishing to social networks via platform APIs (covered by ADR-0075 / Story 6.39).
- Scheduled or automated posting, queues, and calendar views.
- Paid advertising, boosted posts, or ad campaign creation.
- Video upload and per-platform media trans-coding/deriving.
- Multi-stage approval workflows.
- Server-side persistence or sharing of drafts between devices or users.

## 3. Context and Background
See ADR Context.
Social content authors today draft, proof, and adapt posts across a fragmented set of external tools — separate platform dashboards, formatting helpers, AI prompt sandboxes, file converters, and media editors. Each social network enforces its own character limits, grapheme rules, aspect ratios, link rendering, hashtag conventions, and accessibility requirements. This context switching slows content production, increases the risk of rejected or truncated posts, and makes it hard to maintain brand consistency.

This BRD authorizes the **Cross-Platform Polypost Composer and Multi-Network Preview Engine**, a unified authoring workspace inside `social-listening-admin`. Authors compose once and immediately see side-by-side, pixel-accurate preview rails for seven target networks — LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, and X/Twitter — with real-time character/grapheme counters, OpenGraph link cards, drag-and-drop image uploads with Alt-Text, Markdown/Word document import, multi-draft local autosave, and Azure OpenAI copy assistance.

The initiative turns SocialEngage into a full social-media authoring surface, removing the need for separate publishing tools and ensuring content is validated before it reaches any network. It is intentionally an **authoring and preview engine only**; the real outbound dispatch path is defined separately in ADR-0075 / Story 6.39.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a single workspace for multi-platform social drafting | A `Tenant-User` can open `/tenant/compose` or the modal composer and draft once for all seven preview rails |
| 2 | Prevent post rejections and truncation surprises | Each preview rail enforces the correct character/grapheme limit and warns before truncation |
| 3 | Reduce dependence on external formatting, file-conversion, and AI tools | Authors can import `.md`, `.txt`, and `.docx` files and run Azure OpenAI copy assistance without leaving the composer |
| 4 | Improve accessibility compliance for social media content | Every uploaded image carries an editable Alt-Text field that flows into preview cards and exported payloads |
| 5 | Protect draft work from browser refreshes and disconnects | Drafts auto-persist to tenant-isolated `localStorage` within 500ms of the last edit, up to 50 drafts per tenant |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User / Content Marketer | Primary author of social posts | High | Compose, preview, and refine content quickly across all target networks |
| Tenant-Social-Care-Agent | Rapid responder from the unified inbox | Medium | Reuse the composer text area and counters for public replies |
| Tenant-Admin | Workspace owner and content approver | Medium | Ensure brand-safe, accessible drafts and role-gated access |
| Tenant-Brand-Reputation-Manager | Crisis-response content reviewer | Medium | Preview brand messaging before it can be published |
| Menno | Product Owner / Sole Developer | High | A reusable authoring surface that later stories can extend for real publishing |
| UI/Engineering | Implementation team | High | Clear platform constraints, accessibility rules, and Azure OpenAI integration boundaries |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 6.36 | epic-6-tenant-admin-ui.md | As Tenant Administrator or Content Marketer, I want a unified, real-time cross-platform social post composition workspace with side-by-side network preview r... | **Dedicated Route & Modal Integration:**; **Synchronous Multi-Network Preview Rails (`PlatformPreviewRails.tsx`):**; **Media Upload, Drag-and-Drop, and Acces... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Draft text and per-platform overrides | Canonical message and any per-rail customizations | User input | Tenant-User | Tenant-internal |
| Image attachment metadata | File name, dimensions, size, preview blob/object key, and Alt-Text | User upload / browser | Tenant-User | Tenant-internal |
| OpenGraph card metadata | `og:title`, `og:description`, `og:image`, `og:site_name`, plus fallbacks | Target web page | Third-party (scraped) | Public |
| Draft history | Draft titles, body text, attachments, and timestamps | Browser `localStorage` | Tenant-User | Tenant-internal |
| Azure OpenAI prompt/response | Draft text sent and suggestion text returned | Azure OpenAI service | Tenant-User | Tenant-internal; no PII by default |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0035 — Admin UI Shape: One App, Role-Gated | Internal / Architectural | Menno | Already Accepted |
| D-002 | ADR-0038 — AI Enrichment Provider Selection: Azure AI Language & Azure OpenAI | Internal / Architectural | Menno | Already Accepted |
| D-003 | Story 6.2 — Role-gated routing shell | Internal / Story | Product Owner | Built |
| D-004 | Story 6.11 — Post feed | Internal / Story | Product Owner | Built |
| D-005 | Azure OpenAI Service credentials and network access | External | Operations | Required for BR-008 |
| D-006 | ADR-0075 / Story 6.39 — Real outbound publishing | Future / Out-of-Scope | Product Owner | Separate ADR; not required for composer v1 |

---

- Azure OpenAI endpoint, key, and deployment name are configured per tenant/environment.
- Authors use a modern browser with `localStorage` enabled and sufficient free space.
- Target-network constraints (character limits, aspect ratios, card formats) are known and stable.
- The composer is accessed by authenticated, role-gated `social-listening-admin` users.

## 10. Non-Functional Considerations
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

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- Azure OpenAI endpoint, key, and deployment name are configured per tenant/environment.
- Authors use a modern browser with `localStorage` enabled and sufficient free space.
- Target-network constraints (character limits, aspect ratios, card formats) are known and stable.
- The composer is accessed by authenticated, role-gated `social-listening-admin` users.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OpenGraph scraping is slow or blocked by target servers | High | Medium | Run asynchronously with skeleton placeholders; fallback to title/description/domain | Engineering |
| R-002 | `localStorage` quota is exceeded for image-heavy drafts | Medium | Medium | Store image references/keys instead of full blobs; cap history at 50 drafts and prune old entries | Engineering |
| R-003 | Authors rely on AI suggestions that misrepresent tone or facts | Medium | High | Always show a diff and require explicit **Apply**; preserve original draft until accepted | Product Owner |
| R-004 | Users ignore Alt-Text prompts, creating accessibility exposure | Medium | Medium | Prominent inline Alt-Text field; include Alt-Text completion metric in monthly review | Product Owner |
| R-005 | Preview cards drift from real platform rendering over time | Medium | Medium | Track platform UI changes quarterly; update card components when network layouts change | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md`
- BRD: `../Business-Requirements/BRD-0072-Cross-Platform-Polypost-Composer-And-Multi-Network-Preview-Engine.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Feature design: `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Feature design: `docs/product-research/feature-designs/ai-enhancements.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above