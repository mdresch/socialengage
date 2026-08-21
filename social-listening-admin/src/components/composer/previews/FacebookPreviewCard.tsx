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
    <div className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-lg shadow-sm overflow-hidden text-slate-900 dark:text-[#eef0f3] font-sans">
      {/* Header Bar */}
      <div className="px-3.5 py-1.5 bg-blue-50/60 dark:bg-blue-950/30 border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-[#1877f2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="font-semibold">Facebook Page Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-slate-500 dark:text-[#9aa2b1]'}>
          {charCount} / {config.maxChars.toLocaleString()}
        </span>
      </div>

      <div className="p-3.5">
        {/* Page Author Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight truncate">{author.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
              <span>Just now</span>
              <span>•</span>
              <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 0 1 1.05-3.55l3.22 3.22A2.5 2.5 0 0 0 8 10.5v4A6.5 6.5 0 0 1 1.5 8zm7.5 6.45v-3.95a1.5 1.5 0 0 1 1.5-1.5h1.23a6.5 6.5 0 0 1-2.73 5.45zm4.73-2.02l-2.23-2.23a2.5 2.5 0 0 0-1.5-.7h-.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1V5.2a6.5 6.5 0 0 1 2.23 7.23z" />
              </svg>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent p-1" aria-label="Menu">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        {/* Post Text */}
        <div className="mt-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {text ? text : <span className="text-slate-400 dark:text-slate-500 italic">Your Facebook post text will appear here...</span>}
        </div>
      </div>

      {/* Media Box */}
      {media && media.length > 0 && (
        <div className="border-t border-b border-slate-200 dark:border-[#30343d] bg-slate-100 dark:bg-[#14161a]">
          <div className="relative aspect-video w-full overflow-hidden flex items-center justify-center bg-slate-900">
            <img src={media[0].url} alt="Facebook attachment" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Facebook Actions Bar */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs text-slate-600 dark:text-[#9aa2b1] font-medium bg-slate-50/40 dark:bg-[#141a29]/30">
        <button className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <span>👍</span>
          <span>Like</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
