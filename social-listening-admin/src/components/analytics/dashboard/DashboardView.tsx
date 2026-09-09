/**
 * DashboardView — Story 12.10 (ADR-0105).
 * Complete analytics dashboard page combining FilterBar and WidgetGrid.
 */

import React from 'react';
import {
  DashboardWidget,
  DashboardFilters,
  DashboardFilterState,
} from './dashboardTypes';
import { FilterBar } from './FilterBar';
import { WidgetGrid } from './WidgetGrid';

interface DashboardViewProps {
  widgets: DashboardWidget[];
  filters: DashboardFilters;
  filterState: DashboardFilterState;
  loading?: boolean;
  onFilterChange: (updated: Partial<DashboardFilterState>) => void;
}

export function DashboardView({
  widgets,
  filters,
  filterState,
  loading = false,
  onFilterChange,
}: DashboardViewProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'dashboard-view',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
    },
    React.createElement(FilterBar, {
      filters,
      filterState,
      onChange: onFilterChange,
    }),
    React.createElement(WidgetGrid, {
      widgets,
      loading,
    })
  );
}
