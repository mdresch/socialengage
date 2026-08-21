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
      <div className="bg-slate-50 dark:bg-[#141a29]/50 border border-dashed border-slate-300 dark:border-[#30343d] rounded-lg p-8 text-center text-slate-400 dark:text-[#9aa2b1]">
        <svg className="w-9 h-9 mx-auto mb-2 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p className="text-xs font-medium">Select one or more platforms above to preview your post</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-[#eef0f3] m-0">
            Live Preview Rails
          </h3>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Live Sync
          </span>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141a29] border border-slate-200 dark:border-[#30343d] p-0.5 rounded-md text-xs font-medium">
          <button
            onClick={() => setLayoutMode('grid')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              layoutMode === 'grid'
                ? 'bg-white dark:bg-[#1c1f26] text-slate-900 dark:text-[#eef0f3] shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:text-[#9aa2b1] dark:hover:text-[#eef0f3]'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setLayoutMode('tabs')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              layoutMode === 'tabs'
                ? 'bg-white dark:bg-[#1c1f26] text-slate-900 dark:text-[#eef0f3] shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:text-[#9aa2b1] dark:hover:text-[#eef0f3]'
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
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  isTabActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 dark:bg-[#1c1f26] dark:text-[#9aa2b1] dark:border-[#30343d] hover:bg-slate-50 dark:hover:bg-[#141a29]'
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
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
