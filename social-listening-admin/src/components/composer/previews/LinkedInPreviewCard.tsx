'use client';

import { useState } from 'react';
import type { PlatformConfig, MediaAttachment } from '../types';

interface LinkedInPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function LinkedInPreviewCard({ config, text, media }: LinkedInPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const author = config.defaultAuthor;

  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;
  const shouldTruncate = text.length > 210 && !isExpanded;
  const displayText = shouldTruncate ? text.slice(0, 210) + '...' : text;

  return (
    <div className="bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-[#30343d] rounded-lg shadow-sm overflow-hidden text-slate-900 dark:text-[#eef0f3] font-sans">
      {/* Platform Header Indicator */}
      <div className="px-3.5 py-1.5 bg-sky-50/60 dark:bg-sky-950/30 border-b border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs text-sky-800 dark:text-sky-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-[#0a66c2]" viewBox="0 0 24 24">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
          <span className="font-semibold">LinkedIn Feed Post</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-slate-500 dark:text-[#9aa2b1]'}>
          {charCount} / {config.maxChars.toLocaleString()}
        </span>
      </div>

      <div className="p-3.5">
        {/* Author Header */}
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
            {author.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-semibold text-xs truncate hover:underline cursor-pointer">
                {author.name}
              </span>
              <span className="text-slate-400 text-xs">• 1st</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#9aa2b1] truncate mt-0.5 mb-0">
              {author.headline || 'Member'}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>Just now</span>
              <span>•</span>
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 0 1 1.05-3.55l3.22 3.22A2.5 2.5 0 0 0 8 10.5v4A6.5 6.5 0 0 1 1.5 8zm7.5 6.45v-3.95a1.5 1.5 0 0 1 1.5-1.5h1.23a6.5 6.5 0 0 1-2.73 5.45zm4.73-2.02l-2.23-2.23a2.5 2.5 0 0 0-1.5-.7h-.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1V5.2a6.5 6.5 0 0 1 2.23 7.23z" />
              </svg>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 bg-transparent" aria-label="Post options">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        {/* Post Text */}
        <div className="mt-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {text ? (
            <>
              <span>{displayText}</span>
              {shouldTruncate && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 ml-1 font-medium hover:underline inline-block bg-transparent p-0"
                >
                  ...see more
                </button>
              )}
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic">Your LinkedIn post commentary will appear here...</span>
          )}
        </div>
      </div>

      {/* Media Attachments */}
      {media && media.length > 0 && (
        <div className="border-t border-b border-slate-200 dark:border-[#30343d] bg-slate-100 dark:bg-[#14161a]">
          {media.length === 1 ? (
            <div className="relative aspect-video w-full overflow-hidden flex items-center justify-center bg-slate-900">
              <img
                src={media[0].url}
                alt={media[0].altText || 'Media'}
                className="max-h-72 w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0.5 max-h-64 overflow-hidden bg-slate-200 dark:bg-[#30343d]">
              {media.slice(0, 4).map((m, idx) => (
                <div key={m.id || idx} className="relative aspect-square overflow-hidden bg-slate-900">
                  <img src={m.url} alt="Gallery item" className="w-full h-full object-cover" />
                  {idx === 3 && media.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-base font-bold">
                      +{media.length - 3}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LinkedIn Interaction Bar */}
      <div className="px-2 py-1.5 border-t border-slate-200 dark:border-[#30343d] flex items-center justify-between text-xs text-slate-600 dark:text-[#9aa2b1] font-medium bg-slate-50/40 dark:bg-[#141a29]/30">
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>Like</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Comment</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Repost</span>
        </button>
        <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#141a29] transition-colors bg-transparent">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
