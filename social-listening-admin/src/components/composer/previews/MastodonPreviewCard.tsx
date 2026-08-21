'use client';

import type { PlatformConfig, MediaAttachment } from '../types';
import { countCharacters } from '../lib/counting';

interface MastodonPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function MastodonPreviewCard({ config, text, media }: MastodonPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = countCharacters(text, config.countingMethod);
  const isOverLimit = charCount > config.maxChars;

  const handleCopyOpen = () => {
    navigator.clipboard.writeText(text);
    if (config.getOpenUrl) {
      window.open(config.getOpenUrl(text), '_blank');
    }
  };

  return (
    <div className="preview-card">
      {/* Header Bar */}
      <div
        className="preview-card-header"
        style={{
          background: 'rgba(99, 100, 255, 0.08)',
          color: '#6364ff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#6364ff">
            <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.244 15.12 0 12.004 0c-3.116 0-5.506.244-5.96.31-2.687.393-4.954 2.425-5.304 5.003C.387 7.94.3 11.234.3 11.234c0 3.293.087 6.587.44 9.17.35 2.578 2.617 4.61 5.304 5.004.454.066 2.844.31 5.96.31 3.116 0 5.506-.244 5.96-.31 2.687-.394 4.954-2.426 5.304-5.004.353-2.583.44-5.877.44-9.17 0-3.294-.087-6.587-.44-9.17zM17.65 16.035h-2.518V9.388c0-1.408-.592-2.124-1.776-2.124-1.309 0-1.964.845-1.964 2.533v3.667H9.288V9.797c0-1.688-.655-2.533-1.964-2.533-1.184 0-1.776.716-1.776 2.124v6.647H3.03V8.895c0-1.408.358-2.533 1.074-3.376.716-.845 1.66-1.267 2.83-1.267 1.353 0 2.385.52 3.097 1.562l.649 1.09.649-1.09c.712-1.042 1.744-1.562 3.097-1.562 1.17 0 2.114.422 2.83 1.267.716.843 1.074 1.968 1.074 3.376v7.14z" />
          </svg>
          <span>Mastodon Toot</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: isOverLimit ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontWeight: isOverLimit ? 700 : 400 }}>
            {charCount} / {config.maxChars}
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
            title="Copy text and open Mastodon compose"
          >
            Copy &amp; Open
          </button>
        </div>
      </div>

      <div className="preview-card-body">
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#6364ff' }}>
            {author.name.charAt(0)}
          </div>
          <div className="preview-author-info">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="preview-author-name">{author.name}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>{author.handle}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>· now</span>
            </div>

            <div className="preview-text">
              {text ? text : <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>What is on your mind? (Mastodon toot...)</span>}
            </div>

            {media && media.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={media[0].url} alt="Mastodon media" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              <span>💬 0</span>
              <span>🔁 0</span>
              <span>⭐ 0</span>
              <span>🔖 0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
