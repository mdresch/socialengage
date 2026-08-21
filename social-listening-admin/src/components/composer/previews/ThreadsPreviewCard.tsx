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
    <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-stone-100/60 dark:bg-stone-900/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 font-medium">
        <div className="flex items-center gap-1.5 font-bold">
          <span>@ Threads Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-zinc-500'}>
          {charCount} / {config.maxChars}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs">{author.handle.replace('@', '')}</span>
              <span className="text-zinc-400 text-xs">now</span>
            </div>
            <div className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
              {text || <span className="text-zinc-400 italic">Start a thread...</span>}
            </div>

            {media && media.length > 0 && (
              <div className="mt-2.5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img src={media[0].url} alt="Threads media" className="w-full max-h-64 object-cover" />
              </div>
            )}

            <div className="mt-3 flex items-center gap-4 text-zinc-500 text-xs">
              <span>❤️ 24</span>
              <span>💬 5</span>
              <span>🔁 2</span>
              <span>✈️</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
