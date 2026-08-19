import React from 'react';

interface TooltipItem {
  name: string;
  value: string | number;
  color?: string;
  badge?: string;
  badgeColor?: string;
}

interface AnimatedChartTooltipProps {
  active?: boolean;
  title?: string;
  items?: TooltipItem[];
}

export const AnimatedChartTooltip: React.FC<AnimatedChartTooltipProps> = ({
  active,
  title,
  items,
}) => {
  if (!active || !items || items.length === 0) return null;

  return (
    <div className="bg-slate-900/95 text-white p-3 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs min-w-[200px] select-none rounded-none">
      {title && (
        <div className="font-semibold text-slate-100 border-b border-slate-700/80 pb-1.5 mb-2 uppercase tracking-wider text-[10px]">
          {title}
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-slate-300">
                {item.color && (
                  <span
                    className="w-2 h-2 shrink-0 inline-block"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span>{item.name}:</span>
              </div>
              <span className="font-mono font-bold text-white text-[11px]">
                {item.value}
              </span>
            </div>
            {item.badge && (
              <div className="flex justify-end mt-0.5">
                <span
                  className={`text-[8px] font-semibold px-1 py-0.5 rounded-none border uppercase tracking-wider ${
                    item.badgeColor ||
                    'bg-sky-500/20 text-sky-300 border-sky-500/20'
                  }`}
                >
                  {item.badge}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
