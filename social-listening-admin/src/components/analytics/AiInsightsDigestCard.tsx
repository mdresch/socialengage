'use client';

import React, { useState, useEffect } from 'react';
import type { AiInsightsDigestResponse } from '@/lib/core-client';

export function AiInsightsDigestCard() {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [digest, setDigest] = useState<AiInsightsDigestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/digest?period=${period}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setDigest(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        Synthesizing AI brand insights digest…
      </div>
    );
  }

  if (!digest) return null;

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-5)',
        background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        border: '1px solid #e9d5ff',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <h3 style={{ margin: 0, fontSize: '1.0625rem', color: '#581c87', fontWeight: 700 }}>
            AI Executive Insights Digest
          </h3>
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#ede9fe', padding: 2, borderRadius: 6 }}>
          <button
            type="button"
            onClick={() => setPeriod('daily')}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: period === 'daily' ? '#fff' : 'transparent',
              color: period === 'daily' ? '#6b21a8' : '#7e22ce',
            }}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: period === 'weekly' ? '#fff' : 'transparent',
              color: period === 'weekly' ? '#6b21a8' : '#7e22ce',
            }}
          >
            Weekly
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, color: '#3b0764' }}>
        {digest.executiveSummary}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        <div style={{ background: 'rgba(255,255,255,0.7)', padding: 'var(--space-3)', borderRadius: 6 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>Sentiment Trajectory</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 4, fontSize: '0.8125rem' }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>{digest.sentimentBreakdown.positivePct}% Pos</span>
            <span style={{ color: '#6b7280' }}>{digest.sentimentBreakdown.neutralPct}% Neu</span>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>{digest.sentimentBreakdown.negativePct}% Neg</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.7)', padding: 'var(--space-3)', borderRadius: 6 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>Key Recommendations</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 'var(--space-4)', fontSize: '0.75rem', color: '#4c1d95' }}>
            {digest.strategicRecommendations.slice(0, 2).map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
