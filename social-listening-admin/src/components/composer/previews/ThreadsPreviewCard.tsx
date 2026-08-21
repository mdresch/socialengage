'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface ThreadsPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function ThreadsPreviewCard({ config, text, media }: ThreadsPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  return (
    <div className="preview-card">
      {/* Header Bar */}
      <div className="preview-card-header preview-card-header-threads">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>@</span>
          <span>Threads Post</span>
        </div>
        <span style={{ color: isOverLimit ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontWeight: isOverLimit ? 700 : 400 }}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="preview-card-body">
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#0f172a' }}>
            {author.name.charAt(0)}
          </div>

          <div className="preview-author-info">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="preview-author-name">{author.handle.replace('@', '')}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>now</span>
            </div>

            <div className="preview-text">
              {text ? text : <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>Say more on Threads...</span>}
            </div>

            {media && media.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={media[0].url} alt="Threads media" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
              <span>❤️</span>
              <span>💬</span>
              <span>🔁</span>
              <span>↗️</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
