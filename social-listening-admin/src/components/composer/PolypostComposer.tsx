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
      // Simulate dispatching across connected platforms
      await new Promise((resolve) => setTimeout(resolve, 900));

      setPublishStatus({
        type: 'success',
        message: `Successfully scheduled/published post to ${selectedPlatforms
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* Left Column: Authoring Studio (7 cols on desktop) */}
      <div className="xl:col-span-7 space-y-6">
        {/* Target Platforms Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Target Distribution Platforms
            </label>
            <span className="text-xs text-zinc-500">
              {selectedPlatforms.length} of {Object.keys(PLATFORM_CONFIGS).length} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLATFORM_CONFIGS) as SupportedPlatform[]).map((platformKey) => {
              const config = PLATFORM_CONFIGS[platformKey];
              const isSelected = selectedPlatforms.includes(platformKey);
              return (
                <button
                  key={platformKey}
                  type="button"
                  onClick={() => togglePlatform(platformKey)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? `${config.badgeBg} shadow-sm ring-2 ring-offset-1 ring-zinc-400/30`
                      : 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-60'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isSelected ? config.color : '#9ca3af' }}
                  />
                  <span>{config.name}</span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Editor Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Primary Post Draft
              </span>
              <span className="text-[11px] text-zinc-400">(Syncs to all selected channels)</span>
            </div>

            {/* Platform Override Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400">Override:</span>
              <div className="flex gap-1">
                {selectedPlatforms.map((p) => {
                  const hasOverride = platformOverrides[p]?.text !== undefined;
                  const isCurrent = activeOverrideTab === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActiveOverrideTab(isCurrent ? null : p)}
                      title={`Customize copy for ${PLATFORM_CONFIGS[p].name}`}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-medium border transition-colors ${
                        isCurrent
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                          : hasOverride
                          ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                      }`}
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
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <span className="font-bold">⚡ Editing specific override for {PLATFORM_CONFIGS[activeOverrideTab].name}</span>
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
                className="text-amber-700 hover:text-amber-900 dark:text-amber-300 underline text-[11px]"
              >
                Reset to unified draft
              </button>
            </div>
          )}

          {/* Text Area */}
          <div className="relative">
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
              className="w-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-y leading-relaxed font-sans"
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            {/* Quick Hashtags */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
              <span className="text-zinc-400 font-medium">Add tag:</span>
              {['#AI', '#SocialListening', '#Marketing', '#ProductUpdate', '#Innovation'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertHashtag(tag)}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Media Upload Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Image URL</span>
              </button>

              <button
                type="button"
                onClick={handleAddSampleImage}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                <span>🖼️</span>
                <span>Sample Image</span>
              </button>
            </div>
          </div>

          {/* Media URL Input Box */}
          {showMediaInput && (
            <div className="flex gap-2 p-3 bg-zinc-50 dark:bg-zinc-950/80 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <input
                type="url"
                value={mediaInputUrl}
                onChange={(e) => setMediaInputUrl(e.target.value)}
                placeholder="Paste image URL (https://...)"
                className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleAddMedia}
                className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700"
              >
                Add Image
              </button>
            </div>
          )}

          {/* Media Previews Strip */}
          {media.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-medium text-zinc-500 mb-2">Attached Media ({media.length}):</div>
              <div className="flex flex-wrap gap-3">
                {media.map((item, idx) => (
                  <div key={item.id} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                    <img src={item.url} alt="Attachment" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(item.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Publishing Actions Bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          {publishStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                publishStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              <span>{publishStatus.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{publishStatus.message}</span>
            </div>
          )}

          {showSchedulePicker && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Schedule Date & Time:</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  showSchedulePicker
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                }`}
              >
                🗓️ {scheduleDate ? `Scheduled: ${scheduleDate.replace('T', ' ')}` : 'Schedule Post'}
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublish}
              className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isPublishing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Dispatching to Platforms...</span>
                </>
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

      {/* Right Column: Live Multi-Platform Preview Rails (5 cols on desktop) */}
      <div className="xl:col-span-5 sticky top-6">
        <PlatformPreviewRails
          selectedPlatforms={selectedPlatforms}
          getTextForPlatform={getTextForPlatform}
          getMediaForPlatform={getMediaForPlatform}
        />
      </div>
    </div>
  );
}
