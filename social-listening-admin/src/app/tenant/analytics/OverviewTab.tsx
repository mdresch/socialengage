import { EmptyState } from '@/components/ui';
import type { AnalyticsSummary } from './analyticsData';

interface OverviewTabProps {
  summary: AnalyticsSummary;
}

/**
 * Story 8.1 — a summary view only: reuses the same sentimentSplit/sources
 * aggregation the Sources tab renders in full, introduces no computation of
 * its own (AC7).
 */
export function OverviewTab({ summary }: OverviewTabProps) {
  if (summary.totalPosts === 0) {
    return (
      <EmptyState
        heading="No posts in this range"
        body="Try a wider date range, or connect a platform to start ingesting content."
      />
    );
  }

  const { positive, neutral, negative } = summary.sentimentSplit;
  const enrichedTotal = positive + neutral + negative;

  return (
    <div className="an-overview" id="analytics-overview-tab">
      <div className="an-kpi-card" id="widget-overview-total">
        <span className="an-kpi-label">Total matched posts</span>
        <span className="an-kpi-value">{summary.totalPosts.toLocaleString()}</span>
      </div>

      <div className="an-kpi-card" id="widget-overview-sentiment">
        <span className="an-kpi-label">Sentiment split</span>
        {enrichedTotal === 0 ? (
          <span className="an-kpi-empty">No enriched posts yet</span>
        ) : (
          <div className="an-sentiment-mini">
            <span className="an-sentiment-mini-positive">{positive} positive</span>
            <span className="an-sentiment-mini-neutral">{neutral} neutral</span>
            <span className="an-sentiment-mini-negative">{negative} negative</span>
          </div>
        )}
      </div>

      <div className="an-kpi-card" id="widget-overview-sources">
        <span className="an-kpi-label">Source breakdown</span>
        <ul className="an-source-mini-list">
          {summary.sources.map((source) => (
            <li key={source.providerId} className="an-source-mini-row">
              <span className={`provider-pill provider-pill-${source.providerId}`}>{source.label}</span>
              <span className="an-source-mini-count">{source.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
