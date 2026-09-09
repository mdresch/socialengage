'use client';

import React from 'react';
import { getSentimentConfidenceTier, type SentimentConfidenceTier } from '@/app/tenant/posts/postDisplay';

export interface SentimentBadgeProps {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | string;
  confidence?: number | null;
  tier?: SentimentConfidenceTier | null;
  showTier?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SENTIMENT_ICONS: Record<string, string> = {
  positive: '😊',
  negative: '😟',
  neutral: '😐',
  mixed: '🎭',
};

const TIER_CONFIG: Record<
  SentimentConfidenceTier,
  { label: string; bg: string; color: string; border: string }
> = {
  strong: {
    label: 'Strong',
    bg: '#ecfdf5',
    color: '#065f46',
    border: '#a7f3d0',
  },
  moderate: {
    label: 'Moderate',
    bg: '#eff6ff',
    color: '#1e40af',
    border: '#bfdbfe',
  },
  'needs-review': {
    label: 'Needs review',
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fde68a',
  },
};

const SENTIMENT_COLORS: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  positive: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#059669',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  negative: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#dc2626',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  neutral: {
    bg: 'rgba(107, 114, 128, 0.12)',
    color: '#4b5563',
    border: 'rgba(107, 114, 128, 0.3)',
  },
  mixed: {
    bg: 'rgba(168, 85, 247, 0.12)',
    color: '#7e22ce',
    border: 'rgba(168, 85, 247, 0.3)',
  },
};

export function SentimentBadge({
  sentiment,
  confidence,
  tier,
  showTier = true,
  size = 'md',
  className = '',
}: SentimentBadgeProps) {
  const normSentiment = (sentiment || 'neutral').toLowerCase();
  const colors = SENTIMENT_COLORS[normSentiment] || SENTIMENT_COLORS.neutral;
  const icon = SENTIMENT_ICONS[normSentiment] || '😐';

  const resolvedTier: SentimentConfidenceTier | undefined =
    tier || (typeof confidence === 'number' ? getSentimentConfidenceTier(confidence) : undefined);

  const tierMeta = resolvedTier ? TIER_CONFIG[resolvedTier] : undefined;
  const confidencePct =
    typeof confidence === 'number' && !isNaN(confidence)
      ? `${Math.round(confidence * 100)}%`
      : null;

  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.75rem' : size === 'lg' ? '0.95rem' : '0.85rem';

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        fontSize,
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        borderRadius: '9999px',
        fontWeight: 600,
        lineHeight: 1.2,
      }}
      aria-label={`Sentiment: ${sentiment}${confidencePct ? ` with ${confidencePct} confidence` : ''}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="capitalize">{sentiment}</span>

      {confidencePct && (
        <span
          style={{
            fontSize: '0.75em',
            opacity: 0.85,
            fontWeight: 500,
            marginLeft: '2px',
          }}
        >
          {confidencePct}
        </span>
      )}

      {showTier && tierMeta && (
        <span
          style={{
            fontSize: '0.7em',
            padding: '1px 6px',
            backgroundColor: tierMeta.bg,
            color: tierMeta.color,
            border: `1px solid ${tierMeta.border}`,
            borderRadius: '9999px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            marginLeft: '4px',
          }}
          title={`Confidence tier: ${tierMeta.label}`}
        >
          {tierMeta.label}
        </span>
      )}
    </div>
  );
}
