'use client';

import { useState } from 'react';
import type { ComposerResearchResult } from '@/lib/core-client';

export type DeepResearchPanelState = 'idle' | 'loading' | 'error' | 'success';

export interface DeepResearchPanelProps {
  state: DeepResearchPanelState;
  result?: ComposerResearchResult | null;
  error?: string | null;
  onClose?: () => void;
}

export function DeepResearchPanel({ state, result, error, onClose }: DeepResearchPanelProps) {
  const [showSources, setShowSources] = useState(true);
  const [showKeyPhrases, setShowKeyPhrases] = useState(true);

  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <div
        data-testid="deep-research-panel"
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span
          className="composer-spinner"
          style={{
            display: 'inline-block',
            width: 16,
            height: 16,
            border: '2px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>Researching public conversation…</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="composer-btn-secondary"
            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '2px 8px' }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  if (state === 'error') {
    const err = error || 'Unknown error';
    let helper = 'Please try again later.';
    if (err.includes('AI_PROVIDER_NOT_CAPABLE')) {
      helper = 'Your tenant needs an active Azure OpenAI connector to use Deep Research. Contact your administrator.';
    } else if (err.includes('SEARCH_PROVIDER_UNAVAILABLE')) {
      helper = 'Your tenant needs an active Brave or Bing search connector. Connect one in Connector Settings.';
    } else if (err.includes('429') || err.includes('rate')) {
      helper = 'Rate limit reached. Please wait a moment and try again.';
    } else if (err.includes('500') || err.includes('502') || err.includes('503')) {
      helper = 'The research service is temporarily unavailable. Please retry shortly.';
    }

    return (
      <div
        data-testid="deep-research-panel"
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-danger)',
          background: 'rgba(220, 38, 38, 0.05)',
          fontSize: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Deep Research Error</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="composer-btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '2px 8px' }}
            >
              Close
            </button>
          )}
        </div>
        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>{err}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{helper}</p>
      </div>
    );
  }

  if (state === 'success' && result) {
    return (
      <div
        data-testid="deep-research-panel"
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          fontSize: '0.875rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>🔬 Deep Research Results</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="composer-btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '2px 8px' }}
            >
              ✕ Close
            </button>
          )}
        </div>

        {/* Key Phrases & Related Topics (collapsible) */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowKeyPhrases(!showKeyPhrases)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'var(--color-text)',
              padding: 0,
            }}
          >
            {showKeyPhrases ? '▼' : '▶'} Key Phrases &amp; Related Topics
          </button>
          {showKeyPhrases && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {result.keyPhrases.map((kp, i) => (
                <span
                  key={`kp-${i}`}
                  className="composer-tag-chip"
                  style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-accent)' }}
                >
                  {kp}
                </span>
              ))}
              {result.relatedTopics.map((rt, i) => (
                <span
                  key={`rt-${i}`}
                  className="composer-tag-chip"
                  style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-text-secondary)' }}
                >
                  {rt}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Context Summary (Markdown) */}
        {result.contextSummary && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <h5 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
              Context Summary
            </h5>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: 'var(--color-text)',
              }}
            >
              {result.contextSummary}
            </div>
          </div>
        )}

        {/* Comparison (Markdown) */}
        {result.comparison && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <h5 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
              Comparison to Your Draft
            </h5>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: 'var(--color-text)',
              }}
            >
              {result.comparison}
            </div>
          </div>
        )}

        {/* Sources (expandable) */}
        {result.sources.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: 'var(--color-text)',
                padding: 0,
              }}
            >
              {showSources ? '▼' : '▶'} Sources ({result.sources.length})
            </button>
            {showSources && (
              <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {result.sources.map((src, i) => (
                  <div
                    key={`src-${i}`}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-accent)',
                          textDecoration: 'none',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {src.title}
                      </a>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-bg)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {src.provider}
                      </span>
                    </div>
                    <p style={{ marginTop: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {src.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
