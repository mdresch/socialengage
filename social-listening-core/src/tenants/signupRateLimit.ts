/**
 * Story 5.18 (ADR-0040) — a new, minimal, in-process rate-limiting
 * mechanism gating POST /v1/tenants/self-service-signup. Structurally
 * independent of connectors/requestGate.ts (ADR-0003/ADR-0020), which
 * stays scoped to (tenantId, providerId) outbound-request gating and is
 * not repurposed here — RequestGate queues and waits for a window to
 * reset; this mechanism rejects outright (429) once a threshold is
 * crossed, a genuinely different shape for a genuinely different problem
 * (self-service sign-up abuse, not per-tenant outbound API quota).
 *
 * Keyed by IP address and by the RAW domain captured directly from the
 * caller's own OTP-verified email claim — deliberately before
 * selfServiceSignup.ts's own public-email-provider denylist filtering, so
 * this is the one mechanism that bounds repeated attempts against a
 * denylisted domain (e.g. gmail.com), which the database's own
 * uq_tenants_domain constraint structurally cannot (a denylisted domain
 * is stored as NULL and never collides — ADR-0037 §4). See this
 * component's own SKILL.md for the fuller rationale, including why this
 * does not literally query domain_signup_attempts despite Story 5.18's
 * own AC3 text naming that table.
 *
 * Storage is a plain in-process Map — ADR-0040 §2's own explicit decision
 * for this project's current single-instance deployment posture, named as
 * a known limitation (not shared across concurrent instances) in this
 * component's own SKILL.md, not silently assumed away.
 */

export interface SignupRateLimitConfig {
  ipMaxAttempts: number;
  ipWindowMs: number;
  domainMaxAttempts: number;
  domainWindowMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** ADR-0040 §3's own template defaults — adjustable via env, not hardcoded per Story 5.18's own AC5. */
export function defaultSignupRateLimitConfig(): SignupRateLimitConfig {
  return {
    ipMaxAttempts: envInt('SIGNUP_RATE_LIMIT_IP_MAX_ATTEMPTS', 10),
    ipWindowMs: envInt('SIGNUP_RATE_LIMIT_IP_WINDOW_MS', DAY_MS),
    domainMaxAttempts: envInt('SIGNUP_RATE_LIMIT_DOMAIN_MAX_ATTEMPTS', 5),
    domainWindowMs: envInt('SIGNUP_RATE_LIMIT_DOMAIN_WINDOW_MS', DAY_MS),
  };
}

const ipAttempts = new Map<string, number[]>();
const domainAttempts = new Map<string, number[]>();

function countWithinWindow(store: Map<string, number[]>, key: string, windowMs: number, now: number): number {
  const pruned = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  store.set(key, pruned);
  return pruned.length;
}

function record(store: Map<string, number[]>, key: string, now: number): void {
  const timestamps = store.get(key) ?? [];
  timestamps.push(now);
  store.set(key, timestamps);
}

export interface SignupRateLimitResult {
  allowed: boolean;
  /** Which threshold rejected the attempt — undefined when allowed. */
  reason?: 'ip' | 'domain';
}

/**
 * Checks both thresholds and, only if the attempt is allowed, records it
 * against both keys. A rejected attempt is not recorded a second time —
 * the caller already consumed one of its own prior slots to get here, and
 * double-counting a rejection would only make the window recover slower
 * than the threshold itself implies.
 */
export function checkAndRecordSignupAttempt(
  ip: string,
  emailDomain: string,
  config: SignupRateLimitConfig = defaultSignupRateLimitConfig(),
  now: number = Date.now()
): SignupRateLimitResult {
  const ipCount = countWithinWindow(ipAttempts, ip, config.ipWindowMs, now);
  if (ipCount >= config.ipMaxAttempts) {
    return { allowed: false, reason: 'ip' };
  }

  const domainCount = countWithinWindow(domainAttempts, emailDomain, config.domainWindowMs, now);
  if (domainCount >= config.domainMaxAttempts) {
    return { allowed: false, reason: 'domain' };
  }

  record(ipAttempts, ip, now);
  record(domainAttempts, emailDomain, now);
  return { allowed: true };
}

/** Test-only: isolates contract tests that would otherwise share state by key collision across runs. */
export function __resetSignupRateLimitForTests(): void {
  ipAttempts.clear();
  domainAttempts.clear();
}
