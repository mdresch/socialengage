import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { SourceItem, AuthorItem, LanguageItem } from '../../types';
import { BUZZ_DATA, PHRASE_WORDS } from '../../data/mockData';

interface OverviewViewProps {
  sources: SourceItem[];
  authors: AuthorItem[];
  languages: LanguageItem[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  sources,
  authors,
  languages,
}) => {
  const [volTab, setVolTab] = useState<'Volume' | 'Average'>('Volume');

  const sentIndex = 5.1;
  const sentChange = 5.1;

  // Sentiment donut values
  const totalAuthorsCount = sources.reduce((acc, s) => acc + Math.round(s.count * 0.41), 0) || 1;
  const C = 2 * Math.PI * 40;
  let accumulatedFrac = 0;

  const authorDonut = sources.map((s) => {
    const c = Math.round(s.count * 0.41);
    const frac = c / totalAuthorsCount;
    const seg = {
      name: s.name,
      color: s.color,
      count: c.toLocaleString(),
      dash: `${(C * frac).toFixed(1)} ${C.toFixed(1)}`,
      offset: (-C * accumulatedFrac).toFixed(1),
    };
    accumulatedFrac += frac;
    return seg;
  });

  // Chart line calculations
  const maxVal = Math.max(...BUZZ_DATA) * 1.15;
  const pts = BUZZ_DATA.map((v, i) => {
    const x = (i / (BUZZ_DATA.length - 1)) * 900;
    const y = 250 - (v / maxVal) * 250;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePoints = pts.join(' ');
  const areaPath = `M0,250 L${pts.join(' L')} L900,250 Z`;

  const maxSrcCount = Math.max(...sources.map((s) => s.count)) || 1;
  const maxLangCount = Math.max(...languages.map((l) => l.count)) || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-3 space-y-4">
        {/* Sentiment Gauge Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Sentiment
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="11" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="11"
                  strokeDasharray={`${((sentIndex + 10) / 20) * C} ${C}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-bold text-slate-800 tracking-tight">+{sentIndex}</div>
                <div className="text-[11px] text-slate-400">index</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600 tracking-tight">+{sentChange}</div>
                <div className="text-[11px] text-slate-400">change ↗</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 bg-slate-100 rounded-full relative overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-[25.5%] bg-emerald-500 rounded-full" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>-10</span>
              <span>0</span>
              <span>+10</span>
            </div>
          </div>
        </div>

        {/* Location Insights Mini Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Location Insights
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="relative h-36 rounded-lg bg-gradient-to-b from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center border border-slate-200/60">
            {/* Geo Bubbles Preview */}
            <div className="absolute left-[22%] top-[42%] w-6 h-6 rounded-full bg-blue-500/50 border border-blue-300" />
            <div className="absolute left-[45%] top-[30%] w-4 h-4 rounded-full bg-blue-500/50 border border-blue-300" />
            <div className="absolute left-[52%] top-[20%] w-4 h-4 rounded-full bg-blue-500/50 border border-blue-300" />
            <div className="absolute left-[68%] top-[52%] w-3 h-3 rounded-full bg-blue-500/50 border border-blue-300" />
            <div className="absolute left-[32%] top-[70%] w-2.5 h-2.5 rounded-full bg-blue-500/50 border border-blue-300" />
          </div>
        </div>

        {/* Authors by Source Donut Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Authors by Source
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
                {authorDonut.map((a, i) => (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={a.color}
                    strokeWidth="13"
                    strokeDasharray={a.dash}
                    strokeDashoffset={a.offset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">
                {(totalAuthorsCount / 1000).toFixed(1)}k
              </div>
            </div>

            <div className="flex-1 space-y-1">
              {authorDonut.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: a.color }} />
                  <span className="flex-1 text-slate-600 truncate">{a.name}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-3">{totalAuthorsCount.toLocaleString()} total authors</div>
        </div>
      </div>

      {/* MIDDLE COLUMN */}
      <div className="lg:col-span-6 space-y-4">
        {/* Volume Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Volume Trend
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex gap-4 text-xs mb-3">
            {(['Volume', 'Average'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setVolTab(mode)}
                className={`pb-1.5 border-b-2 font-medium transition-colors ${
                  volTab === mode
                    ? 'border-slate-800 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="h-60 w-full relative">
            <svg viewBox="0 0 900 260" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="65" x2="900" y2="65" stroke="#F1F5F9" />
              <line x1="0" y1="130" x2="900" y2="130" stroke="#F1F5F9" />
              <line x1="0" y1="195" x2="900" y2="195" stroke="#F1F5F9" />
              <path d={areaPath} fill="url(#volumeGrad)" />
              <polyline points={linePoints} fill="none" stroke="#334155" strokeWidth="2.5" />
            </svg>
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
            <span>1</span>
            <span>8</span>
            <span>15</span>
            <span>22</span>
            <span>30</span>
          </div>
        </div>

        {/* Sources & Authors Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sources List */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sources Breakdown
              </span>
              <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
            </div>

            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((s.count / maxSrcCount) * 100)}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums w-10 text-right">
                    {s.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Authors List */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Top Authors
              </span>
              <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
            </div>

            <div className="space-y-2.5">
              {authors.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0"
                    style={{ backgroundColor: a.avatarBg }}
                  >
                    {a.initials}
                  </div>
                  <span className="flex-1 text-slate-700 truncate font-medium">{a.name}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-3 space-y-4">
        {/* Phrases Word Cloud */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Phrases Cloud
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="flex flex-wrap gap-2 items-baseline">
            {PHRASE_WORDS.map((text, i) => {
              const fontSize = `${30 - i * 1.3}px`;
              const colors = ['#10243E', '#2563EB', '#64748B'];
              const color = colors[i % 3];

              return (
                <span
                  key={text}
                  style={{ fontSize, color }}
                  className="font-medium cursor-pointer hover:opacity-80 transition-opacity leading-tight"
                >
                  {text}
                </span>
              );
            })}
          </div>
        </div>

        {/* Search Topic Share Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Topic Share
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="text-xs text-slate-500 mb-3">96.7% of posts in dataset</div>

          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-16 h-16 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="13" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1B2A41"
                  strokeWidth="13"
                  strokeDasharray={`${0.967 * C} ${C}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">96.7%</div>
              <div className="text-[11px] text-slate-400">SocialEngage · AI · ADPA</div>
            </div>
          </div>
        </div>

        {/* Languages Breakdown Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Languages
            </span>
            <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>

          <div className="space-y-3">
            {languages.map((l) => (
              <div key={l.name} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-slate-600 font-medium">{l.name}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{ width: `${Math.round((l.count / maxLangCount) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right font-semibold text-slate-800 tabular-nums">
                  {l.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
