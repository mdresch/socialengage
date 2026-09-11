---
name: webhook-management-ui
description: Webhook subscription management UI components including WebhookForm and WebhooksView with HMAC secret support, event filtering, delivery health badges, and sample event test pings per ADR-0106.
---

# Webhook Management UI Skill

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-10/story-10.12.webhook-management-ui.contract.test.ts` — the contract test's own filename (built by `fdb9bb8`, 2026-08-27); its "Story 10.12" number does not correspond to the real Story 10.12 ("DSR self-service portal") in `docs/user-stories/epic-10-adr-0086-to-0094.md`. **Documentation Steward correction, 2026-09-11:** this file's own body text below already (accurately) says "Implements Story 12.12 (ADR-0106)" while its header claimed "Story 10.12" — internally inconsistent. See the paired `social-listening-core/.claude/skills/webhook-notifications/SKILL.md`'s own 2026-09-11 note for the fuller finding: this appears to be a real, previously-uncaught duplicate build of the same feature as the later, correctly-cited `story-12.11`/`story-12.12` contracts (2026-08-29) — flagged for Menno to reconcile, not decided here.

## Overview
Implements Story 12.12 (ADR-0106) — see the correction note above on the likely duplicate with this exact story/ADR pairing:
- `WebhookForm`: Captures endpoint URL, selectable event types (`post.ingested`, `alert.triggered`, `connector.health.changed`, `mention.threshold.crossed`), and HMAC signing secret.
- `WebhooksView`: Lists tenant subscriptions, displays delivery status badges (`Success`, `Failed`, `Pending`), retry counts, and offers inline testing (`Test Ping`), enabling/disabling, and deletion.

## Components
- `src/components/webhooks/WebhookForm.tsx`
- `src/components/webhooks/WebhooksView.tsx`
