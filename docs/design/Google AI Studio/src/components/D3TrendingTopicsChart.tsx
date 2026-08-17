import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface TopicItem {
  text: string;
  count: number;
}

interface D3TrendingTopicsChartProps {
  keywords: TopicItem[];
}

export const D3TrendingTopicsChart: React.FC<D3TrendingTopicsChartProps> = ({ keywords }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 75 });
  const [hoveredTopic, setHoveredTopic] = useState<TopicItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Take top 3 keywords
  const topTopics = keywords.slice(0, 3);
  const totalTrendVolume = keywords.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(120, width),
        height: Math.max(50, height || 75)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || topTopics.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 4, right: 34, bottom: 4, left: 4 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Setup Scales
    const yScale = d3.scaleBand()
      .domain(topTopics.map(d => d.text))
      .range([0, chartHeight])
      .paddingInner(0.24)
      .paddingOuter(0.08);

    const maxCount = d3.max(topTopics, d => (d as TopicItem).count) || 100;
    const xScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([0, chartWidth]);

    const barHeight = yScale.bandwidth();

    // Create rows
    const rows = g.selectAll('.topic-row')
      .data(topTopics)
      .enter()
      .append('g')
      .attr('class', 'topic-row')
      .attr('transform', d => `translate(0, ${yScale((d as TopicItem).text) || 0})`);

    // Row Background pill for aesthetic consistency
    rows.append('rect')
      .attr('width', chartWidth)
      .attr('height', barHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#f1f5f9');

    // Colored Active Bar
    const bars = rows.append('rect')
      .attr('height', barHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', (_, i) => {
        // Aesthetic sequence of cool colors
        if (i === 0) return '#3b82f6'; // Bright blue
        if (i === 1) return '#8b5cf6'; // Violet/purple
        return '#06b6d4'; // Cyan
      })
      .attr('width', 0); // Start at 0 for animation

    // Transition the bar width
    bars.transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('width', d => xScale((d as TopicItem).count));

    // Keyword Text Label placed on top of the bar
    rows.append('text')
      .attr('x', 8)
      .attr('y', barHeight / 2 + 3.5) // Optical alignment
      .attr('class', 'font-sans font-bold fill-slate-800 text-[10px]')
      .style('pointer-events', 'none')
      .text(d => (d as TopicItem).text);

    // Value indicator on the far right
    rows.append('text')
      .attr('x', chartWidth + 6)
      .attr('y', barHeight / 2 + 3.5)
      .attr('class', 'font-mono font-bold fill-slate-500 text-[9px]')
      .text(d => (d as TopicItem).count.toLocaleString());

    // Hover listeners to rows group
    rows.style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        setHoveredTopic(d as TopicItem);
        const [mx, my] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x: mx, y: my });
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x: mx, y: my });
      })
      .on('mouseleave', function() {
        setHoveredTopic(null);
        setTooltipPos(null);
      });

  }, [dimensions, keywords]);

  return (
    <div className="flex flex-col flex-1 h-full select-none relative">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          Top Trending Channels
        </span>
        <span className="text-xs font-mono text-slate-500 font-bold">
          {topTopics[0] ? topTopics[0].text : 'n/a'}
        </span>
      </div>
      <div ref={containerRef} className="w-full flex-1 min-h-[64px] overflow-hidden relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 overflow-visible"
        />

        {/* Absolute-positioned Rich HTML Tooltip */}
        {hoveredTopic && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900 border border-slate-700/80 text-white rounded px-2.5 py-1.5 shadow-xl text-[10px] space-y-0.5 transition-all duration-75 animate-in fade-in zoom-in-95"
            style={{
              left: `${Math.min(dimensions.width - 110, Math.max(0, tooltipPos.x - 55))}px`,
              top: `${Math.max(0, tooltipPos.y - 12)}px`,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-bold text-violet-400">{hoveredTopic.text}</div>
            <div className="font-mono text-white flex justify-between gap-4">
              <span>Mentions:</span>
              <span className="font-extrabold">{hoveredTopic.count.toLocaleString()}</span>
            </div>
            {totalTrendVolume > 0 && (
              <div className="font-mono text-slate-300 flex justify-between gap-4">
                <span>Share:</span>
                <span className="font-semibold text-cyan-400">
                  {((hoveredTopic.count / totalTrendVolume) * 100).toFixed(1)}% of top
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
