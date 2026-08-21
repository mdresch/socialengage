'use client';

import { PolypostComposer } from '@/components/composer';

export default function ComposePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 uppercase tracking-wider">
              Polypost Studio
            </span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Create & Cross-Publish Post
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Draft your message once, inspect live native preview rails, and dispatch simultaneously to all connected channels.
          </p>
        </div>
      </div>

      {/* Main Composer & Rails Workspace */}
      <PolypostComposer />
    </div>
  );
}
