/**
 * MetricTile — Story 12.10 (ADR-0105).
 * Renders high-level KPI cards with value, percentage comparison, and optional explainability callout.
 */

import React from 'react';
import { MetricWidgetData } from '../dashboardTypes';

interface MetricTileProps {
  title: string;
  data: MetricWidgetData;
}

export function MetricTile({ title, data }: MetricTileProps): React.ReactElement {
  const formattedValue = new Intl.NumberFormat('en-US').format(data.value);
  let diffPercent: number | null = null;
  let isPositive = false;

  if (typeof data.previousValue === 'number' && data.previousValue > 0) {
    diffPercent = Math.round(((data.value - data.previousValue) / data.previousValue) * 100);
    isPositive = diffPercent >= 0;
  }

  return React.createElement(
    'div',
    {
      className: 'metric-tile',
      style: {
        padding: '16px 20px',
        borderRadius: 12,
        background: '#fff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
    },
    React.createElement(
      'span',
      { style: { fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.025em' } },
      title
    ),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'baseline', gap: 12 } },
      React.createElement(
        'span',
        { style: { fontSize: '2rem', fontWeight: 700, color: '#111827' } },
        formattedValue
      ),
      diffPercent !== null
        ? React.createElement(
            'span',
            {
              style: {
                fontSize: '0.875rem',
                fontWeight: 600,
                color: isPositive ? '#16a34a' : '#dc2626',
              },
            },
            `${isPositive ? '+' : ''}${diffPercent}%`
          )
        : null
    ),
    data.explanation
      ? React.createElement(
          'div',
          {
            className: 'metric-tile__explanation',
            style: {
              marginTop: 4,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#f0fdf4',
              color: '#166534',
              fontSize: '0.8rem',
              lineHeight: 1.3,
            },
          },
          data.explanation
        )
      : null
  );
}
