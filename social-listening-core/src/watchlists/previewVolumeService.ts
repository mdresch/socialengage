import { AstNode } from './ast';
import { parseBooleanQuery } from './ast';
import { resolveWatchlistAstDispatch } from './dispatch';
import { getSocialConnector } from '../connectors/registry';
import { SocialConnector, ConnectorContext, TimeWindow } from '../connectors/types';
import { checkProviderAvailability } from '../connectors/requestGate';
import { Watchlist } from './watchlistStore';

/**
 * Story 9.1 (ADR-0077) — per-connector volume preview orchestration. See
 * .claude/skills/watchlist-matching/SKILL.md. Runs each selected connector's
 * `count?()` (or `sample?()` fallback) concurrently, isolates a single
 * connector failure as `confidence: 'unavailable'` rather than failing the
 * whole preview, and raises `high_volume` / `quota_risk` / `unsupported_query`
 * warnings per ADR-0077 §5/§6.
 */

/** ADR-0077 §3 open question — the bounded preview sample size. */
export const PREVIEW_SAMPLE_SIZE = 50;
/** ADR-0077 §5 — estimated posts per connector above this trigger `high_volume`. */
export const HIGH_VOLUME_THRESHOLD = 100_000;
/** ADR-0077 §5 — a preview consuming more than 80% of remaining budget triggers `quota_risk`. */
export const QUOTA_RISK_RATIO = 0.8;
/** Default look-back when the caller specifies no time window bounds (ADR-0077 §3 extrapolation). */
const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Estimated API request units a single preview count/sample call consumes (ADR-0077 §5). */
const PREVIEW_ESTIMATED_COST = 1;

export type VolumeConfidence = 'exact' | 'estimate' | 'unavailable';
export type VolumeWarning = 'none' | 'high_volume' | 'quota_risk' | 'unsupported_query';

export interface ConnectorVolumeItem {
  connectorId: string;
  platformId: string;
  estimatedPosts: number;
  confidence: VolumeConfidence;
  sampleSize?: number;
  rateLimitCost: number;
  warning: VolumeWarning;
  errorCode?: string;
  errorMessage?: string;
}

export interface WatchlistVolumePreview {
  totalEstimatedPosts: number;
  breakdown: ConnectorVolumeItem[];
}

export interface PreviewVolumeArgs {
  tenantId: string;
  ast: AstNode;
  connectorIds: string[];
  timeWindow?: TimeWindow;
}

function resolveWindowMs(timeWindow: TimeWindow | undefined): number {
  if (timeWindow?.start && timeWindow?.end) {
    const start = Date.parse(timeWindow.start);
    const end = Date.parse(timeWindow.end);
    if (!isNaN(start) && !isNaN(end) && end > start) {
      return end - start;
    }
  }
  return DEFAULT_WINDOW_MS;
}

function unavailable(
  connectorId: string,
  platformId: string,
  errorCode: string,
  errorMessage: string,
  warning: VolumeWarning = 'none'
): ConnectorVolumeItem {
  return {
    connectorId,
    platformId,
    estimatedPosts: 0,
    confidence: 'unavailable',
    rateLimitCost: 0,
    warning,
    errorCode,
    errorMessage,
  };
}

function highVolumeWarning(estimatedPosts: number): VolumeWarning {
  return estimatedPosts > HIGH_VOLUME_THRESHOLD ? 'high_volume' : 'none';
}

/**
 * Extrapolates a bounded preview sample into an estimated post count for the
 * requested time window (ADR-0077 §3). A sample smaller than the bounded
 * preview size is the exact count for that window (`confidence: 'exact'`).
 */
function extrapolateSample(
  posts: { publishedAt: string }[],
  timeWindow: TimeWindow | undefined,
  rateLimitCost: number
): { estimatedPosts: number; confidence: VolumeConfidence; sampleSize: number } {
  const sampleSize = posts.length;
  if (sampleSize === 0) {
    return { estimatedPosts: 0, confidence: 'estimate', sampleSize: 0 };
  }
  if (sampleSize < PREVIEW_SAMPLE_SIZE) {
    return { estimatedPosts: sampleSize, confidence: 'exact', sampleSize };
  }
  const times = posts
    .map((p) => Date.parse(p.publishedAt))
    .filter((n) => !isNaN(n));
  if (times.length < 2) {
    return { estimatedPosts: sampleSize, confidence: 'estimate', sampleSize };
  }
  const newest = Math.max(...times);
  const oldest = Math.min(...times);
  const dtSampleMs = Math.max(1, newest - oldest);
  const windowMs = resolveWindowMs(timeWindow);
  const cadence = sampleSize / dtSampleMs;
  const estimatedPosts = Math.round(cadence * windowMs);
  return { estimatedPosts, confidence: 'estimate', sampleSize };
}

async function previewOneConnector(
  tenantId: string,
  connectorId: string,
  ast: AstNode,
  timeWindow: TimeWindow | undefined
): Promise<ConnectorVolumeItem> {
  const connector: SocialConnector | undefined = getSocialConnector(connectorId);
  if (!connector) {
    return unavailable(connectorId, connectorId, 'connector_not_found', `No registered connector for '${connectorId}'.`);
  }
  const platformId = connector.providerId;

  // ADR-0077 §6 — fast, static, zero-API-cost unsupported-operator detection.
  const dispatch = resolveWatchlistAstDispatch(connector, ast);
  if (dispatch.unsupportedNodeTypes.length > 0) {
    return {
      connectorId,
      platformId,
      estimatedPosts: 0,
      confidence: 'estimate',
      sampleSize: 0,
      rateLimitCost: 0,
      warning: 'unsupported_query',
    };
  }

  // ADR-0077 §5 — quota_risk pre-check via RequestGate.checkAvailability.
  const { remaining } = checkProviderAvailability(tenantId, connector);
  if (remaining <= 0 || PREVIEW_ESTIMATED_COST / remaining > QUOTA_RISK_RATIO) {
    return unavailable(
      connectorId,
      platformId,
      'quota_exceeded',
      'Preview would consume more than 80% of the connector remaining rate-limit budget.',
      'quota_risk'
    );
  }

  const ctx: ConnectorContext = { tenantId, mode: 'preview', isDryRun: true };

  // ADR-0077 §1 — prefer the platform's own total-results count when available.
  if (connector.count) {
    try {
      const result = await connector.count(ctx, { ast, timeWindow: timeWindow ?? {} });
      return {
        connectorId,
        platformId,
        estimatedPosts: result.count,
        confidence: result.confidence,
        sampleSize: result.sampleSize,
        rateLimitCost: result.rateLimitCost ?? PREVIEW_ESTIMATED_COST,
        warning: highVolumeWarning(result.count),
      };
    } catch (err) {
      return unavailable(
        connectorId,
        platformId,
        'connector_error',
        `count?() failed: ${(err as Error).message}`
      );
    }
  }

  // ADR-0077 §3 — fallback to a bounded preview sample + extrapolation.
  if (connector.sample) {
    try {
      const result = await connector.sample(ctx, { ast, timeWindow: timeWindow ?? {}, limit: PREVIEW_SAMPLE_SIZE });
      const rateLimitCost = result.rateLimitCost ?? PREVIEW_ESTIMATED_COST;
      const { estimatedPosts, confidence, sampleSize } = extrapolateSample(
        result.posts,
        timeWindow,
        rateLimitCost
      );
      return {
        connectorId,
        platformId,
        estimatedPosts,
        confidence,
        sampleSize,
        rateLimitCost,
        warning: highVolumeWarning(estimatedPosts),
      };
    } catch (err) {
      return unavailable(
        connectorId,
        platformId,
        'connector_error',
        `sample?() failed: ${(err as Error).message}`
      );
    }
  }

  // ADR-0077 §2/§3 — a connector with neither count?() nor sample?() has no
  // no-side-effect preview path; its live poll() would persist posts and
  // mutate cursors, which a preview must not do. Reported as unavailable
  // rather than mutating the live ingestion pipeline (see
  // .claude/skills/watchlist-matching/SKILL.md's Known gaps).
  return unavailable(
    connectorId,
    platformId,
    'preview_not_supported',
    'Connector implements neither count?() nor sample?(); preview-mode poll is not wired for this connector.'
  );
}

/**
 * Runs per-connector volume previews concurrently (ADR-0077 §4). A single
 * connector failure is isolated into its breakdown item as
 * `confidence: 'unavailable'` — this function never rejects.
 */
export async function previewWatchlistVolume(args: PreviewVolumeArgs): Promise<WatchlistVolumePreview> {
  const breakdown = await Promise.all(
    args.connectorIds.map((connectorId) =>
      previewOneConnector(args.tenantId, connectorId, args.ast, args.timeWindow)
    )
  );
  const totalEstimatedPosts = breakdown.reduce((sum, item) => sum + item.estimatedPosts, 0);
  return { totalEstimatedPosts, breakdown };
}

/**
 * Derives a boolean-query AST from a stored Watchlist for the
 * `watchlistId` path of `POST /v1/watchlists/preview-volume` (ADR-0077 §4).
 * A `boolean` matchType parses the stored `booleanQuery`; a keyword/hashtag/
 * account matchType builds an OR-of-leaves AST from its terms. Returns null
 * when the watchlist has no usable query (empty terms / missing booleanQuery).
 */
export function watchlistToAst(watchlist: Watchlist): AstNode | null {
  if (watchlist.matchType === 'boolean') {
    if (!watchlist.booleanQuery) return null;
    try {
      return parseBooleanQuery(watchlist.booleanQuery);
    } catch {
      return null;
    }
  }
  const terms = watchlist.terms ?? [];
  if (terms.length === 0) return null;
  const leaves: AstNode[] = terms.map((term) => {
    if (watchlist.matchType === 'hashtag') return { type: 'HASHTAG', value: term.replace(/^#/, '') };
    if (watchlist.matchType === 'account') return { type: 'ACCOUNT', value: term.replace(/^@/, '') };
    return { type: 'TERM', value: term };
  });
  return leaves.reduce((acc, leaf) => (acc ? { type: 'OR', left: acc, right: leaf } : leaf));
}
