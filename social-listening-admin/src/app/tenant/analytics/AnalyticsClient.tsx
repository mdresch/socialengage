'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineError } from '@/components/ui';
import { GlobalDateRangePicker, type DateRangeValue } from './GlobalDateRangePicker';
import type { AnalyticsSummary, DateRangeFilter } from './analyticsData';
import { OverviewTab } from './OverviewTab';
import { SourcesTab } from './SourcesTab';
import { SentimentTab } from './SentimentTab';
import { ConversationsTab } from './ConversationsTab';
import type { AnalyticsTab } from './page';

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'sources', label: 'Sources' },
];

interface AnalyticsClientProps {
  initialSummary: AnalyticsSummary;
  initialRange: DateRangeFilter;
  initialTab: AnalyticsTab;
}

export function AnalyticsClient({ initialSummary, initialRange, initialTab }: AnalyticsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
  const [range, setRange] = useState<DateRangeFilter>(initialRange);
  const [rangeKey, setRangeKey] = useState<string>('last_30_days');
  const [summary, setSummary] = useState<AnalyticsSummary>(initialSummary);
  const [previousSummary, setPreviousSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectTab(tab: AnalyticsTab) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`);
  }

  /**
   * Story 8.4 — reads DateRangeValue.compareWithPrevious for the first time
   * (the picker has set it on every onChange since Story 8.1; it was simply
   * never read). When true, /api/analytics/summary is asked for a real
   * comparison; previousSummary is set from whatever it genuinely returns
   * (including null when the prior period has no data), never estimated
   * client-side.
   */
  async function handleRangeChange(value: DateRangeValue) {
    setRangeKey(value.key);
    const nextRange: DateRangeFilter = { startDate: value.startDate, endDate: value.endDate };
    setRange(nextRange);
    setLoading(true);
    setError(null);
    const compareParam = value.compareWithPrevious ? '&compare=true' : '';
    try {
      const response = await fetch(
        `/api/analytics/summary?startDate=${encodeURIComponent(nextRange.startDate)}&endDate=${encodeURIComponent(nextRange.endDate)}${compareParam}`
      );
      if (!response.ok) {
        throw new Error('Failed to load analytics data.');
      }
      const result = (await response.json()) as { current: AnalyticsSummary; previous: AnalyticsSummary | null };
      setSummary(result.current);
      setPreviousSummary(result.previous);
    } catch {
      setError('Could not load analytics for this date range. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="an-root" id="tenant-analytics-dashboard">
      <div className="an-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            Post volume, sentiment, and source breakdown for {range.startDate} to {range.endDate}
          </p>
        </div>
        <GlobalDateRangePicker value={rangeKey} onChange={handleRangeChange} />
      </div>

      <div className="an-tabs" role="tablist" aria-label="Analytics views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            id={`an-tab-${tab.id}`}
            className={`an-tab-btn${activeTab === tab.id ? ' an-tab-btn-active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <InlineError message={error} />
      {loading && <p className="an-loading">Updating…</p>}

      <div className="an-tab-panel" role="tabpanel">
        {activeTab === 'overview' && <OverviewTab summary={summary} previousSummary={previousSummary} />}
        {activeTab === 'sources' && <SourcesTab summary={summary} />}
        {activeTab === 'sentiment' && <SentimentTab summary={summary} range={range} />}
        {activeTab === 'conversations' && <ConversationsTab summary={summary} range={range} />}
      </div>
    </div>
  );
}
