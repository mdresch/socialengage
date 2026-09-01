---
name: connector-capability-matrix-ui
description: Explains the frontend Connector capability matrix badges, BFF endpoint, and composer publish gating.
---

# Connector Capability Matrix UI Skill

## Background & ADR-0101 Context
In `social-listening-admin`, connectors display their dynamic capabilities (`poll`, `publish`, `reply`, `count`, `backfill`) and coverage category (`sourceType`) so users know which actions are supported per platform. The composer uses this to only offer platforms with `publish` capability.

## Components & Modules
- `src/lib/core-client.ts`: `getConnectorCapabilities()` function fetching `GET /v1/connectors/capabilities`.
- `src/app/api/connectors/capabilities/route.ts`: BFF proxy route forwarding session tokens.
- `src/components/connectors/ConnectorCapabilityBadges.tsx`: Visual chips/badges representing supported capabilities.
- `src/components/connectors/ConnectorsView.tsx`: Displays category groups and capability badges per connector card.
