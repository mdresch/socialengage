import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface TooltipItem {
  name: string;
  value: string | number;
  color?: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
}

export interface AnimatedChartTooltipProps {
  active?: boolean;
  title?: string;
  subtitle?: string;
  items?: TooltipItem[];
  children?: React.ReactNode;
  className?: string;
}

export const AnimatedTooltipWrapper: React.FC<{
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ active, children, className = '' }) => {
  return (
    <AnimatePresence mode="wait">
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{
            type: 'spring',
            damping: 24,
            stiffness: 350,
            mass: 0.5,
          }}
          className={`pointer-events-none z-50 select-none ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const AnimatedChartTooltip: React.FC<AnimatedChartTooltipProps> = ({
  active,
  title,
  subtitle,
  items,
  children,
  className = '',
}) => {
  if (!active) return null;

  return (
    <AnimatedTooltipWrapper active={active}>
      <div
        className={`bg-slate-900/95 text-white p-3 rounded-none shadow-2xl border border-slate-700/80 backdrop-blur-md min-w-[170px] ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/80">
            <span className="font-semibold text-xs tracking-wide text-slate-100">{title}</span>
            {subtitle && <span className="text-[10px] text-slate-400 font-mono">{subtitle}</span>}
          </div>
        )}

        {children ? (
          children
        ) : (
          <div className="space-y-1.5 text-xs">
            {items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 truncate">
                  {item.color && (
                    <span
                      className="w-2 h-2 rounded-xs shrink-0 inline-block shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="text-slate-300 text-[11px] truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono font-medium text-white text-[11px]">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-xs font-semibold ${
                        item.badgeColor || 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnimatedTooltipWrapper>
  );
};
