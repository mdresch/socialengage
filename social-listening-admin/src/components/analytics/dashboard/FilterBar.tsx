/**
 * FilterBar — Story 12.10 (ADR-0105).
 * Dashboard filter toolbar with Watchlist, Topic, and TimeRange selectors.
 */

import React from 'react';
import { DashboardFilters, DashboardFilterState } from './dashboardTypes';

interface FilterBarProps {
  filters: DashboardFilters;
  filterState: DashboardFilterState;
  onChange: (updated: Partial<DashboardFilterState>) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

export function FilterBar({
  filters,
  filterState,
  onChange,
}: FilterBarProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'dashboard-filter-bar',
      style: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        padding: '12px 16px',
        borderRadius: 12,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        marginBottom: 20,
      },
    },
    // 1. Watchlist Selector
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('label', { htmlFor: 'filter-watchlist', style: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' } }, 'Watchlist:'),
      React.createElement(
        'select',
        {
          id: 'filter-watchlist',
          value: filterState.watchlistId ?? '',
          onChange: (e: any) => onChange({ watchlistId: (e.target as HTMLSelectElement).value || null }),
          style: selectStyle,
          'aria-label': 'Select Watchlist',
        },
        React.createElement('option', { value: '' }, 'All Watchlists'),
        ...filters.watchlists.map((wl) =>
          React.createElement('option', { key: wl.id, value: wl.id }, wl.name)
        )
      )
    ),

    // 2. Topic Selector
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('label', { htmlFor: 'filter-topic', style: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' } }, 'Topic:'),
      React.createElement(
        'select',
        {
          id: 'filter-topic',
          value: filterState.selectedTopic ?? '',
          onChange: (e: any) => onChange({ selectedTopic: (e.target as HTMLSelectElement).value || null }),
          style: selectStyle,
          'aria-label': 'Select Topic',
        },
        React.createElement('option', { value: '' }, 'All Topics'),
        ...filters.topics.map((t) =>
          React.createElement('option', { key: t.id, value: t.id }, t.name)
        )
      )
    ),

    // 3. Time Range Selector
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('label', { htmlFor: 'filter-time-range', style: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' } }, 'Range:'),
      React.createElement(
        'select',
        {
          id: 'filter-time-range',
          value: filterState.timeRange ?? '7d',
          onChange: (e: any) => onChange({ timeRange: (e.target as HTMLSelectElement).value }),
          style: selectStyle,
          'aria-label': 'Select Time Range',
        },
        ...filters.availableTimeRanges.map((tr) =>
          React.createElement('option', { key: tr, value: tr }, tr)
        )
      )
    ),

    // 4. Granularity Selector
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      React.createElement('label', { htmlFor: 'filter-granularity', style: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' } }, 'Granularity:'),
      React.createElement(
        'select',
        {
          id: 'filter-granularity',
          value: filterState.granularity ?? 'day',
          onChange: (e: any) => onChange({ granularity: (e.target as HTMLSelectElement).value as any }),
          style: selectStyle,
          'aria-label': 'Select Granularity',
        },
        React.createElement('option', { value: 'hour' }, 'Hour'),
        React.createElement('option', { value: 'day' }, 'Day'),
        React.createElement('option', { value: 'week' }, 'Week'),
        React.createElement('option', { value: 'month' }, 'Month')
      )
    )
  );
}
