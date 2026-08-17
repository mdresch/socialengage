'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineError } from '@/components/ui';
import { GlobalDateRangePicker, type DateRangeValue } from './GlobalDateRangePicker';
import type { AnalyticsSummary, DateRangeFilter } from './analyticsData';
import { OverviewTab } from './OverviewTab';
import { SourcesTab } from './SourcesTab';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectTab(tab: AnalyticsTab) {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`);
  }

  async function handleRangeChange(value: DateRangeValue) {
    setRangeKey(value.key);
    const nextRange: DateRangeFilter = { startDate: value.startDate, endDate: value.endDate };
    setRange(nextRange);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/analytics/summary?startDate=${encodeURIComponent(nextRange.startDate)}&endDate=${encodeURIComponent(nextRange.endDate)}`
      );
      if (!response.ok) {
        throw new Error('Failed to load analytics data.');
      }
      const nextSummary = (await response.json()) as AnalyticsSummary;
      setSummary(nextSummary);
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
        {activeTab === 'overview' && <OverviewTab summary={summary} />}
        {activeTab === 'sources' && <SourcesTab summary={summary} />}
        {activeTab === 'sentiment' && (
          <p className="an-coming-soon">The Sentiment tab is not built yet (Story 8.2).</p>
        )}
        {activeTab === 'conversations' && (
          <p className="an-coming-soon">The Conversations tab is not built yet (Story 8.3).</p>
        )}
      </div>
    </div>
  );
}
