"use client";

import React, { useState } from "react";

export interface VelocityMilestone {
  phase: string;
  name: string;
  cumulativeStories: number;
  totalPhaseStories: number;
  status: "Completed" | "Current" | "Planned";
}

export const MILESTONES: VelocityMilestone[] = [
  { phase: "Phase 0", name: "Spike & Foundation", cumulativeStories: 8, totalPhaseStories: 8, status: "Completed" },
  { phase: "Phase 1", name: "Security & Multi-Tenancy", cumulativeStories: 34, totalPhaseStories: 26, status: "Completed" },
  { phase: "Phase 2", name: "Connectors & Ingestion", cumulativeStories: 82, totalPhaseStories: 48, status: "Completed" },
  { phase: "Phase 3", name: "Data Architecture & Topics", cumulativeStories: 138, totalPhaseStories: 56, status: "Completed" },
  { phase: "Phase 4", name: "Analytics & Governance", cumulativeStories: 192, totalPhaseStories: 54, status: "Current" },
  { phase: "Phase 4.5", name: "Scale-Out & AI Enhancements", cumulativeStories: 206, totalPhaseStories: 14, status: "Planned" },
];

export function VelocityAreaChart() {
  const [activeIdx, setActiveIdx] = useState<number | null>(4); // Default to current phase

  const width = 640;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;

  const maxStories = 220;

  const points = MILESTONES.map((m, idx) => {
    const x = paddingX + (idx / (MILESTONES.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (m.cumulativeStories / maxStories) * (height - 2 * paddingY);
    return { x, y, ...m };
  });

  // Construct SVG path string with smooth curves
  const linePath = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
  }, "");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const activeMilestone = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
          <defs>
            <linearGradient id="velocityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={paddingX} y1={height - paddingY - 50} x2={width - paddingX} y2={height - paddingY - 50} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
          <line x1={paddingX} y1={height - paddingY - 100} x2={width - paddingX} y2={height - paddingY - 100} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />

          {/* Shaded Area */}
          <path d={areaPath} fill="url(#velocityGrad)" />

          {/* Line Path */}
          <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isSelected = activeIdx === idx;
            const isCompleted = pt.status === "Completed";

            return (
              <g key={pt.phase} className="cursor-pointer" onClick={() => setActiveIdx(idx)}>
                {/* Outer halo */}
                {isSelected && (
                  <circle cx={pt.x} cy={pt.y} r="10" fill="#bfdbfe" opacity="0.6" className="animate-pulse" />
                )}
                {/* Core Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? "6" : "4.5"}
                  fill={isCompleted ? "#10b981" : isSelected ? "#2563eb" : "#94a3b8"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
                {/* Phase label */}
                <text
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${isSelected ? "fill-blue-600 font-bold" : "fill-slate-500"}`}
                >
                  {pt.phase}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Milestone Tooltip Card */}
      {activeMilestone && (
        <div className="mt-2 w-full flex items-center justify-between p-2.5 rounded-lg border border-blue-100 bg-blue-50/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">{activeMilestone.phase}: {activeMilestone.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              activeMilestone.status === "Completed"
                ? "bg-emerald-100 text-emerald-800"
                : activeMilestone.status === "Current"
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600"
            }`}>
              {activeMilestone.status}
            </span>
          </div>
          <div className="font-mono text-slate-700 font-medium">
            <span>{activeMilestone.cumulativeStories} cumulative stories</span>
            <span className="text-slate-400 mx-1">·</span>
            <span>+{activeMilestone.totalPhaseStories} this phase</span>
          </div>
        </div>
      )}
    </div>
  );
}

