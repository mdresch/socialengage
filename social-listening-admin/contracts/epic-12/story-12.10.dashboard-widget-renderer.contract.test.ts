/**
 * Contract: Story 12.10 (ADR-0105, BRD-0105, FDD-0105) — Dashboard widget renderer (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1210--dashboard-widget-renderer-frontend
 * and docs/adr/0105-dashboards-and-analytics-widget-contracts.md
 */

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  DashboardWidget,
  DashboardFilters,
  DashboardFilterState,
  formatFilterQueryParams,
  parseFilterQueryParams,
} from '../../src/components/analytics/dashboard/dashboardTypes';
import { MetricTile } from '../../src/components/analytics/dashboard/widgets/MetricTile';
import { TimeSeriesChart } from '../../src/components/analytics/dashboard/widgets/TimeSeriesChart';
import { BarChart } from '../../src/components/analytics/dashboard/widgets/BarChart';
import { PieChart } from '../../src/components/analytics/dashboard/widgets/PieChart';
import { RankedList } from '../../src/components/analytics/dashboard/widgets/RankedList';
import { DataTable } from '../../src/components/analytics/dashboard/widgets/DataTable';
import { WidgetRenderer } from '../../src/components/analytics/dashboard/WidgetRenderer';
import { FilterBar } from '../../src/components/analytics/dashboard/FilterBar';
import { WidgetGrid } from '../../src/components/analytics/dashboard/WidgetGrid';
import { DashboardView } from '../../src/components/analytics/dashboard/DashboardView';

describe('Story 12.10 — Dashboard widget renderer (frontend)', () => {
  const sampleWidgets: DashboardWidget[] = [
    {
      id: 'volume-metric',
      type: 'metric',
      title: 'Total Volume',
      data: {
        type: 'metric',
        value: 1250,
        previousValue: 1000,
        explanation: 'Volume increased by 25% across all channels.',
      },
    },
    {
      id: 'volume-over-time',
      type: 'time-series',
      title: 'Volume Over Time',
      data: {
        type: 'time-series',
        labels: ['2026-08-20', '2026-08-21', '2026-08-22'],
        series: [{ name: 'Posts', data: [120, 150, 180] }],
      },
    },
    {
      id: 'platform-distribution',
      type: 'bar',
      title: 'Source Breakdown',
      data: {
        type: 'bar',
        labels: ['Twitter', 'LinkedIn', 'Facebook'],
        data: [450, 320, 180],
      },
    },
    {
      id: 'sentiment-breakdown',
      type: 'pie',
      title: 'Sentiment Share',
      data: {
        type: 'pie',
        segments: [
          { label: 'positive', value: 65, color: '#16a34a' },
          { label: 'neutral', value: 25, color: '#6b7280' },
          { label: 'negative', value: 10, color: '#dc2626' },
        ],
      },
    },
    {
      id: 'top-topics',
      type: 'list',
      title: 'Top Topics',
      data: {
        type: 'list',
        items: [
          { label: 'Artificial Intelligence', value: 340 },
          { label: 'Cloud Security', value: 210 },
        ],
      },
    },
    {
      id: 'top-authors',
      type: 'table',
      title: 'Top Authors',
      data: {
        type: 'table',
        columns: ['Author', 'Posts', 'Engagement'],
        rows: [
          { Author: 'Alice Tech', Posts: 42, Engagement: 520 },
          { Author: 'Bob Dev', Posts: 31, Engagement: 310 },
        ],
      },
    },
  ];

  const sampleFilters: DashboardFilters = {
    watchlists: [
      { id: 'wl-1', name: 'Tech Brand Watchlist' },
      { id: 'wl-2', name: 'Competitor Intel' },
    ],
    topics: [
      { id: 'topic-1', name: 'Cloud Infrastructure' },
      { id: 'topic-2', name: 'Cybersecurity' },
    ],
    availableTimeRanges: ['7d', '14d', '30d', '90d'],
  };

  describe('AC1: Filter state serializing and URL query parsing for deep linking', () => {
    it('formats filter state to query string correctly', () => {
      const state: DashboardFilterState = {
        watchlistId: 'wl-1',
        selectedTopic: 'topic-2',
        timeRange: '30d',
        granularity: 'day',
      };
      const qs = formatFilterQueryParams(state);
      expect(qs).toContain('watchlistId=wl-1');
      expect(qs).toContain('selectedTopic=topic-2');
      expect(qs).toContain('timeRange=30d');
      expect(qs).toContain('granularity=day');
    });

    it('parses URL query params into typed filter state', () => {
      const search = new URLSearchParams('watchlistId=wl-1&selectedTopic=topic-2&timeRange=30d&granularity=day');
      const state = parseFilterQueryParams(search);
      expect(state.watchlistId).toBe('wl-1');
      expect(state.selectedTopic).toBe('topic-2');
      expect(state.timeRange).toBe('30d');
      expect(state.granularity).toBe('day');
    });
  });

  describe('AC2: Individual typed widget renderers', () => {
    it('renders MetricTile with value, diff, and explanation', () => {
      const html = renderToStaticMarkup(
        React.createElement(MetricTile, {
          title: 'Total Volume',
          data: sampleWidgets[0].data as any,
        })
      );
      expect(html).toContain('Total Volume');
      expect(html).toContain('1,250');
      expect(html).toContain('25%');
      expect(html).toContain('Volume increased by 25%');
    });

    it('renders TimeSeriesChart with labels and series values', () => {
      const html = renderToStaticMarkup(
        React.createElement(TimeSeriesChart, {
          title: 'Volume Over Time',
          data: sampleWidgets[1].data as any,
        })
      );
      expect(html).toContain('Volume Over Time');
      expect(html).toContain('2026-08-20');
      expect(html).toContain('120');
    });

    it('renders BarChart with categories and bars', () => {
      const html = renderToStaticMarkup(
        React.createElement(BarChart, {
          title: 'Source Breakdown',
          data: sampleWidgets[2].data as any,
        })
      );
      expect(html).toContain('Source Breakdown');
      expect(html).toContain('Twitter');
      expect(html).toContain('450');
    });

    it('renders PieChart with segments and percentage share', () => {
      const html = renderToStaticMarkup(
        React.createElement(PieChart, {
          title: 'Sentiment Share',
          data: sampleWidgets[3].data as any,
        })
      );
      expect(html).toContain('Sentiment Share');
      expect(html).toContain('positive');
      expect(html).toContain('65%');
    });

    it('renders RankedList with items and counts', () => {
      const html = renderToStaticMarkup(
        React.createElement(RankedList, {
          title: 'Top Topics',
          data: sampleWidgets[4].data as any,
        })
      );
      expect(html).toContain('Top Topics');
      expect(html).toContain('Artificial Intelligence');
      expect(html).toContain('340');
    });

    it('renders DataTable with columns and row records', () => {
      const html = renderToStaticMarkup(
        React.createElement(DataTable, {
          title: 'Top Authors',
          data: sampleWidgets[5].data as any,
        })
      );
      expect(html).toContain('Top Authors');
      expect(html).toContain('Alice Tech');
      expect(html).toContain('520');
    });
  });

  describe('AC3: WidgetRenderer generic dispatcher and states', () => {
    it('dispatches to correct renderer based on widget type', () => {
      for (const widget of sampleWidgets) {
        const html = renderToStaticMarkup(
          React.createElement(WidgetRenderer, { widget })
        );
        expect(html).toContain(widget.title);
      }
    });

    it('renders loading skeleton when loading=true', () => {
      const html = renderToStaticMarkup(
        React.createElement(WidgetRenderer, {
          widget: sampleWidgets[0],
          loading: true,
        })
      );
      expect(html).toContain('loading');
    });

    it('renders empty state when data has no values/items', () => {
      const emptyWidget: DashboardWidget = {
        id: 'empty-list',
        type: 'list',
        title: 'Empty Topics',
        data: { type: 'list', items: [] },
      };
      const html = renderToStaticMarkup(
        React.createElement(WidgetRenderer, { widget: emptyWidget })
      );
      expect(html).toContain('No data available');
    });
  });

  describe('AC4: FilterBar component with topic, watchlist, and time selectors', () => {
    it('renders filter bar with watchlists, topics, and timeranges', () => {
      const html = renderToStaticMarkup(
        React.createElement(FilterBar, {
          filters: sampleFilters,
          filterState: {
            watchlistId: 'wl-1',
            selectedTopic: 'topic-1',
            timeRange: '30d',
            granularity: 'day',
          },
          onChange: () => {},
        })
      );
      expect(html).toContain('Tech Brand Watchlist');
      expect(html).toContain('Cloud Infrastructure');
      expect(html).toContain('30d');
    });
  });

  describe('AC5: DashboardView integration component', () => {
    it('renders complete dashboard with FilterBar and WidgetGrid', () => {
      const html = renderToStaticMarkup(
        React.createElement(DashboardView, {
          widgets: sampleWidgets,
          filters: sampleFilters,
          filterState: {
            watchlistId: null,
            selectedTopic: null,
            timeRange: '7d',
            granularity: 'day',
          },
          onFilterChange: () => {},
        })
      );
      expect(html).toContain('Total Volume');
      expect(html).toContain('Sentiment Share');
      expect(html).toContain('Source Breakdown');
    });
  });
});
