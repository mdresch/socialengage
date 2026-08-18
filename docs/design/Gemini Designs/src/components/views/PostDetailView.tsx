import React, { useState } from 'react';
import { ArrowLeft, Send, Tag, UserCheck, Link as LinkIcon, Plus } from 'lucide-react';
import { PostItem, ThreadMessage } from '../../types';

interface PostDetailViewProps {
  post: PostItem;
  onBack: () => void;
  backLabel: string;
}

export const PostDetailView: React.FC<PostDetailViewProps> = ({ post, onBack, backLabel }) => {
  const [replyText, setReplyText] = useState('');
  const [selectedTone, setSelectedTone] = useState<'Standard' | 'Empathetic' | 'Escalate'>('Standard');
  const [thread, setThread] = useState<ThreadMessage[]>([
    {
      author: post.author,
      initials: post.initials,
      avatarBg: post.avatarBg,
      time: `${post.time} ago`,
      text: post.text,
    },
  ]);
  const [tags, setTags] = useState<string[]>(['Product feedback', post.sentiment === 'Negative' ? 'Needs response' : 'Advocacy']);
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [crmLinked, setCrmLinked] = useState(false);

  const sentStyle = {
    Positive: { bg: 'bg-emerald-50 text-emerald-800', fg: '#047857', val: '+82' },
    Neutral: { bg: 'bg-slate-100 text-slate-700', fg: '#475569', val: '+4' },
    Negative: { bg: 'bg-red-50 text-red-800', fg: '#B91C1C', val: '-71' },
  }[post.sentiment];

  const reachVal = (post.likes * 37 + post.shares * 420) / 1000;

  const enrichedFields = [
    { label: 'Sentiment', value: `${post.sentiment} (${sentStyle.val})`, weight: 'font-semibold', color: sentStyle.fg },
    { label: 'Intention', value: post.sentiment === 'Negative' ? 'Complaint' : post.sentiment === 'Neutral' ? 'Information request' : 'Praise', weight: 'font-semibold', color: '#1B2A41' },
    { label: 'Search topic', value: 'SocialEngage · AI · ADPA', weight: 'font-medium', color: '#1B2A41' },
    { label: 'Source', value: post.source, weight: 'font-medium', color: '#1B2A41' },
    { label: 'Language', value: 'English (en)', weight: 'font-medium', color: '#1B2A41' },
    { label: 'Location', value: post.source === 'LinkedIn' ? 'Netherlands' : 'United States', weight: 'font-medium', color: '#1B2A41' },
    { label: 'Author influence', value: post.likes > 300 ? 'High' : post.likes > 100 ? 'Medium' : 'Low', weight: 'font-semibold', color: '#1B2A41' },
    { label: 'Post type', value: 'Original post', weight: 'font-medium', color: '#1B2A41' },
    { label: 'Acquired', value: '30 Jul 2026, 09:43 CET', weight: 'font-medium', color: '#1B2A41' },
    { label: 'CRM record', value: crmLinked ? 'Linked (#CRM-84219)' : 'Not linked', weight: 'font-medium', color: crmLinked ? '#047857' : '#94A3B8' },
  ];

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    setThread((prev) => [
      ...prev,
      {
        author: 'SocialEngage',
        initials: 'SE',
        avatarBg: '#2563EB',
        time: 'just now',
        text: replyText,
      },
    ]);
    setReplyText('');
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    setTags((prev) => [...prev, newTagInput.trim()]);
    setNewTagInput('');
    setAddingTag(false);
  };

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {backLabel}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Content Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Post Header & Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3.5">
              <div
                className="w-12 h-12 rounded-full text-white font-semibold flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: post.avatarBg }}
              >
                {post.initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-semibold text-slate-900">{post.author}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {post.source}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {post.handle} · {post.time} ago · 30 Jul 2026, 09:41 CET
                </div>
              </div>

              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sentStyle.bg}`}>
                {post.sentiment}
              </span>
            </div>

            <p className="text-base text-slate-800 leading-relaxed font-normal">
              {post.text}
            </p>

            {/* Post Metrics & Quick Actions */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-100 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Shares
                </div>
                <div className="text-lg font-semibold text-slate-800 tabular-nums">
                  {post.shares.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Likes
                </div>
                <div className="text-lg font-semibold text-slate-800 tabular-nums">
                  {post.likes.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Replies
                </div>
                <div className="text-lg font-semibold text-slate-800 tabular-nums">
                  {Math.round(post.likes / 9).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Est. Reach
                </div>
                <div className="text-lg font-semibold text-slate-800 tabular-nums">
                  {reachVal.toFixed(1)}K
                </div>
              </div>

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <button className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors">
                  Assign
                </button>
                <button
                  onClick={() => setAddingTag(true)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Add tag
                </button>
                <button
                  onClick={() => setCrmLinked(!crmLinked)}
                  className={`border rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
                    crmLinked
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-blue-600 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {crmLinked ? 'CRM Linked' : 'Link to CRM'}
                </button>
              </div>
            </div>
          </div>

          {/* AI Reply Composer */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Reply</span>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                Replying as
                <span className="inline-flex items-center gap-1.5 border border-slate-300 rounded-md px-2 py-1 bg-white font-semibold text-slate-700">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                    SE
                  </span>
                  @socialengage
                </span>
              </div>
            </div>

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={3}
              className="w-full border border-slate-300 rounded-lg p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 resize-none"
            />

            <div className="flex items-center gap-3 flex-wrap pt-1 text-xs">
              <span
                className={`tabular-nums ${
                  replyText.length > 280 ? 'text-red-600 font-bold' : 'text-slate-400'
                }`}
              >
                {replyText.length} / 280
              </span>

              <div className="w-px h-4 bg-slate-200" />

              {/* Tone choices */}
              {(['Standard', 'Empathetic', 'Escalate'] as const).map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  className={`border rounded-full px-3 py-1 font-medium transition-colors ${
                    selectedTone === tone
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tone}
                </button>
              ))}

              <div className="flex-1" />

              <button className="border border-slate-300 rounded-lg px-3.5 py-2 font-medium hover:bg-slate-50 transition-colors">
                Reply privately
              </button>
              <button
                onClick={handleSendReply}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Post reply
              </button>
            </div>
          </div>

          {/* Thread / Message History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="text-sm font-semibold text-slate-800">
              Thread · {thread.length} {thread.length === 1 ? 'message' : 'messages'}
            </div>

            <div className="space-y-3">
              {thread.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-lg border flex gap-3 ${
                    msg.author === 'SocialEngage'
                      ? 'bg-blue-50/70 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs flex-shrink-0"
                    style={{ backgroundColor: msg.avatarBg }}
                  >
                    {msg.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800">{msg.author}</span>
                      <span className="text-[11px] text-slate-400">{msg.time}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* Enriched Fields Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Enriched Fields
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {enrichedFields.map((field) => (
                <div key={field.label} className="py-2 flex justify-between gap-3">
                  <span className="text-slate-500 w-32 flex-shrink-0">{field.label}</span>
                  <span
                    className={`text-right flex-1 ${field.weight}`}
                    style={{ color: field.color }}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords & Tags */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Matched Keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['SocialEngage', 'listening', 'ADPA', 'sentiment'].map((kw) => (
                  <span
                    key={kw}
                    className="border border-blue-200 bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-slate-200 bg-slate-50 text-slate-600 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}

                {addingTag ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="Tag name"
                      className="border border-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <button
                      onClick={handleAddTag}
                      className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 font-semibold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTag(true)}
                    className="border border-dashed border-slate-300 text-slate-400 rounded-full px-2.5 py-0.5 text-xs hover:text-slate-600 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Author Details Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Author Information
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full text-white font-semibold flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: post.avatarBg }}
              >
                {post.initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{post.author}</div>
                <div className="text-xs text-slate-400">{post.handle}</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs pt-1">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Followers</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {(post.likes * 61).toLocaleString()}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Posts on topic</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {3 + (post.shares % 7)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Avg. sentiment</span>
                <span className="font-semibold text-emerald-600 tabular-nums">+42</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">First seen</span>
                <span className="font-semibold text-slate-800">14 Mar 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
