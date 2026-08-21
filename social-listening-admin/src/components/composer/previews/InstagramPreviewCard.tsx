'use client';

import { useState } from 'react';
import type { PlatformConfig, MediaAttachment } from '../types';
import { flattenMentionTokens } from '../lib/mentions';
import { countCharacters } from '../lib/counting';

interface InstagramPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function InstagramPreviewCard({ config, text, media }: InstagramPreviewCardProps) {
  const [activeSlide, setActiveSlide] = useState(0);
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
    <div className="preview-card" style={{ maxWidth: 420, margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="preview-card-header preview-card-header-instagram">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#e1306c">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          <span>Instagram Feed</span>
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
            title="Copy caption & open Instagram"
          >
            Copy &amp; Open
          </button>
        </div>
      </div>

      {/* Author Header */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              padding: 2,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {author.name.charAt(0)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1 }}>
              {author.handle.replace('@', '')}
            </div>
          </div>
        </div>
      </div>

      {/* Media Viewport */}
      <div className="preview-media-frame" style={{ aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {media && media.length > 0 ? (
          <img
            src={media[activeSlide]?.url || media[0].url}
            alt="Instagram square media"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-disabled)', padding: 'var(--space-4)' }}>
            <p style={{ fontSize: '0.75rem', margin: 0 }}>Add an image to preview Instagram square layout</p>
          </div>
        )}

        {/* Carousel Indicators */}
        {media && media.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {media.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlide(idx)}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  background: idx === activeSlide ? 'var(--color-accent)' : 'rgba(255,255,255,0.6)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Icons */}
      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>❤️</span>
          <span>💬</span>
          <span>↗️</span>
        </div>
        <span>🔖</span>
      </div>

      {/* Caption */}
      <div style={{ padding: '4px 12px 12px', fontSize: '0.8125rem' }}>
        <span style={{ fontWeight: 600, marginRight: 6 }}>{author.handle.replace('@', '')}</span>
        <span style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
          {processedText || 'Your Instagram caption will appear here...'}
        </span>
      </div>
    </div>
  );
}
