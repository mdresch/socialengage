/**
 * WidgetRenderer — Story 12.10 (ADR-0105).
 * Inspects widget type and dispatches to the appropriate specialized widget renderer.
 * Handles loading skeleton and empty states.
 */

import React from 'react';
import {
  DashboardWidget,
  MetricWidgetData,
  TimeSeriesWidgetData,
  BarWidgetData,
  PieWidgetData,
  ListWidgetData,
  TableWidgetData,
} from './dashboardTypes';
import { MetricTile } from './widgets/MetricTile';
import { TimeSeriesChart } from './widgets/TimeSeriesChart';
import { BarChart } from './widgets/BarChart';
import { PieChart } from './widgets/PieChart';
import { RankedList } from './widgets/RankedList';
import { DataTable } from './widgets/DataTable';

interface WidgetRendererProps {
  widget: DashboardWidget;
  loading?: boolean;
}

export function WidgetRenderer({ widget, loading = false }: WidgetRendererProps): React.ReactElement {
  if (loading) {
    return React.createElement(
      'div',
      {
        className: 'widget-renderer widget-renderer--loading',
        style: {
          padding: 24,
          borderRadius: 12,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
        },
      },
      React.createElement('span', null, `Loading ${widget.title}...`)
    );
  }

  const isDataEmpty = checkIsDataEmpty(widget);

  if (isDataEmpty) {
    return React.createElement(
      'div',
      {
        className: 'widget-renderer widget-renderer--empty',
        style: {
          padding: 24,
          borderRadius: 12,
          background: '#fff',
          border: '1px solid #e5e7eb',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
      },
      React.createElement('h3', { style: { margin: 0, fontSize: '0.95rem', color: '#374151' } }, widget.title),
      React.createElement('span', { style: { fontSize: '0.85rem', color: '#9ca3af' } }, 'No data available for the selected filters.')
    );
  }

  switch (widget.type) {
    case 'metric':
      return React.createElement(MetricTile, {
        title: widget.title,
        data: widget.data as MetricWidgetData,
      });

    case 'time-series':
      return React.createElement(TimeSeriesChart, {
        title: widget.title,
        data: widget.data as TimeSeriesWidgetData,
      });

    case 'bar':
      return React.createElement(BarChart, {
        title: widget.title,
        data: widget.data as BarWidgetData,
      });

    case 'pie':
      return React.createElement(PieChart, {
        title: widget.title,
        data: widget.data as PieWidgetData,
      });

    case 'list':
      return React.createElement(RankedList, {
        title: widget.title,
        data: widget.data as ListWidgetData,
      });

    case 'table':
      return React.createElement(DataTable, {
        title: widget.title,
        data: widget.data as TableWidgetData,
      });

    default:
      return React.createElement(
        'div',
        { className: 'widget-renderer--unknown' },
        `Unsupported widget type: ${(widget as any).type}`
      );
  }
}

function checkIsDataEmpty(widget: DashboardWidget): boolean {
  const data = widget.data;
  if (!data) return true;

  switch (data.type) {
    case 'list':
      return !data.items || data.items.length === 0;
    case 'table':
      return !data.rows || data.rows.length === 0;
    case 'bar':
      return !data.data || data.data.length === 0;
    case 'time-series':
      return !data.labels || data.labels.length === 0;
    case 'pie':
      return !data.segments || data.segments.length === 0;
    case 'metric':
      return false; // numbers like 0 are valid metric data
    default:
      return false;
  }
}
