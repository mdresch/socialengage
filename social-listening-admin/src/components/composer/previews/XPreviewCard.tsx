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

  // Split text into valid part and overflow part (like X's composer)
  const validText = isOverLimit ? text.slice(0, config.maxChars) : text;
  const overflowText = isOverLimit ? text.slice(config.maxChars) : '';

  return (
    <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-zinc-100/60 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>X / Twitter Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-zinc-500'}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-sm truncate">{author.name}</span>
              <span className="text-zinc-500 text-xs truncate">{author.handle}</span>
              <span className="text-zinc-400 text-xs">·</span>
              <span className="text-zinc-400 text-xs">now</span>
            </div>

            {/* Post Content with Overflow Highlight */}
            <div className="mt-2 text-[14.5px] leading-snug whitespace-pre-wrap break-words">
              {text ? (
                <>
                  <span>{validText}</span>
                  {isOverLimit && (
                    <span className="bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium px-0.5 rounded">
                      {overflowText}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-400 italic">What is happening?!</span>
              )}
            </div>

            {/* Media Block */}
            {media && media.length > 0 && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                <img
                  src={media[0].url}
                  alt="Post attachment"
                  className="w-full max-h-72 object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-3.5 flex items-center justify-between text-zinc-500 text-xs max-w-md">
              <div className="flex items-center gap-1.5 hover:text-sky-500 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>12</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-emerald-500 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>4</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-rose-500 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>89</span>
              </div>
              <div className="flex items-center gap-1.5 hover:text-sky-500 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
