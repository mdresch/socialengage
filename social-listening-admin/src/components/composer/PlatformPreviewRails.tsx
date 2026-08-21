'use client';

import { useState } from 'react';
import type { SupportedPlatform, PlatformConfig, MediaAttachment } from './types';
import { PLATFORM_CONFIGS } from './types';
import { LinkedInPreviewCard } from './previews/LinkedInPreviewCard';
import { InstagramPreviewCard } from './previews/InstagramPreviewCard';
import { FacebookPreviewCard } from './previews/FacebookPreviewCard';
import { XPreviewCard } from './previews/XPreviewCard';
import { ThreadsPreviewCard } from './previews/ThreadsPreviewCard';
import { BlueskyPreviewCard } from './previews/BlueskyPreviewCard';

interface PlatformPreviewRailsProps {
  selectedPlatforms: SupportedPlatform[];
  getTextForPlatform: (platform: SupportedPlatform) => string;
  getMediaForPlatform: (platform: SupportedPlatform) => MediaAttachment[];
}

export function PlatformPreviewRails({
  selectedPlatforms,
  getTextForPlatform,
  getMediaForPlatform,
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
        return <LinkedInPreviewCard key={platform} config={config} text={text} media={media} />;
      case 'instagram':
        return <InstagramPreviewCard key={platform} config={config} text={text} media={media} />;
      case 'facebook':
        return <FacebookPreviewCard key={platform} config={config} text={text} media={media} />;
      case 'twitter':
        return <XPreviewCard key={platform} config={config} text={text} media={media} />;
      case 'threads':
        return <ThreadsPreviewCard key={platform} config={config} text={text} media={media} />;
      case 'bluesky':
        return <BlueskyPreviewCard key={platform} config={config} text={text} media={media} />;
      default:
        return null;
    }
  };

  if (selectedPlatforms.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-400">
        <svg className="w-10 h-10 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p className="text-sm font-medium">Select one or more platforms above to preview your post</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">
            Live Preview Rails
          </h3>
          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Live Sync
          </span>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setLayoutMode('grid')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              layoutMode === 'grid'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setLayoutMode('tabs')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              layoutMode === 'tabs'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Single Tab
          </button>
        </div>
      </div>

      {/* Tabs Switcher (when in Tab mode) */}
      {layoutMode === 'tabs' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {selectedPlatforms.map((p) => {
            const config = PLATFORM_CONFIGS[p];
            const isTabActive = p === effectiveTab;
            return (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isTabActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{config.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Preview Output */}
      {layoutMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {selectedPlatforms.map((p) => (
            <div key={p} className="w-full">
              {renderCard(p)}
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-xl mx-auto">
          {renderCard(effectiveTab)}
        </div>
      )}
    </div>
  );
}
