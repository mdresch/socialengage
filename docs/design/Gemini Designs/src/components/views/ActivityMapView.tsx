import React, { useState } from 'react';
import { GEO_LOCATIONS } from '../../data/mockData';

interface ActivityMapViewProps {
  activeLabel: string;
}

export const ActivityMapView: React.FC<ActivityMapViewProps> = ({ activeLabel }) => {
  const [mapMode, setMapMode] = useState<'Volume' | 'Sentiment' | 'Reach'>('Volume');
  const [selectedRegion, setSelectedRegion] = useState<string>('United States');

  const maxV = Math.max(...GEO_LOCATIONS.map((g) => g.v));
  const currentGeo = GEO_LOCATIONS.find((g) => g.name === selectedRegion) || GEO_LOCATIONS[0];

  return (
    <div className="relative h-[740px] rounded-2xl overflow-hidden bg-[#0B1B2E] border border-slate-800 shadow-2xl">
      {/* Background Gradient */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `radial-gradient(120% 120% at 50% 20%, #16304F 0%, #0B1B2E 70%)`,
        }}
      />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top Header */}
      <div className="absolute top-6 left-6 text-blue-100 z-10">
        <h2 className="text-lg font-semibold tracking-tight">Live activity map</h2>
        <p className="text-xs text-blue-200/60 mt-0.5">
          {activeLabel} · mode: {mapMode} · updates every 30s
        </p>
      </div>

      {/* Mode Toggles */}
      <div className="absolute top-6 right-6 flex gap-2 z-10">
        {(['Volume', 'Sentiment', 'Reach'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMapMode(mode)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              mapMode === mode
                ? 'bg-blue-500/30 border-blue-400 text-blue-100 shadow-lg'
                : 'bg-white/5 border-white/20 text-blue-200/70 hover:bg-white/10'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Map Interactive Regional Bubbles */}
      {GEO_LOCATIONS.map((g) => {
        const size = 26 + Math.round(Math.sqrt(g.v / maxV) * 64);
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
            className="absolute flex flex-col items-center gap-1 group z-20 cursor-pointer transition-transform hover:scale-110"
          >
            <div
              style={{ width: `${size}px`, height: `${size}px` }}
              className={`rounded-full border-2 transition-all ${
                isSelected
                  ? 'bg-blue-400/60 border-blue-200 shadow-[0_0_30px_rgba(147,197,253,.9)]'
                  : 'bg-blue-600/40 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,.5)] hover:bg-blue-500/50'
              }`}
            />
            <span className="text-xs font-semibold text-blue-100 whitespace-nowrap drop-shadow">
              {g.name}
            </span>
          </button>
        );
      })}

      {/* Legend */}
      <div className="absolute left-6 bottom-6 flex items-center gap-4 text-blue-200/80 text-xs z-10">
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

      {/* Region Panel */}
      <div className="absolute right-6 bottom-6 bg-[#0B1B2E]/80 border border-white/15 backdrop-blur-md rounded-xl p-4 min-w-[220px] text-xs text-blue-100 space-y-2 z-10 shadow-2xl">
        <div className="font-semibold text-sm text-blue-50">{selectedRegion}</div>
        <div className="space-y-1 divide-y divide-white/10">
          <div className="pt-1 flex justify-between">
            <span className="text-blue-200/70">Volume</span>
            <span className="font-semibold text-white">{currentGeo.v.toLocaleString()}</span>
          </div>
          <div className="pt-1 flex justify-between">
            <span className="text-blue-200/70">Share</span>
            <span className="font-semibold text-white">
              {Math.round((currentGeo.v / 9240) * 100)}%
            </span>
          </div>
          <div className="pt-1 flex justify-between">
            <span className="text-blue-200/70">Index</span>
            <span className="font-semibold text-emerald-400">
              +{28 + (currentGeo.name.length % 17)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
