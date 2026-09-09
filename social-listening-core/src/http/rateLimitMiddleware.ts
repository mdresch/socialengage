/**
 * Rate Limiting Middleware — Story 12.11 (ADR-0106).
 * Enforces sliding-window rate limits per tenant and attaches X-RateLimit-* headers.
 */

import { Request, Response, NextFunction } from 'express';
import { RequestWithIdentity } from './auth/requestIdentity';

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix timestamp in ms
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function resetRateLimitsForTesting(): void {
  rateLimitStore.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Checks and updates rate limit counter for a given key in a 60-second window.
 */
export function checkRateLimit(key: string, limit: number = 1000): RateLimitResult {
  const now = Date.now();
  const windowMs = 60 * 1000;

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetSeconds: Math.ceil(entry.resetAt / 1000),
    };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const resetSeconds = Math.ceil(entry.resetAt / 1000);

  return {
    allowed: entry.count <= limit,
    limit,
    remaining,
    resetSeconds,
  };
}

/**
 * Express middleware attaching rate limit headers and returning 429 when quota is exceeded.
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const identity = (req as RequestWithIdentity).identity;
  const tenantId = identity && 'tenantId' in identity ? identity.tenantId : req.ip || 'anonymous';

  // Endpoint-specific limits
  let limit = 1000;
  if (req.path.startsWith('/posts') || req.path.startsWith('/analytics/query')) {
    limit = 100;
  }

  const result = checkRateLimit(`tenant:${tenantId}:${req.path.split('/')[1] || 'global'}`, limit);

  res.setHeader('X-RateLimit-Limit', result.limit.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', result.resetSeconds.toString());

  if (!result.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded. Please retry after reset window.',
      code: 'RATE_LIMIT_EXCEEDED',
      resetAt: result.resetSeconds,
    });
    return;
  }

  next();
}
