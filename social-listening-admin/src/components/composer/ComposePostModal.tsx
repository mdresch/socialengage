'use client';

import { useEffect } from 'react';
import { PolypostComposer } from './PolypostComposer';

interface ComposePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
}

export function ComposePostModal({ isOpen, onClose, initialText = '' }: ComposePostModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-[#eef0f3] animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-modal-title"
        data-testid="compose-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#141a29]/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              ✍️
            </div>
            <div>
              <h2 id="compose-modal-title" className="text-base font-bold text-slate-900 dark:text-[#eef0f3] leading-tight">
                Compose & Cross-Publish Post
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9aa2b1] mt-0.5">
                Polypost multi-channel editor with real-time platform preview rails
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-[#14161a]/30">
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
