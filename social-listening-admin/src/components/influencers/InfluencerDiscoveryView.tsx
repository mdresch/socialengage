'use client';

import React, { useState } from 'react';
import type { InfluencerItem, InfluencerQueryParamsInput, InfluencerScoreExplanation } from '@/lib/core-client';
import { InfluencerCard } from './InfluencerCard';

export interface InfluencerDiscoveryViewProps {
  initialInfluencers: InfluencerItem[];
  platforms?: string[];
  topics?: string[];
  watchlists?: Array<{ id: string; name: string }>;
  onFilterChange?: (params: InfluencerQueryParamsInput) => Promise<InfluencerItem[]>;
  onAddToProspectingList?: (authorId: string) => Promise<void>;
  onFetchExplanation?: (authorId: string) => Promise<InfluencerScoreExplanation>;
}

export function InfluencerDiscoveryView({
  initialInfluencers,
  platforms = ['twitter', 'linkedin', 'facebook', 'youtube'],
  topics = [],
  watchlists = [],
  onFilterChange,
  onAddToProspectingList,
  onFetchExplanation,
}: InfluencerDiscoveryViewProps) {
  const [influencers, setInfluencers] = useState<InfluencerItem[]>(initialInfluencers);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'influence' | 'reach' | 'engagement' | 'authenticity' | 'recentPosts'>('influence');
  const [explanation, setExplanation] = useState<InfluencerScoreExplanation | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleApplyFilter = async () => {
    setIsLoading(true);
    try {
      const params: InfluencerQueryParamsInput = {
        platformId: selectedPlatform || undefined,
        topicId: selectedTopic || undefined,
        watchlistId: selectedWatchlist || undefined,
        minScore: minScore > 0 ? minScore : undefined,
        sort: sortBy,
      };

      if (onFilterChange) {
        const results = await onFilterChange(params);
        setInfluencers(results);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToList = async (authorId: string) => {
    try {
      if (onAddToProspectingList) {
        await onAddToProspectingList(authorId);
      }
      setNotification('✓ Author added to prospecting list!');
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification('✕ Failed to add author to list.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleExplain = async (authorId: string) => {
    if (!onFetchExplanation) return;
    try {
      const expl = await onFetchExplanation(authorId);
      setExplanation(expl);
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }}>Influencer Discovery</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
          Discover, evaluate, and engage top voice authorities ranked by multi-factor influence scoring.
        </p>
      </div>

      {notification && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            background: notification.startsWith('✓') ? '#dcfce7' : '#fee2e2',
            color: notification.startsWith('✓') ? '#166534' : '#991b1b',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {notification}
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            Platform
          </label>
          <select
            className="input"
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            Topic
          </label>
          <select
            className="input"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">All Topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {watchlists.length > 0 && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
              Watchlist
            </label>
            <select
              className="input"
              value={selectedWatchlist}
              onChange={(e) => setSelectedWatchlist(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Watchlists</option>
              {watchlists.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ width: 130 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            Min Score: {minScore}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
            Sort by
          </label>
          <select
            className="input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ width: '100%' }}
          >
            <option value="influence">Influence Score</option>
            <option value="reach">Reach</option>
            <option value="engagement">Engagement</option>
            <option value="authenticity">Authenticity</option>
            <option value="recentPosts">Recent Posts</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleApplyFilter}
          disabled={isLoading}
          style={{ padding: '8px 16px' }}
        >
          {isLoading ? 'Filtering…' : 'Filter'}
        </button>
      </div>

      {/* Score Explanation Modal / Details */}
      {explanation && (
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg-subtle, #f0fdf4)',
            border: '1px solid #bbf7d0',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#166534' }}>
              Score Breakdown: {explanation.influenceScore} Composite
            </h3>
            <button
              onClick={() => setExplanation(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', fontSize: '0.8125rem' }}>
            <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <strong>Reach (25%):</strong> {explanation.breakdown.reach.score} pts → +{explanation.breakdown.reach.weighted}
            </div>
            <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <strong>Engagement (35%):</strong> {explanation.breakdown.engagement.score} pts → +{explanation.breakdown.engagement.weighted}
            </div>
            <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <strong>Authenticity (20%):</strong> {explanation.breakdown.authenticity.score} pts → +{explanation.breakdown.authenticity.weighted}
            </div>
            <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <strong>Topic Relevance (20%):</strong> {explanation.breakdown.topicRelevance.score} pts → +{explanation.breakdown.topicRelevance.weighted}
            </div>
          </div>
        </div>
      )}

      {/* Grid of Influencers */}
      {influencers.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-4)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-bg-subtle, #f9fafb)',
            borderRadius: 8,
            border: '1px dashed var(--color-border)',
          }}
        >
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No influencers found</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>Try expanding your filter criteria or lowering the minimum score threshold.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {influencers.map((inf) => (
            <InfluencerCard
              key={inf.authorId}
              influencer={inf}
              onAddToProspectingList={handleAddToList}
              onExplainScore={handleExplain}
            />
          ))}
        </div>
      )}
    </div>
  );
}
