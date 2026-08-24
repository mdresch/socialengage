"use client";

import React, { useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  onSelectSegment?: (label: string | null) => void;
  selectedSegment?: string | null;
}

export function DonutChart({
  data,
  size = 220,
  thickness = 32,
  centerTitle,
  centerSubtitle,
  onSelectSegment,
  selectedSegment,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;
  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    const startAngle = cumulativeAngle * 360;
    cumulativeAngle += percentage;

    const isHovered = hoveredIndex === index;
    const isSelected = selectedSegment === item.label;

    return {
      ...item,
      percentage: Math.round(percentage * 1000) / 10,
      strokeDasharray,
      strokeDashoffset,
      startAngle,
      isHovered,
      isSelected,
      index,
    };
  });

  const activeSegment =
    hoveredIndex !== null
      ? segments[hoveredIndex]
      : selectedSegment
      ? segments.find((s) => s.label === selectedSegment)
      : null;

  const displayTitle = activeSegment
    ? activeSegment.formattedValue || activeSegment.value.toLocaleString()
    : centerTitle || total.toLocaleString();

  const displaySubtitle = activeSegment
    ? `${activeSegment.label} (${activeSegment.percentage}%)`
    : centerSubtitle || "Total";

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-2 w-full">
      {/* SVG Donut */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 transition-all duration-300"
        >
          {/* Background Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={thickness}
            fill="transparent"
          />

          {/* Segments */}
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={seg.isHovered || seg.isSelected ? thickness + 4 : thickness}
              fill="transparent"
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              className="transition-all duration-300 cursor-pointer"
              style={{
                opacity:
                  hoveredIndex !== null && !seg.isHovered && !seg.isSelected
                    ? 0.45
                    : 1,
              }}
              onMouseEnter={() => setHoveredIndex(seg.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                if (onSelectSegment) {
                  onSelectSegment(
                    selectedSegment === seg.label ? null : seg.label
                  );
                }
              }}
            />
          ))}
        </svg>

        {/* Center Text Drilldown */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
          <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {displayTitle}
          </span>
          <span className="text-[11px] font-medium text-slate-500 max-w-[130px] truncate mt-0.5">
            {displaySubtitle}
          </span>
        </div>
      </div>

      {/* Legend & Percentages List */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {segments.map((seg) => {
          const isHighlight =
            hoveredIndex === seg.index || selectedSegment === seg.label;
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredIndex(seg.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                if (onSelectSegment) {
                  onSelectSegment(
                    selectedSegment === seg.label ? null : seg.label
                  );
                }
              }}
              className={`flex items-center justify-between p-1.5 px-2 rounded-md text-xs cursor-pointer transition-all ${
                isHighlight
                  ? "bg-slate-100 font-semibold shadow-xs"
                  : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate text-slate-800">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-slate-500">
                <span>{seg.formattedValue || seg.value}</span>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-200/60 px-1 py-0.2 rounded">
                  {seg.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
