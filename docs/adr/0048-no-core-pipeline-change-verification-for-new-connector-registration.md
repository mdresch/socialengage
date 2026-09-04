# ADR-0048: Explicit policy for "no core pipeline change" verification when registering new connectors

**Status:** Accepted (2026-08-11)
**Source:** Story 2.1 core extensibility contract, Story 2.8 follow-up direction, and downstream connector stories that depend on the same invariants.
**Acceptance note:** Accepted by Menno 2026-08-11, verbatim: *"ADR 0048, ADR 0049 and ADR 0050 approved."* Accepted as drafted, no revisions. **Story 2.10** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`), already drafted against this ADR and left **Blocked — pending ADR-0048 acceptance**, moves to **Ready** — see that story's own Source line, updated to cite this acceptance. This ADR's own "Supports" section (Story 2.1, Story 2.8/2.9, "all downstream connector stories") describes the policy's *reach*, not a claim that no dedicated story exists for it: Story 2.10 is that dedicated story — it builds §2's CI guardrail and §3's registration-traceability requirement directly, rather than leaving them as an unowned constraint every future connector story would have to separately reinvent.

## Context

This project repeatedly states a core architecture promise: adding or swapping a connector (social or AI) must not require editing core ingestion pipeline/orchestration logic.

Today that promise is asserted in story language and validated by selective story-level tests, but there is no explicit project policy defining mandatory verification evidence for every connector addition. That leaves a gap where accidental coupling, hard-coded provider branching, or undocumented extension-point bypass can creep into the core path over time.

## Decision

**Durable decision (scope statement):** Connector registration must not require edits outside the designated registration surfaces — the connector implementation itself and the designated connector registry/registration surface. Any edit to core ingestion orchestration for registration purposes is out of policy unless accompanied by a separately approved ADR superseding this rule. The numbered items below are the verification mechanism for this rule, not separate rules of their own.

Adopt an explicit, enforceable verification policy for every new connector registration PR:

1. **Mandatory evidence of no core-path edits for registration.**
   Every connector PR must provide test evidence that connector registration required changes only in:
   - the connector implementation itself, and
   - the designated connector registry/registration surface.
   Any edit to core ingestion orchestration for registration purposes fails policy unless accompanied by a separately approved ADR superseding this rule.

2. **Automation guardrail in CI.**
   CI must include an automated check that fails when connector-registration behavior is implemented outside designated extension points.
   The check may be implemented as a focused diff policy, a path-based guard, or an equivalent contract test gate, but it must be deterministic and run on every connector PR.

3. **Required registration traceability note.**
   Documentation for each connector must explicitly cite:
   - where registration occurs,
   - which extension points are used,
   - and how no-core-change verification was satisfied in that PR.

4. **Applies equally to social and AI connector types.**
   The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions/removals/swaps.

## Consequences

**Positive**
- Prevents accidental API-surface leaks and hard-coded provider branches in the core pipeline.
- Makes an architectural promise continuously testable, not only narratively asserted.
- Reduces long-term connector tech-debt and preserves clean extension boundaries.

**Negative**
- Adds PR and CI overhead for connector work.
- Requires ongoing maintenance of designated extension-point checks as code structure evolves.

## Supports

- Story 2.1 (connector abstraction and extensibility contract)
- Story 2.8 and Story 2.9 follow-up swappability validation direction
- All downstream connector stories that rely on no-core-path registration changes

## Open Questions

- [ ] **[Q-0048-1]** Whether to enforce this with a dedicated CI script in the repository or as a test-level contract gate inside `social-listening-core`.
- [ ] **[Q-0048-2]** Whether to define a strict allowlist of files/directories as extension points, and where that allowlist is maintained.
- [ ] **[Q-0048-3]** Whether this policy should also apply to connector deprecation/removal PRs with the same strictness.

## Amendment Log

- 2026-08-08 — Initial proposal drafted from backlog input; left Proposed pending acceptance.
