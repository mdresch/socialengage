/**
 * TimeSeriesChart — Story 12.10 (ADR-0105).
 * Renders time-series data trends with labels and series lines/bars.
 */

import React from 'react';
import { TimeSeriesWidgetData } from '../dashboardTypes';

interface TimeSeriesChartProps {
  title: string;
  data: TimeSeriesWidgetData;
}

export function TimeSeriesChart({ title, data }: TimeSeriesChartProps): React.ReactElement {
  const maxVal = Math.max(
    1,
    ...data.series.flatMap((s) => s.data)
  );

  return React.createElement(
    'div',
    {
      className: 'time-series-chart',
      style: {
        padding: '16px 20px',
        borderRadius: 12,
        background: '#fff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      },
    },
    React.createElement(
      'h3',
      { style: { margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#111827' } },
      title
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          height: 140,
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: 8,
        },
      },
      ...data.labels.map((label, idx) => {
        const val = data.series[0]?.data[idx] ?? 0;
        const heightPct = Math.round((val / maxVal) * 100);

        return React.createElement(
          'div',
          {
            key: label,
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              gap: 4,
            },
          },
          React.createElement(
            'div',
            {
              style: {
                width: '100%',
                maxWidth: 28,
                height: `${Math.max(8, heightPct)}%`,
                background: '#3b82f6',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.2s ease',
              },
              title: `${label}: ${val}`,
            }
          ),
          React.createElement(
            'span',
            { style: { fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap' } },
            label.slice(5) // e.g. "08-20"
          ),
          React.createElement(
            'span',
            { style: { fontSize: '0.75rem', fontWeight: 600, color: '#111827' } },
            val
          )
        );
      })
    )
  );
}
