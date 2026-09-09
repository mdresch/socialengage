'use client';

import React, { useState } from 'react';
import type { TopicDriftResult } from '@/lib/core-client';

export interface DriftExplanationCardProps {
  drift?: TopicDriftResult;
  topicName?: string;
}

export function DriftExplanationCard({ drift, topicName = 'this topic' }: DriftExplanationCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!drift) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Semantic Drift Explanation</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select a date range and run drift analysis to see how the topic has shifted.
        </p>
      </div>
    );
  }

  const handleAskRAG = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    const question = [
      `The topic "${topicName}" has a semantic drift score of ${drift.driftScore.toFixed(2)}.`,
      `The top semantic clusters in the "then" window are: ${drift.topClustersThen.join(', ')}.`,
      `The top semantic clusters in the "now" window are: ${drift.topClustersNow.join(', ')}.`,
      `Sample posts from the "then" window: ${drift.samplePostsThen.join('; ')}.`,
      `Sample posts from the "now" window: ${drift.samplePostsNow.join('; ')}.`,
      `Explain in plain language how the meaning of "${topicName}" has shifted between the two time windows.`,
    ].join(' ');

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, maxChunks: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'RAG ask failed');
      setSummary(data.answer || 'No summary available.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate drift summary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            ⚠️ Semantic Drift Explanation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drift score: <span className="font-medium text-slate-700 dark:text-slate-200">{drift.driftScore.toFixed(2)}</span>{' '}
            — warning: <span className="font-medium text-slate-700 dark:text-slate-200">{drift.warning}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleAskRAG}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate AI Summary'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      )}

      {summary && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          {summary}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Then — {drift.start.slice(0, 10)}</h4>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Top clusters:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {drift.topClustersThen.map((cluster) => (
                <span
                  key={`then-${cluster}`}
                  className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {cluster}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Sample posts:</span>
            <ul className="mt-1 list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {drift.samplePostsThen.map((post, i) => (
                <li key={`then-post-${i}`}>{post}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Now — {drift.end.slice(0, 10)}</h4>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Top clusters:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {drift.topClustersNow.map((cluster) => (
                <span
                  key={`now-${cluster}`}
                  className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  {cluster}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Sample posts:</span>
            <ul className="mt-1 list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {drift.samplePostsNow.map((post, i) => (
                <li key={`now-post-${i}`}>{post}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
