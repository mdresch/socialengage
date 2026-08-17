'use client';

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import type { AnalyticsSummary } from './analyticsData';

interface SourcesTabProps {
  summary: AnalyticsSummary;
}

const LINE_COLORS = ['#2563eb', '#15803d', '#d97706', '#7c3aed', '#dc2626'];

/**
 * Story 8.1 (ADR-0054 Decision §2) — per real-`providerId` volume and
 * sentiment breakdown for exactly this project's real content connectors.
 * Only providers with at least one matched post render at all — no
 * placeholder row for an unused connector (AC8).
 */
export function SourcesTab({ summary }: SourcesTabProps) {
  if (summary.sources.length === 0) {
    return (
      <EmptyState
        heading="No posts in this range"
        body="Try a wider date range, or connect a platform to start ingesting content."
      />
    );
  }

  const chartData = summary.sources.map((source) => ({
    label: source.label,
    providerId: source.providerId,
    count: source.count,
  }));

  return (
    <div className="an-sources" id="analytics-sources-tab">
      <div className="an-widget" id="widget-sources-chart">
        <div className="an-widget-header">
          <span className="an-widget-title">Post volume by source</span>
        </div>
        <div className="an-chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <AnimatedChartTooltip
                    active={active}
                    title={String(label)}
                    items={payload?.map((p) => ({ name: 'Posts', value: p.value as number })) ?? []}
                  />
                )}
              />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="an-widget" id="widget-sources-list">
        <div className="an-widget-header">
          <span className="an-widget-title">Source detail</span>
        </div>
        <ul className="an-source-detail-list">
          {summary.sources.map((source) => (
            <li key={source.providerId} className="an-source-detail-row">
              <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
              <span className="an-source-detail-count">{source.count.toLocaleString()} posts</span>
              <span className="an-source-detail-sentiment">
                <span className="an-sentiment-mini-positive">{source.sentiment.positive} pos</span>
                <span className="an-sentiment-mini-neutral">{source.sentiment.neutral} neu</span>
                <span className="an-sentiment-mini-negative">{source.sentiment.negative} neg</span>
              </span>
              <span className="an-source-detail-index">
                {source.sentimentIndex === null ? 'No sentiment data' : `${source.sentimentIndex.toFixed(1)} / 10`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="an-widget" id="widget-sources-volume-history">
        <div className="an-widget-header">
          <span className="an-widget-title">Source volume over time</span>
        </div>
        <div className="an-chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={summary.sourceVolumeHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <AnimatedChartTooltip
                    active={active}
                    title={String(label)}
                    items={payload?.map((p) => ({ name: String(p.name), value: p.value as number, color: p.color as string })) ?? []}
                  />
                )}
              />
              {summary.sources.map((source, i) => (
                <Line
                  key={source.providerId}
                  type="monotone"
                  dataKey={source.providerId}
                  name={source.label}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
