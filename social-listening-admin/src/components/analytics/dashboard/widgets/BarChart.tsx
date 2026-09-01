/**
 * BarChart — Story 12.10 (ADR-0105).
 * Renders categorized horizontal bar charts with labels and relative counts.
 */

import React from 'react';
import { BarWidgetData } from '../dashboardTypes';

interface BarChartProps {
  title: string;
  data: BarWidgetData;
}

export function BarChart({ title, data }: BarChartProps): React.ReactElement {
  const maxVal = Math.max(1, ...data.data);

  return React.createElement(
    'div',
    {
      className: 'bar-chart',
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
      { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      ...data.labels.map((label, idx) => {
        const val = data.data[idx] ?? 0;
        const widthPct = Math.round((val / maxVal) * 100);

        return React.createElement(
          'div',
          { key: label, style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' } },
            React.createElement('span', { style: { fontWeight: 500, color: '#374151' } }, label),
            React.createElement('span', { style: { fontWeight: 600, color: '#111827' } }, val)
          ),
          React.createElement(
            'div',
            {
              style: {
                width: '100%',
                height: 8,
                background: '#f3f4f6',
                borderRadius: 9999,
                overflow: 'hidden',
              },
            },
            React.createElement('div', {
              style: {
                width: `${Math.max(4, widthPct)}%`,
                height: '100%',
                background: '#6366f1',
                borderRadius: 9999,
              },
            })
          )
        );
      })
    )
  );
}
