"use client";

import React, { useState } from "react";

export interface StackedBarItem {
  id: string;
  label: string;
  built: number;
  pending: number;
  total: number;
  progressPct: number;
}

export interface StackedBarChartProps {
  data: StackedBarItem[];
  onSelectEpic?: (id: string) => void;
  selectedEpicId?: string;
}

export function StackedBarChart({
  data,
  onSelectEpic,
  selectedEpicId,
}: StackedBarChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const isHovered = hoveredId === item.id;
        const isSelected = selectedEpicId === item.id;
        const builtPct = (item.built / item.total) * 100;
        const pendingPct = (item.pending / item.total) * 100;

        return (
          <div
            key={item.id}
            onClick={() => onSelectEpic && onSelectEpic(item.id)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
              isSelected
                ? "border-blue-500 bg-blue-50/50 shadow-sm"
                : isHovered
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200/80 bg-white"
            }`}
          >
            {/* Header with Title and Metrics */}
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{item.label}</span>
                <span className="text-[11px] font-mono text-slate-400">({item.total} stories)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-emerald-600 font-medium">
                  {item.built} built
                </span>
                {item.pending > 0 && (
                  <span className="font-mono text-amber-600 font-medium">
                    {item.pending} pending
                  </span>
                )}
                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                  {item.progressPct}%
                </span>
              </div>
            </div>

            {/* Stacked Progress Bar */}
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div
                style={{ width: `${builtPct}%` }}
                className="bg-emerald-500 transition-all duration-500 relative group"
                title={`${item.built} stories implemented`}
              />
              {item.pending > 0 && (
                <div
                  style={{ width: `${pendingPct}%` }}
                  className="bg-amber-400 transition-all duration-500"
                  title={`${item.pending} stories pending`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

