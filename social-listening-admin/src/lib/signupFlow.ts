/**
 * Story 6.7 / ADR-0037 — the testable seam between the sign-up callback's token
 * exchange and the redirect it issues. Kept out of the Route Handler itself so
 * this dispatch logic is provable without a real interactive Entra sign-in (which
 * would require completing a live email-OTP challenge against a brand-new
 * mailbox — not something this environment can drive end to end). See
 * .claude/skills/self-service-signup-ui/SKILL.md.
 */

import { selfServiceSignup } from './core-client';
import { fetchResolvedIdentity } from './core-client';
import { encryptSession } from './session';

export interface SignupCompletionInput {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  tenantName: string;
}

export type SignupCompletionResult =
  | { kind: 'success'; redirectPath: '/'; sessionCookieValue: string }
  | { kind: 'domain_match'; redirectPath: '/sign-up/domain-taken' }
  | { kind: 'already_exists'; redirectPath: '/sign-up/already-have-account' }
  | { kind: 'error'; redirectPath: '/sign-up/error' };

/**
 * Calls core's POST /v1/tenants/self-service-signup and turns its response into
 * a concrete redirect decision. Never invents a tenant/user identity itself —
 * every identity field (email, sub) core derives from the bearer token; this
 * function's only contribution to the request is the caller-supplied tenant
 * name (Story 6.7 AC7).
 */
export async function completeSelfServiceSignup(input: SignupCompletionInput): Promise<SignupCompletionResult> {
  const outcome = await selfServiceSignup(input.accessToken, input.tenantName);

  if (outcome.status === 201) {
    // GET /v1/me is only ever consulted after a confirmed 201 — hydrating
    // identity before provisioning succeeded would read core's endpoint for a
    // caller who still has no users row (see this component's own SKILL.md
    // Load-bearing constraints).
    const identity = await fetchResolvedIdentity(input.accessToken);
    const sessionCookieValue = await encryptSession({
      idToken: input.idToken,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      identity,
    });
    return { kind: 'success', redirectPath: '/', sessionCookieValue };
  }

  if (outcome.status === 409) {
    // core's own two 409 causes today (selfServiceSignupRouter.ts) — told apart
    // only by response text, see this component's own SKILL.md Load-bearing
    // constraints for what happens if core ever adds a third.
    if (/already belong/i.test(outcome.body.error ?? '')) {
      return { kind: 'already_exists', redirectPath: '/sign-up/already-have-account' };
    }
    return { kind: 'domain_match', redirectPath: '/sign-up/domain-taken' };
  }

  // A genuine network/backend failure (Story 6.7's own AC9) — surfaced as a
  // real, actionable redirect rather than a silent partial state.
  return { kind: 'error', redirectPath: '/sign-up/error' };
}
