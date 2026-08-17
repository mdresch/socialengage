import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface D3SentimentGaugeProps {
  sentimentStats: {
    positive: number;
    neutral: number;
    negative: number;
    index: number;
    delta: string;
    posPct: number;
    neuPct: number;
    negPct: number;
  };
}

export const D3SentimentGauge: React.FC<D3SentimentGaugeProps> = ({ sentimentStats }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 140, height: 110 });
  const [hoveredType, setHoveredType] = useState<'positive' | 'neutral' | 'negative' | 'overall' | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(120, width),
        height: Math.max(90, height || 110)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup coordinates relative to the center
    const radius = Math.min(width, height * 1.5) / 2.1;
    const strokeWidth = 8;
    const centerX = width / 2;
    const centerY = height - 12; // Push down slightly

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Semicircular configuration: -90 degrees to +90 degrees (-pi/2 to pi/2)
    const startAngle = -Math.PI * 0.85;
    const endAngle = Math.PI * 0.85;
    const angleRange = endAngle - startAngle;

    // Background track arc
    const arcBackground = d3.arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .cornerRadius(4);

    g.append('path')
      .attr('d', arcBackground as any)
      .attr('fill', '#f1f5f9');

    // Determine color based on score
    const score = sentimentStats.index;
    let arcColor = '#10b981'; // Emerald (Favorable)
    let sentimentLabel = 'Favorable';
    
    if (score < 4.0) {
      arcColor = '#f43f5e'; // Rose (Critical)
      sentimentLabel = 'Critical';
    } else if (score < 6.5) {
      arcColor = '#f59e0b'; // Amber (Neutral/Mixed)
      sentimentLabel = 'Mixed';
    }

    // Active foreground arc representation
    const percent = score / 10;
    const currentEndAngle = startAngle + (angleRange * percent);

    const arcForeground = d3.arc()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(startAngle)
      .cornerRadius(4);

    // Append and animate the gauge path
    const path = g.append('path')
      .attr('fill', arcColor)
      .datum({ endAngle: startAngle });

    path.transition()
      .duration(900)
      .ease(d3.easeQuadOut)
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate(d.endAngle, currentEndAngle);
        return function(t) {
          d.endAngle = interpolate(t);
          return arcForeground(d as any) || '';
        };
      });

    // Score label display
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -radius / 3.8)
      .attr('class', 'font-sans font-black tracking-tight fill-slate-900')
      .style('font-size', `${Math.max(16, radius / 2.3)}px`)
      .text(score.toFixed(1));

    // Dynamic rating subtitle
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 2)
      .attr('class', 'font-sans font-bold tracking-wide uppercase text-slate-400')
      .style('font-size', '8px')
      .style('fill', '#94a3b8')
      .text(sentimentLabel);

  }, [dimensions, sentimentStats]);

  return (
    <div className="flex flex-col flex-1 h-full select-none relative">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          Composite Index
        </span>
        <span className="text-xs font-semibold text-slate-500">
          0.0 – 10.0 scale
        </span>
      </div>
      
      <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
        {/* Left: Animated Semicircle D3 Arc */}
        <div 
          ref={containerRef} 
          className="w-[120px] flex-1 min-h-[75px] max-h-[85px] relative overflow-hidden cursor-help"
          onMouseEnter={() => setHoveredType('overall')}
          onMouseLeave={() => setHoveredType(null)}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="overflow-visible mx-auto"
          />
        </div>

        {/* Right: Legend Breakdown with Micro Percentages */}
        <div className="flex flex-col gap-1 justify-center shrink-0 w-[110px] text-[10px] text-slate-500 pr-1">
          <div 
            className="flex items-center justify-between cursor-help hover:bg-slate-50 px-1 py-0.5 rounded transition-colors"
            onMouseEnter={() => setHoveredType('positive')}
            onMouseLeave={() => setHoveredType(null)}
          >
            <span className="flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pos
            </span>
            <span className="font-mono font-bold text-emerald-600">{sentimentStats.posPct}%</span>
          </div>
          <div 
            className="flex items-center justify-between cursor-help hover:bg-slate-50 px-1 py-0.5 rounded transition-colors"
            onMouseEnter={() => setHoveredType('neutral')}
            onMouseLeave={() => setHoveredType(null)}
          >
            <span className="flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Neu
            </span>
            <span className="font-mono font-bold text-amber-600">{sentimentStats.neuPct}%</span>
          </div>
          <div 
            className="flex items-center justify-between cursor-help hover:bg-slate-50 px-1 py-0.5 rounded transition-colors"
            onMouseEnter={() => setHoveredType('negative')}
            onMouseLeave={() => setHoveredType(null)}
          >
            <span className="flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Neg
            </span>
            <span className="font-mono font-bold text-rose-600">{sentimentStats.negPct}%</span>
          </div>
        </div>
      </div>

      {/* Floating Insight Tooltip */}
      {hoveredType && (
        <div className="absolute z-30 pointer-events-none bg-slate-900 border border-slate-700/80 text-white rounded px-2.5 py-1.5 shadow-xl text-[10px] space-y-0.5 right-1 bottom-1 animate-in fade-in zoom-in-95 duration-75">
          {hoveredType === 'overall' && (
            <>
              <div className="font-bold text-slate-300">Sentiment Score</div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Score Index:</span>
                <span className="font-extrabold text-blue-400">{sentimentStats.index.toFixed(1)} / 10</span>
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Change:</span>
                <span className="font-semibold text-emerald-400">{sentimentStats.delta}</span>
              </div>
            </>
          )}
          {hoveredType === 'positive' && (
            <>
              <div className="font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Positive Mentions
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Volume:</span>
                <span className="font-extrabold">{sentimentStats.positive.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Share:</span>
                <span className="font-extrabold text-emerald-300">{sentimentStats.posPct}%</span>
              </div>
            </>
          )}
          {hoveredType === 'neutral' && (
            <>
              <div className="font-bold text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Neutral Mentions
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Volume:</span>
                <span className="font-extrabold">{sentimentStats.neutral.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Share:</span>
                <span className="font-extrabold text-amber-300">{sentimentStats.neuPct}%</span>
              </div>
            </>
          )}
          {hoveredType === 'negative' && (
            <>
              <div className="font-bold text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Negative Mentions
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Volume:</span>
                <span className="font-extrabold">{sentimentStats.negative.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4 font-mono">
                <span>Share:</span>
                <span className="font-extrabold text-rose-300">{sentimentStats.negPct}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
