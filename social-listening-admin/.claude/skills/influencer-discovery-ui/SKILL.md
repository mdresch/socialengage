---
name: influencer-discovery-ui
description: Influencer discovery interface with InfluencerCard multi-score visual bars, topic tags, platform filtering, sorting, and prospecting list integration per ADR-0108.
---

# Influencer Discovery UI Skill

## Overview
Implements Story 12.16 (ADR-0108):
- `InfluencerCard`: Card display with four visual score bars (`Influence`, `Reach`, `Engagement`, `Authenticity`), top topic tags, author profile link, `Add to Prospecting List` button, and `View Posts` deep link.
- `InfluencerDiscoveryView`: Main discovery feed with multi-filter toolbar (`platform`, `topic`, `minScore`, `sort`), responsive card grid, and empty state.

## Components
- `src/components/influencers/InfluencerCard.tsx`
- `src/components/influencers/InfluencerDiscoveryView.tsx`
