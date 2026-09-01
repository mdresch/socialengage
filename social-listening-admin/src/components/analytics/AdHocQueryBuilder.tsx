'use client';

import React, { useState } from 'react';
import type { AdHocQueryClientResponse } from '@/lib/core-client';

const ALL_DIMENSIONS = [
  { id: 'date', label: 'Date' },
  { id: 'platform', label: 'Platform / Source' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'author', label: 'Author ID' },
  { id: 'watchlist', label: 'Watchlist ID' },
  { id: 'hour', label: 'Hour of Day' },
];

const ALL_METRICS = [
  { id: 'post_count', label: 'Total Posts' },
  { id: 'positive_count', label: 'Positive Posts' },
  { id: 'neutral_count', label: 'Neutral Posts' },
  { id: 'negative_count', label: 'Negative Posts' },
  { id: 'engagement_total', label: 'Total Engagement' },
];

const TIME_GRAINS = [
  { id: 'day', label: 'Daily' },
  { id: 'hour', label: 'Hourly' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

export function AdHocQueryBuilder() {
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['date', 'platform']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['post_count', 'positive_count', 'negative_count']);
  const [timeGrain, setTimeGrain] = useState<'day' | 'hour' | 'week' | 'month'>('day');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdHocQueryClientResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDimension = (id: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleRunQuery = async () => {
    if (selectedDimensions.length === 0 && selectedMetrics.length === 0) {
      setError('Select at least one dimension or metric.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: selectedDimensions,
          metrics: selectedMetrics,
          timeGrain,
          filters: {
            startDate: startDate ? `${startDate}T00:00:00Z` : undefined,
            endDate: endDate ? `${endDate}T23:59:59Z` : undefined,
          },
          limit: 500,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Query execution failed');
        return;
      }

      const data: AdHocQueryClientResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!result || result.data.length === 0) return;
    const headers = [...result.dimensions, ...result.metrics];
    const lines = [headers.join(',')];
    for (const row of result.data) {
      const line = headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        })
        .join(',');
      lines.push(line);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `adhoc-analytics-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div
        className="page-header"
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 0,
        }}
      >
        <div>
          <h1 className="page-title">Ad-Hoc Analytics Query Builder</h1>
          <p className="page-subtitle">
            Configure multi-dimensional metrics, time grains, and filters for instant custom slicing
          </p>
        </div>
      </div>

      {/* Query Configuration Card */}
      <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Dimensions Selector */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
            Dimensions (Group By)
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {ALL_DIMENSIONS.map((dim) => {
              const active = selectedDimensions.includes(dim.id);
              return (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => toggleDimension(dim.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--color-primary, #6366f1)' : '1px solid var(--color-border, #e5e7eb)',
                    background: active ? 'var(--color-primary-subtle, #ede9fe)' : 'var(--color-surface, #fff)',
                    color: active ? 'var(--color-primary, #6366f1)' : 'var(--color-text, #374151)',
                  }}
                >
                  {active ? '✓ ' : '+ '}
                  {dim.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Metrics Selector */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
            Metrics (Aggregations)
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {ALL_METRICS.map((metric) => {
              const active = selectedMetrics.includes(metric.id);
              return (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => toggleMetric(metric.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid #10b981' : '1px solid var(--color-border, #e5e7eb)',
                    background: active ? '#d1fae5' : 'var(--color-surface, #fff)',
                    color: active ? '#059669' : 'var(--color-text, #374151)',
                  }}
                >
                  {active ? '✓ ' : '+ '}
                  {metric.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Grain & Date Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
              Time Grain
            </label>
            <select
              className="input"
              value={timeGrain}
              onChange={(e) => setTimeGrain(e.target.value as any)}
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
            >
              {TIME_GRAINS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
              Start Date
            </label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
              End Date
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
            <button
              id="btn-run-adhoc-query"
              className="btn btn-primary btn-sm"
              onClick={handleRunQuery}
              disabled={loading}
            >
              {loading ? 'Running…' : '▶ Run Query'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--color-error, #ef4444)', fontSize: '0.875rem', fontWeight: 500 }}>
            {error}
          </div>
        )}
      </div>

      {/* Query Results */}
      {result && (
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Query Results</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginLeft: 'var(--space-3)' }}>
                {result.rowCount} rows in {result.executionTimeMs}ms
              </span>
            </div>
            {result.rowCount > 0 && (
              <button
                id="btn-export-csv"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadCsv}
              >
                📥 Export CSV
              </button>
            )}
          </div>

          {result.rowCount === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--color-text-muted)' }}>
              No records matched the selected dimensions and date range.
            </div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {result.dimensions.map((d) => (
                      <th
                        key={d}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--space-2) var(--space-3)',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          borderBottom: '2px solid var(--color-border)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {d}
                      </th>
                    ))}
                    {result.metrics.map((m) => (
                      <th
                        key={m}
                        style={{
                          textAlign: 'right',
                          padding: 'var(--space-2) var(--space-3)',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          borderBottom: '2px solid var(--color-border)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {m.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {result.dimensions.map((d) => (
                        <td key={d} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.875rem' }}>
                          {row[d] !== null && row[d] !== undefined ? String(row[d]) : '—'}
                        </td>
                      ))}
                      {result.metrics.map((m) => (
                        <td
                          key={m}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            fontSize: '0.875rem',
                            textAlign: 'right',
                            fontWeight: 600,
                          }}
                        >
                          {row[m] !== null && row[m] !== undefined ? Number(row[m]).toLocaleString() : '0'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
