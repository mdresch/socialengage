'use client';

import { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { SocialPostSummary, Watchlist } from '@/lib/core-client';
import { flattenPost, type FlatPost } from './postDisplay';
import { RelativeTime } from '@/components/ui';
import { Slideover } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { RunEnrichmentButton } from './RunEnrichmentButton';
import { PostDetailPanel } from './PostDetailPanel';
import { EnrichmentEditDrawer } from './EnrichmentEditDrawer';
import { ComposePostModal } from '@/components/composer';
import type { PostEnrichmentUpdateInput } from '@/lib/core-client';

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const VISIBLE_BATCH_SIZE = 20;

/**
 * Story 6.26 — display labels for the Provider filter's dynamically-derived
 * options (see providerOptions below). This table only affects label text,
 * never which providers are selectable — a providerId with no entry here
 * still renders as an option, using its own raw id as the label. Keep this
 * in sync with real connectors as a courtesy for a nicer label, but never
 * as a gate on whether a provider is filterable at all; that would silently
 * reintroduce the exact bug (Story 6.21/6.22/6.26's own hardcoded-list
 * drift) this story exists to close.
 */
const PROVIDER_LABELS: Record<string, string> = {
  gnews: 'GNews',
  newswire: 'Newswire',
  'tenant-owned-feed': 'Tenant Feed',
  wikipedia: 'Wikipedia',
  facebook: 'Facebook',
  'brave-search': 'Brave Search',
  'bing-search': 'Bing Search',
  instagram: 'Instagram Business',
  linkedin: 'LinkedIn',
};

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

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
  const [postList, setPostList] = useState<SocialPostSummary[]>(posts);
  const flat = useMemo(() => postList.map(flattenPost), [postList]);
  const [isEditingEnrichment, setIsEditingEnrichment] = useState(false);

  /**
   * Story 6.26 — derived from the real, already-fetched post set (Story
   * 6.18), not a hardcoded list. Every provider actually present in the
   * tenant's own data is selectable, automatically, the moment a post from
   * it exists — closing the same hardcoded-platform-list bug Story 6.21/
   * 6.22 already found and fixed on two other screens.
   */
  const providerOptions = useMemo(() => {
    const ids = Array.from(new Set(flat.map((p) => p.provider)));
    return ids
      .map((id) => ({ value: id, label: providerLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [flat]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');
  const [selectedWatchlist, setSelectedWatchlist] = useState('ALL');
  const [activePost, setActivePost] = useState<FlatPost | null>(
    () => (initialActivePostId && flat.find((p) => p.id === initialActivePostId)) || null
  );
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

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
        const inPageName = post.pageName ? post.pageName.toLowerCase().includes(q) : false;
        const inPhrases = post.enrichmentSummary?.keyPhrases.some((kp) => kp.toLowerCase().includes(q)) ?? false;
        const inEntities = post.enrichmentSummary?.entities.some((e) => e.toLowerCase().includes(q)) ?? false;
        if (!inTitle && !inSnippet && !inAuthor && !inPageName && !inPhrases && !inEntities) return false;
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <span>✍️</span>
            <span>Compose Post</span>
          </button>
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
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
              onClick={() => setActivePost(post)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePost(post); }}
              aria-label={`Inspect: ${post.title}`}
            >
              {/* Header row */}
              <div className="pf-post-card-meta">
                <div className="pf-post-card-meta-left">
                  <span className={providerClass(post.provider)}>
                    {post.provider === 'facebook'
                      ? 'Facebook Page'
                      : post.provider === 'instagram'
                      ? 'Instagram Business'
                      : post.provider === 'linkedin'
                      ? 'LinkedIn'
                      : post.provider.replace(/_/g, ' ')}
                  </span>
                  {post.provider === 'facebook' && post.pageName ? (
                    <>
                      <span className="pf-post-page-badge" title={`Hosted on Facebook Page: ${post.pageName}`}>
                        📍 Page: {post.pageName}
                      </span>
                      {post.author && post.author !== post.pageName && (
                        <span className="pf-post-author">By: {post.author}</span>
                      )}
                    </>
                  ) : post.provider === 'instagram' ? (
                    <span className="pf-post-page-badge" title={`Instagram Account: @${post.instagramContext?.username || post.author || ''}`}>
                      📍 @{post.instagramContext?.username || post.author}
                    </span>
                  ) : post.provider === 'linkedin' && post.author ? (
                    <span className="pf-post-author">By: {post.author}</span>
                  ) : (
                    post.author && <span className="pf-post-author">{post.author}</span>
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
              {(post.instagramContext?.thumbnailUrl || post.instagramContext?.mediaUrl) && (
                <div className="pf-post-media-preview">
                  <img
                    src={post.instagramContext.thumbnailUrl || post.instagramContext.mediaUrl || ''}
                    alt={post.title}
                    className="pf-media-thumbnail"
                    loading="lazy"
                  />
                </div>
              )}
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

              {/* Enrichment chips & engagement */}
              <div className="pf-post-card-footer">
                {post.provider === 'instagram' && (post.instagramContext?.likeCount != null || post.instagramContext?.commentsCount != null) && (
                  <span className="pf-chip-engagement">
                    ❤️ {post.instagramContext?.likeCount ?? 0} · 💬 {post.instagramContext?.commentsCount ?? 0}
                  </span>
                )}
                {post.provider === 'linkedin' && (post.linkedinContext?.reactionsCount != null || post.linkedinContext?.commentsCount != null || post.linkedinContext?.sharesCount != null) && (
                  <span className="pf-chip-engagement">
                    👍 {post.linkedinContext?.reactionsCount ?? 0} · 💬 {post.linkedinContext?.commentsCount ?? 0} · 🔄 {post.linkedinContext?.sharesCount ?? 0}
                  </span>
                )}
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
                {post.enrichmentSummary?.entities.slice(0, 3).map((ent) => (
                  <span key={ent} className="pf-chip-entity">
                    <IconBuilding />
                    <span>{ent}</span>
                  </span>
                ))}
                {post.enrichmentSummary?.keyPhrases.slice(0, 3).map((phrase) => (
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

      {/* Detail Slideover & Cascading Edit Drawer */}
      {activePost && (
        <>
          <Slideover
            isOpen={!!activePost}
            onClose={() => {
              setActivePost(null);
              setIsEditingEnrichment(false);
            }}
            title={activePost.title}
            subtitle={
              activePost.provider === 'facebook' && activePost.pageName
                ? `Published on Facebook Page: ${activePost.pageName}${activePost.publishedAt ? ` · ${new Date(activePost.publishedAt).toLocaleString()}` : ''}`
                : activePost.publishedAt
                ? `Published ${new Date(activePost.publishedAt).toLocaleString()} · ${activePost.provider.replace(/_/g, ' ')}`
                : activePost.provider.replace(/_/g, ' ')
            }
            width="lg"
            className={isEditingEnrichment ? 'slideover-shifted' : undefined}
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
                <RunEnrichmentButton
                  postId={activePost.id}
                  isOverridden={activePost.enrichmentSummary?.override?.isOverridden === true}
                />
              </div>
            }
          >
            <PostDetailPanel
              key={activePost.id}
              post={activePost}
              onEdit={() => setIsEditingEnrichment(true)}
            />
          </Slideover>

          {/* Cascading Secondary Edit Drawer */}
          {isEditingEnrichment && (
            <EnrichmentEditDrawer
              isOpen={isEditingEnrichment}
              onClose={() => setIsEditingEnrichment(false)}
              post={activePost}
              onSave={async (updates: PostEnrichmentUpdateInput) => {
                const response = await fetch(`/api/posts/${encodeURIComponent(activePost.id)}/enrichment`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                });
                const body = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(body?.error || 'Failed to save enrichment overrides.');
                }
                if (body.post) {
                  const updatedSummary = body.post as SocialPostSummary;
                  setPostList((prev) => prev.map((p) => (p.id === updatedSummary.id ? updatedSummary : p)));
                  setActivePost(flattenPost(updatedSummary));
                }
              }}
            />
          )}
        </>
      )}

      {/* Compose & Multi-Platform Publishing Modal */}
      <ComposePostModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
