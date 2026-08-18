# SocialEngage — Frontend Design Specification

**Document:** `docs/design/frontend-design-specification.md`  
**Status:** Approved design specification & implementation baseline  
**Date:** 2026-08-14  
**Scope:** `social-listening-admin` — the Next.js front-end that is the sole UI surface of the social listening platform  
**Authoritative inputs:** ADR-0001, ADR-0008 (§10, superseded in part by ADR-0054), ADR-0029–0037, ADR-0041, ADR-0043, ADR-0044, ADR-0050, ADR-0051, ADR-0054 (§5.13, Accepted 2026-08-17), Epic 6 user stories (6.1–6.17), Epic 7 user stories (6.6), Epic 8 user stories (8.1–8.3), Design Spec §2, MSE UI Mockup (HTML/CSS/JS reference prototype), Platform Admin Console mockup (2026-08-03, layout reference only), `docs/design/Gemini Designs/`/Google AI Studio (analytics screens only, §5.13/§11 — layout reference, not ported as code)

**2026-08-17 update:** §5.13 (Analytics Dashboard), the `/tenant/analytics` Route Table row, §10's narrowed deferral bullet, and §11's `Gemini Designs` relationship row added, per ADR-0054's acceptance. Not yet built — see §5.13's own Status line.

---

## 1. Purpose of this Document

This specification defines the **intended** design of the `social-listening-admin` frontend — its visual language, screen inventory, component architecture, interaction patterns, and the constraints that govern every screen. It is the single authoritative design reference that implementation work should be built against.

It supersedes the HTML/JS prototype artefacts in `docs/design/microsoft-social-engagement-ui-mockup/` and `docs/design/MSE ui Mockup/` as implementation targets. Those prototypes remain valid **layout and flow references** only; they are not to be ported as code. Implementation uses Next.js App Router with Vanilla CSS design tokens (CSS custom properties in `globals.css` and scoped component styling), as established by the `social-listening-admin` repository.

---

## 2. Design Principles

These principles are binding on all screens, components, and copy, not aspirational.

**Data, not decoration.** Every visual element earns its place by conveying information or enabling action. No decorative dividers, no padding between sections that doesn't serve alignment, no status badges that don't map to a real system state from the API.

**Role-appropriate scope.** The UI never shows a user data that falls outside their role boundary. A Tenant Admin sees only their tenant. A Platform Admin sees the tenant registry, database health, and audit log — never tenant content (posts, watchlists, credentials). This is not just a permissions concern; it shapes what each screen is allowed to render at all (ADR-0030 §2, ADR-0041).

**State transparency.** Connector health, data freshness, seat counts, DNS verification status, and watchlist coverage are live system state, not dashboard decorations. When a connector is failing, that must be prominently visible, not buried behind a drill-down.

**Plain language.** Labels name what the user controls. Button text names the action that will happen. Error messages say what went wrong and what to do next. No technical jargon from the backend surfaces in copy visible to Tenant Admins.

**Confirmed irreversibility.** Watchlist deletion, tenant suspension, break-glass credential reset, and tenant self-service deletion are hard to undo or irreversible entirely. Every one of these flows requires an explicit confirmation step — not a raw `window.confirm`, but a proper modal or dedicated confirmation screen with the consequence stated in plain language.

---

## 3. Visual Language

### 3.1 Design Direction

The product is a professional-grade monitoring tool positioned as a credible successor to Microsoft Social Engagement — used by brand managers, social care teams, and platform operators, not general consumers. The visual language should read as **capable and calm**: dense information presented cleanly, with enough visual hierarchy to navigate without cognitive load, but none of the busyness that comes from decoration.

The aesthetic reference is enterprise SaaS with restraint — closer to Linear or Vercel's admin surfaces than to a marketing dashboard. Dark top bar, white content area, neutral greys for structure, a single intentional accent colour used only for primary actions and active states.

### 3.2 Colour Palette

| Role | Token name | Light Hex | Dark Hex | Usage |
|---|---|---|---|---|
| Brand accent | `--color-accent` | `#2563EB` | `#5B8DEF` | Primary actions, active nav items, focus rings, links |
| Accent hover | `--color-accent-hover` | `#1D4ED8` | `#7EA3F4` | Button and link hover states |
| Accent contrast | `--color-accent-contrast` | `#FFFFFF` | `#0B1220` | Text/icons on accent backgrounds |
| Surface — top bar | `--color-surface-bar` | `#0F172A` | `#0B0F19` | Top navigation bar background |
| Surface — sidebar | `--color-surface-sidebar` | `#1E293B` | `#141A29` | Left nav sidebar background |
| Surface — page | `--color-surface-page` / `--color-bg` | `#F8FAFC` | `#14161A` | Main content area background |
| Surface — card | `--color-surface-card` / `--color-surface` | `#FFFFFF` | `#1C1F26` | Cards, panels, modals |
| Border | `--color-border` | `#E2E8F0` | `#30343D` | Card borders, dividers, table rows |
| Text — primary | `--color-text-primary` / `--color-text` | `#0F172A` | `#EEF0F3` | Body text, headings |
| Text — secondary | `--color-text-secondary` / `--color-text-muted` | `#64748B` | `#9AA2B1` | Labels, meta, secondary copy |
| Text — disabled | `--color-text-disabled` | `#94A3B8` | `#64748B` | Disabled controls |
| Text — on-dark | `--color-text-on-dark` | `#F1F5F9` | `#F8FAFC` | Text on top bar / sidebar |
| Status — healthy / success | `--color-status-healthy` / `--color-success` | `#16A34A` | `#4ADE80` | Green indicator |
| Status — degraded / warning | `--color-status-degraded` / `--color-warning` | `#D97706` | `#FBBF24` | Amber indicator |
| Status — failing / danger | `--color-status-failing` / `--color-danger` | `#DC2626` | `#F87171` | Red indicator — connector down |
| Status — inactive | `--color-status-inactive` | `#94A3B8` | `#64748B` | Grey — watchlist or connector disabled |
| Destructive | `--color-destructive` / `--color-danger` | `#DC2626` | `#F87171` | Delete, suspend, break-glass actions |
| Destructive hover | `--color-destructive-hover` / `--color-danger-hover` | `#B91C1C` | `#FCA5A5` | Hover on destructive actions |

### 3.3 Typography

**Display / heading face:** `Inter` (variable, loaded via `next/font/google`). Used for page titles, section headings, table column headers. Tight tracking at large sizes (`letter-spacing: -0.02em` at 24px+).

**Body / label face:** `Inter` same family, regular weight. The product is data-dense; keeping to one family prevents font-pairing from competing with content.

**Monospace:** `JetBrains Mono` (variable). Used exclusively for: watchlist boolean query text, connector platform IDs, audit log entries, tenant IDs, DNS TXT verification records. Never for general copy.

**Type scale:**

| Role | Size | Weight | Line height |
|---|---|---|---|
| Page title | 24px / 1.5rem | 650 | 1.25 |
| Section heading | 18px / 1.125rem | 600 | 1.33 |
| Card heading | 15px / 0.9375rem | 600 | 1.4 |
| Body | 14px / 0.875rem | 400 | 1.55 |
| Label / meta | 12px / 0.75rem | 500 | 1.5 |
| Mono (query / ID / TXT) | 13px / 0.8125rem | 400 | 1.6 |

### 3.4 Spacing System

8px base unit. All padding, margin, and gap values are multiples of 4px (0.25rem), with the standard rhythm being 4, 8, 12, 16, 24, 32, 48, 64px (`--space-1` through `--space-8`). No arbitrary values.

### 3.5 Border Radius

| Context | Value |
|---|---|
| Cards, panels, modals | `0.5rem` (8px) |
| Buttons, inputs, badges | `0.375rem` (6px) |
| Status dots | `9999px` (full circle) |
| Avatars | `9999px` |

### 3.6 Shadows

Used sparingly: only on modals and floating elements. Cards use a `1px solid var(--color-border)` border rather than heavy shadows, keeping the page surface flat and readable.

```css
Modal: box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.25);
Dropdown: box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
Card / surface: box-shadow: var(--shadow-sm);
```

---

## 4. Layout Architecture

### 4.1 Shell

The application shell is consistent across all authenticated screens. It is implemented as a Next.js root layout (`src/app/layout.tsx`) that wraps every page.

```
┌──────────────────────────────────────────────────────────┐
│  TOP BAR  (64px, --color-surface-bar)                    │
│  [Logo/wordmark]  [Current tenant name]  [User menu ▾]   │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│  LEFT    │  MAIN CONTENT AREA                            │
│  NAV     │  (scrollable, --color-surface-page)           │
│  SIDEBAR │                                               │
│  (240px, │  Page title + breadcrumb                      │
│  --color │  ──────────────────────────────               │
│  -surface│  Content                                      │
│  -sidebar│                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

The sidebar collapses to a 64px icon-only rail on viewports below 1024px, and to a slide-in drawer on mobile (below 768px).

### 4.2 Top Bar

Contains:
- **Left:** SocialEngage wordmark (links to `/tenant` for Tenant role, `/platform-admin` for Platform Admin role)
- **Centre:** Current tenant display name, shown only for Tenant-scoped sessions. Not shown in Platform Admin sessions (no tenant context)
- **Right:** User display name and role badge, action link to "Sign out" (`/api/auth/signout`)

### 4.3 Left Nav — Tenant Admin / Tenant User role

Navigation items in order, with the active item highlighted using `--color-accent` left border and `--color-accent/10` background:

| Label | Route | Story | Role Scope |
|---|---|---|---|
| Posts | `/tenant/posts` | Story 6.11 | Tenant User, Tenant Admin |
| Connect platforms | `/tenant/connectors` | Story 6.3, 6.12 | Tenant Admin |
| Watchlists | `/tenant/watchlists` | Story 6.4 | Tenant User, Tenant Admin |
| Connector status | `/tenant/connectors/status` | Story 6.5, 6.15 | Tenant User, Tenant Admin |
| Team & Access | `/tenant/users` | Story 6.8, 6.14 | Tenant Admin |
| Invite assist | `/tenant/invite-assist` | Story 6.10 | Tenant Admin |
| Tenant settings | `/tenant/settings` | Story 6.9, 6.13 | Tenant User, Tenant Admin (deletion: Admin only) |

### 4.4 Left Nav — Platform Admin role

Platform Admin sessions have no tenant context and show a dedicated navigation:

| Label | Route | Story |
|---|---|---|
| Platform Admin Console | `/platform-admin` | Story 6.6 (Epic 7) |

Contains direct sections for:
- Database health indicator (Story 1.10)
- Tenant registry table with inline seat & status controls (Story 5.12)
- Tenant provisioning form (Story 5.12)
- Two-phase break-glass credential reset panel (Story 5.13)
- Immutable Platform Admin audit log (Story 5.14)

### 4.5 Page Layout within Main Area

```
┌──────────────────────────────────────────────────────────┐
│  Page heading row                                        │
│  [Page title]                           [Primary action] │
├──────────────────────────────────────────────────────────┤
│  (optional) Alert / status banner                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Page content (cards, tables, forms)                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Page title is always `<h1>`. Section headings within a page use `<h2>`. Card headings use `<h3>`. This hierarchy is both semantic (accessibility) and visual.

---

## 5. Screen Inventory

### 5.1 Sign-in (Story 6.1)

**Route:** `/sign-in` (and `/` when unauthenticated)  
**Role:** All users (pre-auth)

A full-page centred layout — no sidebar, no top bar. Contains:

- SocialEngage wordmark centred at top
- Heading: "Sign in to SocialEngage"
- Sub-heading: "Use your organisation's Microsoft account"
- Primary button: "Continue with Microsoft" (triggers Entra External ID OIDC redirect)
- Below button, small text: "Need access? Contact your administrator." (links to nothing — informational only)

**States:**
- Default: button enabled
- Auth callback / loading: button disabled, spinner inside button, text "Signing in…"
- Error (callback failure): inline error message below button, e.g. "Sign-in failed. Try again or contact your administrator." No technical detail exposed.

---

### 5.2 Self-service Sign-up (Story 6.7)

**Route:** `/sign-up`  
**Role:** New users establishing a new tenant  
**Status:** Built & contract-verified (Story 6.7)

A full-page centred layout matching the sign-in structure. Steps:

1. **Microsoft sign-in step** — OIDC redirect flow to Entra External ID
2. **Tenant setup step** — after auth: form for tenant display name and primary domain (`name`, `domain`). CTA: "Create your workspace"
3. **Completion & Provisioning** — tenant is provisioned via `createSelfServiceSignupTenant()`, user is assigned `tenant_admin` role, and forwarded to `/tenant`.

---

### 5.3 Role-gated routing shell (Story 6.2)

**Route:** `/` (authenticated role-resolution)  
**Status:** Built & contract-verified (Story 6.2)

A server-side routing dispatcher that checks session identity (`isResolvedIdentity()`, `getRoleShell()`):

- Platform Admin identities (`platform_admin`) are forwarded straight to `/platform-admin`
- Tenant identities (`tenant_admin` or `tenant_user`) render the Tenant shell action overview with links to `/tenant` and specific tenant views
- Unresolved / invalid sessions are redirected to `/sign-in`
- Unauthorized cross-boundary requests (e.g. `platform_admin` accessing `/tenant/*` or `tenant_user` accessing `/platform-admin`) are immediately rejected and redirected to `/`

---

### 5.4 Connect platforms (Story 6.3, 6.12, 6.15)

**Route:** `/tenant/connectors`  
**Role:** Tenant Admin

**Page title:** "Connect a platform"

Shows platform cards for supported ingestion and AI enrichment sources:
- **GNews** (API Key)
- **Newswire** (Public / No credential)
- **Azure AI Language** (Endpoint + Key)
- **Azure OpenAI Service** (Endpoint + Key + Deployment)
- Link / Card for **Tenant-Owned Feed** (`/tenant/connectors/tenant-owned-feed`)

Each platform card contains:

```
┌──────────────────────────────────────────────────┐
│  [Platform icon]  Platform name                  │
│  [Connection status badge]  [Active / Inactive]  │
│                                                  │
│  Description: provider overview.                 │
│                                                  │
│  ⚠ You connect using your own account and API    │
│    key directly with [Platform]. SocialEngage    │
│    is not a billing intermediary.                │
│                                                  │
│  [Connect Form / Modal]  [Disconnect]            │
│  [Activate / Deactivate Toggle]                  │
└──────────────────────────────────────────────────┘
```

**Intermediary notice** (ADR-0027): every platform card includes the mandatory disclosure that the user contracts directly with the provider.

---

### 5.5 Watchlists (Story 6.4)

**Route:** `/tenant/watchlists`  
**Role:** Tenant Admin, Tenant User

**Page title:** "Watchlists"  
**Primary action button:** "New watchlist"

**Watchlist list:** a structured table with:
- Name
- Match Type (Keyword, Hashtag, Account, Boolean)
- Query / Terms summary
- Owner
- Active / Inactive status toggle
- Actions (Edit, Delete)

**Create / Edit Drawer (Slideover):**
- Name input
- Match type selector (Keyword, Hashtag, Account, Boolean)
- Conditional query input:
  - Keyword / Hashtag / Account: multi-value tag input
  - Boolean: monospace textarea (`JetBrains Mono`) for complex syntax
- Platforms selection (connected platforms only)
- Active on save toggle

**Locking & Concurrency (ADR-0044):**
Toggle state changes submit a focused `PATCH /v1/watchlists/:id` with `{ isActive: boolean }`. Deleting a watchlist triggers a `ConfirmModal` explaining that deletion is permanent and existing ingested posts are preserved.

---

### 5.6 Connector status (Story 6.5, 6.15)

**Route:** `/tenant/connectors/status`  
**Role:** Tenant Admin, Tenant User

**Page title:** "Connector status"

Displays cards for all platform connectors backed by live `getConnectorStatus()`:
- Status indicator: `● Healthy` (green), `● Degraded` (amber), `● Failing` (red), `● Inactive` (grey)
- Last successful fetch relative timestamp (e.g. "4 minutes ago") and ISO tooltip
- Last attempt timestamp
- Consecutive failure counter
- Tenant Admin activation control (`ActivateDeactivateButton`)

---

### 5.7 Post Feed & Post Detail (Story 6.11, 6.16)

**Route:** `/tenant/posts`
**Role:** Tenant User, Tenant Admin

#### Feed View (`/tenant/posts`)
Browsing surface for social posts ingested by active connectors:
- Post cards containing:
  - Provider pill badge (e.g. `GNEWS`, `NEWSWIRE`, `TENANT_OWNED_FEED`)
  - Post Title / Headline — clicking opens the Post Detail `Slideover` (no page navigation)
  - Text snippet / preview
  - Publication timestamp
  - AI Enrichment summary chips (Sentiment: Positive/Neutral/Negative, Key Phrases, Entities)
- Cursor pagination: "Next page" link forwarding opaque `?cursor=` token (never page numbers)

#### Post Detail Slideover
Post detail is presented in a `Slideover` (`width="lg"`) opening over the feed — no separate route. The selected post ID is tracked in a `?post=<id>` query-string parameter so the view is deep-linkable and browser-back dismisses the panel.

Contents:
- Full post body and structured metadata (`author`, `url`, `publishedAt`, `ingestionRunId`)
- Raw payload metadata section (collapsible)
- Full AI Enrichment panel: sentiment scores, categorized entities, key phrases
- Manual **"Run enrichment now"** button (`RunEnrichmentButton.tsx`, Story 6.16) triggering on-demand Azure AI Language / OpenAI analysis via `POST /v1/posts/:id/enrich`

---

### 5.8 Tenant-Owned Feed Connector Setup (Story 6.12, 6.17)

**Route:** `/tenant/connectors/tenant-owned-feed`  
**Role:** Tenant Admin

Two-step domain verification and custom RSS/Atom feed connection (ADR-0050):

```
┌──────────────────────────────────────────────────────────┐
│  Tenant-Owned Feed Setup                                 │
├──────────────────────────────────────────────────────────┤
│  1. Connect Feed                                         │
│     Domain:   [news.example.com____________________]     │
│     Feed URL: [https://news.example.com/rss.xml____]     │
│     [Connect Feed]                                       │
├──────────────────────────────────────────────────────────┤
│  2. DNS Verification                                     │
│     Add the following TXT record to your DNS zone:       │
│     Host:  _socialengage-challenge.news.example.com      │
│     Value: se-verify-8f92a10b4c2e                        │
│                                                          │
│     ℹ DNS changes may take up to 72 hours to propagate.  │
│     [Verify now]                                         │
│                                                          │
│  Status: Active / Inactive toggle                        │
└──────────────────────────────────────────────────────────┘
```

- Connection state persists `connectorActivationId` across reloads via `?activationId=`.
- "Verify now" performs DNS lookup; `pending` indicates propagation wait (never a hard error); `verified` activates ingestion.

---

### 5.9 Platform Admin Console (Story 6.6 / Epic 7)

**Route:** `/platform-admin`  
**Role:** Platform Admin only (strictly zero tenant content access, ADR-0030 §2, ADR-0041)

**Page title:** "Platform Admin console"

Unified operational console consisting of five discrete, structured sections:

1. **Database Health:** live Postgres connection status indicator (`ok` / `unavailable`) reading `GET /v1/health` (Story 1.10).
2. **Tenant Registry Table:**
   - Columns: Name, Domain, Status (`Active` / `Suspended`), Seats (`active / license`), Actions.
   - Inline `TenantAdminControls`: edit name, toggle status with confirmation, adjust `license_seat_count` (never `active_seat_count`, ADR-0031).
3. **Provision Tenant Form (`ProvisionTenantForm`):**
   - Form fields: Tenant Name, Primary Domain (optional), License Seat Count.
   - Submits `POST /v1/admin/tenants` and refreshes registry.
4. **Two-Phase Break-Glass Reset (`BreakGlassPanel`, ADR-0030 §3, Story 5.13):**
   - **Phase 1 (Request):** select tenant, submit request (`POST /v1/admin/tenants/:id/break-glass/request`).
   - **Phase 2 (Execute):** execute request (`POST .../requests/:requestId/execute`). Renders generated Temporary Access Pass / temporary credential **exactly once** in local state with copy instruction: *"This credential will not be shown again. Store it securely before closing."*
5. **Platform Admin Audit Log:**
   - Read-only table of all administrative actions (`platform_admin_audit_log`): Timestamp, Actor Identity, Operation (`tenant_create`, `tenant_suspend`, `seat_count_adjust`, `break_glass_request`, `break_glass_execute`), Target Tenant.

---

### 5.10 Team Members & Access Management (Story 6.8, 6.14)

**Route:** `/tenant/users`  
**Role:** visible to `tenant_user`/`tenant_admin` alike; invite/access controls gated `tenant_admin`-only

**Visual redesign, 2026-08-17:**
- Seat-utilization card: real `licenseSeatCount`/`activeSeatCount` (widened onto `GET /v1/tenants/users`, the caller's own tenant only) with a progress meter — never a fabricated number.
- Styled user table: initial-letter avatar, role pill (`Tenant Admin`/`Tenant User`), `StatusBadge` (§6.1) for `active`/`invited`, an expiry pill for a scheduled `access_ends_at` or "active indefinitely".
- `InviteUserForm` and `AccessControl` (time-bounded access window) both open in a `Modal` (§6.8) rather than always-inline — same underlying fetch/state logic as before, restyled container.
- `AccessHistoryButton` (Story 6.14) stays per-user, opened from each row — a tenant-wide aggregate view was considered and deliberately not built (Menno's own scoping call).
- No hard-delete-a-user action exists (no `DELETE /v1/tenants/users/:id` anywhere) — the destructive action here is "End access now" (`AccessControl`), immediate `accessEndsAt`, not removal.

---

### 5.11 Same-Domain Invite Assist (Story 6.10)

**Route:** `/tenant/invite-assist`  
**Role:** Tenant Admin

Dashboard surface reviewing captured same-domain sign-up attempts (Story 5.16, ADR-0031 §5):
- Lists unlinked users who authenticated via Microsoft Entra with matching company email domain
- Actions: "Invite user" to immediately add user to tenant with chosen seat role, or "Dismiss"

---

### 5.12 Tenant Settings & Self-Service Offboarding (Story 6.9, 6.13)

**Route:** `/tenant/settings` & `/tenant/settings/delete`  
**Role:** Tenant Admin (`/tenant/settings/delete` strictly gated to `tenant_admin`)

#### General Settings (`/tenant/settings`)
- Tenant display name, domain, created date
- License seat ceiling vs active assigned seats
- Link to self-service offboarding for Tenant Admins

#### Self-Service Deletion & Offboarding (`/tenant/settings/delete`, ADR-0043, Story 3.8/6.13)
- **Request Deletion:** initiates 30-day grace period (`POST /v1/tenants/me/deletion-request`), displaying `graceEndsAt` date
- **Data Export:** self-service export buttons downloading all tenant social posts, watchlists, and metadata in JSON or CSV format
- **Cancel Deletion:** two-click cancel button restoring tenant to normal active state (`DELETE /v1/tenants/me/deletion-request`)
- **Final Irreversible Confirmation:** available once grace period elapses; high-friction confirmation modal executing permanent deletion (`POST /v1/tenants/me/deletion-confirm`)

---

### 5.13 Analytics Dashboard (Story 8.1, 8.2, 8.3 — ADR-0054)

**Route:** `/tenant/analytics`
**Role:** Tenant User, Tenant-Admin
**Status:** Ready (ADR-0054 Accepted 2026-08-17) — not yet built.

**Page title:** "Analytics"

A tab shell with a global date-range filter (`GlobalDateRangePicker`) and four tabs, computed entirely client-side from `GET /v1/posts` and its `enrichment`/`rawPayload.providerId` fields — no new `social-listening-core` endpoint, per ADR-0054 Decision §3. Tab state is reflected in a `?tab=` query-string parameter, the same deep-linkable-state pattern as the Post Detail Slideover's `?post=<id>` (§5.7).

- **Overview** (Story 8.1) — total matched post count, a compact sentiment split, and a compact source breakdown for the selected date range; reuses the Sentiment/Sources tabs' own aggregations rather than computing a fourth one.
- **Sentiment** (Story 8.2) — sentiment donut (positive/neutral/negative), a real day-bucketed sentiment-over-time chart, Top Fans/Top Critics (real `author` + `enrichment.sentiment`, no fabricated-data fallback), positive/negative key-phrase clouds.
- **Conversations** (Story 8.3) — a key-phrase word cloud and a day-bucketed phrase-frequency-over-time chart, both from real `enrichment.keyPhrases`. No Intentions or Tags widget — neither concept exists anywhere in this project's real `enrichment` schema (ADR-0054 Context).
- **Sources** (Story 8.1) — post-volume and sentiment breakdown per this project's real three content connectors (`gnews`, `newswire`, `tenant-owned-feed`), not a generic social-platform roster.

**No Location tab.** ADR-0054 Decision §4 defers it entirely — `social_posts.post_geo_location` is populated by none of this project's real connectors, and even a populated column isn't included in the `GET /v1/posts` response shape this dashboard's entire data-source strategy depends on. Revisit only once a real geo-data source exists.

Clicking through from any widget to its underlying posts opens the existing Post Detail `Slideover` pattern (§5.7) — no new post-detail UI. Zero matched posts for the selected range renders the shared `EmptyState` component (§6.7), never a fabricated sample dataset — per ADR-0054's own finding that the prototype reference this screen is built from silently substituted fake data when a real result set was small or empty.

---

## 6. Component Inventory

### 6.1 `StatusBadge`

Renders a coloured status dot + text label for connector health, tenant status, or DNS verification.

```tsx
type StatusBadgeVariant = 
  | 'healthy' | 'degraded' | 'failing'   // connector health
  | 'active' | 'suspended'               // tenant status
  | 'inactive'                           // watchlist or connector paused
  | 'verified' | 'pending';              // DNS verification

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
}
```

### 6.2 `ConfirmModal`

Shared modal for destructive or irreversible actions (deleting watchlists, disconnecting platforms, suspending tenants, confirming deletion).

```tsx
interface ConfirmModalProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant: 'destructive' | 'primary';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}
```

### 6.3 `Slideover`

Right-side slide-over panel with focus trap, backdrop, and Escape key dismissal (used for Watchlist creation/editing and Post detail inspection).

```tsx
interface SlideoverProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: 'md' | 'lg'; // md = 480px, lg = 640px
}
```

### 6.4 `TagInput`

Multi-value chip creator for keyword/hashtag watchlists. Enter or comma adds a tag; each tag is removable.

```tsx
interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxValues?: number;
}
```

### 6.5 `ActivateDeactivateButton`

Two-click inline confirmation toggle used for activating/deactivating connectors and feeds without requiring modal interruptions.

```tsx
interface ActivateDeactivateButtonProps {
  platformId: string;
  ownerType: 'tenant' | 'user';
  isActive: boolean;
  onToggleSuccess?: () => void;
}
```

### 6.6 `RunEnrichmentButton`

Action button on post details triggering on-demand NLP/AI analysis, displaying progress spinners and success/error states.

```tsx
interface RunEnrichmentButtonProps {
  postId: string;
}
```

### 6.7 `EmptyState`, `InlineError`, & `RelativeTime`

- `EmptyState`: centered callout with heading, body, and CTA button when lists/tables are empty.
- `InlineError`: accessible error message rendered with `role="alert"` for form validation.
- `RelativeTime`: renders human relative time string ("5 minutes ago") with ISO timestamp tooltip in `title`.

### 6.8 `Modal` (added 2026-08-17, Team & Access redesign)

Generic dialog shell — the same `.modal-backdrop`/`.modal-dialog` classes `ConfirmModal` (§6.2) uses, but with a plain `children` slot instead of a baked-in confirm/cancel footer. For a form or multi-action flow with its own internal state and buttons (inviting a user, configuring a time-bounded access window) — `ConfirmModal` stays the right choice for a genuine irreversible-action confirmation (§2's "Confirmed irreversibility" principle); `Modal` is for everything else that still warrants a modal over an inline panel.

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

---

## 7. API Integration Patterns

### 7.1 All requests through `core-client.ts`

No client component calls external backend URLs directly. All communication with `social-listening-core` routes through `social-listening-admin/src/lib/core-client.ts` and same-origin Next.js proxy route handlers (`src/app/api/...`), ensuring:
- Entra session tokens remain strictly server-side (never exposed to browser JavaScript, ADR-0036).
- Unified error handling and standard `{ status, body }` or `ApiError` responses.

### 7.2 Server Components for Initial Render

Next.js Server Components handle initial data retrieval on page load, eliminating client-side loading flashes. Interactive controls (forms, toggles, modals) are encapsulated in client components (`'use client'`).

---

## 8. Accessibility Requirements

Every screen and component must satisfy these core standards:
- **Full Keyboard Navigation:** all inputs, buttons, and drawers operable via Tab, Enter, Space, and Escape.
- **Visible Focus Rings:** standard 2px accent outline (`outline: 2px solid var(--color-accent); outline-offset: 2px`).
- **Semantic ARIA Announcements:** `role="alert"` for errors, `role="status"` for success messages, and `aria-live="polite"` for dynamic health updates.
- **Color Independence:** status badges pair distinct visual colors with explicit text labels.

---

## 9. Comprehensive Route Table

| Route | File Path | Role Scope | Story / ADR | Status |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | All (Dispatcher) | Story 6.1, 6.2 | Built |
| `/sign-in` | `src/app/sign-in/page.tsx` | All (Unauth) | Story 6.1 | Built |
| `/sign-up` | `src/app/sign-up/page.tsx` | All (New Tenants) | Story 6.7 (ADR-0037) | Built |
| `/signed-out` | `src/app/signed-out/page.tsx` | All | Story 6.1 | Built |
| `/tenant` | `src/app/tenant/page.tsx` | Tenant Users & Admins | Story 6.2 | Built |
| `/tenant/posts` | `src/app/tenant/posts/page.tsx` | Tenant Users & Admins | Story 6.11, 6.16 | Built |
| `/tenant/connectors` | `src/app/tenant/connectors/page.tsx` | Tenant Admin | Story 6.3, 6.15 | Built |
| `/tenant/connectors/status` | `src/app/tenant/connectors/status/page.tsx` | Tenant Users & Admins | Story 6.5, 6.15 | Built |
| `/tenant/connectors/tenant-owned-feed` | `src/app/tenant/connectors/tenant-owned-feed/page.tsx` | Tenant Admin | Story 6.12, 6.17 (ADR-0050) | Built |
| `/tenant/watchlists` | `src/app/tenant/watchlists/page.tsx` | Tenant Users & Admins | Story 6.4 (ADR-0044) | Built |
| `/tenant/users` | `src/app/tenant/users/page.tsx` | Tenant Admin | Story 6.8, 6.14 (ADR-0032) | Built |
| `/tenant/invite-assist` | `src/app/tenant/invite-assist/page.tsx` | Tenant Admin | Story 6.10 (Story 5.16) | Built |
| `/tenant/settings` | `src/app/tenant/settings/page.tsx` | Tenant Users & Admins | Story 6.9 | Built |
| `/tenant/settings/delete` | `src/app/tenant/settings/delete/page.tsx` | Tenant Admin | Story 6.13 (ADR-0043) | Built |
| `/platform-admin` | `src/app/platform-admin/page.tsx` | Platform Admin only | Story 6.6 (Epic 7, ADR-0030) | Built |
| `/tenant/analytics` | `src/app/tenant/analytics/page.tsx` | Tenant Users & Admins | Story 8.1, 8.2, 8.3 (Epic 8, ADR-0054) | Not yet built |

---

## 10. Deferred Items & Non-Goals

The following areas are intentionally out of scope for the current administrative console:
- **Analytics dashboard v1 is now in scope — narrowed, not removed (2026-08-17, ADR-0054).** §5.13's Overview/Sentiment/Conversations/Sources tabs, computed client-side from data `GET /v1/posts`/`enrichment` already return, supersede this bullet's prior blanket deferral in part — ADR-0054 is a narrow, scoped supersession of ADR-0008's "any charting UI" clause only (ADR-0008's own "no `TopicDailyCount` table/endpoint" clause stays fully in force, unaffected). **What remains genuinely deferred, unchanged by ADR-0054:** a **Location tab** (no connector populates real geo data, and the field isn't even in the `GET /v1/posts` response shape this dashboard depends on — ADR-0054 Decision §4, Open Question 1); any new `social-listening-core` server-side aggregation or stored `TopicDailyCount`-shaped table (ADR-0008's core prohibition, untouched); and the AI "explain the spike" narrative panels, predictive forecasting, an interactive topic-cluster graph, a real-time pulse-map, and 1-click PDF export/automated workflows named in `docs/design/frontend-design-future-devs.md` — speculative brainstorm content with no product decision behind it, explicitly excluded by ADR-0054 Decision §2.
- **Deep Infrastructure & Storage Telemetry:** deferred until cluster topologies are established; bounded strictly to basic database health (Story 1.10).
- **Subsystem UIs (Brand Reputation, Social Care, Social Selling):** independent future applications consuming `social-listening-core` APIs.
- **Native Mobile Apps:** responsive web shell is supported; native mobile apps are out of scope.

**A related, not-yet-cleaned-up artifact, named here rather than silently left implicit:** five untracked prototype files at `social-listening-admin/src/app/tenant/analytics/` (`SentimentDashboardTab.tsx`, `ConversationsDashboardTab.tsx`, `LocationDashboardTab.tsx`, `GlobalDateRangePicker.tsx`, `AnimatedChartTooltip.tsx`) predate ADR-0054 and are **superseded reference material, not a valid implementation starting point** — per ADR-0054's own Context findings, none of the three data-consuming files compiles as-is (they import a `FlatPost` type from a `./types` module that doesn't exist), and two mix genuinely-computed real-data derivations with fabricated static fallback data presented with no visual distinction (most notably a silent fallback to a hardcoded name list when a real "Top Fans/Critics" computation yields too few results). `GlobalDateRangePicker.tsx` and `AnimatedChartTooltip.tsx` are the two exceptions — confirmed real, non-fabricated, and reusable as-is. These files are not deleted by this update; that is Story 8.1's own scope, likely inside its `implement-story` pass.

---

## 11. Relationship to Existing Prototype Artefacts

| Artefact | Purpose | Status & Relationship |
|---|---|---|
| `docs/design/microsoft-social-engagement-ui-mockup/` | Flow & Layout Reference | Informs layout density and information hierarchy. Not to be ported as code. |
| `docs/design/MSE ui Mockup/` (Vite/React) | Component Flow Reference | Structural reference for watchlist/connector flows. Implementation uses Next.js App Router. |
| `docs/design/platform-admin-console-mockup-2026-08-03.html` | Platform Admin Reference | Informs Platform Admin console sections (§5.9), reconciled with ADR-0030 §3 two-phase break-glass. |
| `docs/design/Gemini Designs/` (Vite/React/Tailwind, AI Studio) | Analytics & Social Care Consumer Surface Reference — **now an accepted UX/layout reference for a real, in-scope screen (§5.13, ADR-0054), not purely deferred-and-unused** | Its Overview/Sentiment/Conversations/Sources screens informed §5.13's v1 scope directly (ADR-0054 Decision §2) — **with two real, decided departures, not a straight port:** no **Location** tab (ADR-0054 Decision §4 — no real geo data source), and no **Intentions/Tags** widgets (no corresponding field anywhere in this project's real `enrichment` schema). Remaining screens this file covers — Social Care's Social Center live streams, Activity Map, Alerts, and Search Setup (topics + rules) — stay deferred exactly as before, unaffected by ADR-0054. Also contains a richer Post Detail layout (enriched fields sidebar, reply composer, thread, CRM link) and an Auth flow (email/password/MFA) that does **not** apply to the current Entra-only implementation. **Still not to be ported as code, on either count** — styling uses Tailwind utility classes; the production codebase uses Vanilla CSS design tokens (§5.13's own widgets are real, contract-tested Recharts + `ad-`-prefixed vanilla CSS, built fresh against this reference's layout intent, not its markup). |
| `social-listening-admin/src/app/*` (Production Application) | Authoritative Codebase | Implements all 16 routes, 18 contract test suites, and 301 verified tests. |

---

*End of specification.*
