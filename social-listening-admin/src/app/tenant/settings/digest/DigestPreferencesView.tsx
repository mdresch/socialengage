'use client';

import React, { useState } from 'react';
import type { UserDigestPreferences, DigestPreviewResponse } from '@/lib/core-client';

interface DigestPreferencesViewProps {
  initialPreferences: UserDigestPreferences;
  watchlists: Array<{ id: string; name: string }>;
}

const COMMON_TIMEZONES = [
  'Europe/Amsterdam',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
];

export function DigestPreferencesView({
  initialPreferences,
  watchlists = [],
}: DigestPreferencesViewProps) {
  const [preferences, setPreferences] = useState<UserDigestPreferences>(initialPreferences);
  const [isEnabled, setIsEnabled] = useState(initialPreferences.isEnabled);
  const [sendAtLocal, setSendAtLocal] = useState(initialPreferences.sendAtLocal.slice(0, 5));
  const [timezone, setTimezone] = useState(initialPreferences.timezone);
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<string[]>(initialPreferences.watchlistIds || []);
  const [includeAiSummary, setIncludeAiSummary] = useState(initialPreferences.includeAiSummary);
  const [includeTopPosts, setIncludeTopPosts] = useState(initialPreferences.includeTopPosts);
  const [includeTopicBreakdown, setIncludeTopicBreakdown] = useState(initialPreferences.includeTopicBreakdown);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preview Drawer
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<DigestPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch('/api/digest/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled,
          sendAtLocal: `${sendAtLocal}:00`,
          timezone,
          watchlistIds: selectedWatchlistIds,
          includeAiSummary,
          includeTopPosts,
          includeTopicBreakdown,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save preferences');
      }

      const updated = await res.json();
      setPreferences(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch('/api/digest/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeAiSummary,
          includeTopPosts,
          includeTopicBreakdown,
          watchlistIds: selectedWatchlistIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate preview');
      }

      const data = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleWatchlist = (id: string) => {
    if (selectedWatchlistIds.includes(id)) {
      setSelectedWatchlistIds(selectedWatchlistIds.filter((w) => w !== id));
    } else {
      setSelectedWatchlistIds([...selectedWatchlistIds, id]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Digest Email</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Receive a timezone-aware consolidated morning summary of social intelligence, sentiment trends, and high-impact discussions.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Enable / Disable Switch */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Daily Digest Subscription
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send an email summary once per day at your chosen local time.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700"></div>
          </label>
        </div>

        {/* Schedule & Delivery Window */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Schedule & Timezone</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delivery Time (Local)
              </label>
              <input
                type="time"
                value={sendAtLocal}
                onChange={(e) => setSendAtLocal(e.target.value)}
                disabled={!isEnabled}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!isEnabled}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Customization */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Included Content</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAiSummary}
                onChange={(e) => setIncludeAiSummary(e.target.checked)}
                disabled={!isEnabled}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">✨ AI Executive Summary</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Concise morning narrative generated from key post themes and audience sentiment.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTopPosts}
                onChange={(e) => setIncludeTopPosts(e.target.checked)}
                disabled={!isEnabled}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">🔥 Notable High-Impact Conversations</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Top 5 ranked posts based on audience reach, engagement velocity, and negative sentiment escalation.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTopicBreakdown}
                onChange={(e) => setIncludeTopicBreakdown(e.target.checked)}
                disabled={!isEnabled}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">📊 Trending Topics & Key Themes</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Volume breakdown of prominent conversation clusters and topics.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Watchlist Scope */}
        {watchlists.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Watchlist Scope</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select specific watchlists to include, or leave empty to include all active watchlists.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWatchlistIds([])}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Include All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
              {watchlists.map((wl) => {
                const selected = selectedWatchlistIds.includes(wl.id);
                return (
                  <button
                    key={wl.id}
                    type="button"
                    onClick={() => toggleWatchlist(wl.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    🎯 {wl.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions & Feedback */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span>✉️</span>
            <span>Preview Daily Digest</span>
          </button>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Preferences saved successfully
              </span>
            )}
            {saveError && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {saveError}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </form>

      {/* Live Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Email Preview: Daily Digest
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewData?.rendered?.subject || 'Simulated 24-hour summary based on current data'}
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950">
              {previewLoading && (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Compiling 24-hour metrics and rendering digest preview...
                </div>
              )}
              {previewError && (
                <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  {previewError}
                </div>
              )}
              {previewData?.rendered?.html && (
                <iframe
                  title="Daily Digest Email HTML Preview"
                  srcDoc={previewData.rendered.html}
                  className="h-full w-full rounded-xl border border-slate-200 bg-white shadow-sm"
                  sandbox="allow-same-origin"
                />
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3 dark:border-slate-800">
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
