import React, { useState } from 'react';
import { AlertItem } from '../../types';
import { ALERTS } from '../../data/mockData';

export const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>(ALERTS);
  const [ruleToggles, setRuleToggles] = useState<Record<string, boolean>>({
    'Negative sentiment spike': true,
    'Volume threshold': true,
    'High-influence author mention': true,
    'Competitor comparison': false,
  });

  const handleToggleRule = (key: string) => {
    setRuleToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Alert Feed */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
          Recent Alerts
        </div>

        <div className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <div key={a.id} className="p-4 flex gap-3.5 hover:bg-slate-50 transition-colors">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800">{a.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.detail}</div>
              </div>
              <span className="text-[11px] text-slate-400 flex-shrink-0">{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Rules */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="font-semibold text-sm text-slate-800">Alert Rules</div>

        <div className="space-y-3 divide-y divide-slate-100">
          {[
            'Negative sentiment spike',
            'Volume threshold',
            'High-influence author mention',
            'Competitor comparison',
          ].map((rule) => {
            const isChecked = ruleToggles[rule] ?? false;

            return (
              <div key={rule} className="pt-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{rule}</span>
                <button
                  onClick={() => handleToggleRule(rule)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${
                    isChecked ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${
                      isChecked ? 'left-4.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
