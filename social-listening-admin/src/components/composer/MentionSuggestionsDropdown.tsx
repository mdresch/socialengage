'use client';

import React from 'react';
import type { MentionSuggestionItem } from '@/lib/core-client';

interface MentionSuggestionsDropdownProps {
  suggestions: MentionSuggestionItem[];
  loading?: boolean;
  onSelectMention: (handle: string) => void;
}

export function MentionSuggestionsDropdown({
  suggestions,
  loading,
  onSelectMention,
}: MentionSuggestionsDropdownProps) {
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '0.6rem 0.9rem',
          fontSize: '0.75rem',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.5rem',
        }}
        data-testid="mention-suggestions-loading"
      >
        <span>🔍</span>
        <span>Finding relevant authors to tag...</span>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'topic':
        return (
          <span
            style={{
              backgroundColor: '#064e3b',
              color: '#34d399',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
            data-testid="badge-topic"
          >
            TOPIC
          </span>
        );
      case 'rag':
        return (
          <span
            style={{
              backgroundColor: '#3b0764',
              color: '#c084fc',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
            data-testid="badge-rag"
          >
            RAG
          </span>
        );
      default:
        return (
          <span
            style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
            }}
            data-testid="badge-keyword"
          >
            KEYWORD
          </span>
        );
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '0.6rem',
        marginTop: '0.5rem',
      }}
      data-testid="mention-suggestions-container"
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#cbd5e1',
          marginBottom: '0.4rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>💡 Suggested Mentions ({suggestions.length})</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Click to insert @mention</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {suggestions.map((item) => (
          <button
            key={`${item.platformId}-${item.authorId}`}
            type="button"
            onClick={() => onSelectMention(item.handle)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease',
            }}
            data-testid={`mention-pill-${item.handle}`}
          >
            {getSourceBadge(item.matchSource)}
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#60a5fa' }}>
              @{item.handle}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              ({item.authorName})
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: '#64748b',
                maxWidth: '180px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={item.reason}
            >
              · {item.reason}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
