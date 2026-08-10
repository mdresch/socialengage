// Contract: Story 5.18 (ADR-0040) — Self-service sign-up rate limiting and
// abuse prevention.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-518--self-service-sign-up-rate-limiting-and-abuse-prevention
//
// Intent: Story 5.18 — a new, dedicated, in-process rate-limiting mechanism
// gating POST /v1/tenants/self-service-signup, structurally independent of
// RequestGate (ADR-0003/ADR-0020, which stays scoped to (tenantId,
// providerId) and is not repurposed here — RequestGate queues-and-waits,
// this mechanism rejects outright with 429, a genuinely different shape).
// Scope: src/tenants/signupRateLimit.ts (new), src/http/versions/v1/selfServiceSignupRouter.ts
// (extended), .claude/skills/self-service-tenant-signup/SKILL.md.
//
// Contract to encode: rejects with 429 once either threshold is crossed
// within its own rolling window — per-IP (default 10/24h) and per raw
// email-domain, captured directly from the token's own OTP-verified email
// claim (default 5/24h; deliberately the RAW domain, before
// selfServiceSignup.ts's own public-email-provider denylist filtering —
// see this contract's own "A real interpretive decision" note below); a
// caller under threshold on both is unaffected and reaches the ordinary
// signup path; a caller from a different IP, or a different domain, is
// unaffected by another caller's own count; a 429 rejection here never
// writes a domain_signup_attempts row and never triggers Story 5.16's
// escalation logic — a structurally distinct outcome from ADR-0037 §3's own
// domain-match rejection; both thresholds and window lengths are read from
// environment configuration (SIGNUP_RATE_LIMIT_*), not hardcoded, with
// ADR-0040 §3's own template defaults when unset; storage is in-process
// (a plain Map, per ADR-0040 §2's own explicit single-instance-deployment
// decision), named as a known limitation in this component's own SKILL.md.
//
// A real interpretive decision, named honestly rather than silently
// assumed: Story 5.18's own AC3 text says the domain-keyed limit reuses
// "the same domain_signup_attempts data Story 5.16 already reads" — but
// ADR-0040 §2 itself unambiguously decides in-process storage for this
// mechanism, and domain_signup_attempts (a real Postgres table, written
// only on an already-rejected domain-match — see selfServiceSignup.ts's
// own recordDomainSignupAttempt(), never for a denylisted/public-email
// domain, which never collides and so never gets a row at all) cannot
// literally BE that in-process counter without contradicting §2. Read as
// directional ("reuse the same concept of domain," not "literally query
// that table"), not literal — confirmed the more protective reading too:
// keying on the RAW domain (not the post-denylist-filtered nullable
// capturedDomain used for tenant creation) is the only way this mechanism
// bounds repeated attempts against denylisted domains like gmail.com,
// which the existing uq_tenants_domain constraint structurally cannot
// (a null domain never collides, per ADR-0037 §4's own "two unrelated
// @gmail.com sign-ups each get their own, entirely independent tenant").
// Named in docs/user-stories/epic-5-security-isolation-and-messaging.md's
// own dated note, the same "don't rewrite history, add a dated
// correction" treatment Story 5.17's own AC1/schema drift already used.
//
// Explicitly out of scope for this contract:
//   - Re-proving POST /v1/tenants/self-service-signup's own already-built
//     behavior (denylist, domain-match detection, invited-row routing,
//     audit logging, partial-failure handling) — Story 5.15's own contract
//     already proves all of that; this contract only proves the new
//     rate-limit gate sits in front of it correctly.
//   - Story 5.16's own domain_signup_attempts read endpoint or escalation
//     logic — this story proves independence from it, not its own
//     correctness.
//   - A distributed/shared rate-limit store — ADR-0040 §2's own named,
//     accepted limitation for this project's current single-instance
//     deployment posture, not built here.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeTenantSignupPool } from '../../src/db/tenantSignupPool';
import { closeIdentityResolverPool } from '../../src/db/identityResolverPool';
import { closePool } from '../../src/db/pool';
import {
  checkAndRecordSignupAttempt,
  __resetSignupRateLimitForTests,
  type SignupRateLimitConfig,
} from '../../src/tenants/signupRateLimit';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closeTenantSignupPool();
  await closeIdentityResolverPool();
  await closePool();
});

beforeEach(() => {
  __resetSignupRateLimitForTests();
});

const TEST_CLAIMS_HEADER = 'X-Test-Claims';

function claimsHeader(sub: string, email: string): string {
  return JSON.stringify({ sub, email });
}

const TEST_CONFIG: SignupRateLimitConfig = {
  ipMaxAttempts: 3,
  ipWindowMs: 60_000,
  domainMaxAttempts: 2,
  domainWindowMs: 60_000,
};

describe('Story 5.18 — self-service sign-up rate limiting', () => {
  describe('checkAndRecordSignupAttempt() — the keying/threshold logic, unit-level', () => {
    it('AC2: allows up to ipMaxAttempts from one IP, then rejects with reason "ip"', () => {
      const ip = `1.2.3.${randomUUID().slice(0, 2)}`;
      for (let i = 0; i < TEST_CONFIG.ipMaxAttempts; i++) {
        const result = checkAndRecordSignupAttempt(ip, `domain-${i}.example`, TEST_CONFIG);
        expect(result.allowed).toBe(true);
      }
      const rejected = checkAndRecordSignupAttempt(ip, 'yet-another.example', TEST_CONFIG);
      expect(rejected.allowed).toBe(false);
      expect(rejected.reason).toBe('ip');
    });

    it('AC2: a different IP is unaffected by another IP\'s own count', () => {
      const ip1 = `10.0.0.${randomUUID().slice(0, 2)}`;
      const ip2 = `10.0.1.${randomUUID().slice(0, 2)}`;
      for (let i = 0; i < TEST_CONFIG.ipMaxAttempts; i++) {
        checkAndRecordSignupAttempt(ip1, `domain-${i}-a.example`, TEST_CONFIG);
      }
      const result = checkAndRecordSignupAttempt(ip2, 'domain-b.example', TEST_CONFIG);
      expect(result.allowed).toBe(true);
    });

    it('AC3: allows up to domainMaxAttempts distinct emails at one domain, then rejects with reason "domain"', () => {
      const domain = `acme-${randomUUID()}.example`;
      for (let i = 0; i < TEST_CONFIG.domainMaxAttempts; i++) {
        const result = checkAndRecordSignupAttempt(`192.168.1.${i}`, domain, TEST_CONFIG);
        expect(result.allowed).toBe(true);
      }
      const rejected = checkAndRecordSignupAttempt('192.168.1.99', domain, TEST_CONFIG);
      expect(rejected.allowed).toBe(false);
      expect(rejected.reason).toBe('domain');
    });

    it('AC3: a different domain is unaffected by another domain\'s own count', () => {
      const domainA = `domain-a-${randomUUID()}.example`;
      const domainB = `domain-b-${randomUUID()}.example`;
      for (let i = 0; i < TEST_CONFIG.domainMaxAttempts; i++) {
        checkAndRecordSignupAttempt(`172.16.0.${i}`, domainA, TEST_CONFIG);
      }
      const result = checkAndRecordSignupAttempt('172.16.0.99', domainB, TEST_CONFIG);
      expect(result.allowed).toBe(true);
    });

    it('AC1: is a structurally distinct mechanism from RequestGate — never imports connectors/requestGate.ts', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'tenants', 'signupRateLimit.ts'),
        'utf8'
      );
      // The module's own doc comment names RequestGate by design (explaining
      // why it's independent) — this checks for an actual import, not prose.
      expect(source).not.toMatch(/(?:from|require\()\s*['"][^'"]*requestGate['"]/i);
    });
  });

  describe('POST /v1/tenants/self-service-signup — HTTP-level 429 wiring', () => {
    const app = createApp();

    it('AC2 (HTTP): exceeding the real IP-keyed threshold returns 429, not the ordinary signup response', async () => {
      // All supertest requests in this process share one real local IP —
      // exactly what's needed to prove the 429 wiring itself; per-key
      // isolation (different IP/domain unaffected) is proven at the unit
      // level above, which can construct synthetic keys HTTP cannot.
      const attempts = Number(process.env.SIGNUP_RATE_LIMIT_IP_MAX_ATTEMPTS ?? 10);
      let lastStatus = 0;
      for (let i = 0; i <= attempts; i++) {
        const sub = randomUUID();
        const email = `attempt-${randomUUID()}@ratelimit-${randomUUID()}.example`;
        const res = await request(app)
          .post('/v1/tenants/self-service-signup')
          .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
          .send({ name: `RL-${randomUUID()}` });
        lastStatus = res.status;
        if (res.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });

    it('AC4: a 429 rejection writes no domain_signup_attempts row for the rejected email', async () => {
      const domain = `norow-${randomUUID()}.example`;
      const maxDomainAttempts = Number(process.env.SIGNUP_RATE_LIMIT_DOMAIN_MAX_ATTEMPTS ?? 5);

      // Primes the in-process counter directly (the same module instance
      // the router itself calls) so the one HTTP request below is
      // guaranteed to be rate-limited, without first routing several real
      // requests through the actual domain-match provisioning logic — once
      // the first of those legitimately claims the domain, every
      // subsequent one would correctly write its own domain_signup_attempts
      // row via the *real* domain-match path (already proven by Story
      // 5.15's own contract), which would pollute this specific assertion
      // rather than test it.
      for (let i = 0; i < maxDomainAttempts; i++) {
        checkAndRecordSignupAttempt(`203.0.113.${i}`, domain);
      }

      const rejectedEmail = `rejected@${domain}`;
      const res = await request(app)
        .post('/v1/tenants/self-service-signup')
        .set(TEST_CLAIMS_HEADER, claimsHeader(randomUUID(), rejectedEmail))
        .send({ name: `RL-${randomUUID()}` });

      expect(res.status).toBe(429);

      const { rows } = await getAdminPool().query(`SELECT email FROM domain_signup_attempts WHERE email = $1`, [
        rejectedEmail,
      ]);
      expect(rows).toHaveLength(0);
    });
  });
});
