// Contract: Story 20.1 — Separate backend and frontend repositories (ADR-0144).
// See docs/user-stories/epic-20-adr-0144.md#story-201 and
// .claude/skills/openapi-spec-generation/SKILL.md.
//
// Intent: Story 20.1's repository-split acceptance criteria are largely
// infrastructure (git history extraction, a new standalone repo, a CI
// workflow) rather than something a Jest contract can assert directly — that
// portion is handled outside this suite, documented in
// docs/implementation-log.md and the TDS-0144 split procedure. The one
// acceptance criterion that IS a real, testable code behavior is "Backend
// publishes its OpenAPI spec as a CI artifact on every build" — that requires
// the backend to actually be able to generate a valid OpenAPI document from
// its own real, live routes, with no dependency on any frontend code. This
// contract locks down that generation mechanism.
// Scope: src/http/openapi/registry.ts (new), src/http/openapi/
// generateOpenApiDocument.ts (new), scripts/generateOpenApiSpec.ts (new),
// package.json (new `openapi:generate` script), registration call sites
// added to src/http/versions/v1/router.ts (GET /v1/health) and
// src/http/versions/v1/watchlistsRouter.ts (GET /v1/watchlists, GET
// /v1/watchlists/:id) — the read endpoints FDD-0144's watchlist reference
// screen actually needs (Stories 20.3-20.5), not a hand-authored spec for
// every one of the ~40 existing route groups, which is disproportionate to
// this story and would drift the moment any route changed. Additional routes
// register their own operations the same way in their own future stories.
// Contract to encode: (1) generateOpenApiDocument() produces a structurally
// valid OpenAPI 3.0.x document (openapi/info/paths present, paths keyed by
// real path strings with lowercase HTTP method keys); (2) the document is
// sourced from the same registry real route modules populate at import time
// — not a duplicate hard-coded list in this test — and includes the real,
// currently-registered watchlist and health operations; (3) the documented
// GET /v1/watchlists operation corresponds to a live, real production route:
// booting the real createApp() and calling it via supertest returns exactly
// one of the status codes the generated document declares for that
// operation; (4) the generated document contains no reference to any
// frontend concept (confirms the spec itself carries no frontend coupling,
// independent of the repo-split procedure).
// Explicitly out of scope: full OpenAPI coverage of every existing route
// (tracked as ongoing, additive work, not a Story 20.1 gate); request/
// response JSON Schema fidelity beyond a minimal, honest description;
// runtime introspection of Express's router tree (evaluated and rejected —
// Express 5's Layer/matcher internals discard the original path string after
// registration, see .claude/skills/openapi-spec-generation/SKILL.md's "Load-
// bearing constraints" for why); the actual git filter-repo extraction, new
// GitHub repository, and CI workflow file, which are infrastructure, not
// application code, and are handled and recorded outside this Jest suite.

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { generateOpenApiDocument } from '../../src/http/openapi/generateOpenApiDocument';
// Importing the real v1 router module is what triggers the real route
// files' registerOpenApiOperation() calls as an import-time side effect —
// exactly the same module the real server imports via createApp().
import '../../src/http/versions/v1/router';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePool();
});

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

describe('Story 20.1 — OpenAPI spec generation (ADR-0144)', () => {
  test('AC0: generateOpenApiDocument() produces a structurally valid OpenAPI 3.0.x document', () => {
    const doc = generateOpenApiDocument();

    expect(doc.openapi).toMatch(/^3\.0\.\d+$/);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
    expect(typeof doc.paths).toBe('object');

    const pathEntries = Object.entries(doc.paths);
    expect(pathEntries.length).toBeGreaterThan(0);

    for (const [path, methods] of pathEntries) {
      expect(path.startsWith('/')).toBe(true);
      expect(typeof methods).toBe('object');
      const methodKeys = Object.keys(methods as Record<string, unknown>);
      expect(methodKeys.length).toBeGreaterThan(0);
      for (const method of methodKeys) {
        expect(['get', 'post', 'put', 'patch', 'delete']).toContain(method);
        const operation = (methods as Record<string, { summary: string; responses: Record<string, unknown> }>)[
          method
        ];
        expect(operation.summary).toBeTruthy();
        expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
      }
    }
  });

  test('AC1: the document includes the real, currently-registered watchlist and health operations', () => {
    const doc = generateOpenApiDocument();

    expect(doc.paths['/v1/health']?.get).toBeDefined();
    expect(doc.paths['/v1/watchlists']?.get).toBeDefined();
    expect(doc.paths['/v1/watchlists/{id}']?.get).toBeDefined();
  });

  test('AC2: the documented GET /v1/watchlists operation matches the real, live production route', async () => {
    const doc = generateOpenApiDocument();
    const documentedStatuses = Object.keys(doc.paths['/v1/watchlists'].get!.responses).map(Number);

    const { tenantId, userId } = await makeTenantWithUser();

    const res = await request(createApp())
      .get('/v1/watchlists')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }));

    expect(documentedStatuses).toContain(res.status);
    expect(res.status).toBe(200);
  });

  test('AC3: the generated document carries no frontend-repository coupling or reference', () => {
    const doc = generateOpenApiDocument();
    const serialized = JSON.stringify(doc).toLowerCase();

    expect(serialized).not.toContain('social-listening-admin');
    expect(serialized).not.toContain('next.js');
    expect(serialized).not.toContain('react');
  });
});
