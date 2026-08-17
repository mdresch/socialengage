import React from 'react';
import { PostItem } from '../types';

interface PostsPaneProps {
  posts: PostItem[];
  onSelectPost: (handle: string) => void;
  postsOpen: boolean;
}

export const PostsPane: React.FC<PostsPaneProps> = ({ posts, onSelectPost, postsOpen }) => {
  if (!postsOpen) return null;

  return (
    <aside className="w-full md:w-[420px] md:flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full min-h-0 overflow-hidden shadow-lg animate-in slide-in-from-right duration-200">
      {/* Pane Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span className="text-[11px] tracking-wider uppercase text-slate-500 font-bold">
          Posts Pane
        </span>
        <span className="text-xs text-slate-400 font-medium">
          {posts.length} matching
        </span>
      </div>

      {/* Posts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No posts match current filters. Try resetting filters.
          </div>
        ) : (
          posts.map((p, idx) => {
            const sentStyle = {
              Positive: 'bg-emerald-50 text-emerald-700',
              Neutral: 'bg-slate-100 text-slate-600',
              Negative: 'bg-red-50 text-red-700',
            }[p.sentiment];

            return (
              <div
                key={idx}
                onClick={() => onSelectPost(p.handle)}
                className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-7 h-7 rounded-full text-white flex items-center justify-center font-semibold text-xs flex-shrink-0"
                    style={{ backgroundColor: p.avatarBg }}
                  >
                    {p.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                      {p.author}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {p.handle} · {p.time}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentStyle}`}
                  >
                    {p.sentiment}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {p.text}
                </p>

                <div className="flex items-center gap-3.5 mt-2.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-500">{p.source}</span>
                  <span>↻ {p.shares}</span>
                  <span>♡ {p.likes}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
