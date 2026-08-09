export default function SignUpPage() {
  return (
    <main>
      <h1>Sign up</h1>
      <p>
        Creating a SocialEngage account is free and self-service at this step — it doesn&apos;t commit you to
        any seat pricing or contract terms.
      </p>
      <p>
        If you&apos;re the first person from your organization to sign up, you&apos;ll become the Tenant-Admin
        of a brand-new tenant.
      </p>
      <form action="/api/auth/signup" method="GET">
        <label htmlFor="tenantName">Organization name</label>
        <input id="tenantName" name="tenantName" type="text" required />
        <button type="submit">Sign up with Microsoft</button>
      </form>
      <a href="/sign-in">Already have an account? Sign in</a>
    </main>
  );
}
