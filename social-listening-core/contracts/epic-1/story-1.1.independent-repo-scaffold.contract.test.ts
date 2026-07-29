// Contract: Story 1.1 (ADR-0001) — social-listening-core is independently deployable and
// has no coupling to social-listening-admin.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-11--core-rest-api-access-for-the-admin-ui
//
// Intent: Story 1.1 — Core REST API access for the admin UI (ADR-0001)
// Scope: social-listening-core/package.json
// Contract to encode: social-listening-core is an independently versioned/buildable npm
// package with its own build/test scripts, not coupled to social-listening-admin via a
// shared workspace root or a direct dependency on it.
// Explicitly out of scope: social-listening-core's actual REST endpoints/routes (Story 1.3
// and Phase 1 stories), Postgres/RLS (Stories 1.2, 5.4), Key Vault credential storage
// (Story 5.3) — none are required to prove the repository-split boundary itself.

import fs from 'fs';
import path from 'path';

const CORE_ROOT = path.resolve(__dirname, '..', '..');
const ADMIN_ROOT = path.resolve(CORE_ROOT, '..', 'social-listening-admin');

function readPackageJson(root: string) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

describe('Story 1.1 — social-listening-core independent-deployability contract', () => {
  const pkg = readPackageJson(CORE_ROOT);

  it('AC3: declares its own independent name, version, and build/test scripts', () => {
    expect(typeof pkg.name).toBe('string');
    expect(typeof pkg.version).toBe('string');
    expect(pkg.scripts).toEqual(
      expect.objectContaining({ build: expect.any(String), test: expect.any(String) })
    );
  });

  it('AC3: has no dependency on social-listening-admin', () => {
    const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const coupled = Object.entries(declared).some(([name, version]) =>
      `${name}@${version}`.includes('social-listening-admin')
    );
    expect(coupled).toBe(false);
  });

  it('AC3: is not unified with social-listening-admin under a shared workspace root', () => {
    const parentPackageJson = path.resolve(CORE_ROOT, '..', 'package.json');
    expect(fs.existsSync(parentPackageJson)).toBe(false);
    expect(pkg.name).not.toBe(readPackageJson(ADMIN_ROOT).name);
  });
});
