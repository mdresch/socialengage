'use client';

import { useState } from 'react';
import type { SupportedPlatform, MediaAttachment, PlatformOverride } from './types';
import { PLATFORM_CONFIGS } from './types';
import { PlatformPreviewRails } from './PlatformPreviewRails';

interface PolypostComposerProps {
  initialText?: string;
  initialPlatforms?: SupportedPlatform[];
  onPublishSuccess?: () => void;
  onCancel?: () => void;
}

export function PolypostComposer({
  initialText = '',
  initialPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter'],
  onPublishSuccess,
  onCancel,
}: PolypostComposerProps) {
  const [mainText, setMainText] = useState(initialText);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SupportedPlatform[]>(initialPlatforms);
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [mediaInputUrl, setMediaInputUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [activeOverrideTab, setActiveOverrideTab] = useState<SupportedPlatform | null>(null);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<SupportedPlatform, PlatformOverride>>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  // Toggle platform selection
  const togglePlatform = (p: SupportedPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  // Helper to get effective text for a platform (checking overrides first)
  const getTextForPlatform = (platform: SupportedPlatform): string => {
    return platformOverrides[platform]?.text !== undefined
      ? platformOverrides[platform]!.text!
      : mainText;
  };

  // Helper to get effective media for a platform
  const getMediaForPlatform = (platform: SupportedPlatform): MediaAttachment[] => {
    return platformOverrides[platform]?.media !== undefined
      ? platformOverrides[platform]!.media!
      : media;
  };

  // Add media URL
  const handleAddMedia = () => {
    if (!mediaInputUrl.trim()) return;
    const newMedia: MediaAttachment = {
      id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: mediaInputUrl.trim(),
      type: 'image',
    };
    setMedia((prev) => [...prev, newMedia]);
    setMediaInputUrl('');
    setShowMediaInput(false);
  };

  // Add sample image
  const handleAddSampleImage = () => {
    const sampleImages = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    ];
    const randomImg = sampleImages[media.length % sampleImages.length];
    const newMedia: MediaAttachment = {
      id: `media-${Date.now()}`,
      url: randomImg,
      type: 'image',
    };
    setMedia((prev) => [...prev, newMedia]);
  };

  const handleRemoveMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  // Quick insert hashtags
  const insertHashtag = (tag: string) => {
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    setMainText((prev) => (prev ? `${prev} ${formatted}` : formatted));
  };

  // Simulated Publish
  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      setPublishStatus({ type: 'error', message: 'Please select at least one platform.' });
      return;
    }
    if (!mainText.trim() && media.length === 0) {
      setPublishStatus({ type: 'error', message: 'Please enter content or attach media.' });
      return;
    }

    setIsPublishing(true);
    setPublishStatus(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      setPublishStatus({
        type: 'success',
        message: `Successfully dispatched post to ${selectedPlatforms
          .map((p) => PLATFORM_CONFIGS[p].name)
          .join(', ')}!`,
      });

      if (onPublishSuccess) {
        setTimeout(() => onPublishSuccess(), 1200);
      }
    } catch {
      setPublishStatus({ type: 'error', message: 'Failed to publish post. Please retry.' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="composer-root">
      {/* Left Column: Authoring Studio */}
      <div className="composer-studio">
        {/* Target Platforms Card */}
        <div className="composer-card">
          <div className="composer-card-header">
            <h4 className="composer-section-title">
              Target Distribution Platforms
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {selectedPlatforms.length} of {Object.keys(PLATFORM_CONFIGS).length} active
            </span>
          </div>

          <div className="composer-platform-chips">
            {(Object.keys(PLATFORM_CONFIGS) as SupportedPlatform[]).map((platformKey) => {
              const config = PLATFORM_CONFIGS[platformKey];
              const isSelected = selectedPlatforms.includes(platformKey);
              return (
                <button
                  key={platformKey}
                  type="button"
                  onClick={() => togglePlatform(platformKey)}
                  className={`composer-chip ${isSelected ? 'composer-chip-active' : ''}`}
                >
                  <span
                    className="composer-chip-dot"
                    style={{ backgroundColor: isSelected ? config.color : 'var(--color-text-disabled)' }}
                  />
                  <span>{config.name}</span>
                  {isSelected && <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Editor Card */}
        <div className="composer-card">
          <div className="composer-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h4 className="composer-section-title" style={{ color: 'var(--color-text)' }}>
                Primary Post Draft
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                (Live syncs to all selected channels)
              </span>
            </div>

            {/* Platform Override Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Override:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {selectedPlatforms.map((p) => {
                  const hasOverride = platformOverrides[p]?.text !== undefined;
                  const isCurrent = activeOverrideTab === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActiveOverrideTab(isCurrent ? null : p)}
                      title={`Customize copy for ${PLATFORM_CONFIGS[p].name}`}
                      style={{
                        fontSize: '0.6875rem',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: isCurrent
                          ? 'var(--color-accent)'
                          : hasOverride
                          ? 'rgba(217, 119, 6, 0.15)'
                          : 'var(--color-bg)',
                        color: isCurrent
                          ? 'var(--color-accent-contrast)'
                          : hasOverride
                          ? 'var(--color-warning)'
                          : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontWeight: isCurrent || hasOverride ? 600 : 400,
                      }}
                    >
                      {PLATFORM_CONFIGS[p].name.split(' ')[0]}
                      {hasOverride && ' *'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Override Banner */}
          {activeOverrideTab && (
            <div className="composer-override-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span>⚡ <strong>Editing custom copy for {PLATFORM_CONFIGS[activeOverrideTab].name}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlatformOverrides((prev) => {
                    const copy = { ...prev };
                    delete copy[activeOverrideTab];
                    return copy;
                  });
                  setActiveOverrideTab(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-warning)',
                  textDecoration: 'underline',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Reset to unified draft
              </button>
            </div>
          )}

          {/* Text Area */}
          <div>
            <textarea
              rows={6}
              value={activeOverrideTab ? platformOverrides[activeOverrideTab]?.text ?? mainText : mainText}
              onChange={(e) => {
                const val = e.target.value;
                if (activeOverrideTab) {
                  setPlatformOverrides((prev) => ({
                    ...prev,
                    [activeOverrideTab]: {
                      ...prev[activeOverrideTab],
                      text: val,
                    },
                  }));
                } else {
                  setMainText(val);
                }
              }}
              placeholder="What would you like to share across your social channels? Type your post here..."
              className="composer-textarea"
            />
          </div>

          {/* Toolbar */}
          <div className="composer-toolbar">
            {/* Quick Hashtags */}
            <div className="composer-tag-list">
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Add tag:</span>
              {['#AI', '#SocialListening', '#Marketing', '#ProductUpdate', '#Innovation'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertHashtag(tag)}
                  className="composer-tag-chip"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Media Upload Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className="composer-btn-secondary"
              >
                <span>🔗</span>
                <span>Image URL</span>
              </button>

              <button
                type="button"
                onClick={handleAddSampleImage}
                className="composer-btn-secondary"
              >
                <span>🖼️</span>
                <span>Sample Image</span>
              </button>
            </div>
          </div>

          {/* Media URL Input Box */}
          {showMediaInput && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              <input
                type="url"
                value={mediaInputUrl}
                onChange={(e) => setMediaInputUrl(e.target.value)}
                placeholder="Paste image URL (https://...)"
                style={{ flex: 1, fontSize: '0.8125rem' }}
              />
              <button
                type="button"
                onClick={handleAddMedia}
                className="composer-btn-primary"
              >
                Add Image
              </button>
            </div>
          )}

          {/* Media Previews Strip */}
          {media.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                Attached Media ({media.length}):
              </div>
              <div className="composer-media-strip">
                {media.map((item, idx) => (
                  <div key={item.id} className="composer-media-thumb">
                    <img src={item.url} alt="Attachment" />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(item.id)}
                      className="composer-media-remove"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Publishing Actions Bar */}
        <div className="composer-card">
          {publishStatus && (
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                background: publishStatus.type === 'success' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                border: `1px solid ${publishStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                color: publishStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              <span>{publishStatus.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{publishStatus.message}</span>
            </div>
          )}

          {showSchedulePicker && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Schedule Date &amp; Time:</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                style={{ fontSize: '0.8125rem' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                className="composer-btn-secondary"
              >
                🗓️ {scheduleDate ? `Scheduled: ${scheduleDate.replace('T', ' ')}` : 'Schedule Post'}
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="composer-btn-secondary"
                  style={{ border: 'none' }}
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublish}
              className="composer-btn-primary"
            >
              {isPublishing ? (
                <span>Dispatching to Channels...</span>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{scheduleDate ? 'Schedule Publication' : 'Publish to All Channels'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Live Multi-Platform Preview Rails */}
      <div className="rails-container">
        <PlatformPreviewRails
          selectedPlatforms={selectedPlatforms}
          getTextForPlatform={getTextForPlatform}
          getMediaForPlatform={getMediaForPlatform}
        />
      </div>
    </div>
  );
}
