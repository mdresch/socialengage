'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface XPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function XPreviewCard({ config, text, media }: XPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  // Real-time limit highlight
  const validText = isOverLimit ? text.slice(0, config.maxChars) : text;
  const overflowText = isOverLimit ? text.slice(config.maxChars) : '';

  return (
    <div className="preview-card">
      {/* Header Bar */}
      <div className="preview-card-header preview-card-header-twitter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>X / Post</span>
        </div>

        {/* Character Counter with Overflow Warning */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isOverLimit ? 'var(--color-danger)' : 'var(--color-text-secondary)',
            }}
          >
            {charCount}/{config.maxChars}
          </span>
          {isOverLimit && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                background: 'rgba(220, 38, 38, 0.15)',
                color: 'var(--color-danger)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              +{charCount - config.maxChars} overflow
            </span>
          )}
        </div>
      </div>

      <div className="preview-card-body">
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#0f172a' }}>
            {author.name.charAt(0)}
          </div>
          <div className="preview-author-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="preview-author-name">{author.name}</span>
              <span style={{ fontSize: '0.75rem', color: '#0284c7' }}>✓</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{author.handle}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>· now</span>
            </div>

            {/* Tweet Body with Over-limit Highlighting */}
            <div className="preview-text">
              {text ? (
                <>
                  <span>{validText}</span>
                  {overflowText && (
                    <span className="preview-overflow" title="Exceeds 280 characters">
                      {overflowText}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>
                  What is happening?! (Tweet text...)
                </span>
              )}
            </div>

            {/* Media Attachment */}
            {media && media.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={media[0].url} alt="Tweet attachment" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Tweet Action Icons */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              <span>💬 0</span>
              <span>🔁 0</span>
              <span>❤️ 0</span>
              <span>📊 0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
