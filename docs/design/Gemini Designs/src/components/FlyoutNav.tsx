import React from 'react';
import { BarChart3, MessageSquare, MapPin, Search, Bell, Settings, Lock } from 'lucide-react';
import { ScreenType, AuthViewType } from '../types';

interface FlyoutNavProps {
  navOpen: boolean;
  toggleNav: () => void;
  activeScreen: ScreenType;
  setScreen: (screen: ScreenType) => void;
  setAuthView: (view: AuthViewType) => void;
}

export const FlyoutNav: React.FC<FlyoutNavProps> = ({
  navOpen,
  toggleNav,
  activeScreen,
  setScreen,
  setAuthView,
}) => {
  if (!navOpen) return null;

  const NAV_ITEMS = [
    { key: 'overview' as ScreenType, label: 'Analytics', icon: BarChart3 },
    { key: 'social-center' as ScreenType, label: 'Social Center', icon: MessageSquare },
    { key: 'activity-map' as ScreenType, label: 'Activity Map', icon: MapPin },
    { key: 'search-setup' as ScreenType, label: 'Search Setup', icon: Search },
    { key: 'alerts' as ScreenType, label: 'Alerts', icon: Bell },
    { key: 'settings' as ScreenType, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={toggleNav}
        className="fixed inset-0 top-14 bg-slate-900/40 backdrop-blur-sm z-30 transition-opacity"
      />

      {/* Drawer */}
      <aside className="fixed top-14 left-0 bottom-0 w-72 bg-[#0B1B2E] text-white z-40 py-5 flex flex-col justify-between shadow-2xl border-r border-slate-800 animate-in slide-in-from-left duration-200">
        <div className="space-y-1">
          <div className="px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected =
              activeScreen === item.key ||
              (item.key === 'overview' &&
                ['overview', 'conversations', 'sentiment', 'location', 'sources'].includes(activeScreen));

            return (
              <button
                key={item.key}
                onClick={() => {
                  setScreen(item.key);
                  toggleNav();
                }}
                className={`w-full flex items-center gap-3.5 px-6 py-3 text-sm transition-all text-left border-l-4 ${
                  isSelected
                    ? 'bg-blue-600/25 border-blue-500 font-semibold text-white'
                    : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 opacity-90" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 px-6">
            <div className="h-px bg-white/10 my-2" />
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
              Auth Preview
            </div>
            <button
              onClick={() => {
                setAuthView('login');
                toggleNav();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md text-slate-300 hover:bg-white/5 transition-colors"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Test Sign In / Sign Up Flow</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 space-y-2 border-t border-white/10 pt-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Adaptive Digital Processing Analytics
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Tenant: <span className="text-slate-200 font-medium">ADPA Production</span>
            <br />
            Data refreshed 4 min ago
          </div>
        </div>
      </aside>
    </>
  );
};
