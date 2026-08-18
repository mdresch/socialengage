/**
 * Contract: Story 6.26 — Post feed's Provider filter derives its options
 * from real data, not a hardcoded list.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-626
 *
 * Intent: Story 6.26 — no new ADR (ordinary CRUD/UI-surface fix, same
 * category Story 6.21/6.22 already established for the identical bug on
 * two other screens).
 * Scope: social-listening-admin/{
 *   src/app/tenant/posts/PostsFeedClient.tsx (Provider <select>'s options
 *     now derived from the distinct provider values present in `flat`,
 *     the already-fetched full post set, via a small display-label lookup
 *     with a raw-id fallback — not three hardcoded <option> elements)
 * }. No social-listening-core change of any kind.
 *
 * Requested directly by Menno, 2026-08-18, after real Wikipedia posts
 * started landing in the feed but had no way to be selected in the
 * Provider filter — confirmed directly, the filter was three static
 * <option> elements (gnews/newswire/tenant-owned-feed) that never included
 * Wikipedia and never will include any future connector either. This is
 * the third real instance of the identical hardcoded-platform-list bug
 * (Story 6.21's PLATFORMS array, Story 6.22's SOCIAL_PLATFORMS list) —
 * Menno's own framing ("I would expect the connector to become available
 * automatically") names the actual fix: derive the options from real,
 * already-fetched data, not a list that has to be remembered.
 *
 * Contract to encode:
 * - AC1: options are computed from the distinct `provider` values present
 *   in `flat` (extractProviderBadge()'s own existing output) — a fetched
 *   set containing a wikipedia-sourced post renders a "Wikipedia" option;
 *   one without renders none.
 * - AC2: each option's label uses a small lookup table for known
 *   providers, falling back to the raw providerId for any unmapped value
 *   — an unmapped/future provider is still selectable, never silently
 *   hidden.
 * - AC3: options render in a stable, deterministic (alphabetical-by-label)
 *   order.
 * - AC4: existing filter-matching logic is unchanged — re-proven, not
 *   re-designed.
 * - Regression (justified rewrite, dated note on that file directly):
 *   Story 6.11's own 2026-08-17 healing-note test asserted the
 *   tenant-owned-feed option's hyphenated value via a literal source-text
 *   grep (`<option value="tenant-owned-feed"`) — that literal string no
 *   longer appears in source once options are generated from data, so the
 *   test is rewritten to render the component with a real
 *   tenant-owned-feed-sourced post and assert the real rendered option's
 *   value, preserving the original intent (the hyphenated id, never the
 *   underscored form) under the new mechanism.
 *
 * Explicitly out of scope for this contract:
 *   - Any change to tenant/connectors/page.tsx's PLATFORMS array or
 *     tenant/watchlists/page.tsx's SOCIAL_PLATFORMS list — a related,
 *     plausible future follow-on, not solved here.
 *   - Any change to the Sentiment/Watchlist filters' own option lists.
 *   - Any change to fetchAllPosts()/page.tsx (Story 6.18/6.25, unaffected).
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PostsFeedClient } from '../../src/app/tenant/posts/PostsFeedClient';

function post(id: string, providerId: string) {
  return {
    id,
    createdAt: '2026-08-18T09:00:00.000Z',
    publishedAt: '2026-08-18T08:00:00.000Z',
    enrichment: null,
    rawPayload: { providerId, title: `Post ${id}` },
  };
}

/** Isolates just the Provider <select>'s own inner HTML — the page also has a Sentiment <select>, whose options must not leak into these assertions. */
function renderProviderOptionsHtml(posts: ReturnType<typeof post>[]): string {
  const full = renderToStaticMarkup(createElement(PostsFeedClient, { posts, watchlists: [] }));
  const match = full.match(/<select id="pf-provider"[^>]*>([\s\S]*?)<\/select>/);
  if (!match) throw new Error('pf-provider <select> not found in rendered output');
  return match[1];
}

function optionValuesInOrder(html: string): string[] {
  return [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
}

describe('Story 6.26 — Post feed Provider filter derives its options from real data', () => {
  describe('AC1: options are computed from the distinct providers actually present in the fetched post set', () => {
    it('a fetched set containing a wikipedia-sourced post renders a Wikipedia option', () => {
      const html = renderProviderOptionsHtml([post('a', 'gnews'), post('b', 'wikipedia')]);
      expect(html).toMatch(/<option value="wikipedia">Wikipedia<\/option>/);
    });

    it('a fetched set with no wikipedia-sourced post renders no wikipedia option', () => {
      const html = renderProviderOptionsHtml([post('a', 'gnews'), post('b', 'newswire')]);
      expect(html).not.toMatch(/<option value="wikipedia"/);
    });

    it('an empty fetched set renders only the fixed "All Providers" option', () => {
      const html = renderProviderOptionsHtml([]);
      const values = optionValuesInOrder(html);
      expect(values).toEqual(['ALL']);
    });
  });

  describe('AC2: unmapped/future providerId values are still selectable, never silently hidden', () => {
    it('a providerId with no entry in the display-label lookup renders using its own raw id as the label', () => {
      const html = renderProviderOptionsHtml([post('a', 'reddit')]);
      expect(html).toMatch(/<option value="reddit">reddit<\/option>/);
    });
  });

  describe('AC3: options render in a stable, deterministic (alphabetical-by-label) order', () => {
    it('providers supplied out of fetch order render alphabetically by their display label', () => {
      // Fetch/array order deliberately reversed from alphabetical
      // (Wikipedia, Tenant Feed, Newswire, GNews) to prove sorting is real,
      // not incidental to input order.
      const html = renderProviderOptionsHtml([
        post('a', 'wikipedia'),
        post('b', 'tenant-owned-feed'),
        post('c', 'newswire'),
        post('d', 'gnews'),
      ]);
      const values = optionValuesInOrder(html);
      // 'ALL' is always first (the fixed entry), then alphabetical by label:
      // GNews, Newswire, Tenant Feed, Wikipedia.
      expect(values).toEqual(['ALL', 'gnews', 'newswire', 'tenant-owned-feed', 'wikipedia']);
    });
  });

  describe('AC4: existing filter-matching logic (selectedProvider vs. post.provider) is unchanged', () => {
    it('the underlying provider-matching predicate in source is untouched by this story', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'app', 'tenant', 'posts', 'PostsFeedClient.tsx'),
        'utf8'
      );
      expect(source).toContain("post.provider.toLowerCase() !== selectedProvider.toLowerCase()");
    });
  });
});
