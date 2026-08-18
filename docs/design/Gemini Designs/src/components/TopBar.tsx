import React, { useState } from 'react';
import { Menu, ChevronDown, Calendar, Bell, LogOut, Settings, User } from 'lucide-react';
import { ScreenType, AuthViewType } from '../types';

interface TopBarProps {
  screenTitle: string;
  topic: string;
  setTopic: (t: string) => void;
  dateRange: string;
  setDateRange: (d: string) => void;
  toggleNav: () => void;
  setAuthView: (view: AuthViewType) => void;
  unreadCount: number;
}

const TOPICS_LIST = [
  'SocialEngage · AI · ADPA',
  'Competitor watch',
  'Brand mentions — EU',
  'Product launch buzz',
];

const DATE_RANGES = [
  'Last 30 days',
  'Last 14 days',
  'Last 7 days',
  'Yesterday',
  'Today',
];

export const TopBar: React.FC<TopBarProps> = ({
  screenTitle,
  topic,
  setTopic,
  dateRange,
  setDateRange,
  toggleNav,
  setAuthView,
  unreadCount,
}) => {
  const [topicOpen, setTopicOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="h-14 bg-[#10243E] text-white flex items-center justify-between px-5 gap-4 relative z-40 select-none shadow-md">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleNav}
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/10 transition-colors p-1"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-sm shadow">
            S
          </div>
          <span className="font-semibold text-base tracking-tight hidden sm:inline">SocialEngage</span>
          <div className="w-px h-5 bg-white/20 mx-1 hidden sm:block" />
          <span className="text-sm font-medium opacity-90 truncate max-w-[140px] md:max-w-none">{screenTitle}</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search topic picker */}
        <div className="relative">
          <button
            onClick={() => {
              setTopicOpen(!topicOpen);
              setDateOpen(false);
              setBellOpen(false);
              setUserMenuOpen(false);
            }}
            className="hidden md:flex items-center gap-2 bg-white/10 border border-white/15 rounded-md px-3 py-1.5 text-xs text-left hover:bg-white/15 transition-colors min-w-[220px]"
          >
            <span className="uppercase tracking-wider text-[10px] opacity-60">Topic</span>
            <span className="font-semibold text-sm truncate flex-1">{topic}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {topicOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Topic</div>
              {TOPICS_LIST.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTopic(t);
                    setTopicOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                    t === topic ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range picker */}
        <div className="relative">
          <button
            onClick={() => {
              setDateOpen(!dateOpen);
              setTopicOpen(false);
              setBellOpen(false);
              setUserMenuOpen(false);
            }}
            className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-white/15 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 opacity-80" />
            <span className="hidden xs:inline">{dateRange}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {dateOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date Filter</div>
              {DATE_RANGES.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDateRange(d);
                    setDateOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                    d === dateRange ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bell Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setBellOpen(!bellOpen);
              setTopicOpen(false);
              setDateOpen(false);
              setUserMenuOpen(false);
            }}
            className="relative w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-semibold text-xs text-slate-800">Notifications</span>
                <span className="text-[11px] text-blue-600 font-medium cursor-pointer">Mark all read</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div className="p-2 bg-red-50 rounded-lg border border-red-100 text-xs">
                  <div className="font-semibold text-red-800">Spike in negative sentiment</div>
                  <div className="text-[11px] text-red-600 mt-0.5">Onboarding friction mentions up 41%</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">14m ago</span>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs">
                  <div className="font-semibold text-blue-900">New high-influence author</div>
                  <div className="text-[11px] text-blue-700 mt-0.5">@techledger posted about SocialEngage</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">1h ago</span>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-xs">
                  <div className="font-semibold text-amber-900">Volume threshold reached</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">SocialEngage crossed 9,000 posts</div>
                  <span className="text-[10px] text-slate-400 mt-1 block">3h ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User avatar menu */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setTopicOpen(false);
              setDateOpen(false);
              setBellOpen(false);
            }}
            className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-xs cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
          >
            MK
          </button>

          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="font-semibold text-xs text-slate-800">Mia Kessler</div>
                <div className="text-[11px] text-slate-400 truncate">mia.kessler@adpa.io</div>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                Account settings
              </button>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setAuthView('login');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-red-50 flex items-center gap-2 text-red-600 font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
