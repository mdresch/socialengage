import fs from 'fs';
import path from 'path';

describe('Story 6.4 — watchlist management screen', () => {
  const adminRoot = path.resolve(__dirname, '..', '..');
  const screenPath = path.join(adminRoot, 'src', 'app', 'tenant', 'watchlists', 'page.tsx');
  const skillPath = path.join(adminRoot, '.claude', 'skills', 'watchlist-management', 'SKILL.md');

  it('creates a tenant-facing watchlist management screen route', () => {
    expect(fs.existsSync(screenPath)).toBe(true);
  });

  it('documents the watchlist management flow in the component skill note', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('renders the watchlist list, match-type options, and delete-confirm copy', () => {
    const source = fs.readFileSync(screenPath, 'utf8');
    expect(source).toContain('Watchlists');
    expect(source).toContain('keyword');
    expect(source).toContain('boolean');
    expect(source).toContain('confirm');
  });
});
