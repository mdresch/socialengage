import React from 'react';
import { useApp } from '../context/AppContext';
import { Layers, CheckCircle2, ArrowRight } from 'lucide-react';

export const SignedOutView: React.FC = () => {
  const { navigateTo } = useApp();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700 shadow-md mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 mb-3">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          You have signed out
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Your active session on SocialEngage has been securely terminated.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#1E293B] py-6 px-6 shadow-xl sm:rounded-xl sm:px-8 border border-slate-800 text-center space-y-4">
          <button
            type="button"
            onClick={() => navigateTo('/sign-in')}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus-ring transition-all"
          >
            <span>Sign back in</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
