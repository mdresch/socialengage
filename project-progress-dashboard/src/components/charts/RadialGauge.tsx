"use client";

import React, { useEffect, useState } from "react";

export interface RadialGaugeProps {
  value: number;
  max?: number;
  title: string;
  subtitle?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

export function RadialGauge({
  value,
  max = 100,
  title,
  subtitle,
  size = 180,
  strokeWidth = 14,
  color = "#2563eb",
  trackColor = "#e2e8f0",
}: RadialGaugeProps) {
  const [animatedVal, setAnimatedVal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedVal(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(100, Math.max(0, (animatedVal / max) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id={`gauge-grad-${title.replace(/\s+/g, "")}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
          />
          {/* Animated Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#gauge-grad-${title.replace(/\s+/g, "")})`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
            {Math.round(animatedVal)}%
          </span>
          {subtitle && (
            <span className="text-[11px] font-medium text-slate-500 max-w-[100px] truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold text-slate-800 text-center">
        {title}
      </span>
    </div>
  );
}

