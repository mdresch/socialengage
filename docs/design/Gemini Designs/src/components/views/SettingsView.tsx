import React, { useState } from 'react';
import { Check, Plus, UserPlus } from 'lucide-react';
import { ProfileItem } from '../../types';
import { PROFILES, ADDABLE_SOURCES } from '../../data/mockData';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Social Profiles');
  const [profiles, setProfiles] = useState<ProfileItem[]>(PROFILES);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    'Email notifications': true,
    'Auto-refresh dashboards': true,
    'Auto-tag negative posts': true,
    'Auto-assign EU mentions': true,
  });

  const SETTINGS_TABS = [
    'Social Profiles',
    'Personal Settings',
    'Global Settings',
    'Users',
    'Connections',
    'Automation Rules',
  ];

  const handleConnectSource = (sourceName: string) => {
    const newProf: ProfileItem = {
      name: `SocialEngage ${sourceName}`,
      handle: `@socialengage_${sourceName.toLowerCase()}`,
      source: sourceName,
      color: '#2563EB',
      initial: sourceName[0],
      status: 'Connected',
      statusBg: '#ECFDF5',
      statusFg: '#047857',
    };
    setProfiles((prev) => [...prev, newProf]);
  };

  const handleToggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left Menu Sidebar */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1 shadow-sm">
        {SETTINGS_TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Main Settings Panel */}
      <div className="lg:col-span-9">
        {activeTab === 'Social Profiles' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Connected Profiles */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
                Connected Social Profiles
              </div>
              <div className="divide-y divide-slate-100">
                {profiles.map((p, idx) => (
                  <div key={idx} className="p-4 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center text-xs flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.handle} · {p.source}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: p.statusBg, color: p.statusFg }}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Profile */}
            <div className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="text-sm font-semibold text-slate-800">Add Profile</div>
              <p className="text-xs text-slate-400">
                Connect an account to publish and reply directly
              </p>

              <div className="space-y-2">
                {ADDABLE_SOURCES.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-lg text-white font-bold flex items-center justify-center text-xs flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.initial}
                    </div>
                    <span className="flex-1 text-xs font-medium text-slate-800">{s.name}</span>
                    <button
                      onClick={() => handleConnectSource(s.name)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* General Settings Rows */
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">{activeTab}</h2>

            <div className="divide-y divide-slate-100">
              {[
                { label: 'Email notifications', sub: 'Daily digest of mentions and sentiment spikes' },
                { label: 'Auto-refresh dashboards', sub: 'Refresh live streams every 30 seconds' },
                { label: 'Auto-tag negative posts', sub: 'Applies "Needs response" tag automatically' },
                { label: 'Auto-assign EU mentions', sub: 'Routes European timezone posts to regional team' },
              ].map((row) => {
                const isChecked = toggles[row.label] ?? false;

                return (
                  <div key={row.label} className="py-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{row.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{row.sub}</div>
                    </div>

                    <button
                      onClick={() => handleToggle(row.label)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        isChecked ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${
                          isChecked ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
