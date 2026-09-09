/**
 * Contract: Story 10.13 (ADR-0093) — YouTube Connector Admin UI integration.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 10.13 — YouTube Connector Admin UI Contract', () => {
  it('AC1: registers YouTube platform definition in /tenant/connectors/page.tsx', () => {
    const src = readSrc('app', 'tenant', 'connectors', 'page.tsx');
    expect(src).toMatch(/id:\s*'youtube'/);
    expect(src).toMatch(/name:\s*'YouTube Data API'/);
    expect(src).toMatch(/authMode:\s*'api_key'/);
    expect(src).toMatch(/key:\s*'apiKey'/);
  });

  it('AC2: registers YouTube platform in /tenant/connectors/status/page.tsx', () => {
    const src = readSrc('app', 'tenant', 'connectors', 'status', 'page.tsx');
    expect(src).toMatch(/id:\s*'youtube'/);
    expect(src).toMatch(/name:\s*'YouTube Data API'/);
  });

  it('AC3: includes YouTube in Watchlist target platforms in /tenant/watchlists/page.tsx', () => {
    const src = readSrc('app', 'tenant', 'watchlists', 'page.tsx');
    expect(src).toMatch(/id:\s*'youtube'/);
    expect(src).toMatch(/name:\s*'YouTube'/);
  });
});
