import { NextFunction, Request, Response } from 'express';

/** ADR-0017's implementation default — check its Amendment Log before assuming this is still current. */
export const MIN_DEPRECATION_WINDOW_DAYS = 90;

/** Earliest date a version may be sunset, given when its successor shipped. */
export function minimumSunsetDate(
  successorShippedAt: Date,
  minWindowDays: number = MIN_DEPRECATION_WINDOW_DAYS
): Date {
  const sunset = new Date(successorShippedAt.getTime());
  sunset.setUTCDate(sunset.getUTCDate() + minWindowDays);
  return sunset;
}

/**
 * Marks every response from a versioned router as deprecated per RFC 8594.
 * Throws immediately if `sunsetAt` is earlier than the minimum window after
 * `successorShippedAt` (ADR-0017) — a caller finds out at wiring time, not
 * once a consumer has already relied on too-short a deprecation window.
 */
export function deprecateVersion(successorShippedAt: Date, sunsetAt: Date) {
  if (sunsetAt.getTime() < minimumSunsetDate(successorShippedAt).getTime()) {
    throw new Error(
      `sunsetAt (${sunsetAt.toISOString()}) is earlier than the ${MIN_DEPRECATION_WINDOW_DAYS}-day ` +
        `minimum after successorShippedAt (${successorShippedAt.toISOString()})`
    );
  }

  return function deprecationMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Deprecation', successorShippedAt.toUTCString());
    res.setHeader('Sunset', sunsetAt.toUTCString());
    next();
  };
}
