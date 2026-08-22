---
name: polypost-composer
description: Cross-platform social post composer and multi-network preview engine at /tenant/compose and in the Posts feed modal. Read this before touching src/components/composer/**, src/app/tenant/compose/**, or src/app/api/composer/**.
---

# Polypost Composer

## What this is

The `/tenant/compose` page and the `ComposePostModal` overlay in `PostsFeedClient.tsx` provide a single, tenant-scoped authoring workspace where a user drafts one message, attaches images with accessibility Alt-Text, imports Markdown or plain-text documents, sees live side-by-side previews for seven target networks, and can ask an Azure OpenAI-backed assistant to rewrite the copy. All of the client-side state (drafts, autosave, platform selection, media attachments) is intentionally browser-local and tenant-isolated; the composer does not call `social-listening-core` directly for publishing — the out-of-scope write APIs are intentionally not built.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0072 | Cross-Platform Polypost Composer and Multi-Network Preview Engine | 6.36 |

## Contracts that constrain this component

- `contracts/epic-6/story-6.36.polypost-composer.contract.test.ts` — asserts (a) `PolypostComposer` renders the platform toggle bar, editor toolbar, Upload Images / Import Doc / Markdown / Save Draft controls, and the initial text, (b) `PlatformPreviewRails` renders all seven network preview cards (LinkedIn, Instagram, Facebook, Bluesky, Mastodon, Threads, X/Twitter) and propagates media `altText`, (c) `CardLinkPreview` renders OpenGraph title, description, site name, image, and hostname, (d) `documentImport.cleanPastedText()` normalizes Markdown/plain text, (e) `ComposePostModal` renders when `isOpen` and nothing when closed, (f) the dedicated `/tenant/compose/page.tsx` exports a default `ComposePage` component that imports `PolypostComposer`, (g) `PostsFeedClient.tsx` contains a `Compose Post` trigger and the `ComposePostModal` import.

## How to extend this safely

- **Adding an eighth preview rail** requires a new entry in `src/components/composer/types.ts`'s `SupportedPlatform` union and `PLATFORM_CONFIGS`, a new preview card in `src/components/composer/previews/`, and a new branch in `PlatformPreviewRails.tsx`'s `renderCard` switch. The contract's `AC1` test is the backstop that all existing rails still render.
- **Adding a new AI assist mode** requires a new `AiAssistRequest['mode']` value in `src/app/api/composer/ai-assist/route.ts`, a matching prompt branch, and a matching button/preset in `PolypostComposer.tsx`. Do not bypass the same-origin `POST /api/composer/ai-assist` route and call Azure OpenAI from a client component — the API key must stay server-side.
- **Adding a new document import format** should extend `parseDocumentFile()` in `src/components/composer/lib/documentImport.ts` and add a matching unit assertion to the contract. `.docx` is intentionally a minimal zero-dependency XML extractor today; if the format needs real parsing, that is a new ADR-sized decision, not an ad hoc dependency.
- **Changing the link preview route** (`src/app/api/composer/link-preview/route.ts`) changes the `LinkPreviewData` type that `PolypostComposer.tsx` and every preview card import. Keep the type shape forward-compatible or update every consumer at once.
- **Adding or removing publish target Pages** (e.g. for Facebook) lives in `src/components/composer/PublishTargetsDialog.tsx` and is driven by the same `GET /api/connectors/facebook/pages` shape. Any new page-based platform needs a matching read endpoint and a filter rule for which records are treated as active/healthy.

## Load-bearing constraints — do not change casually

- **Every client component in this tree is `'use client'`.** They must not access `window`, `document`, `localStorage`, `navigator.clipboard`, or `fetch` during the synchronous render pass, because the contract suite renders them with `react-dom/server`'s `renderToStaticMarkup` in a Node test environment. Browser-only access belongs inside `useEffect` handlers, event handlers, or guards like `typeof window === 'undefined'`.
- **Draft storage is tenant-isolated via `localStorage` keying.** `draftStorage.ts` must keep the tenant-scoped key prefix (`socialengage:drafts:${tenantId}`) and respect the `typeof window` guard so the contract suite does not crash under Node. The 50 most-recent-drafts limit and quota handling are intentional mitigations for `localStorage` size.
- **Alt-Text on media attachments must propagate into the preview cards.** `MediaAttachment.altText` is optional but, when provided, must appear in the rendered `<img alt>` of every preview rail. The contract's `AC1` alt-text assertion checks `PlatformPreviewRails` output, not only `PolypostComposer`'s thumbnail list.
- **The preview rails receive callbacks, not raw text/media.** `PlatformPreviewRails` takes `getTextForPlatform` and `getMediaForPlatform` so per-platform overrides (not yet a contract, but built into the props shape) can be added without changing the rails' signature.
- **Publishing / scheduled posting is explicitly out of scope.** The Publish button now opens `PublishTargetsDialog.tsx`, which polls `GET /api/connectors/facebook/pages` and lets the user pick active connected Facebook Pages before the (still simulated) dispatch. Do not wire real social network write APIs, webhooks, or ad placement under the cover of "just a small follow-up." That is ADR-0072's named deferred scope and requires its own ADR.

## Known gaps / deferred work

- Direct automated scheduled posting and social network write APIs are explicitly out of scope per ADR-0072. The `PublishTargetsDialog` page picker is UI-only and still simulates dispatch in `handlePublish`.
- The multi-draft `localStorage` persistence is client-side only; cross-device draft sync is not built.
- The OpenGraph scraper is a lightweight regex-based extractor. If a target site blocks the scraper or serves JavaScript-only meta tags, the graceful fallback returns hostname/title/description but not a full browser-rendered preview.

## Relations to other components

- **`post-feed` `PostsFeedClient.tsx` calls `ComposePostModal`** from this component and opens it with a `Compose Post` button. This real call site is asserted in `story-6.36.polypost-composer.contract.test.ts`'s `AC5` source-inspection test.
- **Same-origin API routes `src/app/api/composer/link-preview/route.ts` and `src/app/api/composer/ai-assist/route.ts`** are the only production server entry points the composer talks to. `PolypostComposer.tsx` calls `/api/composer/link-preview` from a `useEffect` and the AI toolbar calls `POST /api/composer/ai-assist`. These routes do not depend on `social-listening-core`.
- **`PublishTargetsDialog.tsx` calls `GET /api/connectors/facebook/pages`** (a same-origin proxy to `social-listening-core`) to list the caller's connected Facebook Pages. It filters to Pages with `status === 'connected'` and a non-failing/non-disconnected `connectorHealth` before presenting them as tick-box targets. The dispatch itself remains a client-side simulation; no real write API is called.
