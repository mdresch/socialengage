'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Watchlist, RAGSearchResultItem, RAGAskCitation, RAGStatusResponse } from '@/lib/core-client';

interface RAGDiscoveryClientProps {
  watchlists: Watchlist[];
  initialStatus: RAGStatusResponse;
}

export function RAGDiscoveryClient({ watchlists, initialStatus }: RAGDiscoveryClientProps) {
  const [mode, setMode] = useState<'search' | 'ask'>('search');
  const [query, setQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');

  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<RAGSearchResultItem[]>([]);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askCitations, setAskCitations] = useState<RAGAskCitation[]>([]);
  const [askConfidence, setAskConfidence] = useState<'high' | 'medium' | 'low' | 'unsupported' | null>(null);
  const [isGrounded, setIsGrounded] = useState<boolean>(true);
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExecute = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    const filter: Record<string, any> = {};
    if (selectedPlatform !== 'all') filter.platformId = selectedPlatform;
    if (selectedWatchlist !== 'all') filter.watchlistIds = [selectedWatchlist];
    if (selectedSentiment !== 'all') filter.sentiment = selectedSentiment;

    try {
      if (mode === 'search') {
        const res = await fetch('/api/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            filter,
            pagination: { topK: 15 },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        setSearchResults(data.results || []);
      } else {
        // Mode === 'ask'
        setAskAnswer(null);
        setAskCitations([]);
        setAskConfidence(null);

        const res = await fetch('/api/rag/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query.trim(),
            filter,
            maxChunks: 5,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Q&A failed');
        setAskAnswer(data.answer);
        setAskCitations(data.citations || []);
        setAskConfidence(data.confidence);
        setIsGrounded(data.isGrounded);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during discovery');
    } finally {
      setLoading(false);
    }
  };

  const getMatchBadge = (score: number) => {
    const pct = Math.round(score * 100);
    if (score >= 0.85) {
      return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>🔥 {pct}% Strong Match</span>;
    }
    if (score >= 0.70) {
      return <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>✨ {pct}% Relevant</span>;
    }
    return <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500 }}>{pct}% Match</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Status Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Semantic Discovery & AI Assistant</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Search social mentions by meaning and ask grounded questions with verified citations.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: initialStatus.status === 'healthy' ? '#22c55e' : '#f59e0b' }} />
          <span>{initialStatus.totalIndexedChunks} chunks indexed</span>
        </div>
      </div>

      {/* Mode Selector & Search Box */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'search' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('search')}
            data-testid="mode-search-btn"
          >
            🔍 Semantic Search
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'ask' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('ask')}
            data-testid="mode-ask-btn"
          >
            🤖 Ask AI Assistant
          </button>
        </div>

        {/* Search Input Field */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Semantic search and Q&A input"
              placeholder={mode === 'search' ? 'Search by concept, topic, or meaning... (e.g. customer frustration with pricing)' : 'Ask a natural question... (e.g. What are users saying about our new update?)'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecute();
              }}
              style={{
                width: '100%',
                padding: '0.75rem 3.5rem 0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '0.95rem',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'var(--color-background)',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                pointerEvents: 'none',
              }}
            >
              ⌘K
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={loading || !query.trim()}
            data-testid="execute-discovery-btn"
            style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Processing...' : mode === 'search' ? 'Search' : 'Ask'}
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 600 }}>Platform:</span>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}
            >
              <option value="all">All Platforms</option>
              <option value="gnews">GNews</option>
              <option value="newswire">Newswire</option>
              <option value="wikipedia">Wikipedia</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 600 }}>Watchlist:</span>
            <select
              value={selectedWatchlist}
              onChange={(e) => setSelectedWatchlist(e.target.value)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}
            >
              <option value="all">All Watchlists</option>
              {watchlists.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 600 }}>Sentiment:</span>
            <select
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.875rem' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* SEARCH MODE RESULTS */}
      {mode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {searchResults.length === 0 && !loading && query && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>No semantic matches found</p>
              <p style={{ fontSize: '0.85rem' }}>Try broadening your query keywords or adjusting filters.</p>
            </div>
          )}

          {searchResults.map((result) => (
            <div
              key={`${result.postId}:${result.chunkIndex}`}
              data-testid="rag-result-card"
              className="card"
              style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>{result.platformId}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{result.publishedAt}</span>
                </div>
                {getMatchBadge(result.score)}
              </div>

              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {result.snippet}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <a href={`/tenant/posts`} style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  View in Posts Feed →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ASK MODE GENERATIVE ANSWER & CITATIONS RAIL */}
      {mode === 'ask' && askAnswer && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          {/* Answer Card */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem' }}>🤖 Grounded AI Synthesis</strong>
              {askConfidence && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: askConfidence === 'high' ? '#dcfce7' : askConfidence === 'medium' ? '#fef3c7' : '#fee2e2',
                    color: askConfidence === 'high' ? '#166534' : askConfidence === 'medium' ? '#92400e' : '#991b1b',
                  }}
                >
                  Confidence: {askConfidence.toUpperCase()}
                </span>
              )}
            </div>

            {/* Answer body with aria-live for streaming accessibility */}
            <div
              aria-live="polite"
              style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}
            >
              {askAnswer.split(' ').map((word, i) => {
                if (word.includes('[^1]')) {
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label="Citation 1"
                      onMouseEnter={() => setHoveredCitation(1)}
                      onMouseLeave={() => setHoveredCitation(null)}
                      style={{
                        background: '#e0e7ff',
                        color: '#3730a3',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.1rem 0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        margin: '0 0.15rem',
                      }}
                    >
                      [1]
                    </button>
                  );
                }
                return word + ' ';
              })}
            </div>

            {!isGrounded && (
              <div
                data-testid="rag-refusal-callout"
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <strong>⚠️ Limited Context in Indexed Posts:</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                  The workspace corpus does not contain sufficient grounded evidence. Try broadening your date filter or connecting additional platforms.
                </p>
              </div>
            )}
          </div>

          {/* Citations Rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Sources & Citations ({askCitations.length})
            </strong>
            {askCitations.map((citation) => {
              const isHovered = hoveredCitation === citation.citationIndex;
              return (
                <div
                  key={citation.citationIndex}
                  data-testid="rag-citation-card"
                  className="card"
                  style={{
                    padding: '0.85rem',
                    border: isHovered ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Citation [{citation.citationIndex}]
                    </span>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      {citation.platformId}
                    </span>
                  </div>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {citation.snippet.slice(0, 140)}...
                  </p>
                  <a href={`/tenant/posts`} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                    Inspect Post →
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
