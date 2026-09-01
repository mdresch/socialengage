/**
 * PieChart — Story 12.10 (ADR-0105).
 * Renders circular / segmented distribution breakdowns with percentage badges and legends.
 */

import React from 'react';
import { PieWidgetData } from '../dashboardTypes';

interface PieChartProps {
  title: string;
  data: PieWidgetData;
}

export function PieChart({ title, data }: PieChartProps): React.ReactElement {
  const total = Math.max(
    1,
    data.segments.reduce((acc, s) => acc + s.value, 0)
  );

  return React.createElement(
    'div',
    {
      className: 'pie-chart',
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
          height: 16,
          borderRadius: 9999,
          overflow: 'hidden',
          marginBottom: 16,
        },
      },
      ...data.segments.map((seg) => {
        const pct = Math.round((seg.value / total) * 100);
        return React.createElement('div', {
          key: seg.label,
          style: {
            width: `${pct}%`,
            height: '100%',
            background: seg.color || '#3b82f6',
          },
          title: `${seg.label}: ${seg.value} (${pct}%)`,
        });
      })
    ),
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      ...data.segments.map((seg) => {
        const pct = Math.round((seg.value / total) * 100);
        return React.createElement(
          'div',
          {
            key: seg.label,
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('span', {
              style: {
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: seg.color || '#3b82f6',
              },
            }),
            React.createElement('span', { style: { textTransform: 'capitalize', color: '#374151' } }, seg.label)
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: 8 } },
            React.createElement('span', { style: { fontWeight: 600, color: '#111827' } }, seg.value),
            React.createElement('span', { style: { color: '#6b7280' } }, `${pct}%`)
          )
        );
      })
    )
  );
}
