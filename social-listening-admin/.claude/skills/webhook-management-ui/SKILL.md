---
name: webhook-management-ui
description: Webhook subscription management UI components including WebhookForm and WebhooksView with HMAC secret support, event filtering, delivery health badges, and sample event test pings per ADR-0106.
---

# Webhook Management UI Skill

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-10/story-10.12.webhook-management-ui.contract.test.ts` — Story 10.12 contract test.

## Overview
Implements Story 12.12 (ADR-0106):
- `WebhookForm`: Captures endpoint URL, selectable event types (`post.ingested`, `alert.triggered`, `connector.health.changed`, `mention.threshold.crossed`), and HMAC signing secret.
- `WebhooksView`: Lists tenant subscriptions, displays delivery status badges (`Success`, `Failed`, `Pending`), retry counts, and offers inline testing (`Test Ping`), enabling/disabling, and deletion.

## Components
- `src/components/webhooks/WebhookForm.tsx`
- `src/components/webhooks/WebhooksView.tsx`

**Documentation Steward correction, 2026-09-10.** This file names two different sources for itself: its own frontmatter/Overview text describes "Story 12.12 (ADR-0106)," while its own "Contracts that constrain this component" section cites `contracts/epic-10/story-10.12.webhook-management-ui.contract.test.ts` — Story 10.12, built earlier (`social-listening-admin@ffe640d`... actually `fdb9bb8`'s sibling Batch commit, confirmed via `git diff-tree --no-commit-id --name-only -r fdb9bb8`) under the old numbering. Same root cause as `webhook-notifications/SKILL.md`'s matching correction: this component's real, contract-tested build is Story 10.12, not Story 12.12 — whether Story 12.12 (`docs/user-stories/epic-12-adr-0101-to-0108.md`, built later `social-listening-admin@95c8a97`) extended this same component or built a separate, parallel one is not resolved here — a content question for Menno, not decided here.
