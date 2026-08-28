'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  extractFacebookPageContext,
  extractInstagramContext,
  extractLinkedInContext,
  extractUrl,
  extractWatchlistId,
  type PostEnrichmentSummary,
} from './postDisplay';
import { RunEnrichmentButton } from './RunEnrichmentButton';
import { PostRepliesTab } from './PostRepliesTab';
import { CRMHandoffModal } from '@/components/crm/CRMHandoffModal';
import type { OutboundActivity } from '@/lib/core-client';

// ---------------------------------------------------------------------------
// Inline SVG icons — same set PostsFeedClient.tsx already defines; lucide-react
// is not installed. Kept local to this file (not shared) since this is the
// only other place they're used, matching this project's existing per-file
// icon convention (GlobalDateRangePicker.tsx, OverviewTab.tsx each keep their
// own small icon sets too, rather than a single shared icon module nobody
// asked for yet).
// ---------------------------------------------------------------------------

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
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

function IconCode() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconMessageSquare() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconReply() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

export interface PostDetailPanelPost {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  bodyMarkdown: string | null;
  snippet: string | null;
  provider: string;
  pageName?: string | null;
  pageId?: string | null;
  watchlistId?: string | null;
  watchlistName?: string | null;
  enrichmentSummary: PostEnrichmentSummary | null;
}

export function PostDetailPanel({
  post,
  onEdit,
  onReply,
  watchlists,
  facebookPages,
  optimisticReplies,
  repliesRefresh,
}: {
  post: PostDetailPanelPost;
  onEdit?: () => void;
  onReply?: () => void;
  watchlists?: { id: string; name?: string }[];
  facebookPages?: { pageId: string; pageName: string }[];
  optimisticReplies?: OutboundActivity[];
  repliesRefresh?: number;
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'replies'>('details');
  const [isCrmOpen, setIsCrmOpen] = useState(false);

  const supportedReplyProviders = ['facebook'];
  const isReplySupported = supportedReplyProviders.includes(post.provider);
  const hasCredential = post.provider === 'facebook' && (facebookPages ?? []).length > 0;
  const canReply = isReplySupported && hasCredential;
  const replyTooltip = !isReplySupported
    ? 'Replies are not supported for this provider yet.'
    : !hasCredential
    ? 'No active credential for this provider. Connect it first.'
    : 'Reply to this post';

  return (
    <div className="pf-detail-body">
      <div className="pf-detail-header">
        <div className="pf-detail-tablist" role="tablist" aria-label="Post detail tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            className={`pf-detail-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <IconFileText />
            <span>Details</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'replies'}
            className={`pf-detail-tab ${activeTab === 'replies' ? 'active' : ''}`}
            onClick={() => setActiveTab('replies')}
          >
            <IconMessageSquare />
            <span>Replies</span>
            {optimisticReplies && optimisticReplies.length > 0 && (
              <span className="pf-detail-tab-badge">{optimisticReplies.length}</span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsCrmOpen(true)}
            aria-label="Push to CRM"
            title="Escalate post to CRM (Dynamics 365, Salesforce, HubSpot)"
            className="pf-crm-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>💼</span>
            <span>Push to CRM</span>
          </button>
          <button
            type="button"
            onClick={() => onReply?.()}
            disabled={!canReply}
            aria-label="Reply"
            title={replyTooltip}
            className="pf-reply-btn"
          >
            <IconReply />
            <span>Reply</span>
          </button>
        </div>
      </div>

      {activeTab === 'details' && (
        <div className="pf-detail-tab-panel">
      {/* Instagram Media & Carousel Gallery (Story 6.34, ADR-0068) */}
      {(() => {
        const igContext = extractInstagramContext(post.rawPayload);
        if (!igContext) return null;
        const hasChildren = igContext.children && igContext.children.length > 0;
        const hasSingleMedia = !hasChildren && (igContext.thumbnailUrl || igContext.mediaUrl);
        if (!hasChildren && !hasSingleMedia) return null;

        return (
          <div className="pf-detail-media-section">
            <h3 className="pf-detail-section-title">
              {hasChildren ? `Instagram Carousel Gallery (${igContext.children.length} items)` : 'Instagram Media'}
            </h3>
            {hasChildren ? (
              <div className="pf-carousel-gallery" role="group" aria-label="Instagram Carousel Items">
                {igContext.children.map((child, idx) => (
                  <div key={child.id || idx} className="pf-carousel-item-wrapper">
                    {(child.thumbnailUrl || child.mediaUrl) ? (
                      <img
                        src={child.thumbnailUrl || child.mediaUrl}
                        alt={`Carousel item ${idx + 1}`}
                        className="pf-carousel-thumbnail"
                        loading="lazy"
                      />
                    ) : (
                      <div className="pf-carousel-placeholder">
                        <span>{child.mediaType || 'MEDIA'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pf-single-media-wrapper">
                <img
                  src={igContext.thumbnailUrl || igContext.mediaUrl || ''}
                  alt={post.snippet || 'Instagram media'}
                  className="pf-detail-media-preview"
                  loading="lazy"
                />
              </div>
            )}
            {igContext.childrenTruncated && (
              <div className="pf-carousel-truncated-notice">
                <a
                  href={igContext.permalink || extractUrl(post.rawPayload) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="pf-gallery-link"
                >
                  View full gallery on Instagram →
                </a>
              </div>
            )}
          </div>
        );
      })()}

      {/* Full body */}
      {(post.bodyMarkdown || post.snippet) && (
        <div>
          <h3 className="pf-detail-section-title">Ingested Article Body</h3>
          {post.bodyMarkdown ? (
            <div className="pf-detail-body-markdown">
              <ReactMarkdown>{post.bodyMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <div className="pf-detail-body-text">{post.snippet}</div>
          )}
        </div>
      )}

      {/* AI Enrichment Panel */}
      {post.enrichmentSummary ? (
        <div className="pf-enrichment-panel">
          <div className="pf-enrichment-panel-header">
            <div className="pf-enrichment-panel-title">
              <IconSparkles />
              Azure AI Cognitive Analysis
            </div>
            {post.enrichmentSummary.override?.isOverridden && (
              <span
                className="pf-override-badge"
                title={`Edited by user${
                  post.enrichmentSummary.override.overriddenByUserId
                    ? ` (${post.enrichmentSummary.override.overriddenByUserId})`
                    : ''
                }${
                  post.enrichmentSummary.override.overriddenAt
                    ? ` on ${new Date(post.enrichmentSummary.override.overriddenAt).toLocaleString()}`
                    : ''
                }`}
              >
                Edited by user
              </span>
            )}
            {post.enrichmentSummary.modelUsed && (
              <span className="pf-enrichment-model">{post.enrichmentSummary.modelUsed}</span>
            )}
            {post.enrichmentSummary.language && (
              <span className="pf-enrichment-language">Language: {post.enrichmentSummary.language}</span>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="pf-enrich-edit-btn"
                aria-label="Edit enrichment details"
                title="Edit enrichment attributes"
              >
                <IconPencil />
                <span>Edit</span>
              </button>
            )}
          </div>

          {/* Sentiment scores */}
          {post.enrichmentSummary.sentiment && (
            <div className="pf-sentiment-section">
              <div className="pf-sentiment-header">
                <span>Sentiment: <strong>{post.enrichmentSummary.sentiment}</strong></span>
                {post.enrichmentSummary.sentimentScores && (
                  <span className="pf-sentiment-sub">Confidence Distribution</span>
                )}
              </div>
              {post.enrichmentSummary.sentimentScores && (
                <div className="pf-sentiment-bars">
                  {(['positive', 'neutral', 'negative'] as const).map((key) => {
                    const score = post.enrichmentSummary!.sentimentScores![key];
                    const pct = (score * 100).toFixed(0);
                    return (
                      <div key={key} className="pf-bar-row">
                        <span className={`pf-bar-label pf-bar-label-${key}`}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </span>
                        <div className="pf-bar-track">
                          <div className={`pf-bar-fill pf-bar-fill-${key}`} style={{ width: `${pct}%` }} />
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
          {post.enrichmentSummary.entities.length > 0 && (
            <div>
              <span className="pf-detail-field-label">Extracted Named Entities</span>
              <div className="pf-chip-group">
                {post.enrichmentSummary.namedEntities && post.enrichmentSummary.namedEntities.length > 0
                  ? post.enrichmentSummary.namedEntities.map((ent, idx) => (
                      <span key={`${ent.text}-${idx}`} className="pf-chip-entity-lg">
                        <IconTag /> <strong>{ent.text}</strong>
                        {ent.category && (
                          <span className="pf-chip-entity-category">{ent.category}</span>
                        )}
                      </span>
                    ))
                  : post.enrichmentSummary.entities.map((ent, idx) => (
                      <span key={`${ent}-${idx}`} className="pf-chip-entity-lg">
                        <IconTag /> <strong>{ent}</strong>
                      </span>
                    ))}
              </div>
            </div>
          )}

          {/* Key phrases */}
          {post.enrichmentSummary.keyPhrases.length > 0 && (
            <div>
              <span className="pf-detail-field-label">Extracted Key Phrases</span>
              <div className="pf-chip-group">
                {post.enrichmentSummary.keyPhrases.map((phrase) => (
                  <span key={phrase} className="pf-chip-phrase-lg">#{phrase}</span>
                ))}
              </div>
            </div>
          )}

          {/* Executive summary — Story 2.17's own enrichment.summary */}
          {post.enrichmentSummary.summary && (
            <div className="pf-summary-section">
              <span className="pf-detail-field-label">Executive Summary</span>
              <p className="pf-summary-text">{post.enrichmentSummary.summary}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="pf-no-enrichment">
          <p>This post has not been enriched yet.</p>
          <RunEnrichmentButton postId={post.id} />
        </div>
      )}

      {/* Ingestion telemetry */}
      <div className="pf-telemetry">
        <div className="pf-telemetry-row">
          <span>Post ID</span>
          <code>{post.id}</code>
        </div>
        <div className="pf-telemetry-row">
          <span>Ingested At</span>
          <code>{new Date(post.createdAt).toISOString()}</code>
        </div>
        <div className="pf-telemetry-row">
          <span>Provider</span>
          <code>{post.provider}</code>
        </div>
        {(() => {
          const fbContext = extractFacebookPageContext(post.rawPayload, facebookPages);
          if (post.provider !== 'facebook' && (!fbContext || (!fbContext.pageName && !fbContext.pageId))) return null;
          const pageName = fbContext?.pageName || post.pageName || (post.provider === 'facebook' && post.snippet ? 'Facebook Page' : 'Unknown Page');
          const pageId = fbContext?.pageId || post.pageId;
          const author = fbContext?.author;
          const isDistinctAuthor = author && pageName && author !== pageName && author !== 'Facebook Page';
          const pageUrl = pageId ? `https://facebook.com/${pageId}` : null;

          return (
            <>
              <div className="pf-telemetry-row">
                <span>Hosting Facebook Page</span>
                <span>
                  {pageUrl ? (
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pf-footer-ext-link"
                      style={{ fontWeight: 600, color: 'var(--color-accent)' }}
                    >
                      📘 {pageName} ↗
                    </a>
                  ) : (
                    <strong>📘 {pageName}</strong>
                  )}
                  {pageId && <code className="pf-page-id-code" style={{ marginLeft: 6 }}>(ID: {pageId})</code>}
                </span>
              </div>
              {isDistinctAuthor && (
                <div className="pf-telemetry-row">
                  <span>Post Creator / Author</span>
                  <span><strong>👤 {author}</strong></span>
                </div>
              )}
            </>
          );
        })()}
        {(() => {
          const igContext = extractInstagramContext(post.rawPayload);
          if (!igContext || (!igContext.username && !igContext.igUserId)) return null;
          return (
            <div className="pf-telemetry-row">
              <span>Hosting Instagram Account</span>
              <span>
                <strong>@{igContext.username ?? 'unknown'}</strong>
                {igContext.igUserId && <code className="pf-page-id-code">(ID: {igContext.igUserId})</code>}
                {igContext.pageName && <span className="pf-page-name-secondary"> via {igContext.pageName}</span>}
              </span>
            </div>
          );
        })()}
        {(() => {
          const liContext = extractLinkedInContext(post.rawPayload);
          if (post.provider !== 'linkedin' && !liContext) return null;
          const authorId = liContext?.memberId
            ? (liContext.memberId.startsWith('linkedin:') ? liContext.memberId : `linkedin:${liContext.memberId}`)
            : (typeof (post.rawPayload as Record<string, unknown>)?.authorUrn === 'string'
              ? (post.rawPayload as Record<string, unknown>).authorUrn
              : (typeof (post.rawPayload as Record<string, unknown>)?.authorExternalId === 'string'
                ? (post.rawPayload as Record<string, unknown>).authorExternalId
                : null));
          const permalink = liContext?.permalink || extractUrl(post.rawPayload);
          return (
            <>
              {authorId && (
                <div className="pf-telemetry-row">
                  <span>Author ID</span>
                  <code>{authorId as string}</code>
                </div>
              )}
              {liContext?.authorName && (
                <div className="pf-telemetry-row">
                  <span>LinkedIn Author</span>
                  <span><strong>{liContext.authorName}</strong></span>
                </div>
              )}
              {permalink && (
                <div className="pf-telemetry-row">
                  <span>Permalink</span>
                  <a href={permalink} target="_blank" rel="noreferrer" className="pf-footer-ext-link">
                    {permalink}
                  </a>
                </div>
              )}
            </>
          );
        })()}
        {/* Matched Watchlist Link (Wikipedia, Brave Search, Bing Search, etc.) */}
        {(() => {
          let wId = post.watchlistId || extractWatchlistId(post.rawPayload);
          let matchedWl = watchlists?.find((w) => w.id === wId);

          if (!matchedWl && watchlists && watchlists.length > 0) {
            const textToMatch = `${post.snippet || ''} ${post.bodyMarkdown || ''}`.toLowerCase();
            matchedWl = watchlists.find((w) => {
              const targetsPlatform = !(w as any).platformIds || (w as any).platformIds.length === 0 || (w as any).platformIds.includes(post.provider);
              return targetsPlatform && ((w as any).terms || []).some((term: string) => term && textToMatch.includes(term.toLowerCase()));
            }) || (post.provider === 'wikipedia' ? watchlists.find((w) => (w as any).platformIds?.includes('wikipedia')) : undefined);
            if (matchedWl) {
              wId = matchedWl.id;
            }
          }

          const wName = post.watchlistName || matchedWl?.name || (wId ? `Watchlist (${wId.slice(0, 8)})` : null);
          if (!wName) return null;

          return (
            <div className="pf-telemetry-row">
              <span>Matched Watchlist</span>
              <span>
                <a
                  href={`/tenant/watchlists`}
                  className="pf-footer-ext-link"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-accent)',
                    fontWeight: 600,
                  }}
                  title={`View watchlist settings for ${wName}`}
                >
                  🎯 {wName}
                </a>
                {wId && <code className="pf-page-id-code" style={{ marginLeft: 6 }}>(ID: {wId})</code>}
              </span>
            </div>
          );
        })()}
        {/* Wikipedia Article Metadata */}
        {(() => {
          if (post.provider !== 'wikipedia') return null;
          const p = post.rawPayload && typeof post.rawPayload === 'object' ? (post.rawPayload as Record<string, unknown>) : {};
          const title = typeof p.title === 'string' ? p.title : null;
          const pageId = p.pageid ? String(p.pageid) : null;
          const revId = p.revid ? String(p.revid) : null;
          const wikiUrl = title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}` : null;
          return (
            <>
              {title && wikiUrl && (
                <div className="pf-telemetry-row">
                  <span>Wikipedia Article</span>
                  <span>
                    <a
                      href={wikiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pf-footer-ext-link"
                    >
                      <strong>{title}</strong> ↗
                    </a>
                    {pageId && <code className="pf-page-id-code" style={{ marginLeft: 6 }}>(Page: {pageId})</code>}
                    {revId && <code className="pf-page-id-code" style={{ marginLeft: 4 }}>(Rev: {revId})</code>}
                  </span>
                </div>
              )}
            </>
          );
        })()}
        {/* Brave / Bing Search Query Metadata */}
        {(() => {
          if (post.provider !== 'brave-search' && post.provider !== 'bing-search') return null;
          const p = post.rawPayload && typeof post.rawPayload === 'object' ? (post.rawPayload as Record<string, unknown>) : {};
          const query = typeof p.query === 'string' ? p.query : (typeof p.searchQuery === 'string' ? p.searchQuery : null);
          return (
            <>
              {query && (
                <div className="pf-telemetry-row">
                  <span>Search Query</span>
                  <code>{query}</code>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Raw JSON toggle */}
      <div>
        <button type="button" onClick={() => setShowRawJson((v) => !v)} className="pf-raw-toggle">
          <span className="pf-raw-toggle-left">
            <IconCode />
            {showRawJson ? 'Hide Raw Ingestion JSON' : 'Inspect Raw Ingestion Payload'}
          </span>
          <span>{showRawJson ? '▲' : '▼'}</span>
        </button>
        {showRawJson && <pre className="pf-raw-json">{JSON.stringify(post.rawPayload, null, 2)}</pre>}
      </div>
    </div>
    )}

    {activeTab === 'replies' && (
      <div className="replies-tab-panel">
        <PostRepliesTab postId={post.id} optimisticReplies={optimisticReplies} refreshToken={repliesRefresh} />
      </div>
    )}

    <CRMHandoffModal
      isOpen={isCrmOpen}
      onClose={() => setIsCrmOpen(false)}
      postId={post.id}
      authorName={post.authorName}
      postExcerpt={post.snippet || post.bodyMarkdown}
    />
  </div>
  );
}
