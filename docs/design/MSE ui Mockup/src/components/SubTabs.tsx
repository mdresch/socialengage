import React from 'react';
import { FileText, Download } from 'lucide-react';
import { ScreenType } from '../types';

interface SubTabsProps {
  activeScreen: ScreenType;
  setScreen: (s: ScreenType) => void;
  postsOpen: boolean;
  togglePosts: () => void;
  onOpenExport: () => void;
}

const TABS: { key: ScreenType; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'location', label: 'Location' },
  { key: 'sources', label: 'Sources' },
];

export const SubTabs: React.FC<SubTabsProps> = ({
  activeScreen,
  setScreen,
  postsOpen,
  togglePosts,
  onOpenExport,
}) => {
  return (
    <div className="h-12 bg-white border-b border-slate-200 flex items-stretch justify-between px-6 gap-2 select-none">
      {/* Sub Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const isActive = activeScreen === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setScreen(tab.key)}
              className={`flex items-center h-full px-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-[#10243E] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Pane and Export Controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={togglePosts}
          className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            postsOpen
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Posts pane</span>
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
