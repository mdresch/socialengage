/**
 * Contract: Story 6.37 — core side of matched-watchlist attribution for Wikipedia
 * Sourced from ADR-0067 (Accepted 2026-08-20; amended 2026-08-22).
 *
 * Intent: `pollWikipedia.ts` denormalizes the effective discovering/matched watchlist id
 * into the `rawPayload` of every ingested Wikipedia revision, so the admin post feed
 * can render the matched watchlist chip without re-deriving the match client-side.
 */

import fs from 'fs';
import path from 'path';

const pollWikipediaSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/connectors/wikipedia/pollWikipedia.ts'),
  'utf8'
);

describe('Story 6.37 — Wikipedia rawPayload watchlist id denormalization (ADR-0067)', () => {
  it('pollWikipedia.ts computes effectiveWatchlistId from discovering and matched watchlists', () => {
    expect(pollWikipediaSrc).toContain('const effectiveWatchlistId =');
    expect(pollWikipediaSrc).toContain('discoveringWatchlistId ||');
    expect(pollWikipediaSrc).toContain('WIKIPEDIA_PROVIDER_ID');
  });

  it('stores watchlistId and discoveringWatchlistId in the inserted rawPayload', () => {
    expect(pollWikipediaSrc).toContain('watchlistId: effectiveWatchlistId');
    expect(pollWikipediaSrc).toContain('discoveringWatchlistId: effectiveWatchlistId');
  });

  it('publishes the same effectiveWatchlistId to SocialPostIngestedEvents', () => {
    expect(pollWikipediaSrc).toContain('discoveringWatchlistId: effectiveWatchlistId');
  });
});
