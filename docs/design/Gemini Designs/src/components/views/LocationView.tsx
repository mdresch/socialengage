import React, { useState } from 'react';
import { GeoLocationItem } from '../../types';

interface LocationViewProps {
  locations: GeoLocationItem[];
  activeLabel: string;
}

export const LocationView: React.FC<LocationViewProps> = ({ locations, activeLabel }) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('United States');

  const maxV = Math.max(...locations.map((g) => g.v)) || 1;
  const currentGeo = locations.find((g) => g.name === selectedRegion) || locations[0];

  const regionStats = [
    { label: 'Posts', value: currentGeo.v.toLocaleString(), color: 'text-slate-800' },
    { label: 'Share of total buzz', value: `${Math.round((currentGeo.v / 9240) * 100)}%`, color: 'text-slate-800' },
    { label: 'Sentiment index', value: `+${28 + (currentGeo.name.length % 17)}`, color: 'text-emerald-600' },
    { label: 'Top source', value: currentGeo.v > 1000 ? 'Twitter/X' : 'LinkedIn', color: 'text-slate-800' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Map Canvas */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-800">Buzz by location</span>
          <span className="text-xs text-slate-400">
            Bubble size = post volume · {activeLabel}
          </span>
        </div>

        {/* Map Dark Stage */}
        <div className="relative h-[540px] rounded-lg overflow-hidden bg-[#0B1B2E] border border-slate-800">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage: `radial-gradient(120% 120% at 50% 20%, #16304F 0%, #0B1B2E 70%)`,
            }}
          />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Geo Bubbles */}
          {locations.map((g) => {
            const size = 22 + Math.round(Math.sqrt(g.v / maxV) * 62);
            const isSelected = selectedRegion === g.name;

            return (
              <button
                key={g.name}
                onClick={() => setSelectedRegion(g.name)}
                style={{
                  left: `${g.x}%`,
                  top: `${g.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute flex flex-col items-center gap-1 group z-10 transition-transform hover:scale-110"
              >
                <div
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                  }}
                  className={`rounded-full transition-all border-2 ${
                    isSelected
                      ? 'bg-blue-400/60 border-blue-200 shadow-[0_0_26px_rgba(147,197,253,.8)]'
                      : 'bg-blue-600/40 border-blue-400 shadow-[0_0_16px_rgba(37,99,235,.4)] hover:bg-blue-500/50'
                  }`}
                />
                <span className="text-xs font-semibold text-blue-100 whitespace-nowrap drop-shadow">
                  {g.name}
                </span>
              </button>
            );
          })}

          {/* Legend */}
          <div className="absolute left-4 bottom-4 flex items-center gap-3 text-blue-200/80 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/50 border border-blue-400" /> Low
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-500/50 border border-blue-400" /> Medium
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-blue-500/50 border border-blue-400" /> High
            </div>
          </div>
        </div>
      </div>

      {/* Right Region Info Panel */}
      <div className="lg:col-span-4 space-y-4">
        {/* Top Regions List */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-800 mb-4">Top regions</div>
          <div className="space-y-3">
            {locations.map((r) => {
              const isSelected = selectedRegion === r.name;
              return (
                <div
                  key={r.name}
                  onClick={() => setSelectedRegion(r.name)}
                  className="cursor-pointer group"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span
                      className={`font-medium transition-colors ${
                        isSelected ? 'text-blue-600 font-bold' : 'text-slate-700 group-hover:text-blue-600'
                      }`}
                    >
                      {r.name}
                    </span>
                    <span className="text-slate-500 tabular-nums">{r.v.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isSelected ? 'bg-blue-600' : 'bg-blue-300'
                      }`}
                      style={{ width: `${Math.round((r.v / maxV) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Region Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-base font-semibold text-slate-800">{selectedRegion}</div>
          <div className="text-xs text-slate-400 mb-4">Regional breakdown</div>

          <div className="space-y-3 divide-y divide-slate-100">
            {regionStats.map((stat) => (
              <div key={stat.label} className="pt-2 flex justify-between text-xs">
                <span className="text-slate-500">{stat.label}</span>
                <span className={`font-semibold tabular-nums ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
