'use client';

/**
 * AnimatedChartTooltip — replaces the framer-motion version from the design
 * reference. Pure CSS transition on mount via the `.act-tooltip` class
 * (defined in globals.css ad-* block). No motion/react dependency.
 */

export interface TooltipItem {
  name: string;
  value: string | number;
  color?: string;
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

export function AnimatedChartTooltip({
  active,
  title,
  subtitle,
  items,
  children,
  className = '',
}: AnimatedChartTooltipProps) {
  if (!active) return null;

  return (
    <div className={`ad-tooltip ${className}`}>
      {title && (
        <div className="ad-tooltip-header">
          <span className="ad-tooltip-title">{title}</span>
          {subtitle && <span className="ad-tooltip-subtitle">{subtitle}</span>}
        </div>
      )}
      {children ? (
        children
      ) : (
        <div className="ad-tooltip-items">
          {items?.map((item, idx) => (
            <div key={idx} className="ad-tooltip-row">
              <div className="ad-tooltip-row-left">
                {item.color && (
                  <span className="ad-tooltip-dot" style={{ backgroundColor: item.color }} />
                )}
                <span className="ad-tooltip-name">{item.name}</span>
              </div>
              <div className="ad-tooltip-row-right">
                <span className="ad-tooltip-value">
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
                {item.badge && (
                  <span
                    className="ad-tooltip-badge"
                    style={item.badgeColor ? { background: item.badgeColor } : undefined}
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
  );
}
