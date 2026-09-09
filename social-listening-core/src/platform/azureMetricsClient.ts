/**
 * Story 13.8 (ADR-0114): Azure Metrics provider abstraction.
 *
 * The worker consumes metrics through a `AzureMetricsProvider` so that tests
 * can inject a test double and production can wire a live Azure Monitor /
 * Cost Management client without changing the worker.
 */

export interface MetricSample {
  metric_name: string;
  value: number;
  unit: string;
  dimensions: Record<string, unknown>;
  source: string;
  timestamp: Date;
  granularity: 'hour' | 'day';
}

export interface AzureMetricsProvider {
  fetchMetrics(hour: Date): Promise<MetricSample[]>;
}

class LiveAzureMetricsProvider implements AzureMetricsProvider {
  async fetchMetrics(_hour: Date): Promise<MetricSample[]> {
    return [];
  }
}

let activeProvider: AzureMetricsProvider = new LiveAzureMetricsProvider();

export function setAzureMetricsProvider(provider: AzureMetricsProvider): void {
  activeProvider = provider;
}

export function getAzureMetricsProvider(): AzureMetricsProvider {
  return activeProvider;
}

export async function fetchAzureMetrics(hour: Date): Promise<MetricSample[]> {
  return activeProvider.fetchMetrics(hour);
}
