'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TopicEvolutionResponse, TopicEvolutionPoint } from '@/lib/core-client';

interface TopicEvolutionTimelineProps {
  initialData: TopicEvolutionResponse;
  availableTopics?: string[];
}

export function TrendAnnotation({ trend }: { trend: 'rising' | 'stable' | 'falling' }) {
  if (trend === 'rising') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
        🔥 Rising Trend (&gt;+5%/day)
      </span>
    );
  }
  if (trend === 'falling') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300">
        📉 Falling Trend (&lt;-5%/day)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300">
      ➡️ Stable Volume
    </span>
  );
}

export function TopicEvolutionTimeline({
  initialData,
  availableTopics = ['Artificial Intelligence', 'Customer Support', 'Product Feedback', 'Pricing', 'Security'],
}: TopicEvolutionTimelineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<TopicEvolutionResponse>(initialData);
  const [selectedTopic, setSelectedTopic] = useState(
    searchParams.get('topic') || initialData.topicName || availableTopics[0]
  );
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>(
    (searchParams.get('granularity') as any) || initialData.granularity || 'day'
  );
  const [compareToPrevious, setCompareToPrevious] = useState(
    searchParams.get('compareToPrevious') === 'true'
  );
  const [loading, setLoading] = useState(false);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Sync state when topic / granularity / comparison changes
  const fetchEvolution = async (topic: string, gran: 'day' | 'week' | 'month', compare: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('topic', topic);
      params.set('granularity', gran);
      if (compare) params.set('compareToPrevious', 'true');

      const res = await fetch(`/api/topics/evolution?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    } catch (err) {
      console.error('Failed to fetch evolution', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    fetchEvolution(topic, granularity, compareToPrevious);
  };

  const handleGranularityChange = (gran: 'day' | 'week' | 'month') => {
    setGranularity(gran);
    fetchEvolution(selectedTopic, gran, compareToPrevious);
  };

  const handleCompareToggle = (compare: boolean) => {
    setCompareToPrevious(compare);
    fetchEvolution(selectedTopic, granularity, compare);
  };

  const points = data.points || [];
  const maxVolume = Math.max(1, ...points.map((p) => p.mentionCount));
  const latestTrend = points.length > 0 ? points[points.length - 1].trend : 'stable';
  const activePoint = activePointIndex !== null && points[activePointIndex] ? points[activePointIndex] : points[points.length - 1];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Topic Evolution Timeline
            </h1>
            <TrendAnnotation trend={latestTrend} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Longitudinal analysis of volume trajectories, sentiment transitions, and driver key terms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Topic Picker */}
          <select
            value={selectedTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {availableTopics.map((t) => (
              <option key={t} value={t}>
                🎯 {t}
              </option>
            ))}
          </select>

          {/* Granularity Picker */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleGranularityChange(g)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  granularity === g
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Compare to Previous Period Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={compareToPrevious}
              onChange={(e) => handleCompareToggle(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700"
            />
            <span>Compare Previous</span>
          </label>
        </div>
      </div>

      {/* Main Multi-Series Volume & Sentiment Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {data.topicName} — Longitudinal Trajectory ({data.startDate} to {data.endDate})
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500"></span> Positive
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400"></span> Neutral
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500"></span> Negative
            </span>
            {compareToPrevious && (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-0.5 w-3 border-b-2 border-dashed border-blue-500"></span> Prior Period
              </span>
            )}
          </div>
        </div>

        {/* Timeline Bars Visualization */}
        <div className="relative h-64 w-full flex items-end gap-1.5 pt-8 pb-4 border-b border-slate-200 dark:border-slate-800">
          {points.map((pt, idx) => {
            const heightPercent = Math.max(8, (pt.mentionCount / maxVolume) * 100);
            const posPct = pt.mentionCount > 0 ? (pt.sentiment.positive / pt.mentionCount) * 100 : 0;
            const neuPct = pt.mentionCount > 0 ? (pt.sentiment.neutral / pt.mentionCount) * 100 : 0;
            const negPct = pt.mentionCount > 0 ? (pt.sentiment.negative / pt.mentionCount) * 100 : 0;

            const isSelected = activePointIndex === idx || (activePointIndex === null && idx === points.length - 1);

            return (
              <div
                key={pt.date}
                onMouseEnter={() => setActivePointIndex(idx)}
                className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer"
              >
                {/* Trend indicator dot */}
                {pt.trend === 'rising' && (
                  <span className="absolute -top-3 text-[10px]" title="Rising trend">
                    🔥
                  </span>
                )}
                {pt.trend === 'falling' && (
                  <span className="absolute -top-3 text-[10px]" title="Falling trend">
                    📉
                  </span>
                )}

                {/* Stacked Sentiment Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t flex flex-col-reverse overflow-hidden transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <div style={{ height: `${posPct}%` }} className="w-full bg-emerald-500"></div>
                  <div style={{ height: `${neuPct}%` }} className="w-full bg-slate-400"></div>
                  <div style={{ height: `${negPct}%` }} className="w-full bg-rose-500"></div>
                </div>

                {/* Date Label */}
                <span className="mt-2 text-[10px] text-slate-400 truncate max-w-full">
                  {pt.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Breakdown for Active / Selected Point */}
      {activePoint && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Summary Metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Period Snapshot: {activePoint.date}
            </h3>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Mentions</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {activePoint.mentionCount.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Unique Authors</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {activePoint.uniqueAuthors.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Sentiment Ratio</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {activePoint.sentiment.positive} pos / {activePoint.sentiment.negative} neg
              </span>
            </div>
          </div>

          {/* Keyword Frequency Breakdown (KeywordHeatmap) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Top Keywords & Themes
            </h3>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(activePoint.topKeywords || []).map((kw) => (
                <span
                  key={kw.keyword}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  <span>#{kw.keyword}</span>
                  <span className="rounded bg-blue-200/60 px-1 py-0.2 text-[10px] text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                    {kw.count}
                  </span>
                </span>
              ))}
              {(!activePoint.topKeywords || activePoint.topKeywords.length === 0) && (
                <span className="text-xs text-slate-400">No keyword clusters recorded</span>
              )}
            </div>
          </div>

          {/* Top Contributing Authors (AuthorSparkline) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Key Driving Voices
            </h3>
            <div className="space-y-2 pt-1">
              {(activePoint.topAuthors || []).map((auth) => (
                <div
                  key={auth.authorId}
                  className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                >
                  <span className="font-medium truncate max-w-[140px]">{auth.authorName}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {auth.count} posts
                  </span>
                </div>
              ))}
              {(!activePoint.topAuthors || activePoint.topAuthors.length === 0) && (
                <span className="text-xs text-slate-400">No author mentions aggregated</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
