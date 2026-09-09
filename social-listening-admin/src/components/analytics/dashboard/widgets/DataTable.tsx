/**
 * DataTable — Story 12.10 (ADR-0105).
 * Renders structured tabular breakdown widgets with columns and data rows.
 */

import React from 'react';
import { TableWidgetData } from '../dashboardTypes';

interface DataTableProps {
  title: string;
  data: TableWidgetData;
}

export function DataTable({ title, data }: DataTableProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'data-table-widget',
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
      { style: { margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600, color: '#111827' } },
      title
    ),
    React.createElement(
      'div',
      { style: { overflowX: 'auto' } },
      React.createElement(
        'table',
        { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' } },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            ...data.columns.map((col) =>
              React.createElement(
                'th',
                {
                  key: col,
                  style: {
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '2px solid #e5e7eb',
                    color: '#4b5563',
                    fontWeight: 600,
                  },
                },
                col
              )
            )
          )
        ),
        React.createElement(
          'tbody',
          null,
          ...data.rows.map((row, rIdx) =>
            React.createElement(
              'tr',
              { key: rIdx, style: { borderBottom: '1px solid #f3f4f6' } },
              ...data.columns.map((col) =>
                React.createElement(
                  'td',
                  { key: col, style: { padding: '8px 10px', color: '#111827' } },
                  row[col] ?? '—'
                )
              )
            )
          )
        )
      )
    )
  );
}
