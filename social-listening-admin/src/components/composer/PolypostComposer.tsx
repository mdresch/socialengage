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
import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';

interface PolypostComposerProps {
  initialText?: string;
  initialPlatforms?: SupportedPlatform[];
  onPublishSuccess?: () => void;
  onCancel?: () => void;
}

export function PolypostComposer({
  initialText = '',
  initialPlatforms = ['linkedin', 'instagram', 'facebook', 'twitter', 'threads', 'bluesky'],
  onPublishSuccess,
  onCancel,
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

  // Drafts & Link Preview states
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [lastScrapedUrl, setLastScrapedUrl] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    updateCurrentText(currentText ? `${currentText} ${formatted}` : formatted);
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

          {/* Text Area */}
          <div>
            <textarea
              ref={textareaRef}
              rows={7}
              value={currentText}
              onChange={(e) => updateCurrentText(e.target.value)}
              placeholder="Draft your post once... Type @[Name] for cross-platform mentions, use the formatting bar for Unicode styling, or add media."
              className="composer-textarea"
            />
          </div>

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
          linkPreview={linkPreview}
        />
      </div>

      {/* Saved Drafts Drawer */}
      <DraftHistoryDrawer
        isOpen={isDraftsOpen}
        onClose={() => setIsDraftsOpen(false)}
        onSelectDraft={handleSelectDraft}
      />
    </div>
  );
}
