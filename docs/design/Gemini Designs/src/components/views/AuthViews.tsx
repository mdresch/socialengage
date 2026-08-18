import React, { useState } from 'react';
import { AuthViewType } from '../../types';

interface AuthViewsProps {
  authView: AuthViewType;
  setAuthView: (view: AuthViewType) => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({ authView, setAuthView }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);

  if (!authView) return null;

  const handleLoginSubmit = () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your work email and password to continue.');
      return;
    }
    setError('');
    setAuthView(null);
  };

  const handleMfaDigitChange = (index: number, val: string) => {
    const next = [...mfaDigits];
    next[index] = val.slice(-1);
    setMfaDigits(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-radial from-[#16304F] via-[#0B1B2E] to-[#071220] p-4 animate-in fade-in">
      {/* LOGIN */}
      {authView === 'login' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-6 text-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-base">
              S
            </div>
            <span className="font-semibold text-lg text-slate-900">SocialEngage</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="text-xs text-slate-500 mt-1">Adaptive Digital Processing Analytics · ADPA</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-semibold text-slate-700">Password</label>
                <button
                  onClick={() => setAuthView('forgot')}
                  className="text-blue-600 font-medium hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleLoginSubmit}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Sign in
            </button>

            <div className="flex items-center gap-3 my-2 text-slate-400">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px]">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              onClick={() => setAuthView(null)}
              className="w-full border border-slate-300 rounded-lg py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Continue with Microsoft Entra ID
            </button>
          </div>

          <div className="text-center text-xs text-slate-500 pt-2">
            No account?{' '}
            <button
              onClick={() => setAuthView('signup')}
              className="text-blue-600 font-semibold hover:underline"
            >
              Create one
            </button>
          </div>
        </div>
      )}

      {/* SIGNUP */}
      {authView === 'signup' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-5 text-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-base">
              S
            </div>
            <span className="font-semibold text-lg text-slate-900">SocialEngage</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
            <p className="text-xs text-slate-500 mt-1">Start listening across every channel in minutes</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">First name</label>
                <input
                  type="text"
                  placeholder="Mia"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Last name</label>
                <input
                  type="text"
                  placeholder="Kessler"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Work email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Organisation</label>
              <input
                type="text"
                placeholder="ADPA"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setAuthView('mfa')}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 transition-colors mt-2"
            >
              Create account
            </button>
          </div>

          <div className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => setAuthView('login')}
              className="text-blue-600 font-semibold hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD */}
      {authView === 'forgot' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-5 text-slate-800">
          {!forgotSent ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
              <p className="text-xs text-slate-500">
                Enter your work email and we'll send a reset link
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => setForgotSent(true)}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                  Send reset link
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xl">
                ✓
              </div>
              <h2 className="text-xl font-bold text-slate-900">Check your inbox</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                We sent a password reset link to {forgotEmail || 'your email'}. It expires in 30 minutes.
              </p>
              <button
                onClick={() => setAuthView('reset')}
                className="w-full border border-blue-600 text-blue-700 font-semibold rounded-lg py-2.5 text-xs hover:bg-blue-50 transition-colors"
              >
                Open reset link (demo)
              </button>
            </div>
          )}

          <div className="text-center text-xs text-slate-500 pt-2">
            <button
              onClick={() => setAuthView('login')}
              className="text-blue-600 font-semibold hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      )}

      {/* RESET PASSWORD */}
      {authView === 'reset' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-5 text-slate-800">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
          <p className="text-xs text-slate-500">Must be at least 8 characters</p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setAuthView('login')}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 transition-colors mt-2"
            >
              Reset password
            </button>
          </div>
        </div>
      )}

      {/* MFA */}
      {authView === 'mfa' && (
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-5 text-slate-800 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xl mx-auto">
            🔒
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Verify your identity</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the 6-digit code from your authenticator app
          </p>

          <div className="flex gap-2 justify-center py-2">
            {mfaDigits.map((val, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={val}
                onChange={(e) => handleMfaDigitChange(idx, e.target.value)}
                className="w-10 h-12 text-center text-lg font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            ))}
          </div>

          <button
            onClick={() => setAuthView(null)}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            Verify
          </button>
        </div>
      )}
    </div>
  );
};
