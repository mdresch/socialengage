/**
 * RankedList — Story 12.10 (ADR-0105).
 * Renders ordered lists for top topics, top terms, or top entities.
 */

import React from 'react';
import { ListWidgetData } from '../dashboardTypes';

interface RankedListProps {
  title: string;
  data: ListWidgetData;
}

export function RankedList({ title, data }: RankedListProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'ranked-list',
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
      'ol',
      {
        style: {
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        },
      },
      ...data.items.map((item, idx) =>
        React.createElement(
          'li',
          {
            key: item.label,
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement(
              'span',
              {
                style: {
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: '#f3f4f6',
                  color: '#4b5563',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                },
              },
              idx + 1
            ),
            React.createElement('span', { style: { fontWeight: 500, color: '#111827' } }, item.label)
          ),
          React.createElement(
            'span',
            { style: { fontWeight: 600, color: '#6b7280' } },
            item.value
          )
        )
      )
    )
  );
}
