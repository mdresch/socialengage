import React from 'react';
import { SourceItem } from '../../types';

interface SourcesViewProps {
  sources: SourceItem[];
}

export const SourcesView: React.FC<SourcesViewProps> = ({ sources }) => {
  const shareTotal = sources.reduce((a, s) => a + s.count, 0) || 1;

  return (
    <div className="space-y-4">
      {/* Source Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((s) => {
          const sharePct = `${Math.round((s.count / shareTotal) * 100)}%`;
          const indexVal = s.index ?? 30;

          return (
            <div
              key={s.name}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: s.color }}
                >
                  {s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-400">{sharePct} share of voice</div>
                </div>
                <div
                  className={`text-xs font-semibold ${
                    (s.trend || '').startsWith('−') ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {s.trend || '+12%'}
                </div>
              </div>

              {/* Sparkline simulation */}
              <div className="flex items-end gap-1 h-12">
                {Array.from({ length: 14 }, (_, i) => {
                  const height = `${25 + Math.abs(Math.sin(i / 2 + s.count / 900)) * 70}%`;
                  const isLast = i === 13;
                  return (
                    <div
                      key={i}
                      style={{
                        height,
                        backgroundColor: isLast ? s.color : '#DBEAFE',
                      }}
                      className="flex-1 rounded-t-xs"
                    />
                  );
                })}
              </div>

              {/* Metric stats */}
              <div className="flex justify-between border-t border-slate-100 pt-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Posts
                  </div>
                  <div className="text-base font-semibold text-slate-800 tabular-nums">
                    {s.count.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Authors
                  </div>
                  <div className="text-base font-semibold text-slate-800 tabular-nums">
                    {(s.authors ?? Math.round(s.count * 0.4)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Index
                  </div>
                  <div
                    className={`text-base font-semibold tabular-nums ${
                      indexVal > 30 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    +{indexVal}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 text-sm font-semibold text-slate-800">
          Source detail
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">Source</th>
                <th className="py-3 px-5 text-right">Posts</th>
                <th className="py-3 px-5 text-right">Authors</th>
                <th className="py-3 px-5 text-right">Reach</th>
                <th className="py-3 px-5 text-right">Index</th>
                <th className="py-3 px-5 pl-8">Sentiment Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5 font-medium text-slate-800 flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </td>
                  <td className="py-3.5 px-5 text-right tabular-nums text-slate-700">
                    {s.count.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right tabular-nums text-slate-600">
                    {(s.authors ?? Math.round(s.count * 0.4)).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right tabular-nums text-slate-600">
                    {s.reach ?? '1.2M'}
                  </td>
                  <td className="py-3.5 px-5 text-right tabular-nums font-semibold text-emerald-700">
                    +{s.index ?? 30}
                  </td>
                  <td className="py-3.5 px-5 pl-8">
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 w-36">
                      <div className="bg-emerald-500" style={{ width: `${s.pos ?? 50}%` }} />
                      <div className="bg-slate-300" style={{ width: `${s.neu ?? 30}%` }} />
                      <div className="bg-red-500" style={{ width: `${s.neg ?? 20}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
