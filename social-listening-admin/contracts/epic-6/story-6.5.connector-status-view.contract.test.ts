import fs from 'fs';
import path from 'path';

describe('Story 6.5 — connector status view', () => {
  const adminRoot = path.resolve(__dirname, '..', '..');
  const screenPath = path.join(adminRoot, 'src', 'app', 'tenant', 'connectors', 'status', 'page.tsx');
  const skillPath = path.join(adminRoot, '.claude', 'skills', 'connector-status-view', 'SKILL.md');

  it('creates a tenant-facing connector status route', () => {
    expect(fs.existsSync(screenPath)).toBe(true);
  });

  it('documents the connector status flow in the component skill note', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('renders per-platform health, last successful poll, unsupported-feature warnings, and status-only copy', () => {
    const source = fs.readFileSync(screenPath, 'utf8');
    expect(source).toContain('Connector status');
    expect(source).toContain('healthy');
    expect(source).toContain('degraded');
    expect(source).toContain('failing');
    expect(source).toContain('Last successful poll');
    expect(source).toContain('unsupported features');
    expect(source).toContain('Health only');
  });
});
