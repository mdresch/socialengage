import fs from 'fs';
import path from 'path';

describe('Story 6.3 — connector connect/disconnect flow', () => {
  const adminRoot = path.resolve(__dirname, '..', '..');
  const screenPath = path.join(adminRoot, 'src', 'app', 'tenant', 'connectors', 'page.tsx');

  it('creates a tenant-facing connectors screen route', () => {
    expect(fs.existsSync(screenPath)).toBe(true);
  });

  it('documents the connector flow in the component skill note', () => {
    const skillPath = path.join(adminRoot, '.claude', 'skills', 'connector-connect-disconnect', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('renders the connector actions and disclosure copy expected by Story 6.3', () => {
    const source = fs.readFileSync(screenPath, 'utf8');
    expect(source).toContain('Connect a platform');
    expect(source).toContain('GNews');
    expect(source).toContain('Newswire');
    expect(source).toContain('provider terms');
  });
});
