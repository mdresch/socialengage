/**
 * Story 6.7 / ADR-0037 §3, §8d — deliberately static, generic copy. Never
 * interpolates anything about the matched tenant (name, ID, seat count) — the
 * redirect that lands here carries no tenant data at all, and this page must
 * stay that way (see this component's own SKILL.md Load-bearing constraints).
 */
export default function DomainTakenPage() {
  return (
    <main>
      <h1>Sign-up not available</h1>
      <p>
        An account for this email domain already exists. Ask your organization&apos;s admin for an invite —
        your request has been shared with them.
      </p>
      <a href="/sign-in">Already invited? Sign in</a>
    </main>
  );
}
