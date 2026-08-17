import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, Building, Globe, Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { InlineError } from '../components/InlineError';

export const SignUpView: React.FC = () => {
  const { completeSignUp, navigateTo } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tenantName, setTenantName] = useState('Fabrikam Media Group');
  const [domain, setDomain] = useState('fabrikam.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStep1Auth = async () => {
    setLoading(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setStep(2);
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      setError('Workspace name is required.');
      return;
    }
    if (!domain.trim() || !domain.includes('.')) {
      setError('A valid corporate domain is required (e.g. fabrikam.com).');
      return;
    }

    setLoading(true);
    setStep(3);
    await new Promise((r) => setTimeout(r, 1000));
    completeSignUp(tenantName.trim(), domain.trim().toLowerCase());
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Create a Social<span className="text-blue-400">Engage</span> Workspace
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Establish an isolated enterprise tenant for your brand listening operations
        </p>
      </div>

      {/* Wizard Progress Indicator */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-6">
        <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-400">
          <span className={`flex items-center gap-1.5 ${step >= 1 ? 'text-blue-400 font-semibold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              1
            </span>
            Auth
          </span>
          <span className="text-slate-700">──</span>
          <span className={`flex items-center gap-1.5 ${step >= 2 ? 'text-blue-400 font-semibold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              2
            </span>
            Workspace
          </span>
          <span className="text-slate-700">──</span>
          <span className={`flex items-center gap-1.5 ${step >= 3 ? 'text-blue-400 font-semibold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              3
            </span>
            Provision
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#1E293B] py-8 px-6 shadow-xl sm:rounded-xl sm:px-10 border border-slate-800">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-sm text-slate-300 leading-relaxed">
                Step 1: Authenticate with your organisation's Microsoft account to verify your enterprise identity.
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleStep1Auth}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-md shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus-ring disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Verifying Microsoft Identity...
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none">
                      <path fill="#F25022" d="M1 1h9v9H1z" />
                      <path fill="#00A4EF" d="M1 11h9v9H1z" />
                      <path fill="#7FBA00" d="M11 1h9v9h-9z" />
                      <path fill="#FFB900" d="M11 11h9v9h-9z" />
                    </svg>
                    <span>Authenticate with Microsoft</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigateTo('/sign-in')}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Already have a workspace? Sign in
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleCompleteSetup} className="space-y-5">
              <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-md text-xs text-blue-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Identity verified: admin@fabrikam.com</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tenant Display Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus-ring"
                    placeholder="e.g. Acme Global Operations"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Primary Corporate Domain
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus-ring font-mono"
                    placeholder="e.g. fabrikam.com"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Colleagues with this email domain will qualify for same-domain invite assistance.
                </p>
              </div>

              {error && <InlineError message={error} />}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus-ring transition-all"
              >
                <span>Create your workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <svg className="w-6 h-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">
                Provisioning Tenant & Sovereign Storage...
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Allocating workspace container, bootstrapping default ingestion rules, and issuing tenant_admin credential.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
