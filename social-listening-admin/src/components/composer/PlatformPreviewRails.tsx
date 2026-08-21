'use client';

import { useState } from 'react';
import type { SupportedPlatform, MediaAttachment } from './types';
import { PLATFORM_CONFIGS } from './types';
import { LinkedInPreviewCard } from './previews/LinkedInPreviewCard';
import { InstagramPreviewCard } from './previews/InstagramPreviewCard';
import { FacebookPreviewCard } from './previews/FacebookPreviewCard';
import { XPreviewCard } from './previews/XPreviewCard';
import { ThreadsPreviewCard } from './previews/ThreadsPreviewCard';
import { BlueskyPreviewCard } from './previews/BlueskyPreviewCard';
import { MastodonPreviewCard } from './previews/MastodonPreviewCard';

import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';

interface PlatformPreviewRailsProps {
  selectedPlatforms: SupportedPlatform[];
  getTextForPlatform: (platform: SupportedPlatform) => string;
  getMediaForPlatform: (platform: SupportedPlatform) => MediaAttachment[];
  linkPreview?: LinkPreviewData | null;
}

export function PlatformPreviewRails({
  selectedPlatforms,
  getTextForPlatform,
  getMediaForPlatform,
  linkPreview,
}: PlatformPreviewRailsProps) {
  const [layoutMode, setLayoutMode] = useState<'grid' | 'tabs'>('grid');
  const [activeTab, setActiveTab] = useState<SupportedPlatform>(
    selectedPlatforms[0] || 'linkedin'
  );

  // Sync active tab if selection changes
  const effectiveTab = selectedPlatforms.includes(activeTab)
    ? activeTab
    : selectedPlatforms[0] || 'linkedin';

  const renderCard = (platform: SupportedPlatform) => {
    const config = PLATFORM_CONFIGS[platform];
    const text = getTextForPlatform(platform);
    const media = getMediaForPlatform(platform);

    switch (platform) {
      case 'linkedin':
        return <LinkedInPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'instagram':
        return <InstagramPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'facebook':
        return <FacebookPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'twitter':
        return <XPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'threads':
        return <ThreadsPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'bluesky':
        return <BlueskyPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      case 'mastodon':
        return <MastodonPreviewCard key={platform} config={config} text={text} media={media} linkPreview={linkPreview} />;
      default:
        return null;
    }
  };

  if (selectedPlatforms.length === 0) {
    return (
      <div
        style={{
          background: 'var(--color-bg)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '0.8125rem',
        }}
      >
        <p style={{ margin: 0 }}>Select one or more platforms above to preview your post</p>
      </div>
    );
  }

  return (
    <div className="rails-container">
      {/* View Header */}
      <div className="rails-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h4
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text)',
            }}
          >
            Live Preview Rails
          </h4>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              background: 'rgba(22, 163, 74, 0.1)',
              color: 'var(--color-success)',
              border: '1px solid rgba(22, 163, 74, 0.3)',
              borderRadius: 'var(--radius-full)',
              padding: '1px 8px',
              textTransform: 'uppercase',
            }}
          >
            Live Sync
          </span>
        </div>

        {/* Layout Toggle */}
        <div className="rails-toggle">
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            className={`rails-toggle-btn ${layoutMode === 'grid' ? 'active' : ''}`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('tabs')}
            className={`rails-toggle-btn ${layoutMode === 'tabs' ? 'active' : ''}`}
          >
            Single Tab
          </button>
        </div>
      </div>

      {/* Tabs Switcher (when in Tab mode) */}
      {layoutMode === 'tabs' && (
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
          {selectedPlatforms.map((p) => {
            const config = PLATFORM_CONFIGS[p];
            const isTabActive = p === effectiveTab;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActiveTab(p)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: isTabActive ? 600 : 400,
                  border: '1px solid var(--color-border)',
                  background: isTabActive ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: isTabActive ? 'var(--color-accent-contrast)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{config.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Preview Output */}
      {layoutMode === 'grid' ? (
        <div className="rails-grid">
          {selectedPlatforms.map((p) => (
            <div key={p}>
              {renderCard(p)}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {renderCard(effectiveTab)}
        </div>
      )}
    </div>
  );
}
