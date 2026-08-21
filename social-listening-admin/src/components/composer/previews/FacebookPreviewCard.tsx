'use client';

import type { PlatformConfig, MediaAttachment } from '../types';
import { flattenMentionTokens } from '../lib/mentions';
import { countCharacters } from '../lib/counting';

import { CardLinkPreview } from '../CardLinkPreview';
import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';

interface FacebookPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
  linkPreview?: LinkPreviewData | null;
}

export function FacebookPreviewCard({ config, text, media, linkPreview }: FacebookPreviewCardProps) {
  const author = config.defaultAuthor;

  const processedText = flattenMentionTokens(text, { collapseSpaces: false });
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
      <div className="preview-card-header preview-card-header-facebook">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877f2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Facebook Page Post</span>
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
            title="Copy text & open Facebook"
          >
            Copy &amp; Open
          </button>
        </div>
      </div>

      <div className="preview-card-body">
        {/* Page Author Header */}
        <div className="preview-author">
          <div className="preview-avatar" style={{ background: '#1877f2' }}>
            {author.name.charAt(0)}
          </div>
          <div className="preview-author-info">
            <div className="preview-author-name">{author.name}</div>
            <div className="preview-author-sub">Just now • 🌐</div>
          </div>
        </div>

        {/* Post Text */}
        <div className="preview-text">
          {processedText ? processedText : <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>Your Facebook post text will appear here...</span>}
        </div>
      </div>

      {/* Media Box or Link Preview */}
      {media && media.length > 0 ? (
        <div className="preview-media-frame">
          <img
            src={media[0].url}
            alt="Facebook attachment"
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
          />
        </div>
      ) : linkPreview ? (
        <div style={{ padding: '0 var(--space-3)' }}>
          <CardLinkPreview data={linkPreview} />
        </div>
      ) : null}

      {/* Facebook Actions Bar */}
      <div className="preview-actions-bar">
        <button type="button" className="preview-action-btn">👍 Like</button>
        <button type="button" className="preview-action-btn">💬 Comment</button>
        <button type="button" className="preview-action-btn">↗️ Share</button>
      </div>
    </div>
  );
}
