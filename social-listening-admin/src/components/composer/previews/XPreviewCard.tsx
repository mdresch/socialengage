'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface XPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function XPreviewCard({ config, text, media }: XPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  // Real-time limit highlight
  const validText = isOverLimit ? text.slice(0, config.maxChars) : text;
  const overflowText = isOverLimit ? text.slice(config.maxChars) : '';

  return (
    <div className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-lg shadow-sm overflow-hidden text-slate-900 dark:text-[#eef0f3] font-sans">
      {/* Header Bar */}
      <div className="px-3.5 py-1.5 bg-slate-100/80 dark:bg-[#141a29] border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-[#eef0f3]">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="font-semibold">X / Post</span>
        </div>

        {/* Character Counter with Overflow Warning */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-semibold ${isOverLimit ? 'text-rose-600' : 'text-slate-500 dark:text-[#9aa2b1]'}`}>
            {charCount}/{config.maxChars}
          </span>
          {isOverLimit && (
            <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
              +{charCount - config.maxChars} overflow
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 leading-tight">
              <span className="font-bold text-xs truncate">{author.name}</span>
              <svg className="w-3.5 h-3.5 text-sky-500 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-slate-500 text-xs truncate">{author.handle}</span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-400 text-xs">now</span>
            </div>

            {/* Tweet Body with Over-limit Highlighting */}
            <div className="mt-2 text-xs leading-normal break-words whitespace-pre-wrap">
              {text ? (
                <>
                  <span>{validText}</span>
                  {overflowText && (
                    <span className="bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200 rounded-xs px-0.5" title="Exceeds 280 characters">
                      {overflowText}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 italic">What is happening?! (Tweet text...)</span>
              )}
            </div>

            {/* Media Attachment */}
            {media && media.length > 0 && (
              <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-200 dark:border-[#30343d] bg-slate-900">
                <img src={media[0].url} alt="Tweet media" className="w-full max-h-56 object-cover" />
              </div>
            )}

            {/* Tweet Action Icons */}
            <div className="mt-3 flex items-center justify-between text-slate-400 dark:text-[#9aa2b1] max-w-xs text-xs">
              <button className="hover:text-sky-500 flex items-center gap-1 transition-colors bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>0</span>
              </button>
              <button className="hover:text-emerald-500 flex items-center gap-1 transition-colors bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>0</span>
              </button>
              <button className="hover:text-rose-500 flex items-center gap-1 transition-colors bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>0</span>
              </button>
              <button className="hover:text-sky-500 flex items-center gap-1 transition-colors bg-transparent p-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
