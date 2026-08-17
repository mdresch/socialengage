export default function SignedOutPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">SE</div>
        <h1 className="auth-heading">You&apos;ve been signed out</h1>
        <p className="auth-subheading">Your session has ended. Sign in again to continue.</p>
        <a href="/sign-in" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Sign in again
        </a>
      </div>
    </div>
  );
}
