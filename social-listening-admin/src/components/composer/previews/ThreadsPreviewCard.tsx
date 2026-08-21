'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface ThreadsPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function ThreadsPreviewCard({ config, text, media }: ThreadsPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  return (
    <div className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-lg shadow-sm overflow-hidden text-slate-900 dark:text-[#eef0f3] font-sans">
      {/* Header Bar */}
      <div className="px-3.5 py-1.5 bg-slate-100/80 dark:bg-[#141a29] border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-[#eef0f3]">
          <span className="text-sm font-bold">@</span>
          <span className="font-semibold">Threads Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-slate-500 dark:text-[#9aa2b1]'}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="p-3.5">
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {author.name.charAt(0)}
            </div>
            <div className="w-0.5 flex-1 bg-slate-200 dark:bg-[#30343d] my-1 rounded-full min-h-[20px]" />
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs">{author.handle.replace('@', '')}</span>
              <span className="text-[11px] text-slate-400">now</span>
            </div>

            <div className="mt-1 text-xs leading-relaxed whitespace-pre-wrap break-words">
              {text ? text : <span className="text-slate-400 dark:text-slate-500 italic">Say more on Threads...</span>}
            </div>

            {media && media.length > 0 && (
              <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-200 dark:border-[#30343d] bg-slate-900">
                <img src={media[0].url} alt="Threads media" className="w-full max-h-56 object-cover" />
              </div>
            )}

            {/* Actions */}
            <div className="mt-2.5 flex items-center gap-3.5 text-slate-600 dark:text-[#9aa2b1]">
              <svg className="w-4 h-4 hover:text-rose-500 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <svg className="w-4 h-4 hover:text-slate-800 dark:hover:text-white cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <svg className="w-4 h-4 hover:text-slate-800 dark:hover:text-white cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg className="w-4 h-4 hover:text-slate-800 dark:hover:text-white cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
