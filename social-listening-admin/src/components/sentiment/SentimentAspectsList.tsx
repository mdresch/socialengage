'use client';

import React from 'react';
import type { SentimentAspectSummary } from '@/app/tenant/posts/postDisplay';
import { SentimentBadge } from './SentimentBadge';

export interface SentimentAspectsListProps {
  aspects?: SentimentAspectSummary[];
  className?: string;
}

export function SentimentAspectsList({
  aspects = [],
  className = '',
}: SentimentAspectsListProps) {
  if (!aspects || aspects.length === 0) {
    return (
      <div
        className={`text-sm text-gray-500 italic py-2 ${className}`}
        style={{
          color: '#6b7280',
          fontSize: '0.85rem',
          fontStyle: 'italic',
          padding: '8px 0',
        }}
      >
        No aspect-level sentiment detected.
      </div>
    );
  }

  return (
    <div
      className={`space-y-2.5 ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {aspects.map((aspectItem, index) => (
        <div
          key={`${aspectItem.aspect}-${index}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px 12px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#111827',
                  textTransform: 'capitalize',
                }}
              >
                {aspectItem.aspect}
              </span>
            </div>
            <SentimentBadge
              sentiment={aspectItem.label}
              confidence={aspectItem.confidence}
              size="sm"
              showTier={false}
            />
          </div>

          {aspectItem.evidence && (
            <div
              style={{
                fontSize: '0.8rem',
                color: '#4b5563',
                backgroundColor: '#ffffff',
                padding: '6px 10px',
                borderLeft: '3px solid #cbd5e1',
                borderRadius: '4px',
                fontStyle: 'italic',
              }}
            >
              &ldquo;{aspectItem.evidence}&rdquo;
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
