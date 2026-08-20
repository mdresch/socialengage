'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { PostEnrichmentSummary } from './postDisplay';
import { RunEnrichmentButton } from './RunEnrichmentButton';

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

export interface PostDetailPanelPost {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  bodyMarkdown: string | null;
  snippet: string | null;
  provider: string;
  enrichmentSummary: PostEnrichmentSummary | null;
}

/**
 * 2026-08-19 — extracted from PostsFeedClient.tsx's own detail Slideover
 * body, requested directly by Menno so the Analytics Overview tab's own
 * post-detail drawer (a new, second call site) renders the identical rich
 * view — full body, AI enrichment panel (sentiment bars, entities, key
 * phrases, executive summary — Story 2.17), ingestion telemetry, and raw
 * JSON toggle — rather than a second, drifting copy of the same ~140 lines.
 * Deliberately excludes the outer Slideover chrome (title/subtitle/footer):
 * PostsFeedClient.tsx still wraps this in the shared `Slideover` component;
 * OverviewTab.tsx wraps it in its own stacked-panel markup instead (the
 * shared `Slideover` assumes exactly one full-screen backdrop, which a
 * second, side-by-side panel can't use without breaking every other
 * existing Slideover call site) — see `.claude/skills/analytics-dashboard/
 * SKILL.md`'s own Relations section for the real, contract-verified caller
 * list this extraction is asserted against.
 */
export function PostDetailPanel({ post }: { post: PostDetailPanelPost }) {
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <div className="pf-detail-body">
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
            {post.enrichmentSummary.modelUsed && (
              <span className="pf-enrichment-model">{post.enrichmentSummary.modelUsed}</span>
            )}
            {post.enrichmentSummary.language && (
              <span className="pf-enrichment-language">Language: {post.enrichmentSummary.language}</span>
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
                {post.enrichmentSummary.entities.map((ent) => (
                  <span key={ent} className="pf-chip-entity-lg">
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
  );
}
