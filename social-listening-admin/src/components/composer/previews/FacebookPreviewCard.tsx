'use client';

import type { PlatformConfig, MediaAttachment } from '../types';

interface FacebookPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function FacebookPreviewCard({ config, text, media }: FacebookPreviewCardProps) {
  const author = config.defaultAuthor;
  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Platform Header */}
      <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-[#1877f2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Facebook Page Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-zinc-500'}>
          {charCount} / {config.maxChars.toLocaleString()}
        </span>
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight hover:underline cursor-pointer">
              {author.name}
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
              <span>Just now</span>
              <span>•</span>
              <span title="Public">🌐</span>
            </div>
          </div>
          <button className="text-zinc-400 hover:text-zinc-600 p-1" aria-label="Post actions">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
            </svg>
          </button>
        </div>

        {/* Text */}
        <div className="mt-3 text-[14px] leading-normal whitespace-pre-wrap break-words">
          {text || <span className="text-zinc-400 italic">Your Facebook post text will appear here...</span>}
        </div>
      </div>

      {/* Media Attachments */}
      {media && media.length > 0 && (
        <div className="border-t border-b border-zinc-100 dark:border-zinc-800 bg-zinc-900">
          <img
            src={media[0].url}
            alt="Facebook media"
            className="w-full max-h-96 object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Facebook Reactions Bar */}
      <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <span className="flex -space-x-1">
            <span className="inline-block w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] text-center leading-4">👍</span>
            <span className="inline-block w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] text-center leading-4">❤️</span>
          </span>
          <span className="ml-1">42</span>
        </div>
        <div>3 comments · 1 share</div>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-3 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        <button className="py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors flex items-center justify-center gap-1.5">
          <span>👍</span> Like
        </button>
        <button className="py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors flex items-center justify-center gap-1.5">
          <span>💬</span> Comment
        </button>
        <button className="py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors flex items-center justify-center gap-1.5">
          <span>↗️</span> Share
        </button>
      </div>
    </div>
  );
}
