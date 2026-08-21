'use client';

import type { PlatformConfig, MediaAttachment } from '../types';
import { flattenMentionTokens } from '../lib/mentions';
import { countCharacters } from '../lib/counting';

import { CardLinkPreview } from '../CardLinkPreview';
import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';

interface BlueskyPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
  linkPreview?: LinkPreviewData | null;
}

export function BlueskyPreviewCard({ config, text, media, linkPreview }: BlueskyPreviewCardProps) {
  const author = config.defaultAuthor;

  const processedText = flattenMentionTokens(text, { collapseSpaces: true });
  const charCount = countCharacters(processedText, config.countingMethod);
  const isOverLimit = charCount > config.maxChars;

  const handleCopyOpen = () => {
    navigator.clipboard.writeText(processedText);
    if (config.getOpenUrl) {
      window.open(config.getOpenUrl(processedText), '_blank');
    }
  };

  return (
    <div className="preview-card">
      {/* Header Bar */}
      <div className="preview-card-header preview-card-header-bluesky">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1185fe">
            <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566 1.01 1.25 1.5 0.5 2.5 0 3.2 0 4.5 0.5 6.5c1.077 4.3 3.5 6.3 5.5 6.8-2 0.3-4.5 1.3-5.5 4.5C0 19.5 0 20.8 0.5 21.5c0.75 1 2.066 1.49 4.702-0.305C7.954 19.253 10.913 15.314 12 13.2c1.087 2.114 4.046 6.053 6.798 7.995 2.636 1.795 3.952 1.305 4.702 0.305 0.5-0.7 0.5-2 0-3.7-1-3.2-3.5-4.2-5.5-4.5 2-0.5 4.423-2.5 5.5-6.8 0.5-2 0.5-3.3 0-4-0.75-1-2.066-1.49-4.702 0.305C16.046 4.747 13.087 8.686 12 10.8z" />
          </svg>
          <span>Bluesky Post</span>
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
            title="Copy text & open Bluesky"
          >
            Copy &amp; Open
          </button>
        </div>
      </div>

      <div className="preview-card-body">
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#1185fe' }}>
            {author.name.charAt(0)}
          </div>
          <div className="preview-author-info">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="preview-author-name">{author.name}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>{author.handle}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>· now</span>
            </div>

            <div className="preview-text">
              {processedText ? processedText : <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>What&apos;s up? (Bluesky post text...)</span>}
            </div>

            {/* Media or Link Preview */}
            {media && media.length > 0 ? (
              <div style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={media[0].url} alt="Bluesky media" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
              </div>
            ) : linkPreview ? (
              <CardLinkPreview data={linkPreview} />
            ) : null}

            {/* Actions */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              <span>💬 0</span>
              <span>🔁 0</span>
              <span>❤️ 0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
