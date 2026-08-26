/**
 * Contract: Story 6.39 — Polypost Composer Real Publish Flow
 * Sourced from ADR-0075 (Accepted 2026-08-23).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-639
 *
 * Intent:
 * 1. core-client.ts gains publishPost(payload) calling POST /v1/outbound/posts,
 *    returning { rows: OutboundActivity[]; status: number }.
 * 2. A same-origin proxy route src/app/api/outbound/posts/route.ts is added to
 *    attach the session and forward to core.
 * 3. PolypostComposer's handleConfirmPublish calls publishPost() with the
 *    composer state (text, overrides, selected Pages, optional link preview).
 *    On 201/207 the dialog closes and a per-Page status toast/list is shown;
 *    on 422/429/5xx a per-Page error toast is shown.
 * 4. Non-Facebook selected platforms (LinkedIn, etc.) are rendered in the
 *    PublishTargetsDialog as disabled with an explanatory note until their
 *    connector publish() is implemented.
 * 5. The success message lists the actual external_url for each successfully
 *    published Page, or the normalized error_code for each failed one.
 * 6. handleOpenPublishDialog fails early if no active Facebook Pages are
 *    available (in addition to the existing platform/content validation).
 * 7. Jest contract test asserts that PolypostComposer renders the platform-
 *    aware publish button and that PublishTargetsDialog is wired to a
 *    publishPost-shaped fetch, by source inspection.
 *
 * Scope:
 * - social-listening-admin/src/lib/core-client.ts (add publishPost)
 * - social-listening-admin/src/app/api/outbound/posts/route.ts (new BFF proxy)
 * - social-listening-admin/src/components/composer/PolypostComposer.tsx (update handleConfirmPublish)
 * - social-listening-admin/src/components/composer/PublishTargetsDialog.tsx (disable non-Facebook platforms)
 * - social-listening-admin/.claude/skills/polypost-composer/SKILL.md (update)
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.39 — Polypost Composer Real Publish Flow', () => {
  // -----------------------------------------------------------------------
  // AC1: core-client.ts gains publishPost calling POST /v1/outbound/posts
  // -----------------------------------------------------------------------
  describe('AC1: core-client.ts publishPost function', () => {
    it('exports a publishPost function that calls POST /v1/outbound/posts', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/export async function publishPost\(/);
      expect(source).toContain('/v1/outbound/posts');
      expect(source).toMatch(/OutboundActivity/);
    });

    it('publishPost returns a { rows, status } outcome shape', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/publishPost/);
      // The return type must include rows and status
      expect(source).toMatch(/rows.*PublishPostRow/);
    });
  });

  // -----------------------------------------------------------------------
  // AC2: Same-origin proxy route /api/outbound/posts
  // -----------------------------------------------------------------------
  describe('AC2: Same-origin proxy route', () => {
    it('src/app/api/outbound/posts/route.ts exists and proxies to publishPost', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'posts', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSource = fs.readFileSync(routePath, 'utf8');
      expect(routeSource).toContain('publishPost');
      expect(routeSource).toContain('POST');
    });
  });

  // -----------------------------------------------------------------------
  // AC3: PolypostComposer handleConfirmPublish calls publishPost
  // -----------------------------------------------------------------------
  describe('AC3: PolypostComposer calls publishPost on confirm', () => {
    it('PolypostComposer.tsx imports PublishPostRow and calls the BFF proxy', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/PublishPostRow/);
      expect(source).toMatch(/\/api\/outbound\/posts/);
    });

    it('handleConfirmPublish calls the BFF proxy with composer state (text, pages, overrides, link preview)', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/handleConfirmPublish/);
      // The confirm handler must call the BFF proxy, not just simulate with setTimeout
      expect(source).toMatch(/fetch\(['"]\/api\/outbound\/posts/);
      // Must pass selected pages / target assets
      expect(source).toMatch(/pageId/);
    });

    it('on 201/207 success the dialog closes and per-Page status is shown', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      // Must handle 201 or 207 status codes
      expect(source).toMatch(/20[17]/);
      // Must close the dialog on success
      expect(source).toMatch(/setShowPublishDialog\(false\)/);
    });

    it('on 422/429/5xx error a per-Page error toast is shown', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      // Must handle error status codes
      expect(source).toMatch(/422|429|5\d\d/);
    });
  });

  // -----------------------------------------------------------------------
  // AC4: Non-Facebook platforms disabled in PublishTargetsDialog
  // -----------------------------------------------------------------------
  describe('AC4: Non-Facebook platforms disabled in PublishTargetsDialog', () => {
    it('PublishTargetsDialog renders non-Facebook platforms as disabled with an explanatory note', () => {
      const source = readSrc('components', 'composer', 'PublishTargetsDialog.tsx');
      // Must have some logic for non-Facebook platforms being disabled
      expect(source).toMatch(/disabled/i);
      expect(source).toMatch(/not yet|not available|coming soon|not supported/i);
    });
  });

  // -----------------------------------------------------------------------
  // AC5: Success message lists external_url or error_code per Page
  // -----------------------------------------------------------------------
  describe('AC5: Per-Page success/error details in status message', () => {
    it('PolypostComposer renders external_url for successful posts and error_code for failures', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/external_url|externalUrl/);
      expect(source).toMatch(/error_code|errorCode/);
    });
  });

  // -----------------------------------------------------------------------
  // AC6: handleOpenPublishDialog fails early if no active Facebook Pages
  // -----------------------------------------------------------------------
  describe('AC6: Early failure when no active Facebook Pages', () => {
    it('handleOpenPublishDialog checks for active Facebook Pages before opening dialog', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/handleOpenPublishDialog/);
      // Must have some check for Facebook Pages availability
      expect(source).toMatch(/facebook.*page|active.*page|page.*available/i);
    });
  });
});
