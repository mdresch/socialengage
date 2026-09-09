/**
 * WidgetGrid — Story 12.10 (ADR-0105).
 * Responsive grid layout rendering an array of dashboard widgets via WidgetRenderer.
 */

import React from 'react';
import { DashboardWidget } from './dashboardTypes';
import { WidgetRenderer } from './WidgetRenderer';

interface WidgetGridProps {
  widgets: DashboardWidget[];
  loading?: boolean;
}

export function WidgetGrid({ widgets, loading = false }: WidgetGridProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'dashboard-widget-grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
      },
    },
    ...widgets.map((widget) =>
      React.createElement(
        'div',
        {
          key: widget.id,
          className: `widget-grid-item widget-grid-item--${widget.type}`,
          style: {
            gridColumn: widget.type === 'time-series' || widget.type === 'table' ? 'span 2' : 'span 1',
          },
        },
        React.createElement(WidgetRenderer, { widget, loading })
      )
    )
  );
}
