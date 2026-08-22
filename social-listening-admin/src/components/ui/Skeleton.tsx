import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width,
  height,
  circle,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`.trim()}
      style={{ width, height, ...style }}
    />
  );
}
