---
name: crisis-threshold-wizard
description: Crisis threshold wizard UI component (Story 9.4, ADR-0079, BRD-0079, FDD-0079) — preview, customize, and activate pre-configured crisis monitoring templates with advisory playbooks in social-listening-admin. Read this before touching src/app/tenant/watchlists/CrisisThresholdWizard.tsx or src/app/api/crisis-templates/.
---

# Crisis Threshold Wizard (`CrisisThresholdWizard.tsx`)

## What this is

A 3-step interactive UI wizard in `social-listening-admin` that allows brand managers and tenant administrators to preview, customize, and activate standard crisis monitoring templates (`brand-crisis`, `product-recall`, `exec-attack`, `competitor-surge`, `data-breach`) without writing boolean queries by hand.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0079 | Crisis template bundle and activation (amended 2026-08-25) | 9.4 (frontend), 9.3 (backend) |
| BRD-0079 | Business requirements for standardized crisis monitoring and advisory playbooks | 9.4 |
| FDD-0079 | Functional design for 3-step wizard, variable interpolation, and alert disclosure | 9.4 |

## Key Invariants

1. **Persistent V1 Disclosure:** The wizard must display a prominent, plain-language notification explaining that v1 activates a real-time monitoring watchlist and stores notification intent, while automated alert delivery (email/Slack/webhook) will be enabled in a future release.
2. **Dynamic Variable Form:** Step 2 renders input fields dynamically based on `template.parameters` with live query preview.
3. **Threshold Customization & Advisory Playbook:** Step 3 displays customizable thresholds and read-only advisory response steps with SLAs.
4. **Inline Error Handling:** Missing required variables, validation issues, or backend failures are rendered directly inline.
5. **Keyboard Accessibility:** Navigable via Tab, Enter, Escape, and Space keys.
