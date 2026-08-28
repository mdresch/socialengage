---
name: daily-digest-ui
description: Frontend UI preferences and live interactive preview drawer for the daily digest email.
---

# Daily Digest Email UI

Governed by **ADR-0096**, **BRD-0096**, **FDD-0096**, and **Story 11.4**.

## Key Responsibilities

1. **`core-client.ts` Digest Integration**:
   - `getUserDigestPreferences()`: Fetches recipient's active schedule, timezone, and content flags.
   - `upsertUserDigestPreferences(input)`: Persists delivery configuration.
   - `previewDailyDigest(customPreferences)`: Requests a compiled 24h preview with rendered dual-MIME bodies.

2. **BFF Route Proxies**:
   - `/api/digest/preferences`: GET/POST handler proxying to core with authenticated session.
   - `/api/digest/preview`: POST handler generating on-demand previews.

3. **`DigestPreferencesView.tsx`**:
   - Delivery time and IANA timezone selector.
   - Toggle switch for entire subscription.
   - Content toggles: AI Executive Summary, Notable Conversations, and Trending Topics.
   - Watchlist multi-select scope.
   - Live interactive sandboxed HTML email preview iframe.

4. **Tenant Settings Navigation**:
   - Integrated into `/tenant/settings` under Notification Preferences.
