import React from 'react';
import { SourceItem, SentimentType } from '../types';

interface FilterBarProps {
  sources: SourceItem[];
  activeSources: string[];
  toggleSource: (name: string) => void;
  activeSentiments: SentimentType[];
  toggleSentiment: (s: SentimentType) => void;
  clearFilters: () => void;
}

const ALL_SENTIMENTS: SentimentType[] = ['Positive', 'Neutral', 'Negative'];

export const FilterBar: React.FC<FilterBarProps> = ({
  sources,
  activeSources,
  toggleSource,
  activeSentiments,
  toggleSentiment,
  clearFilters,
}) => {
  const isFiltered = activeSources.length < sources.length || activeSentiments.length < ALL_SENTIMENTS.length;

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2.5 flex-wrap select-none text-xs">
      <span className="text-[11px] tracking-wider uppercase color-slate-500 font-bold text-slate-500 mr-1">
        Add filters
      </span>

      {/* Sources Chips */}
      {sources.map((s) => {
        const isActive = activeSources.includes(s.name);
        return (
          <button
            key={s.name}
            onClick={() => toggleSource(s.name)}
            className={`flex items-center gap-2 rounded-full px-3 py-1 font-medium border transition-all ${
              isActive
                ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span>{s.name}</span>
            <span className="opacity-60 tabular-nums">{s.count}</span>
          </button>
        );
      })}

      <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

      {/* Sentiment Chips */}
      {ALL_SENTIMENTS.map((sent) => {
        const isActive = activeSentiments.includes(sent);
        const styles = {
          Positive: isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60',
          Neutral: isActive ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60',
          Negative: isActive ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60',
        }[sent];

        return (
          <button
            key={sent}
            onClick={() => toggleSentiment(sent)}
            className={`border rounded-full px-3 py-1 font-medium transition-all ${styles}`}
          >
            {sent}
          </button>
        );
      })}

      <div className="flex-1" />

      {isFiltered && (
        <button
          onClick={clearFilters}
          className="text-blue-600 font-semibold hover:underline text-xs"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
};
