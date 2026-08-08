import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PostItem, SourceItem } from '../../types';

interface SocialCenterViewProps {
  sources: SourceItem[];
  posts: PostItem[];
  onSelectPost: (handle: string) => void;
}

export const SocialCenterView: React.FC<SocialCenterViewProps> = ({
  sources,
  posts,
  onSelectPost,
}) => {
  const [streamSources, setStreamSources] = useState<string[]>([
    'Twitter/X',
    'LinkedIn',
    'News',
    'Blogs',
  ]);
  const [showAddStream, setShowAddStream] = useState(false);

  const sentDots = {
    Positive: 'bg-emerald-500',
    Neutral: 'bg-slate-400',
    Negative: 'bg-red-500',
  };

  const handleAddStream = (sourceName: string) => {
    if (!streamSources.includes(sourceName)) {
      setStreamSources((prev) => [...prev, sourceName]);
    }
    setShowAddStream(false);
  };

  const handleRemoveStream = (sourceName: string) => {
    setStreamSources((prev) => prev.filter((s) => s !== sourceName));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Social Center - Live Streams</h2>
          <p className="text-xs text-slate-400">
            Real-time feed monitoring across configured listening channels
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[700px] no-scrollbar items-start">
        {streamSources.map((sourceName) => {
          const sourceObj = sources.find((s) => s.name === sourceName) || {
            name: sourceName,
            color: '#2563EB',
          };

          const streamPosts = posts.filter((p) => p.source === sourceName);

          return (
            <div
              key={sourceName}
              className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col max-h-[760px] shadow-sm"
            >
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: sourceObj.color }}
                  />
                  <span className="text-xs font-semibold text-slate-800">{sourceName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {streamPosts.length} posts
                  </span>
                  <button
                    onClick={() => handleRemoveStream(sourceName)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Remove stream"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
                {streamPosts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No active posts in stream
                  </div>
                ) : (
                  streamPosts.map((post, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectPost(post.handle)}
                      className="p-3.5 hover:bg-slate-50/80 cursor-pointer rounded-lg transition-colors group space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0"
                          style={{ backgroundColor: post.avatarBg }}
                        >
                          {post.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {post.author}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{post.time}</div>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${sentDots[post.sentiment]}`}
                          title={`Sentiment: ${post.sentiment}`}
                        />
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                        {post.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Add stream button */}
        <button
          onClick={() => setShowAddStream(true)}
          className="w-80 flex-shrink-0 h-48 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-600 bg-white/50 hover:bg-blue-50/20 transition-all text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Add stream</span>
        </button>
      </div>

      {/* Modal Add Stream */}
      {showAddStream && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-semibold text-sm text-slate-800">Add Stream</span>
              <button
                onClick={() => setShowAddStream(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {sources
                .filter((s) => !streamSources.includes(s.name))
                .map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleAddStream(s.name)}
                    className="w-full text-left p-3 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 flex items-center gap-3 transition-colors text-xs font-semibold text-slate-700"
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                ))}

              {sources.every((s) => streamSources.includes(s.name)) && (
                <div className="text-xs text-slate-400 text-center py-4">
                  All available streams are currently active!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
