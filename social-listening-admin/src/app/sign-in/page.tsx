export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">SE</div>
        <h1 className="auth-heading">Sign in to SocialEngage</h1>
        <p className="auth-subheading">Use your organisation&apos;s Microsoft account</p>
        <a href="/api/auth/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Continue with Microsoft
        </a>
        <p className="auth-footer-note">
          Need access? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
