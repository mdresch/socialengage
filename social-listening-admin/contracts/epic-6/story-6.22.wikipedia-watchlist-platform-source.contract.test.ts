/**
 * Contract: Story 6.22 — Add Wikipedia to the watchlist screen's
 * platform-source list.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-622
 *
 * Intent: Story 2.13 (social-listening-core) shipped a real, fully generic
 * Wikipedia connector (authMode: 'none'). Story 6.21 exposed it on the
 * connectors screen, but tenant/watchlists/page.tsx keeps its own,
 * separately-maintained SOCIAL_PLATFORMS constant (watchlist-management/
 * SKILL.md's own "Governing decisions" — deliberately narrower than the
 * connectors screen's PLATFORMS array, real SocialConnector platforms
 * only) — it still lists gnews/newswire only, so Wikipedia has never been
 * selectable as a watchlist's platform source, and Story 2.14's own
 * watchlist-driven discovery has nothing to search for.
 *
 * Scope: social-listening-admin/{src/app/tenant/watchlists/page.tsx
 * (SOCIAL_PLATFORMS entry), social-listening-admin/.claude/skills/
 * watchlist-management/SKILL.md}. WatchlistForm.tsx and WatchlistRow.tsx
 * already render generically from the connectedPlatforms prop/lookup — this
 * story proves that generic rendering, not new code in either file.
 *
 * Explicitly out of scope: tenant-owned-feed (a real SocialConnector, also
 * missing from this same list) — its "connected" state is per-domain/
 * multi-feed, not the simple credential-or-none boolean this list already
 * handles for gnews/newswire/wikipedia; a materially different, undesigned
 * change, named as a separate open gap, not solved here.
 *
 * AC1: page.tsx's SOCIAL_PLATFORMS gains a 'wikipedia' entry, authMode:
 *      'none' — the same shape the existing 'newswire' entry already uses.
 * AC2: WatchlistForm.tsx needs zero change — it already renders every
 *      connectedPlatforms entry generically (no per-platform branch).
 * AC3: WatchlistRow.tsx needs zero change — its platform-name lookup
 *      already falls back correctly for any connectedPlatforms entry.
 * AC4: watchlist-management/SKILL.md documents Wikipedia as a third real
 *      SocialConnector platform here, and that this list is independently
 *      maintained from the connectors screen's own PLATFORMS array.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.22 — Wikipedia added to the watchlist screen\'s platform-source list', () => {
  const pagePath = ['app', 'tenant', 'watchlists', 'page.tsx'];
  const formPath = ['app', 'tenant', 'watchlists', 'WatchlistForm.tsx'];
  const rowPath = ['app', 'tenant', 'watchlists', 'WatchlistRow.tsx'];

  describe('AC1: SOCIAL_PLATFORMS gains a wikipedia entry, shaped like the existing authMode-none newswire entry', () => {
    it('lists wikipedia with authMode: none', () => {
      const source = readSrc(...pagePath);
      const listMatch = source.match(/const SOCIAL_PLATFORMS:[\s\S]*?\n\];/);
      expect(listMatch).not.toBeNull();
      const block = listMatch![0];
      expect(block).toContain(`id: 'wikipedia'`);

      const entryMatch = block.match(/\{\s*id:\s*'wikipedia'[^}]*\}/);
      expect(entryMatch).not.toBeNull();
      const entry = entryMatch![0];
      expect(entry).toMatch(/name:\s*'Wikipedia'/);
      expect(entry).toMatch(/authMode:\s*'none'/);
    });

    it('still lists the pre-existing gnews and newswire entries, unaffected', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain(`id: 'gnews'`);
      expect(source).toContain(`id: 'newswire'`);
    });
  });

  describe('AC2: WatchlistForm.tsx needs zero change — already renders every connectedPlatforms entry generically', () => {
    it('renders platform rows from connectedPlatforms.map with no per-platform-id branch', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/connectedPlatforms\.map/);
      expect(source).not.toMatch(/platform\.id\s*===\s*['"]wikipedia['"]/);
      expect(source).not.toMatch(/platform\.id\s*===\s*['"]gnews['"]/);
    });
  });

  describe('AC3: WatchlistRow.tsx needs zero change — its platform-name lookup already falls back correctly', () => {
    it('derives platformNames via connectedPlatforms.find(...) with a raw-id fallback, no per-platform-id branch', () => {
      const source = readSrc(...rowPath);
      expect(source).toMatch(/connectedPlatforms\.find/);
      expect(source).toMatch(/\?\?\s*id/);
      expect(source).not.toMatch(/platformIds\.includes\(['"]wikipedia['"]\)/);
    });
  });

  describe('AC4: watchlist-management/SKILL.md documents Wikipedia and the independently-maintained-list fact', () => {
    it('names Wikipedia as a third real SocialConnector platform offered here', () => {
      const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'watchlist-management', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
      const skillSource = fs.readFileSync(skillPath, 'utf8');
      expect(skillSource).toMatch(/wikipedia/i);
      expect(skillSource).toMatch(/independently maintained/i);
    });
  });
});
