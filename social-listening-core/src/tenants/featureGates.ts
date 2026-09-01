/**
 * Plan definitions and feature-gate helpers for Story 13.5 (ADR-0112).
 *
 * `PLANS` is the platform-level configuration. Missing feature keys are
 * treated as `true` (available) so that existing tenants and direct-SQL test
 * fixtures without a populated `feature_gates` object are not broken. The
 * `max_seats` value in `feature_gates` is the primary ceiling; when it is not
 * explicitly set, the legacy `license_seat_count` column is used.
 */

export const PLANS: Record<
  string,
  { max_seats: number; feature_gates: Record<string, boolean> }
> = {
  starter: {
    max_seats: 3,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: false,
      api_access: false,
      webhooks: false,
      crisis_templates: false,
      compliance_packs: false,
      dsr_portal: false,
      rag_search: false,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
  pro: {
    max_seats: 25,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: true,
      api_access: true,
      webhooks: true,
      crisis_templates: false,
      compliance_packs: false,
      dsr_portal: false,
      rag_search: true,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
  enterprise: {
    max_seats: 100,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: true,
      api_access: true,
      webhooks: true,
      crisis_templates: true,
      compliance_packs: true,
      dsr_portal: true,
      rag_search: true,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
};

/**
 * Return the default feature gates for a plan, with the plan's `max_seats`
 * folded in. Unknown plans return an empty object so that callers fall back
 * to `license_seat_count` and treat all features as available.
 */
export function getPlanFeatureGates(plan: string | null | undefined): Record<string, any> {
  const planDef = plan ? PLANS[plan] : undefined;
  if (!planDef) {
    return {};
  }
  return {
    ...planDef.feature_gates,
    max_seats: planDef.max_seats,
  };
}

/**
 * Merge plan defaults with any explicit tenant-level feature_gates overrides.
 * Explicit tenant overrides win over plan defaults; missing keys default to
 * `true` (available) to avoid breaking pre-13.5 tenants and direct-SQL fixtures.
 */
export function getEffectiveFeatureGates(
  plan: string | null | undefined,
  featureGates: Record<string, any> | undefined
): Record<string, any> {
  const planGates = getPlanFeatureGates(plan);
  const stored = featureGates || {};

  const effective: Record<string, any> = { ...planGates };
  for (const key of Object.keys(stored)) {
    effective[key] = stored[key];
  }

  // Any feature key not present in either plan or stored is treated as true.
  return effective;
}

/**
 * The effective maximum number of active users for a tenant. Uses the explicit
 * `feature_gates.max_seats` if present, otherwise falls back to
 * `license_seat_count` for backward compatibility.
 */
export function getEffectiveMaxSeats(
  featureGates: Record<string, any> | undefined,
  licenseSeatCount: number
): number {
  const stored = featureGates || {};
  if (stored.max_seats !== undefined && stored.max_seats !== null) {
    return Number(stored.max_seats);
  }
  return licenseSeatCount;
}

/**
 * Check whether a feature is enabled for a tenant. A key explicitly set to
 * `false` disables it; any other value (including missing) is treated as
 * enabled so that existing tenants without a value are not broken.
 */
export function isFeatureEnabled(
  featureGates: Record<string, any> | undefined,
  feature: string
): boolean {
  const stored = featureGates || {};
  if (Object.prototype.hasOwnProperty.call(stored, feature)) {
    return stored[feature] !== false;
  }
  return true;
}

/**
 * Thrown by the invite-activation path when a tenant is already at its
 * effective `max_seats` ceiling. Caught by `tenantAuthMiddleware.ts` and
 * mapped to `403 SEAT_LIMIT_EXCEEDED`.
 */
export class SeatLimitExceededError extends Error {
  public readonly code = 'SEAT_LIMIT_EXCEEDED';
  constructor(message = 'Seat limit exceeded') {
    super(message);
    this.name = 'SeatLimitExceededError';
  }
}
