import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, ArrowRight, ShieldCheck, AlertCircle, Sparkles, Mail, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

export const SignInView: React.FC = () => {
  const { signInAs, navigateTo, completeSignUp } = useApp();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('tenant_admin');
  const [customEmail, setCustomEmail] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinueWithMicrosoft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate Microsoft Entra External ID OIDC redirect & token exchange
      await new Promise((r) => setTimeout(r, 400));

      if (useCustomEmail && customEmail.trim()) {
        const email = customEmail.trim().toLowerCase();
        const domain = email.includes('@') ? email.split('@')[1] : 'enterprise.com';
        const companyName = domain.split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) + ' Operations';
        // Auto-provision or sign into custom domain workspace
        completeSignUp(companyName, domain);
      } else {
        signInAs(selectedRole);
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      setError('Sign-in failed. Try again or contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Logo */}
        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Sign in to Social<span className="text-blue-400">Engage</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Enterprise Social Listening & Media Ingestion Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#1E293B] py-8 px-6 shadow-xl sm:rounded-xl sm:px-10 border border-slate-800 space-y-6">
          {/* Identity selection tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Microsoft Entra Identity
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseCustomEmail(!useCustomEmail);
                  setError(null);
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                {useCustomEmail ? 'Use demo profiles' : 'Enter work email'}
              </button>
            </div>

            {!useCustomEmail ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('tenant_admin')}
                    className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-all ${
                      selectedRole === 'tenant_admin'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold shadow-xs'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tenant Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('tenant_user')}
                    className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-all ${
                      selectedRole === 'tenant_user'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold shadow-xs'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tenant User
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('platform_admin')}
                    className={`px-3 py-2 text-xs font-medium rounded-md border text-center transition-all ${
                      selectedRole === 'platform_admin'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold shadow-xs'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Platform Admin
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 bg-slate-900/70 p-2.5 rounded border border-slate-800 font-mono">
                  {selectedRole === 'tenant_admin' && 'sarah.chen@acme-global.com (Tenant Admin - Full access)'}
                  {selectedRole === 'tenant_user' && 'marcus.vance@acme-global.com (Analyst - Feeds & Watchlists)'}
                  {selectedRole === 'platform_admin' && 'alex.rivera@socialengage.platform (Operator - Multi-tenant)'}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-100 placeholder:text-slate-500 focus-ring font-mono"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter your Microsoft 365 or Entra ID work account email.
                </p>
              </div>
            )}
          </div>

          {/* Primary Sign-In Button */}
          <button
            type="button"
            id="btn-continue-microsoft"
            disabled={loading}
            onClick={() => handleContinueWithMicrosoft()}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-md shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus-ring disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing in with Microsoft...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none">
                  <path fill="#F25022" d="M1 1h9v9H1z" />
                  <path fill="#00A4EF" d="M1 11h9v9H1z" />
                  <path fill="#7FBA00" d="M11 1h9v9h-9z" />
                  <path fill="#FFB900" d="M11 11h9v9h-9z" />
                </svg>
                <span>Continue with Microsoft</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-3 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1E293B] px-2 text-slate-500 font-medium">or</span>
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigateTo('/sign-up')}
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create a new tenant workspace (Self-service sign up)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Footnote */}
          <div className="pt-2 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              Secured with Microsoft Entra ID • Single Sign-On Enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
