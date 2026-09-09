/**
 * Widget Registry and Widget Data Shapes — Story 12.9 (ADR-0105).
 * Formalizes typed dashboard widgets and modular data providers.
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

export interface DashboardQueryParams {
  watchlistId?: string;
  selectedTopic?: string;
  timeRange?: { start?: string; end?: string };
  granularity?: 'hour' | 'day' | 'week' | 'month';
  includeExplanation?: boolean;
}

export type WidgetDataProvider = (
  tenantId: string,
  params: DashboardQueryParams
) => Promise<WidgetData>;

export interface DashboardWidgetDefinition {
  id: string;
  type: WidgetType;
  title: string;
  dataProvider: WidgetDataProvider;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  data: WidgetData;
}

export class WidgetRegistry {
  private definitions = new Map<string, DashboardWidgetDefinition>();

  public register(def: DashboardWidgetDefinition): void {
    this.definitions.set(def.id, def);
  }

  public unregister(id: string): void {
    this.definitions.delete(id);
  }

  public get(id: string): DashboardWidgetDefinition | undefined {
    return this.definitions.get(id);
  }

  public getAll(): DashboardWidgetDefinition[] {
    return Array.from(this.definitions.values());
  }

  public async executeWidgets(
    tenantId: string,
    params: DashboardQueryParams
  ): Promise<DashboardWidget[]> {
    const results: DashboardWidget[] = [];

    for (const def of this.definitions.values()) {
      try {
        const data = await def.dataProvider(tenantId, params);
        results.push({
          id: def.id,
          type: def.type,
          title: def.title,
          data,
        });
      } catch (err) {
        console.error(`[WidgetRegistry] Error executing provider for widget ${def.id}:`, err);
        // Fallback default shape per type on provider error
        results.push({
          id: def.id,
          type: def.type,
          title: def.title,
          data: getFallbackData(def.type),
        });
      }
    }

    return results;
  }
}

function getFallbackData(type: WidgetType): WidgetData {
  switch (type) {
    case 'metric':
      return { type: 'metric', value: 0 };
    case 'time-series':
      return { type: 'time-series', labels: [], series: [] };
    case 'bar':
      return { type: 'bar', labels: [], data: [] };
    case 'pie':
      return { type: 'pie', segments: [] };
    case 'list':
      return { type: 'list', items: [] };
    case 'table':
      return { type: 'table', columns: [], rows: [] };
  }
}

export const dashboardWidgetRegistry = new WidgetRegistry();
