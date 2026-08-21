'use client';

import { useState } from 'react';
import type { PlatformConfig, MediaAttachment } from '../types';
import { flattenMentionTokens } from '../lib/mentions';
import { countCharacters } from '../lib/counting';

interface LinkedInPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function LinkedInPreviewCard({ config, text, media }: LinkedInPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const author = config.defaultAuthor;

  const processedText = flattenMentionTokens(text, { collapseSpaces: false });
  const charCount = countCharacters(processedText, config.countingMethod);
  const isOverLimit = charCount > config.maxChars;
  const shouldTruncate = processedText.length > 210 && !isExpanded;
  const displayText = shouldTruncate ? processedText.slice(0, 210) + '...' : processedText;

  const handleCopyOpen = () => {
    navigator.clipboard.writeText(processedText);
    if (config.getOpenUrl) {
      window.open(config.getOpenUrl(processedText), '_blank');
    }
  };

  return (
    <div className="preview-card">
      {/* Header Indicator */}
      <div className="preview-card-header preview-card-header-linkedin">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
          <span>LinkedIn Feed Post</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: isOverLimit ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontWeight: isOverLimit ? 700 : 400 }}>
            {charCount} / {config.maxChars.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={handleCopyOpen}
            style={{
              fontSize: '0.6875rem',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
            title="Copy text & open LinkedIn"
          >
            Copy &amp; Open
          </button>
        </div>
      </div>

      <div className="preview-card-body">
        {/* Author Header */}
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#0a66c2' }}>
            {author.name.charAt(0)}
          </div>
          <div className="preview-author-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="preview-author-name">{author.name}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>• 1st</span>
            </div>
            <div className="preview-author-sub">{author.headline || 'Member'}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginTop: 2 }}>Just now • 🌐</div>
          </div>
        </div>

        {/* Post Text */}
        <div className="preview-text">
          {processedText ? (
            <>
              <span>{displayText}</span>
              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 4,
                    fontSize: 'inherit',
                  }}
                >
                  ...see more
                </button>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>
              Your LinkedIn commentary will appear here...
            </span>
          )}
        </div>
      </div>

      {/* Media Attachments */}
      {media && media.length > 0 && (
        <div className="preview-media-frame">
          <img
            src={media[0].url}
            alt="LinkedIn attachment"
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Action Bar */}
      <div className="preview-actions-bar">
        <button type="button" className="preview-action-btn">👍 Like</button>
        <button type="button" className="preview-action-btn">💬 Comment</button>
        <button type="button" className="preview-action-btn">🔁 Repost</button>
        <button type="button" className="preview-action-btn">↗️ Send</button>
      </div>
    </div>
  );
}
