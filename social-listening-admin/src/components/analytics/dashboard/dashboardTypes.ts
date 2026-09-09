/**
 * Dashboard Types — Story 12.10 (ADR-0105).
 * Typed representations of dashboard widgets, filter states, and deep linking serialization.
 */

export type WidgetType = 'metric' | 'time-series' | 'bar' | 'pie' | 'list' | 'table';

export interface MetricWidgetData {
  type: 'metric';
  value: number;
  previousValue?: number;
  explanation?: string;
}

export interface TimeSeriesWidgetData {
  type: 'time-series';
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
}

export interface BarWidgetData {
  type: 'bar';
  labels: string[];
  data: number[];
}

export interface PieWidgetSegment {
  label: string;
  value: number;
  color?: string;
}

export interface PieWidgetData {
  type: 'pie';
  segments: PieWidgetSegment[];
}

export interface ListWidgetItem {
  label: string;
  value: number;
  url?: string;
}

export interface ListWidgetData {
  type: 'list';
  items: ListWidgetItem[];
}

export interface TableWidgetData {
  type: 'table';
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export type WidgetData =
  | MetricWidgetData
  | TimeSeriesWidgetData
  | BarWidgetData
  | PieWidgetData
  | ListWidgetData
  | TableWidgetData;

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  data: WidgetData;
}

export interface DashboardFilters {
  watchlists: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  availableTimeRanges: string[];
}

export interface DashboardFilterState {
  watchlistId?: string | null;
  selectedTopic?: string | null;
  timeRange?: string | null;
  granularity?: 'hour' | 'day' | 'week' | 'month' | null;
  includeExplanation?: boolean;
}

export interface DashboardDataResponse {
  widgets: DashboardWidget[];
  filters: DashboardFilters;
}

/**
 * Formats filter state to query string for deep linking.
 */
export function formatFilterQueryParams(state: DashboardFilterState): string {
  const params = new URLSearchParams();
  if (state.watchlistId) params.set('watchlistId', state.watchlistId);
  if (state.selectedTopic) params.set('selectedTopic', state.selectedTopic);
  if (state.timeRange) params.set('timeRange', state.timeRange);
  if (state.granularity) params.set('granularity', state.granularity);
  if (state.includeExplanation) params.set('includeExplanation', 'true');
  return params.toString();
}

/**
 * Parses URL query params into typed DashboardFilterState.
 */
export function parseFilterQueryParams(
  searchParams: URLSearchParams | Record<string, string | undefined>
): DashboardFilterState {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    return searchParams[key];
  };

  return {
    watchlistId: get('watchlistId') || null,
    selectedTopic: get('selectedTopic') || null,
    timeRange: get('timeRange') || '7d',
    granularity: (get('granularity') as any) || 'day',
    includeExplanation: get('includeExplanation') === 'true',
  };
}
