'use client';

import { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { SocialPostSummary, Watchlist } from '@/lib/core-client';
import {
  extractDisplayText,
  extractProviderBadge,
  extractEnrichmentSummary,
  extractUrl,
  extractAuthor,
  type PostEnrichmentSummary,
} from './postDisplay';
import { RelativeTime } from '@/components/ui';
import { Slideover } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { RunEnrichmentButton } from './RunEnrichmentButton';

// ---------------------------------------------------------------------------
// Inline SVG icons (lucide-react is not installed)
// ---------------------------------------------------------------------------

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 7h.01M16 7h.01M8 12h.01M16 12h.01" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Derived type for flattened post display data
// ---------------------------------------------------------------------------

interface FlatPost {
  id: string;
  createdAt: string;
  publishedAt: string | null;
  rawPayload: unknown;
  enrichment: unknown;
  bodyMarkdown: string | null;
  // derived
  title: string;
  snippet: string | null;
  provider: string;
  url: string | null;
  author: string | null;
  enrichmentSummary: PostEnrichmentSummary | null;
}

function flattenPost(post: SocialPostSummary): FlatPost {
  const { title, snippet } = extractDisplayText(post.rawPayload);
  return {
    ...post,
    title,
    snippet,
    provider: extractProviderBadge(post.rawPayload),
    url: extractUrl(post.rawPayload),
    author: extractAuthor(post.rawPayload),
    enrichmentSummary: post.enrichment ? extractEnrichmentSummary(post.enrichment) : null,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const VISIBLE_BATCH_SIZE = 20;

/**
 * Story 6.11 enhancement, 2026-08-17 — a defensive prefix length for the
 * card-list teaser's Markdown source, matching ADR-0053's own
 * MAX_BODY_SOURCE_LENGTH-shaped precedent: the CSS `-webkit-line-clamp: 3`
 * on `.pf-post-card-snippet` already visually truncates to 3 lines
 * regardless of source length, so this only bounds DOM/parse cost across a
 * page of many cards, not visible truncation.
 */
const CARD_SNIPPET_SOURCE_LENGTH = 500;

interface PostsFeedClientProps {
  posts: SocialPostSummary[];
  watchlists: Watchlist[];
  /**
   * Story 6.19 testability seam only — same precedent as Story 6.14's
   * `initialEntries`. Seeds the Slideover open with a matching post's id so
   * its Markdown-rendered body can be proven under `renderToStaticMarkup()`
   * (this repo has no DOM-interaction test runner). Real usage (page.tsx)
   * never passes it.
   */
  initialActivePostId?: string;
}

/**
 * Story 6.18 — `posts` is now the tenant's entire real, fetched set
 * (page.tsx's own paginated loop), not one default-sized page — search/
 * filter below already operated over whatever it was given, so widening
 * that input is the whole fix. Rendering is still batched client-side
 * (`visibleCount`, "Show more") purely for DOM/perf reasons, never to limit
 * what search/filter can actually see.
 */
export function PostsFeedClient({ posts, watchlists, initialActivePostId }: PostsFeedClientProps) {
  const flat = useMemo(() => posts.map(flattenPost), [posts]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');
  const [selectedWatchlist, setSelectedWatchlist] = useState('ALL');
  const [activePost, setActivePost] = useState<FlatPost | null>(
    () => (initialActivePostId && flat.find((p) => p.id === initialActivePostId)) || null
  );
  const [showRawJson, setShowRawJson] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);

  const filteredPosts = useMemo(() => {
    return flat.filter((post) => {
      if (selectedProvider !== 'ALL' && post.provider.toLowerCase() !== selectedProvider.toLowerCase()) return false;
      if (selectedSentiment !== 'ALL' && post.enrichmentSummary?.sentiment?.toLowerCase() !== selectedSentiment.toLowerCase()) return false;
      if (selectedWatchlist !== 'ALL') {
        // rawPayload may carry matchedWatchlistId
        const p = post.rawPayload && typeof post.rawPayload === 'object' ? post.rawPayload as Record<string, unknown> : {};
        if (p.matchedWatchlistId !== selectedWatchlist) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = post.title.toLowerCase().includes(q);
        const inSnippet = post.snippet ? post.snippet.toLowerCase().includes(q) : false;
        const inAuthor = post.author ? post.author.toLowerCase().includes(q) : false;
        const inPhrases = post.enrichmentSummary?.keyPhrases.some((kp) => kp.toLowerCase().includes(q)) ?? false;
        const inEntities = post.enrichmentSummary?.entities.some((e) => e.toLowerCase().includes(q)) ?? false;
        if (!inTitle && !inSnippet && !inAuthor && !inPhrases && !inEntities) return false;
      }
      return true;
    });
  }, [flat, selectedProvider, selectedSentiment, selectedWatchlist, searchQuery]);

  // Story 6.18 — a filter/search change re-scopes the matched set, so the
  // visible batch resets too; otherwise a narrower result could leave
  // "Show more" stuck showing zero new posts, or a wider one could hide
  // real matches behind a stale, too-small visible count.
  useEffect(() => {
    setVisibleCount(VISIBLE_BATCH_SIZE);
  }, [selectedProvider, selectedSentiment, selectedWatchlist, searchQuery]);

  const visiblePosts = useMemo(() => filteredPosts.slice(0, visibleCount), [filteredPosts, visibleCount]);

  function resetFilters() {
    setSearchQuery('');
    setSelectedProvider('ALL');
    setSelectedSentiment('ALL');
    setSelectedWatchlist('ALL');
  }

  const providerClass = (provider: string) => {
    const slug = provider.toLowerCase().replace(/_/g, '-');
    return `provider-pill provider-pill-${slug}`;
  };

  const sentimentChipClass = (sentiment: string | null) => {
    if (!sentiment) return 'enrichment-chip enrichment-chip-sentiment-neutral';
    return `enrichment-chip enrichment-chip-sentiment-${sentiment.toLowerCase()}`;
  };

  const sentimentDotClass = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'pf-sentiment-dot pf-sentiment-dot-positive';
      case 'negative': return 'pf-sentiment-dot pf-sentiment-dot-negative';
      default: return 'pf-sentiment-dot pf-sentiment-dot-neutral';
    }
  };

  return (
    <div className="pf-root">
      {/* Page Header */}
      <div className="pf-header">
        <div>
          <h1 className="page-title">Social &amp; Media Posts</h1>
          <p className="page-subtitle">
            Real-time ingested articles, releases, and social mentions enriched with Azure AI
          </p>
        </div>
        <div className="pf-header-count">
          {(() => {
            const filtersActive = searchQuery.trim() || selectedProvider !== 'ALL' || selectedSentiment !== 'ALL' || selectedWatchlist !== 'ALL';
            if (filtersActive) {
              return (
                <>
                  <strong>{filteredPosts.length}</strong> of {flat.length} match
                </>
              );
            }
            return (
              <>
                <strong>{flat.length}</strong> post{flat.length !== 1 ? 's' : ''}
              </>
            );
          })()}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="pf-filter-bar">
        <div className="pf-filter-inner">
          {/* Search */}
          <div className="pf-search-wrap">
            <span className="pf-search-icon"><IconSearch /></span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headline, snippet, entity, key phrase…"
              className="pf-search-input"
            />
          </div>

          {/* Provider */}
          <div className="pf-filter-group">
            <label className="pf-filter-label" htmlFor="pf-provider">Provider</label>
            <select
              id="pf-provider"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="pf-filter-select"
            >
              <option value="ALL">All Providers</option>
              <option value="gnews">GNews</option>
              <option value="newswire">Newswire</option>
              <option value="tenant-owned-feed">Tenant Feed</option>
            </select>
          </div>

          {/* Sentiment */}
          <div className="pf-filter-group">
            <label className="pf-filter-label" htmlFor="pf-sentiment">Sentiment</label>
            <select
              id="pf-sentiment"
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
              className="pf-filter-select"
            >
              <option value="ALL">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          {/* Watchlist */}
          {watchlists.length > 0 && (
            <div className="pf-filter-group">
              <label className="pf-filter-label" htmlFor="pf-watchlist">Watchlist</label>
              <select
                id="pf-watchlist"
                value={selectedWatchlist}
                onChange={(e) => setSelectedWatchlist(e.target.value)}
                className="pf-filter-select pf-filter-select-wide"
              >
                <option value="ALL">All Watchlists</option>
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <EmptyState
          heading={flat.length === 0 ? 'No posts yet' : 'No matching posts found'}
          body={
            flat.length === 0
              ? 'Connect a platform to start ingesting social posts and news articles.'
              : 'Try broadening your search or resetting the filters.'
          }
          action={
            flat.length > 0
              ? { label: 'Reset Filters', onClick: resetFilters }
              : undefined
          }
        />
      ) : (
        <div className="pf-list">
          {visiblePosts.map((post) => (
            <article
              key={post.id}
              className="pf-post-card"
              onClick={() => { setShowRawJson(false); setActivePost(post); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowRawJson(false); setActivePost(post); } }}
              aria-label={`Inspect: ${post.title}`}
            >
              {/* Header row */}
              <div className="pf-post-card-meta">
                <div className="pf-post-card-meta-left">
                  <span className={providerClass(post.provider)}>
                    {post.provider.replace(/_/g, ' ')}
                  </span>
                  {post.author && (
                    <span className="pf-post-author">{post.author}</span>
                  )}
                </div>
                <div className="pf-post-card-meta-right">
                  {post.publishedAt && (
                    <RelativeTime timestamp={post.publishedAt} className="pf-post-time" />
                  )}
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="pf-external-link"
                      title="Open original source URL"
                    >
                      <IconExternalLink />
                    </a>
                  )}
                </div>
              </div>

              {/* Title & snippet */}
              <h2 className="pf-post-card-title">{post.title}</h2>
              {(post.bodyMarkdown || post.snippet) && (
                <p className="pf-post-card-snippet">
                  {post.bodyMarkdown ? (
                    <ReactMarkdown allowedElements={[]} unwrapDisallowed>
                      {post.bodyMarkdown.slice(0, CARD_SNIPPET_SOURCE_LENGTH)}
                    </ReactMarkdown>
                  ) : (
                    post.snippet
                  )}
                </p>
              )}

              {/* Enrichment chips */}
              <div className="pf-post-card-footer">
                {post.enrichmentSummary?.sentiment && (
                  <span className={sentimentChipClass(post.enrichmentSummary.sentiment)}>
                    <span className={sentimentDotClass(post.enrichmentSummary.sentiment)} />
                    {post.enrichmentSummary.sentiment}
                    {post.enrichmentSummary.sentimentScores && (() => {
                      const s = post.enrichmentSummary!.sentiment!.toLowerCase() as 'positive' | 'neutral' | 'negative';
                      const score = post.enrichmentSummary!.sentimentScores![s];
                      return score !== undefined
                        ? ` (${(score * 100).toFixed(0)}%)`
                        : null;
                    })()}
                  </span>
                )}
                {post.enrichmentSummary?.entities.slice(0, 2).map((ent) => (
                  <span key={ent} className="pf-chip-entity">
                    <IconBuilding />
                    <span>{ent}</span>
                  </span>
                ))}
                {post.enrichmentSummary?.keyPhrases.slice(0, 2).map((phrase) => (
                  <span key={phrase} className="pf-chip-phrase">#{phrase}</span>
                ))}

                <span className="pf-inspect-link">
                  Inspect details <IconChevronRight />
                </span>
              </div>
            </article>
          ))}

          {/* Pagination footer — Story 6.18: a client-side "Show more" over
              the already-fetched, already-filtered result set, never a
              server round trip. */}
          <div className="pf-pagination">
            <span className="pf-pagination-info">
              {visiblePosts.length} of {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''} shown
            </span>
            {visibleCount < filteredPosts.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((v) => v + VISIBLE_BATCH_SIZE)}
                className="btn btn-primary btn-sm pf-next-btn"
              >
                Show more <IconChevronRight />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detail Slideover */}
      {activePost && (
        <Slideover
          isOpen={!!activePost}
          onClose={() => setActivePost(null)}
          title={activePost.title}
          subtitle={
            activePost.publishedAt
              ? `Published ${new Date(activePost.publishedAt).toLocaleString()} · ${activePost.provider.replace(/_/g, ' ')}`
              : activePost.provider.replace(/_/g, ' ')
          }
          width="lg"
          footer={
            <div className="pf-slideover-footer-inner">
              {activePost.url ? (
                <a
                  href={activePost.url}
                  target="_blank"
                  rel="noreferrer"
                  className="pf-footer-ext-link"
                >
                  <IconExternalLink /> Open original article
                </a>
              ) : (
                <span />
              )}
              <RunEnrichmentButton postId={activePost.id} />
            </div>
          }
        >
          <div className="pf-detail-body">
            {/* Full body */}
            {(activePost.bodyMarkdown || activePost.snippet) && (
              <div>
                <h3 className="pf-detail-section-title">Ingested Article Body</h3>
                {activePost.bodyMarkdown ? (
                  <div className="pf-detail-body-markdown">
                    <ReactMarkdown>{activePost.bodyMarkdown}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="pf-detail-body-text">{activePost.snippet}</div>
                )}
              </div>
            )}

            {/* AI Enrichment Panel */}
            {activePost.enrichmentSummary ? (
              <div className="pf-enrichment-panel">
                <div className="pf-enrichment-panel-header">
                  <div className="pf-enrichment-panel-title">
                    <IconSparkles />
                    Azure AI Cognitive Analysis
                  </div>
                  {activePost.enrichmentSummary.modelUsed && (
                    <span className="pf-enrichment-model">{activePost.enrichmentSummary.modelUsed}</span>
                  )}
                  {activePost.enrichmentSummary.language && (
                    <span className="pf-enrichment-language">Language: {activePost.enrichmentSummary.language}</span>
                  )}
                </div>

                {/* Sentiment scores */}
                {activePost.enrichmentSummary.sentiment && (
                  <div className="pf-sentiment-section">
                    <div className="pf-sentiment-header">
                      <span>Sentiment: <strong>{activePost.enrichmentSummary.sentiment}</strong></span>
                      {activePost.enrichmentSummary.sentimentScores && (
                        <span className="pf-sentiment-sub">Confidence Distribution</span>
                      )}
                    </div>
                    {activePost.enrichmentSummary.sentimentScores && (
                      <div className="pf-sentiment-bars">
                        {(['positive', 'neutral', 'negative'] as const).map((key) => {
                          const score = activePost.enrichmentSummary!.sentimentScores![key];
                          const pct = (score * 100).toFixed(0);
                          return (
                            <div key={key} className="pf-bar-row">
                              <span className={`pf-bar-label pf-bar-label-${key}`}>
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                              </span>
                              <div className="pf-bar-track">
                                <div
                                  className={`pf-bar-fill pf-bar-fill-${key}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="pf-bar-pct">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Named entities */}
                {activePost.enrichmentSummary.entities.length > 0 && (
                  <div>
                    <span className="pf-detail-field-label">Extracted Named Entities</span>
                    <div className="pf-chip-group">
                      {activePost.enrichmentSummary.entities.map((ent) => (
                        <span key={ent} className="pf-chip-entity-lg">
                          <IconTag /> <strong>{ent}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key phrases */}
                {activePost.enrichmentSummary.keyPhrases.length > 0 && (
                  <div>
                    <span className="pf-detail-field-label">Extracted Key Phrases</span>
                    <div className="pf-chip-group">
                      {activePost.enrichmentSummary.keyPhrases.map((phrase) => (
                        <span key={phrase} className="pf-chip-phrase-lg">#{phrase}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pf-no-enrichment">
                <p>This post has not been enriched yet.</p>
                <RunEnrichmentButton postId={activePost.id} />
              </div>
            )}

            {/* Ingestion telemetry */}
            <div className="pf-telemetry">
              <div className="pf-telemetry-row">
                <span>Post ID</span>
                <code>{activePost.id}</code>
              </div>
              <div className="pf-telemetry-row">
                <span>Ingested At</span>
                <code>{new Date(activePost.createdAt).toISOString()}</code>
              </div>
              <div className="pf-telemetry-row">
                <span>Provider</span>
                <code>{activePost.provider}</code>
              </div>
            </div>

            {/* Raw JSON toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowRawJson((v) => !v)}
                className="pf-raw-toggle"
              >
                <span className="pf-raw-toggle-left">
                  <IconCode />
                  {showRawJson ? 'Hide Raw Ingestion JSON' : 'Inspect Raw Ingestion Payload'}
                </span>
                <span>{showRawJson ? '▲' : '▼'}</span>
              </button>
              {showRawJson && (
                <pre className="pf-raw-json">
                  {JSON.stringify(activePost.rawPayload, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </Slideover>
      )}
    </div>
  );
}
