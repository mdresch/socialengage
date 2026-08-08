import React from 'react';
import { Download } from 'lucide-react';
import { PHRASE_WORDS } from '../../data/mockData';

export const ConversationsView: React.FC = () => {
  const INTENTS = [
    { name: 'Praise', count: 3120, color: '#10B981' },
    { name: 'Question', count: 1840, color: '#2563EB' },
    { name: 'Complaint', count: 980, color: '#EF4444' },
    { name: 'Comparison', count: 640, color: '#7C3AED' },
    { name: 'Recommendation', count: 410, color: '#F59E0B' },
  ];
  const maxIntent = Math.max(...INTENTS.map((i) => i.count));

  const TAGS = [
    ['Product feedback', 412],
    ['Needs response', 187],
    ['Advocacy', 328],
    ['Feature request', 210],
    ['Bug report', 96],
    ['Pricing question', 154],
    ['Onboarding', 88],
    ['Partnership', 41],
  ];

  const PLATFORMS = [
    { name: 'Twitter/X', color: '#1D9BF0', phrases: ['AI listening', 'real-time alerts', 'sentiment model'] },
    { name: 'LinkedIn', color: '#0A66C2', phrases: ['social CRM', 'brand health', 'case study'] },
    { name: 'News', color: '#7C3AED', phrases: ['market expansion', 'ADPA', 'AI-driven'] },
    { name: 'Forums', color: '#10B981', phrases: ['topic clustering', 'API access', 'recall'] },
  ];

  const HIST = [12, 14, 13, 18, 22, 19, 25, 28, 24, 31, 29, 35, 40, 37, 44, 48, 42, 52, 58, 55, 63, 60, 68, 72, 66, 74, 80, 76, 84, 90];
  const maxH = Math.max(...HIST);
  const phrasePoints = HIST.map((v, i) => `${(i / (HIST.length - 1)) * 260},${110 - (v / maxH) * 100}`).join(' ');

  const TRENDING = [
    { text: 'adaptive analytics', trend: '+64%', color: '#047857' },
    { text: 'AI listening', trend: '+41%', color: '#047857' },
    { text: 'profile auth timeouts', trend: '+38%', color: '#B91C1C' },
    { text: 'intention detection', trend: '+22%', color: '#047857' },
    { text: 'export limits', trend: '−12%', color: '#B45309' },
    { text: 'topic clustering', trend: '+9%', color: '#047857' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-3 space-y-4">
        {/* Intentions */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Intentions
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="space-y-3">
            {INTENTS.map((intent) => (
              <div key={intent.name}>
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-slate-700">{intent.name}</span>
                  <span className="text-slate-500 tabular-nums">{intent.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((intent.count / maxIntent) * 100)}%`,
                      backgroundColor: intent.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Conversation Tags
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex flex-wrap gap-2">
            {TAGS.map(([name, count]) => (
              <span
                key={name as string}
                className="bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {name} <span className="opacity-60">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MIDDLE COLUMN */}
      <div className="lg:col-span-6 space-y-4">
        {/* Phrases cloud */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phrases Cloud
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex flex-wrap gap-3 items-baseline min-h-[160px]">
            {PHRASE_WORDS.map((word, i) => (
              <span
                key={word}
                style={{ fontSize: `${28 - i * 1.2}px` }}
                className="font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        {/* Phrases per platform */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phrases per Platform
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="space-y-3">
            {PLATFORMS.map((plat) => (
              <div key={plat.name}>
                <div className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: plat.color }} />
                  {plat.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {plat.phrases.map((phrase) => (
                    <span
                      key={phrase}
                      className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-3 space-y-4">
        {/* Phrases History Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phrases History
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="h-28">
            <svg viewBox="0 0 260 120" preserveAspectRatio="none" className="w-full h-full">
              <polyline points={phrasePoints} fill="none" stroke="#334155" strokeWidth="2" />
            </svg>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Mentions of "adaptive analytics" over 30 days</div>
        </div>

        {/* Trending Phrases */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Trending Phrases
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="space-y-2.5">
            {TRENDING.map((item) => (
              <div key={item.text} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium truncate">{item.text}</span>
                <span className="font-bold tabular-nums" style={{ color: item.color }}>
                  {item.trend}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
