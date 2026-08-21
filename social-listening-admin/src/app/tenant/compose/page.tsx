'use client';

import { PolypostComposer } from '@/components/composer';

export default function ComposePage() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-[#30343d] pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 uppercase tracking-wider">
            Polypost Studio
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#eef0f3] tracking-tight m-0">
          Create &amp; Cross-Publish Post
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9aa2b1] mt-1 mb-0">
          Draft your message once, inspect live native preview rails, and dispatch simultaneously to all connected channels.
        </p>
      </div>

      {/* Main Composer & Rails Workspace */}
      <PolypostComposer />
    </div>
  );
}
