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
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-cyan-50/50 dark:bg-cyan-950/20 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-cyan-800 dark:text-cyan-300 font-medium">
        <div className="flex items-center gap-1.5 font-bold">
          <span>🦋 Bluesky Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-zinc-500'}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="font-bold text-sm truncate">{author.name}</span>
              <span className="text-zinc-500 text-xs truncate">{author.handle}</span>
              <span className="text-zinc-400 text-xs">· now</span>
            </div>
            <div className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words">
              {text || <span className="text-zinc-400 italic">What's up?</span>}
            </div>

            {media && media.length > 0 && (
              <div className="mt-3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img src={media[0].url} alt="Bluesky media" className="w-full max-h-64 object-cover" />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-zinc-500 text-xs max-w-sm">
              <span className="hover:text-cyan-500 cursor-pointer">💬 8</span>
              <span className="hover:text-emerald-500 cursor-pointer">🔁 3</span>
              <span className="hover:text-rose-500 cursor-pointer">❤️ 45</span>
              <span>⋯</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
