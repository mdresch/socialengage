'use client';

import { useState, useRef, useEffect } from 'react';
import type { SupportedPlatform, MediaAttachment, PlatformOverride } from './types';
import { PLATFORM_CONFIGS } from './types';
import { PlatformPreviewRails } from './PlatformPreviewRails';
import { styleText, applyStrikethrough, applyUnderline } from './lib/unicodeStyles';
import { countCharacters } from './lib/counting';
import { parseDocumentFile } from './lib/documentImport';
import { saveDraft, saveAutoSave, getSavedDrafts, type SavedDraft } from './lib/draftStorage';
import { DraftHistoryDrawer } from './DraftHistoryDrawer';
import { CardLinkPreview } from './CardLinkPreview';
import { PublishTargetsDialog } from './PublishTargetsDialog';
import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';
import type { FacebookConnectedPageRow, PublishPostRow, ComposerResearchResult, ConnectorTargetItem, OutboundPostAsset } from '@/lib/core-client';
import { validateMediaFile } from './lib/mediaValidation';
import { DeepResearchPanel, type DeepResearchPanelState } from './DeepResearchPanel';

interface PolypostComposerProps {
  initialText?: string;
  initialPlatforms?: SupportedPlatform[];
  onPublishSuccess?: () => void;
  onCancel?: () => void;
  isPlatformAdmin?: boolean;
}

export function PolypostComposer({
  initialText = '',
  initialPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'threads', 'bluesky'],
  onPublishSuccess,
  onCancel,
  isPlatformAdmin = false,
}: PolypostComposerProps) {
  const [mainText, setMainText] = useState(initialText);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SupportedPlatform[]>(initialPlatforms);
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [mediaInputUrl, setMediaInputUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionInput, setShowMentionInput] = useState(false);
  const [showCustomAiInput, setShowCustomAiInput] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  const [mentionName, setMentionName] = useState('');
  const [activeOverrideTab, setActiveOverrideTab] = useState<SupportedPlatform | null>(null);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<SupportedPlatform, PlatformOverride>>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  // Story 13.10 — media upload / asset targeting state
  const [assetTargets, setAssetTargets] = useState<Partial<Record<SupportedPlatform, string>>>({});
  const [availableTargets, setAvailableTargets] = useState<Partial<Record<SupportedPlatform, ConnectorTargetItem[]>>>({});
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [mediaUploadErrors, setMediaUploadErrors] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Deep Research state (ephemeral — not saved to draft storage)
  const [researchState, setResearchState] = useState<DeepResearchPanelState>('idle');
  const [researchResult, setResearchResult] = useState<ComposerResearchResult | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  // Drafts & Link Preview states
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [lastScrapedUrl, setLastScrapedUrl] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Story 13.10 — platforms that require an explicit asset target (page / account / organization)
  const PLATFORMS_REQUIRING_TARGET: Set<SupportedPlatform> = new Set(['facebook', 'instagram', 'linkedin']);

  // Autosave on changes
  useEffect(() => {
    if (mainText || media.length > 0) {
      saveAutoSave({
        mainText,
        selectedPlatforms,
        media,
        platformOverrides,
      });
    }
  }, [mainText, selectedPlatforms, media, platformOverrides]);

  // URL link preview detection
  useEffect(() => {
    const urlMatch = mainText.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const foundUrl = urlMatch[0];
      if (foundUrl !== lastScrapedUrl) {
        setLastScrapedUrl(foundUrl);
        fetch('/api/composer/link-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: foundUrl }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: LinkPreviewData | null) => {
            if (data && data.title) {
              setLinkPreview(data);
            }
          })
          .catch(() => {});
      }
    } else {
      if (linkPreview) {
        setLinkPreview(null);
        setLastScrapedUrl('');
      }
    }
  }, [mainText, lastScrapedUrl, linkPreview]);

  // Story 13.10 — fetch available asset targets when selected platforms change
  useEffect(() => {
    const targetPlatforms = selectedPlatforms.filter((p) => PLATFORMS_REQUIRING_TARGET.has(p));
    if (targetPlatforms.length === 0) {
      setAvailableTargets({});
      setTargetError(null);
      return;
    }

    let cancelled = false;
    setLoadingTargets(true);
    setTargetError(null);

    Promise.all(
      targetPlatforms.map(async (platform) => {
        const res = await fetch(`/api/connectors/${platform}/targets`);
        if (!res.ok) throw new Error(`Failed to load ${platform} targets`);
        const data = await res.json();
        return { platform, targets: (data.targets || []) as ConnectorTargetItem[] };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const byPlatform: Partial<Record<SupportedPlatform, ConnectorTargetItem[]>> = {};
        for (const { platform, targets } of results) {
          byPlatform[platform] = targets;
        }
        setAvailableTargets(byPlatform);
      })
      .catch((err) => {
        if (cancelled) return;
        setTargetError(err.message || 'Could not load target assets.');
      })
      .finally(() => {
        if (!cancelled) setLoadingTargets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlatforms]);

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

  // Active target text to modify
  const currentText = activeOverrideTab
    ? platformOverrides[activeOverrideTab]?.text ?? mainText
    : mainText;

  const updateCurrentText = (newText: string) => {
    if (activeOverrideTab) {
      setPlatformOverrides((prev) => ({
        ...prev,
        [activeOverrideTab]: {
          ...prev[activeOverrideTab],
          text: newText,
        },
      }));
    } else {
      setMainText(newText);
    }
  };

  // Save current draft
  const handleSaveCurrentDraft = () => {
    saveDraft({
      mainText,
      selectedPlatforms,
      media,
      platformOverrides,
    });
    setPublishStatus({ type: 'success', message: 'Draft saved successfully to local storage.' });
    setTimeout(() => setPublishStatus(null), 3000);
  };

  // Restore draft
  const handleSelectDraft = (draft: SavedDraft) => {
    setMainText(draft.mainText);
    setSelectedPlatforms(draft.selectedPlatforms);
    setMedia(draft.media);
    setPlatformOverrides(draft.platformOverrides || {});
  };

  // Document File Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseDocumentFile(file);
      if (parsed.text) {
        updateCurrentText(parsed.text);
      }
    } catch {
      setPublishStatus({ type: 'error', message: 'Failed to read file.' });
    }
    // reset input
    e.target.value = '';
  };

  // Formatting helpers for selected text or insertion
  const applyFormatting = (formatType: 'bold' | 'italic' | 'code' | 'underline' | 'strike') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentText.substring(start, end);

    if (!selected) {
      const placeholder = 'styled';
      let styled = placeholder;
      if (formatType === 'bold') styled = styleText(placeholder, { bold: true });
      if (formatType === 'italic') styled = styleText(placeholder, { italic: true });
      if (formatType === 'code') styled = styleText(placeholder, { code: true });
      if (formatType === 'underline') styled = applyUnderline(placeholder);
      if (formatType === 'strike') styled = applyStrikethrough(placeholder);

      const next = currentText.slice(0, start) + styled + currentText.slice(end);
      updateCurrentText(next);
      return;
    }

    let formatted = selected;
    if (formatType === 'bold') formatted = styleText(selected, { bold: true });
    if (formatType === 'italic') formatted = styleText(selected, { italic: true });
    if (formatType === 'code') formatted = styleText(selected, { code: true });
    if (formatType === 'underline') formatted = applyUnderline(selected);
    if (formatType === 'strike') formatted = applyStrikethrough(selected);

    const next = currentText.slice(0, start) + formatted + currentText.slice(end);
    updateCurrentText(next);
  };

  // Insert mention token
  const handleInsertMention = () => {
    if (!mentionName.trim()) return;
    const token = `@[${mentionName.trim()}]`;
    const textarea = textareaRef.current;
    const pos = textarea ? textarea.selectionStart : currentText.length;
    const next = currentText.slice(0, pos) + ` ${token} ` + currentText.slice(pos);
    updateCurrentText(next);
    setMentionName('');
    setShowMentionInput(false);
  };

  // Insert emoji
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const pos = textarea ? textarea.selectionStart : currentText.length;
    const next = currentText.slice(0, pos) + emoji + currentText.slice(pos);
    updateCurrentText(next);
  };

  // Deep Research handler — calls same-origin proxy route
  const handleDeepResearch = async () => {
    if (mainText.replace(/\s/g, '').length < 10) return;
    setResearchState('loading');
    setResearchResult(null);
    setResearchError(null);
    try {
      const res = await fetch('/api/composer/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mainText }),
      });
      const body = await res.json();
      if (!res.ok) {
        const errMsg = body?.error || body?.code || `HTTP ${res.status}`;
        setResearchError(errMsg);
        setResearchState('error');
      } else {
        setResearchResult(body as ComposerResearchResult);
        setResearchState('success');
      }
    } catch {
      setResearchError('Network error — unable to reach the research service.');
      setResearchState('error');
    }
  };

  const handleCloseResearch = () => {
    setResearchState('idle');
    setResearchResult(null);
    setResearchError(null);
  };

  // AI Assist API Call
  const handleAiTransform = async (mode: 'autofit' | 'professional' | 'punchy' | 'hashtags' | 'custom') => {
    if (!currentText.trim()) return;
    setIsAiProcessing(true);

    try {
      const maxChars = activeOverrideTab
        ? PLATFORM_CONFIGS[activeOverrideTab].maxChars
        : 280;

      const res = await fetch('/api/composer/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          mode,
          targetPlatform: activeOverrideTab ? PLATFORM_CONFIGS[activeOverrideTab].name : undefined,
          maxChars,
          customPrompt: customAiPrompt || undefined,
        }),
      });

      const body = await res.json();
      if (body?.result) {
        updateCurrentText(body.result);
        setShowCustomAiInput(false);
        setCustomAiPrompt('');
      }
    } catch {
      setPublishStatus({ type: 'error', message: 'AI assistance encountered an error.' });
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Story 13.10 — shared media upload handler (file input + drag/drop)
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setMediaUploadErrors([]);
    setIsUploadingMedia(true);
    const accepted: MediaAttachment[] = [];

    for (const file of Array.from(files)) {
      const validation = validateMediaFile(file);
      if (!validation.ok) {
        setMediaUploadErrors((prev) => [...prev, validation.error || 'Invalid media file']);
        continue;
      }

      const uploadForm = new FormData();
      uploadForm.append('file', file);

      try {
        const res = await fetch('/api/outbound/media', {
          method: 'POST',
          body: uploadForm,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMediaUploadErrors((prev) => [...prev, body.error || `Upload failed for ${file.name} (${res.status}).`]);
          continue;
        }

        const payload = await res.json();
        accepted.push({
          id: payload.mediaId,
          url: payload.url,
          altText: file.name.replace(/\.[^/.]+$/, ''),
          type: file.type.startsWith('video/') ? 'video' : 'image',
          mediaId: payload.mediaId,
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
        });
      } catch (err: any) {
        setMediaUploadErrors((prev) => [...prev, `Upload failed for ${file.name}: ${err.message || 'network error'}`]);
      }
    }

    if (accepted.length > 0) {
      setMedia((prev) => [...prev, ...accepted]);
    }
    setIsUploadingMedia(false);
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(e.dataTransfer.files);
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

  const handleUpdateAltText = (id: string, altText: string) => {
    setMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, altText } : m))
    );
  };

  // Quick insert hashtags
  const insertHashtag = (tag: string) => {
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    updateCurrentText(currentText ? `${currentText} ${formatted}` : formatted);
  };

  const handleOpenPublishDialog = () => {
    if (selectedPlatforms.length === 0) {
      setPublishStatus({ type: 'error', message: 'Please select at least one platform.' });
      return;
    }
    if (!mainText.trim() && media.length === 0) {
      setPublishStatus({ type: 'error', message: 'Please enter content or attach media.' });
      return;
    }

    const missing = selectedPlatforms.filter((p) => PLATFORMS_REQUIRING_TARGET.has(p) && !assetTargets[p]);
    if (missing.includes('facebook')) {
      // Open the Facebook Page picker if no active Facebook Page target is selected.
      setShowPublishDialog(true);
      return;
    }
    if (missing.length > 0) {
      setPublishStatus({ type: 'error', message: `Please select a target for: ${missing.join(', ')}.` });
      return;
    }

    handlePublish();
  };

  // Story 13.10 (ADR-0115) — real publish via POST /api/outbound/posts with media and asset targeting
  const handlePublish = async (extraAssetTargets?: Record<string, string>) => {
    setIsPublishing(true);
    setPublishStatus(null);
    setMediaUploadErrors([]);

    try {
      const mergedTargets = { ...assetTargets, ...(extraAssetTargets || {}) } as Record<string, string>;
      const missing = selectedPlatforms.filter((p) => PLATFORMS_REQUIRING_TARGET.has(p) && !mergedTargets[p]);
      if (missing.length > 0) {
        setPublishStatus({ type: 'error', message: `Please select a target for: ${missing.join(', ')}.` });
        return;
      }

      const perPlatformOverrides: Record<string, string> = {};
      for (const platform of selectedPlatforms) {
        const overrideText = platformOverrides[platform]?.text;
        if (overrideText !== undefined && overrideText.trim() !== '') {
          perPlatformOverrides[platform] = overrideText;
        }
      }

      const assets: OutboundPostAsset[] = [];
      for (const item of media) {
        if (item.mediaId) {
          assets.push({
            type: item.type === 'video' ? 'video' : 'image',
            mediaId: item.mediaId,
            alt: item.altText,
          });
        }
      }
      if (linkPreview) {
        assets.push({ type: 'link-card', url: linkPreview.url, imageUrl: linkPreview.image });
      }

      const targetPlatforms = selectedPlatforms.map((p) => p as string);
      const scheduledFor = scheduleDate ? new Date(scheduleDate).toISOString() : null;

      const response = await fetch('/api/outbound/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: mainText,
          targetPlatforms,
          assets,
          assetTargets: mergedTargets,
          scheduledFor,
          perPlatformOverrides,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 202 || response.status === 201 || response.status === 207) {
        const activityIds = Array.isArray(body.activityIds) ? body.activityIds : [];
        const scheduled = body.scheduledFor ? new Date(body.scheduledFor).toLocaleString() : null;
        const externalUrl = body?.externalUrl;
        const errorCode = body?.errorCode;
        const message = scheduled
          ? `Scheduled ${activityIds.length} post(s) for ${scheduled}.`
          : `Publishing ${activityIds.length} post(s).`;
        setPublishStatus({ type: 'success', message });
        setShowPublishDialog(false);
        if (activityIds.length > 0 && onPublishSuccess) {
          setTimeout(() => onPublishSuccess(), 1200);
        }
      } else if (response.status === 422) {
        setPublishStatus({ type: 'error', message: body.error || 'Validation failed. UNSUPPORTED_MEDIA_TYPE or MEDIA_TOO_LARGE.' });
      } else if (response.status === 429) {
        setPublishStatus({ type: 'error', message: 'Rate limit reached. Please wait and try again.' });
      } else if (response.status >= 500) {
        setPublishStatus({ type: 'error', message: `Publish failed (HTTP ${response.status}). error_code: ${body?.code || body?.errorCode || 'unknown'}` });
      } else {
        setPublishStatus({ type: 'error', message: `Publish failed (HTTP ${response.status}). Please retry.` });
      }
    } catch {
      setPublishStatus({ type: 'error', message: 'Failed to publish post. Please retry.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleConfirmPublish = async (selectedPages: FacebookConnectedPageRow[]) => {
    const pageId = selectedPages[0]?.pageId;
    if (!pageId) {
      setPublishStatus({ type: 'error', message: 'No active Facebook Pages available for publishing.' });
      setShowPublishDialog(false);
      return;
    }
    await handlePublish({ facebook: pageId });
    setShowPublishDialog(false);
  };

  const popularEmojis = ['🔥', '🚀', '💡', '📊', '✨', '📈', '💬', '🎯', '👇', '👍', '👏', '🎉', '🧠', '🛡️', '⚡', '🌐'];

  return (
    <div className="composer-root">
      {/* Hidden File Input for .docx / .md / .txt */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt,.md,.markdown,.docx"
        style={{ display: 'none' }}
      />

      {/* Hidden File Input for Images and Videos */}
      <input
        type="file"
        ref={imageFileInputRef}
        onChange={handleLocalImageUpload}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,video/mp4,video/quicktime"
        multiple
        style={{ display: 'none' }}
      />

      {/* Left Column: Authoring Studio */}
      <div className="composer-studio">
        {/* Top Header: Draft Management Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsDraftsOpen(true)}
              className="composer-btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              📁 Drafts ({getSavedDrafts().length})
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentDraft}
              className="composer-btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              💾 Save Draft
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="composer-btn-secondary"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            📥 Import Doc / Markdown
          </button>
        </div>

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

        {/* Asset Targets Card */}
        {selectedPlatforms.some((p) => PLATFORMS_REQUIRING_TARGET.has(p)) && (
          <div className="composer-card">
            <div className="composer-card-header">
              <h4 className="composer-section-title">Target Assets</h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Select page or account for each platform
              </span>
            </div>

            {loadingTargets && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                Loading targets…
              </div>
            )}
            {targetError && (
              <div
                style={{
                  padding: 'var(--space-2)',
                  background: 'rgba(220, 38, 38, 0.1)',
                  color: 'var(--color-danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                }}
              >
                {targetError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {selectedPlatforms
                .filter((p) => PLATFORMS_REQUIRING_TARGET.has(p))
                .map((platform) => {
                  const targets = availableTargets[platform] || [];
                  return (
                    <div key={platform}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          marginBottom: 'var(--space-1)',
                        }}
                      >
                        {PLATFORM_CONFIGS[platform].name} target
                      </label>
                      <select
                        value={assetTargets[platform] || ''}
                        onChange={(e) =>
                          setAssetTargets((prev) => ({ ...prev, [platform]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg)',
                          color: 'var(--color-text)',
                        }}
                      >
                        <option value="">— Select {PLATFORM_CONFIGS[platform].name} target —</option>
                        {targets.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {targets.length === 0 && !loadingTargets && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-warning)', marginTop: 'var(--space-1)' }}>
                          No active {PLATFORM_CONFIGS[platform].name} targets available.
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Main Editor Card */}
        <div className="composer-card">
          <div className="composer-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h4 className="composer-section-title" style={{ color: 'var(--color-text)' }}>
                {activeOverrideTab ? `${PLATFORM_CONFIGS[activeOverrideTab].name} Override` : 'Primary Post Draft'}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                ({countCharacters(currentText)} chars)
              </span>
            </div>

            {/* Platform Override Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>Override:</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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

          {/* Polypost Formatting Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            {/* Unicode Stylers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                onClick={() => applyFormatting('bold')}
                title="Bold (Unicode)"
                style={{ fontWeight: 800, padding: '2px 7px', fontSize: '0.8125rem', background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                𝗕
              </button>
              <button
                type="button"
                onClick={() => applyFormatting('italic')}
                title="Italic (Unicode)"
                style={{ fontStyle: 'italic', padding: '2px 7px', fontSize: '0.8125rem', background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                𝘐
              </button>
              <button
                type="button"
                onClick={() => applyFormatting('underline')}
                title="Underline (Unicode)"
                style={{ textDecoration: 'underline', padding: '2px 7px', fontSize: '0.8125rem', background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                U̲
              </button>
              <button
                type="button"
                onClick={() => applyFormatting('strike')}
                title="Strikethrough (Unicode)"
                style={{ textDecoration: 'line-through', padding: '2px 7px', fontSize: '0.8125rem', background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                S̶
              </button>
              <button
                type="button"
                onClick={() => applyFormatting('code')}
                title="Monospace (Unicode)"
                style={{ fontFamily: 'var(--font-mono)', padding: '2px 7px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                𝙲𝚘𝚍𝚎
              </button>
              <button
                type="button"
                onClick={() => setShowMentionInput(!showMentionInput)}
                title="Mention Person (@[Name])"
                style={{ padding: '2px 7px', fontSize: '0.75rem', fontWeight: 600, background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
              >
                @[Mention]
              </button>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emoji Picker"
                style={{ padding: '2px 6px', fontSize: '0.875rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                😀
              </button>
            </div>

            {/* Azure OpenAI AI Assistant Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                disabled={isAiProcessing}
                onClick={() => handleAiTransform('autofit')}
                title="Auto-fit length via Azure OpenAI"
                className="composer-tag-chip"
                style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-accent)', fontWeight: 600 }}
              >
                {isAiProcessing ? '...' : '✂️ Auto-fit'}
              </button>
              <button
                type="button"
                disabled={isAiProcessing}
                onClick={() => handleAiTransform('professional')}
                title="Polish into structured B2B thought-leadership via Azure OpenAI"
                className="composer-tag-chip"
              >
                💼 Polish
              </button>
              <button
                type="button"
                disabled={isAiProcessing}
                onClick={() => handleAiTransform('punchy')}
                title="Convert into punchy social hook via Azure OpenAI"
                className="composer-tag-chip"
              >
                ⚡ Punchy
              </button>
              <button
                type="button"
                onClick={() => setShowCustomAiInput(!showCustomAiInput)}
                title="Custom AI Prompt"
                className="composer-tag-chip"
              >
                ✨ Prompt
              </button>
              {/* Deep Research button — disabled for platform_admin sessions or short draft text */}
              <button
                type="button"
                disabled={isPlatformAdmin || mainText.replace(/\s/g, '').length < 10}
                onClick={handleDeepResearch}
                title={isPlatformAdmin ? 'Deep Research is not available for platform_admin sessions' : 'Research public conversation around your draft (requires 10+ characters)'}
                className="composer-tag-chip"
                style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-text-secondary)', fontWeight: 600 }}
              >
                🔬 Deep Research
              </button>
            </div>
          </div>

          {/* Custom AI Prompt Input Box */}
          {showCustomAiInput && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2)', background: 'rgba(37, 99, 235, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <input
                type="text"
                value={customAiPrompt}
                onChange={(e) => setCustomAiPrompt(e.target.value)}
                placeholder="Ask Azure OpenAI (e.g. Translate to Dutch, write 3 hooks, add bullet points...)"
                style={{ flex: 1, fontSize: '0.8125rem' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAiTransform('custom');
                  }
                }}
              />
              <button
                type="button"
                disabled={isAiProcessing}
                onClick={() => handleAiTransform('custom')}
                className="composer-btn-primary"
              >
                {isAiProcessing ? 'Thinking...' : 'Generate'}
              </button>
            </div>
          )}

          {/* Emoji Tray */}
          {showEmojiPicker && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              {popularEmojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  style={{ fontSize: '1.125rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Mention Input Box */}
          {showMentionInput && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              <input
                type="text"
                value={mentionName}
                onChange={(e) => setMentionName(e.target.value)}
                placeholder="Type full person name (e.g. Scott Hanselman)"
                style={{ flex: 1, fontSize: '0.8125rem' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertMention();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleInsertMention}
                className="composer-btn-primary"
              >
                Insert Mention
              </button>
            </div>
          )}

          {/* Text Area / Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              position: 'relative',
              borderRadius: 'var(--radius)',
              border: isDragging ? '2px dashed var(--color-accent)' : 'none',
              background: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
              transition: 'all 120ms ease',
            }}
          >
            <textarea
              ref={textareaRef}
              rows={7}
              value={currentText}
              onChange={(e) => updateCurrentText(e.target.value)}
              placeholder="Draft your post once... Type @[Name] for cross-platform mentions, use the formatting bar for Unicode styling, or drag & drop images."
              className="composer-textarea"
            />
            {isDragging && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(37, 99, 235, 0.08)',
                  backdropFilter: 'blur(2px)',
                  borderRadius: 'var(--radius)',
                  pointerEvents: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-accent)',
                }}
              >
                📸 Drop images and videos to attach to post
              </div>
            )}
          </div>

          {/* Deep Research Panel (ephemeral) */}
          <DeepResearchPanel
            state={researchState}
            result={researchResult}
            error={researchError}
            onClose={handleCloseResearch}
          />

          {/* Detected Link Preview Card */}
          {linkPreview && (
            <CardLinkPreview
              data={linkPreview}
              onRemove={() => setLinkPreview(null)}
            />
          )}

          {/* Toolbar */}
          <div className="composer-toolbar">
            {/* Quick Hashtags */}
            <div className="composer-tag-list">
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Tags:</span>
              {['#AI', '#SocialListening', '#Marketing', '#PMBOK', '#BABOK', '#DMBOK', '#DataGovernance'].map((tag) => (
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
                onClick={() => imageFileInputRef.current?.click()}
                className="composer-btn-secondary"
                style={{ fontWeight: 600, color: 'var(--color-accent)' }}
                title="Upload images and videos from your computer"
                disabled={isUploadingMedia}
              >
                <span>{isUploadingMedia ? '⏳' : '📷'}</span>
                <span>{isUploadingMedia ? 'Uploading…' : 'Upload Images'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className="composer-btn-secondary"
                title="Attach image from web URL"
              >
                <span>🔗</span>
                <span>Image URL</span>
              </button>

              <button
                type="button"
                onClick={handleAddSampleImage}
                className="composer-btn-secondary"
                title="Insert test photo"
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

          {/* Media Upload Feedback */}
          {mediaUploadErrors.length > 0 && (
            <div
              style={{
                padding: 'var(--space-2)',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
              }}
            >
              {mediaUploadErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
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
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div className="composer-media-thumb">
                      <img src={item.url} alt={item.altText || 'Attachment'} />
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(item.id)}
                        className="composer-media-remove"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.altText || ''}
                      onChange={(e) => handleUpdateAltText(item.id, e.target.value)}
                      placeholder="Alt text"
                      style={{
                        width: 72,
                        fontSize: '0.625rem',
                        padding: '1px 3px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                      }}
                      title="Describe this image (alt text)"
                    />
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
              onClick={handleOpenPublishDialog}
              className="composer-btn-primary"
            >
              {isPublishing ? (
                <span>Dispatching to Channels...</span>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{scheduleDate ? 'Schedule Publication' : 'Publish to Selected'}</span>
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
          linkPreview={linkPreview}
        />
      </div>

      {/* Saved Drafts Drawer */}
      <DraftHistoryDrawer
        isOpen={isDraftsOpen}
        onClose={() => setIsDraftsOpen(false)}
        onSelectDraft={handleSelectDraft}
      />

      {/* Publish Target Pages Dialog */}
      <PublishTargetsDialog
        isOpen={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        selectedPlatforms={selectedPlatforms}
        onConfirm={handleConfirmPublish}
        isPublishing={isPublishing}
      />
    </div>
  );
}
