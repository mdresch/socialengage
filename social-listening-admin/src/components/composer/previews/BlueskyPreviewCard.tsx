'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface BlueskyPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function BlueskyPreviewCard({ config, text, media }: BlueskyPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  return (
    <div className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-lg shadow-sm overflow-hidden text-slate-900 dark:text-[#eef0f3] font-sans">
      {/* Header Bar */}
      <div className="px-3.5 py-1.5 bg-sky-50/60 dark:bg-sky-950/30 border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs text-sky-800 dark:text-sky-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-[#1185fe]" viewBox="0 0 24 24">
            <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566 1.01 1.25 1.5 0.5 2.5 0 3.2 0 4.5 0.5 6.5c1.077 4.3 3.5 6.3 5.5 6.8-2 0.3-4.5 1.3-5.5 4.5C0 19.5 0 20.8 0.5 21.5c0.75 1 2.066 1.49 4.702-0.305C7.954 19.253 10.913 15.314 12 13.2c1.087 2.114 4.046 6.053 6.798 7.995 2.636 1.795 3.952 1.305 4.702 0.305 0.5-0.7 0.5-2 0-3.7-1-3.2-3.5-4.2-5.5-4.5 2-0.5 4.423-2.5 5.5-6.8 0.5-2 0.5-3.3 0-4-0.75-1-2.066-1.49-4.702 0.305C16.046 4.747 13.087 8.686 12 10.8z" />
          </svg>
          <span className="font-semibold">Bluesky Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-slate-500 dark:text-[#9aa2b1]'}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="font-bold text-xs truncate">{author.name}</span>
              <span className="text-slate-500 text-[11px] truncate">{author.handle}</span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-400 text-xs">now</span>
            </div>

            <div className="mt-1.5 text-xs leading-normal break-words whitespace-pre-wrap">
              {text ? text : <span className="text-slate-400 dark:text-slate-500 italic">What&apos;s up? (Bluesky post text...)</span>}
            </div>

            {media && media.length > 0 && (
              <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-200 dark:border-[#30343d] bg-slate-900">
                <img src={media[0].url} alt="Bluesky media" className="w-full max-h-56 object-cover" />
              </div>
            )}

            {/* Bluesky Action Bar */}
            <div className="mt-3 flex items-center justify-between text-slate-400 dark:text-[#9aa2b1] max-w-xs text-xs">
              <button className="hover:text-sky-500 flex items-center gap-1 bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>0</span>
              </button>
              <button className="hover:text-emerald-500 flex items-center gap-1 bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>0</span>
              </button>
              <button className="hover:text-rose-500 flex items-center gap-1 bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>0</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
