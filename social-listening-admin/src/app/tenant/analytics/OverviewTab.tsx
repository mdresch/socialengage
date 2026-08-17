import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EmptyState } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import { computePercentDelta, type AnalyticsSummary, type PercentDelta } from './analyticsData';

interface OverviewTabProps {
  summary: AnalyticsSummary;
  previousSummary?: AnalyticsSummary | null;
}

const SENTIMENT_COLORS = { positive: '#15803d', neutral: '#64748b', negative: '#dc2626' };

/** Renders nothing (not even a "no data" placeholder) when there's genuinely no comparison to show — Story 8.4 AC4. */
function DeltaBadge({ delta }: { delta: PercentDelta }) {
  if (delta.trend === 'none' || delta.pct === null) {
    return <span className="an-delta an-delta-none">vs. previous period: no prior data</span>;
  }
  const sign = delta.pct > 0 ? '+' : '';
  return <span className={`an-delta an-delta-${delta.trend}`}>{sign}{delta.pct}% vs. previous period</span>;
}

/**
 * Story 8.1 — a summary view: reuses the same sentimentSplit/sources
 * aggregation the Sources/Sentiment tabs render in full, introduces no new
 * aggregation of its own beyond volumeHistory/percent-delta (AC7).
 *
 * Story 8.4 — adds a real volume-over-time chart (summary.volumeHistory), a
 * real sentiment donut (the exact summary.sentimentSplit numbers Sentiment
 * tab's own donut reads), and a real percentage delta against
 * previousSummary when the date picker's comparison toggle is on.
 */
export function OverviewTab({ summary, previousSummary }: OverviewTabProps) {
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

  const totalDelta = computePercentDelta(summary.totalPosts, previousSummary ? previousSummary.totalPosts : null);
  const positiveDelta = computePercentDelta(positive, previousSummary ? previousSummary.sentimentSplit.positive : null);

  const donutData = [
    { name: 'Positive', value: positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: negative, color: SENTIMENT_COLORS.negative },
  ];

  return (
    <div className="an-overview" id="analytics-overview-tab">
      <div className="an-kpi-card" id="widget-overview-total">
        <span className="an-kpi-label">Total matched posts</span>
        <span className="an-kpi-value">{summary.totalPosts.toLocaleString()}</span>
        <DeltaBadge delta={totalDelta} />
      </div>

      <div className="an-kpi-card" id="widget-overview-sentiment">
        <span className="an-kpi-label">Sentiment split</span>
        {enrichedTotal === 0 ? (
          <span className="an-kpi-empty">No enriched posts yet</span>
        ) : (
          <>
            <div className="an-sentiment-mini">
              <span className="an-sentiment-mini-positive">{positive} positive</span>
              <span className="an-sentiment-mini-neutral">{neutral} neutral</span>
              <span className="an-sentiment-mini-negative">{negative} negative</span>
            </div>
            <DeltaBadge delta={positiveDelta} />
          </>
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

      <div className="an-widget" id="widget-overview-volume">
        <div className="an-widget-header">
          <span className="an-widget-title">Post volume over time</span>
        </div>
        <div className="an-chart-wrap" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.volumeHistory} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
              <Area type="monotone" dataKey="count" name="Posts" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="an-widget" id="widget-overview-sentiment-donut">
        <div className="an-widget-header">
          <span className="an-widget-title">Sentiment</span>
        </div>
        {enrichedTotal === 0 ? (
          <span className="an-kpi-empty">No enriched posts yet</span>
        ) : (
          <div className="an-sent-donut-wrap">
            <PieChart width={120} height={120}>
              <Pie data={donutData} cx={60} cy={60} innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={1} stroke="#fff">
                {donutData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="an-sent-donut-legend">
              {donutData.map((d) => (
                <div key={d.name} className="an-sent-donut-row">
                  <span className="an-list-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="an-sent-donut-count">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
