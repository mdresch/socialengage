'use client';

import React, { useState, useEffect } from 'react';
import type { ConnectorTargetItem, OutboundPostAsset, MentionSuggestionItem } from '@/lib/core-client';
import { MentionSuggestionsDropdown } from './MentionSuggestionsDropdown';

interface OutboundComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

const SUPPORTED_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', requiresTarget: true },
  { id: 'facebook', name: 'Facebook', requiresTarget: true },
  { id: 'bluesky', name: 'Bluesky', requiresTarget: false },
  { id: 'twitter', name: 'X (Twitter)', requiresTarget: false },
];

export function OutboundComposerModal({ isOpen, onClose, onPostCreated }: OutboundComposerModalProps) {
  const [text, setText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin']);
  const [dispatchMode, setDispatchMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [availableTargets, setAvailableTargets] = useState<Record<string, ConnectorTargetItem[]>>({});
  const [selectedAssetTargets, setSelectedAssetTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Story 11.12: Mention suggestions state
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestionItem[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);

  // AC1: 300ms debounced mention suggestions fetch
  useEffect(() => {
    if (!text.trim() || selectedPlatforms.length === 0) {
      setMentionSuggestions([]);
      return;
    }
    setMentionLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/composer/mention-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetPlatforms: selectedPlatforms }),
        });
        if (res.ok) {
          const data = await res.json();
          setMentionSuggestions(data.suggestions || []);
        }
      } catch {
        // ignore
      } finally {
        setMentionLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [text, selectedPlatforms]);

  const handleInsertMention = (handle: string) => {
    const mentionTag = `@${handle}`;
    if (!text.includes(mentionTag)) {
      setText((prev) => (prev ? `${prev} ${mentionTag} ` : `${mentionTag} `));
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Set default schedule date to tomorrow 09:00 local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    setScheduledDate(`${year}-${month}-${day}`);
    setScheduledTime('09:00');

    // Fetch targets for platforms that support asset targeting
    selectedPlatforms.forEach((pId) => {
      fetchTargetsForPlatform(pId);
    });
  }, [isOpen]);

  const fetchTargetsForPlatform = async (platformId: string) => {
    try {
      const res = await fetch(`/api/connectors/${platformId}/targets`);
      if (res.ok) {
        const data = await res.json();
        const targets: ConnectorTargetItem[] = data.targets || [];
        setAvailableTargets((prev) => ({ ...prev, [platformId]: targets }));
        if (targets.length > 0 && !selectedAssetTargets[platformId]) {
          setSelectedAssetTargets((prev) => ({ ...prev, [platformId]: targets[0].id }));
        }
      }
    } catch {
      // ignore
    }
  };

  const [capabilitiesMap, setCapabilitiesMap] = useState<Record<string, boolean>>({
    linkedin: true,
    facebook: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/connectors/capabilities')
      .then((res) => (res.ok ? res.json() : { connectors: [] }))
      .then((data) => {
        if (Array.isArray(data.connectors)) {
          const map: Record<string, boolean> = {};
          data.connectors.forEach((c: any) => {
            map[c.platformId] = Boolean(c.capabilities?.publish);
          });
          setCapabilitiesMap((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleTogglePlatform = (platformId: string) => {
    if (capabilitiesMap[platformId] === false) return;
    setSelectedPlatforms((prev) => {
      const next = prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId];
      if (!prev.includes(platformId)) {
        fetchTargetsForPlatform(platformId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!text.trim()) {
      setError('Please enter post content.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one target platform.');
      return;
    }

    let scheduledFor: string | null = null;
    if (dispatchMode === 'schedule') {
      if (!scheduledDate || !scheduledTime) {
        setError('Please choose a valid date and time for scheduled dispatch.');
        return;
      }
      const combined = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(combined.getTime())) {
        setError('Invalid scheduled date or time.');
        return;
      }
      if (combined.getTime() <= Date.now()) {
        setError('Scheduled dispatch time must be in the future.');
        return;
      }
      scheduledFor = combined.toISOString();
    }

    setLoading(true);

    try {
      const res = await fetch('/api/outbound/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          targetPlatforms: selectedPlatforms,
          assetTargets: selectedAssetTargets,
          scheduledFor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit post');
      }

      setSuccess(
        scheduledFor
          ? `Post scheduled successfully for ${new Date(scheduledFor).toLocaleString()}!`
          : 'Post published successfully!'
      );

      setTimeout(() => {
        setText('');
        setDispatchMode('now');
        onPostCreated?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-modal-title"
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#f8fafc',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 id="composer-modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#ffffff' }}>
              Create Outbound Post
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Compose, target accounts, and publish immediately or schedule for later.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#450a0a',
              border: '1px solid #dc2626',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: '#064e3b',
              border: '1px solid #059669',
              color: '#6ee7b7',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Post Content */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#cbd5e1' }}>
              Post Content
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would you like to share?"
              rows={4}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              data-testid="composer-textarea"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
              {text.length} characters
            </div>

            {/* Story 11.12: Mention Suggestions Dropdown */}
            <MentionSuggestionsDropdown
              suggestions={mentionSuggestions}
              loading={mentionLoading}
              onSelectMention={handleInsertMention}
            />
          </div>

          {/* Target Platforms */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#cbd5e1' }}>
              Target Networks
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {SUPPORTED_PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => handleTogglePlatform(platform.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                      color: isSelected ? '#93c5fd' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textAlign: 'left',
                    }}
                    data-testid={`platform-toggle-${platform.id}`}
                  >
                    <span style={{ fontSize: '1rem' }}>
                      {isSelected ? '☑' : '☐'}
                    </span>
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Targets Selectors */}
          {selectedPlatforms.some((p) => SUPPORTED_PLATFORMS.find((sp) => sp.id === p)?.requiresTarget) && (
            <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: '#cbd5e1' }}>
                Target Pages & Accounts
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedPlatforms.map((platformId) => {
                  const sp = SUPPORTED_PLATFORMS.find((p) => p.id === platformId);
                  if (!sp?.requiresTarget) return null;
                  const targets = availableTargets[platformId] || [];

                  return (
                    <div key={platformId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ minWidth: '80px', fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>
                        {sp.name}:
                      </span>
                      <select
                        value={selectedAssetTargets[platformId] || ''}
                        onChange={(e) =>
                          setSelectedAssetTargets((prev) => ({ ...prev, [platformId]: e.target.value }))
                        }
                        style={{
                          flex: 1,
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '6px',
                          padding: '0.5rem',
                          color: '#ffffff',
                          fontSize: '0.8125rem',
                          outline: 'none',
                        }}
                        data-testid={`target-select-${platformId}`}
                      >
                        {targets.length === 0 ? (
                          <option value="">Default Account Target</option>
                        ) : (
                          targets.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.type})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dispatch Mode: Now vs Schedule */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#cbd5e1' }}>
              Dispatch Timing
            </label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="dispatchMode"
                  value="now"
                  checked={dispatchMode === 'now'}
                  onChange={() => setDispatchMode('now')}
                  data-testid="dispatch-now-radio"
                />
                <span>⚡ Publish Immediately</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="dispatchMode"
                  value="schedule"
                  checked={dispatchMode === 'schedule'}
                  onChange={() => setDispatchMode('schedule')}
                  data-testid="dispatch-schedule-radio"
                />
                <span>📅 Schedule for Later</span>
              </label>
            </div>

            {/* Schedule Date & Time Picker */}
            {dispatchMode === 'schedule' && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  backgroundColor: '#0f172a',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  alignItems: 'center',
                }}
                data-testid="schedule-picker-container"
              >
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '0.4rem 0.5rem',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                    }}
                    data-testid="schedule-date-input"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                    Time (Local)
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '0.4rem 0.5rem',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                    }}
                    data-testid="schedule-time-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #475569',
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
              data-testid="composer-submit-btn"
            >
              {loading
                ? 'Processing...'
                : dispatchMode === 'schedule'
                ? 'Schedule Post'
                : 'Publish Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
