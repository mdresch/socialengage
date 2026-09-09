'use client';

import React from 'react';
import type { InfluencerItem } from '@/lib/core-client';

export interface InfluencerCardProps {
  influencer: InfluencerItem;
  onAddToProspectingList?: (authorId: string) => void;
  onExplainScore?: (authorId: string) => void;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 70 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

export function InfluencerCard({ influencer, onAddToProspectingList, onExplainScore }: InfluencerCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>
              {influencer.authorName}
            </h3>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 12,
                background: '#e0e7ff',
                color: '#3730a3',
                textTransform: 'capitalize',
              }}
            >
              {influencer.platformId}
            </span>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {influencer.recentPosts} recent posts
            {influencer.publicUrl && (
              <>
                <span style={{ margin: '0 6px' }}>•</span>
                <a
                  href={influencer.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                >
                  View Profile ↗
                </a>
              </>
            )}
          </div>
        </div>

        {/* Primary Composite Score Badge */}
        <div
          onClick={() => onExplainScore?.(influencer.authorId)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'var(--color-bg-subtle, #f8fafc)',
            border: '1px solid var(--color-border)',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: onExplainScore ? 'pointer' : 'default',
          }}
          title="Click to explain score"
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Influence</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f766e' }}>{influencer.influenceScore}</span>
        </div>
      </div>

      {/* 4 Score Bars */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <ScoreBar label="Reach" value={influencer.reachScore} color="#3b82f6" />
        <ScoreBar label="Engagement" value={influencer.engagementScore} color="#10b981" />
        <ScoreBar label="Authenticity" value={influencer.authenticityScore} color="#8b5cf6" />
        <ScoreBar label="Influence" value={influencer.influenceScore} color="#0f766e" />
      </div>

      {/* Topics */}
      {influencer.topTopics && influencer.topTopics.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Top Topics:</span>
          {influencer.topTopics.map((t, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 4,
                background: '#f3f4f6',
                color: '#374151',
                fontWeight: 500,
              }}
            >
              {t.topicName}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
        <a
          href={`/tenant/posts?authorId=${influencer.authorId}`}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.8125rem', textDecoration: 'none', padding: '5px 10px' }}
        >
          View Posts
        </a>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => onAddToProspectingList?.(influencer.authorId)}
          style={{ fontSize: '0.8125rem', padding: '5px 12px' }}
        >
          + Add to Prospecting List
        </button>
      </div>
    </div>
  );
}
