'use client';

import { useState } from 'react';
import type { PlatformConfig, MediaAttachment } from '../types';

interface InstagramPreviewCardProps {
  config: PlatformConfig;
  text: string;
  media: MediaAttachment[];
}

export function InstagramPreviewCard({ config, text, media }: InstagramPreviewCardProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const author = config.defaultAuthor;

  const charCount = text.length;
  const isOverLimit = charCount > config.maxChars;

  return (
    <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans max-w-md mx-auto">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-pink-50/50 dark:bg-pink-950/20 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-pink-800 dark:text-pink-300 font-medium">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 fill-[#e1306c]" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          <span>Instagram Feed</span>
        </div>
        <span className={isOverLimit ? 'text-rose-600 font-bold' : 'text-zinc-500'}>
          {charCount} / {config.maxChars.toLocaleString()}
        </span>
      </div>

      {/* Profile Header */}
      <div className="px-3.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
            <div className="w-full h-full rounded-full bg-white dark:bg-black p-[1px]">
              <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold">
                {author.name.charAt(0)}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold leading-none">{author.handle.replace('@', '')}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Original audio</div>
          </div>
        </div>
        <button className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" aria-label="Options">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="18" cy="12" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Media Viewport */}
      <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center">
        {media && media.length > 0 ? (
          <img
            src={media[activeSlide]?.url || media[0].url}
            alt="Instagram media"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400">
            <svg className="w-12 h-12 mb-2 text-zinc-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">Add an image to preview in Instagram square format</p>
          </div>
        )}

        {/* Carousel Indicators */}
        {media && media.length > 1 && (
          <>
            <div className="absolute top-2.5 right-2.5 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
              {activeSlide + 1}/{media.length}
            </div>
            <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1">
              {media.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeSlide ? 'bg-sky-500 scale-125' : 'bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action Icons Bar */}
      <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <svg className="w-6 h-6 hover:text-rose-500 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <svg className="w-6 h-6 -rotate-90 hover:text-zinc-600 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <svg className="w-6 h-6 hover:text-zinc-600 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <svg className="w-6 h-6 hover:text-zinc-600 cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </div>

      {/* Caption & Metadata */}
      <div className="px-3.5 pb-4 text-xs space-y-1.5">
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">128 likes</div>
        <div className="leading-snug break-words">
          <span className="font-semibold mr-1.5">{author.handle.replace('@', '')}</span>
          <span className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{text || 'Your Instagram caption will appear here...'}</span>
        </div>
        <div className="text-[10px] text-zinc-400 uppercase pt-1 tracking-wider">Just now</div>
      </div>
    </div>
  );
}
