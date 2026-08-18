import React from 'react';

export const SentimentView: React.FC = () => {
  const SENT_CARDS = [
    { label: 'Positive', color: '#10B981', value: '5,359', pct: '58%', sub: '+4.2 pts vs. prior period' },
    { label: 'Neutral', color: '#94A3B8', value: '2,680', pct: '29%', sub: '−1.8 pts vs. prior period' },
    { label: 'Negative', color: '#EF4444', value: '1,201', pct: '13%', sub: '−2.4 pts vs. prior period' },
  ];

  const SENT_BARS = Array.from({ length: 22 }, (_, i) => {
    const p = 46 + Math.round(Math.sin(i / 3.1) * 9) + i * 0.5;
    const n = 22 - Math.round(Math.cos(i / 2.4) * 6) - i * 0.35;
    const u = 100 - p - n;
    return { pos: `${p.toFixed(1)}%`, neu: `${u.toFixed(1)}%`, neg: `${n.toFixed(1)}%` };
  });

  const SENT_SOURCES = [
    { name: 'Twitter/X', pos: '54%', neu: '30%', neg: '16%', index: '+38' },
    { name: 'LinkedIn', pos: '71%', neu: '24%', neg: '5%', index: '+66' },
    { name: 'News', pos: '49%', neu: '41%', neg: '10%', index: '+39' },
    { name: 'Blogs', pos: '66%', neu: '26%', neg: '8%', index: '+58' },
    { name: 'Forums', pos: '38%', neu: '39%', neg: '23%', index: '+15' },
    { name: 'YouTube', pos: '44%', neu: '28%', neg: '28%', index: '+16' },
  ];

  const PRAISE = [
    { text: 'accurate sentiment scoring', count: 412 },
    { text: 'fast setup', count: 288 },
    { text: 'clean analytics', count: 241 },
    { text: 'responsive support', count: 196 },
    { text: 'good value', count: 154 },
  ];

  const CRITICISM = [
    { text: 'profile auth timeouts', count: 187 },
    { text: 'alert config UI', count: 142 },
    { text: 'export limits', count: 118 },
    { text: 'mobile experience', count: 91 },
    { text: 'docs gaps', count: 64 },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SENT_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-t-4"
            style={{ borderTopColor: card.color }}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {card.label} posts
            </div>
            <div className="flex items-baseline gap-2.5 mt-2">
              <span className="text-3xl font-bold text-slate-800 tracking-tight">{card.value}</span>
              <span className="text-sm font-semibold" style={{ color: card.color }}>
                {card.pct}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Sentiment Over Time */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-800">Sentiment over time</span>
          <div className="flex gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Positive
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-400" /> Neutral
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-red-500" /> Negative
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-56">
          {SENT_BARS.map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <div className="bg-emerald-500 rounded-t" style={{ height: bar.pos }} />
              <div className="bg-slate-300" style={{ height: bar.neu }} />
              <div className="bg-red-500 rounded-b" style={{ height: bar.neg }} />
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>1 Jul</span>
          <span>8 Jul</span>
          <span>15 Jul</span>
          <span>22 Jul</span>
          <span>30 Jul</span>
        </div>
      </div>

      {/* Sentiment by Source & Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Source */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-800 mb-4">Sentiment by source</div>
          <div className="space-y-3.5">
            {SENT_SOURCES.map((src) => (
              <div key={src.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700">{src.name}</span>
                  <span className="text-slate-500 tabular-nums">index {src.index}</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: src.pos }} />
                  <div className="bg-slate-300" style={{ width: src.neu }} />
                  <div className="bg-red-500" style={{ width: src.neg }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Drivers */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-800 mb-4">Sentiment drivers</div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-3">
                Praise
              </div>
              <div className="space-y-2.5">
                {PRAISE.map((p) => (
                  <div key={p.text} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{p.text}</span>
                    <span className="text-slate-400 tabular-nums font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-3">
                Criticism
              </div>
              <div className="space-y-2.5">
                {CRITICISM.map((c) => (
                  <div key={c.text} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{c.text}</span>
                    <span className="text-slate-400 tabular-nums font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
