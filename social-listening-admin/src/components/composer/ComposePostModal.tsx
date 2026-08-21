'use client';

import { PolypostComposer } from './PolypostComposer';

interface ComposePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
}

export function ComposePostModal({ isOpen, onClose, initialText = '' }: ComposePostModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-sm shadow">
              ✍️
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Compose & Cross-Publish Post
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Polypost multi-channel editor with real-time platform preview rails
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <PolypostComposer
            initialText={initialText}
            onPublishSuccess={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
