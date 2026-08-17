import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface SparklinePoint {
  day: string;
  volume: number;
  isForecast: boolean;
  changePercent?: number | null;
}

interface D3SparklineProps {
  timelineData: {
    day: string;
    volume: number | null;
    projectedVolume?: number | null;
    isForecast: boolean;
  }[];
}

export const D3Sparkline: React.FC<D3SparklineProps> = ({ timelineData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 200, height: 64 });
  const [hoveredPoint, setHoveredPoint] = useState<SparklinePoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Zoom and Brushing State
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushCurrent, setBrushCurrent] = useState<number | null>(null);
  const [isBrushing, setIsBrushing] = useState<boolean>(false);

  // Reset zoom on data change
  useEffect(() => {
    setZoomDomain(null);
  }, [timelineData]);

  // Clean and prepare data with daily percentage change calculations
  const data: SparklinePoint[] = timelineData.map((d, i) => {
    const volume = d.volume !== null ? d.volume : (d.projectedVolume || 0);
    let changePercent: number | null = null;
    if (i > 0) {
      const prevD = timelineData[i - 1];
      const prevVolume = prevD.volume !== null ? prevD.volume : (prevD.projectedVolume || 0);
      if (prevVolume > 0) {
        changePercent = ((volume - prevVolume) / prevVolume) * 100;
      }
    }
    return {
      day: d.day.replace(' • Proj', ''),
      volume,
      isForecast: d.isForecast,
      changePercent
    };
  });

  // Sliced data based on active zoom domain
  const zoomedData = zoomDomain
    ? data.slice(zoomDomain[0], zoomDomain[1] + 1)
    : data;

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(100, width),
        height: Math.max(40, height || 64)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw chart
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Scale helpers mapping to original indices for consistent width alignment
    const xScale = d3.scaleLinear()
      .domain(zoomDomain ? [zoomDomain[0], zoomDomain[1]] : [0, data.length - 1])
      .range([0, chartWidth]);

    const maxVal = d3.max(zoomedData, d => d.volume) || 100;
    const minVal = d3.min(zoomedData, d => d.volume) || 0;
    // Add 10% padding to top/bottom of y-scale
    const yPadding = (maxVal - minVal) * 0.1 || 5;
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, minVal - yPadding), maxVal + yPadding])
      .range([chartHeight, 0]);

    // Create container group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Gradient definitions
    const defs = svg.append('defs');
    
    // Gradient for historical area
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'sparkline-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', '0.24');

    areaGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', '0.00');

    // Gradient for forecast area
    const forecastGradient = defs.append('linearGradient')
      .attr('id', 'sparkline-area-forecast-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    forecastGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#8b5cf6')
      .attr('stop-opacity', '0.16');

    forecastGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#8b5cf6')
      .attr('stop-opacity', '0.00');

    // Create area generator
    const areaGenerator = d3.area<SparklinePoint>()
      .x((d) => xScale(data.indexOf(d)))
      .y0(chartHeight)
      .y(d => yScale(d.volume))
      .curve(d3.curveMonotoneX);

    // Create line generator
    const lineGenerator = d3.line<SparklinePoint>()
      .x((d) => xScale(data.indexOf(d)))
      .y(d => yScale(d.volume))
      .curve(d3.curveMonotoneX);

    // Split data into historical and forecast chunks for clean rendering
    const historicalData = zoomedData.filter(d => !d.isForecast);
    const forecastData = zoomedData.filter((d, i) => d.isForecast || (i > 0 && zoomedData[i - 1] && !zoomedData[i - 1].isForecast));

    // Append historical area and line
    if (historicalData.length > 0) {
      g.append('path')
        .datum(historicalData)
        .attr('class', 'historical-area')
        .attr('d', areaGenerator)
        .attr('fill', 'url(#sparkline-area-grad)');

      g.append('path')
        .datum(historicalData)
        .attr('class', 'historical-line')
        .attr('d', lineGenerator)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', '2')
        .attr('stroke-linecap', 'round');
    }

    // Append forecast area and line
    if (forecastData.length > 0) {
      g.append('path')
        .datum(forecastData)
        .attr('class', 'forecast-area')
        .attr('d', areaGenerator)
        .attr('fill', 'url(#sparkline-area-forecast-grad)');

      g.append('path')
        .datum(forecastData)
        .attr('class', 'forecast-line')
        .attr('d', lineGenerator)
        .attr('fill', 'none')
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', '1.75')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-linecap', 'round');
    }

    // Interactive Hover elements
    const hoverCircle = g.append('circle')
      .attr('r', 4)
      .attr('fill', '#ffffff')
      .attr('stroke', '#2563eb')
      .attr('stroke-width', '2')
      .style('display', 'none');

    // Shaded Brush overlay selection box
    if (isBrushing && brushStart !== null && brushCurrent !== null) {
      const x1 = xScale(Math.min(brushStart, brushCurrent));
      const x2 = xScale(Math.max(brushStart, brushCurrent));
      g.append('rect')
        .attr('x', x1)
        .attr('width', Math.max(1, x2 - x1))
        .attr('y', 0)
        .attr('height', chartHeight)
        .attr('fill', '#3b82f6')
        .attr('fill-opacity', 0.2)
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .style('pointer-events', 'none');
    }

    // Transparent overlay for catching all mouse movements, dragging, and double-clicks
    g.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousedown', function (event) {
        const mouseX = d3.pointer(event)[0];
        const rawIdx = xScale.invert(mouseX);
        const idx = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));
        setBrushStart(idx);
        setBrushCurrent(idx);
        setIsBrushing(true);
      })
      .on('mousemove', function (event) {
        const mouseX = d3.pointer(event)[0];
        const rawIdx = xScale.invert(mouseX);
        const idx = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));

        if (isBrushing) {
          setBrushCurrent(idx);
        } else {
          const point = data[idx];
          // Only show tooltips for items within current view boundaries
          if (point && (!zoomDomain || (idx >= zoomDomain[0] && idx <= zoomDomain[1]))) {
            const cx = xScale(idx);
            const cy = yScale(point.volume);

            hoverCircle
              .attr('cx', cx)
              .attr('cy', cy)
              .attr('stroke', point.isForecast ? '#8b5cf6' : '#2563eb')
              .style('display', null);

            setHoveredPoint(point);
            setTooltipPos({
              x: cx + margin.left,
              y: cy + margin.top
            });
          } else {
            hoverCircle.style('display', 'none');
            setHoveredPoint(null);
            setTooltipPos(null);
          }
        }
      })
      .on('mouseup', function () {
        if (isBrushing && brushStart !== null && brushCurrent !== null) {
          const start = Math.min(brushStart, brushCurrent);
          const end = Math.max(brushStart, brushCurrent);
          if (end - start >= 1) {
            setZoomDomain([start, end]);
          }
        }
        setIsBrushing(false);
        setBrushStart(null);
        setBrushCurrent(null);
      })
      .on('mouseleave', function () {
        hoverCircle.style('display', 'none');
        setHoveredPoint(null);
        setTooltipPos(null);
        if (isBrushing) {
          setIsBrushing(false);
          setBrushStart(null);
          setBrushCurrent(null);
        }
      })
      .on('dblclick', function () {
        setZoomDomain(null);
      });

  }, [dimensions, timelineData, zoomDomain, isBrushing, brushStart, brushCurrent]);

  return (
    <div className="flex flex-col flex-1 h-full select-none relative">
      {/* Dynamic inline metric state to show micro-tooltip values & zoom helper */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          {hoveredPoint ? (hoveredPoint.isForecast ? 'Forecast Value' : 'Historical Value') : (zoomDomain ? '🔍 Zoomed In' : 'Volume Sparkline')}
        </span>
        <span className={`text-xs font-mono font-bold ${hoveredPoint?.isForecast ? 'text-violet-600' : 'text-blue-600'}`}>
          {hoveredPoint ? (
            `${hoveredPoint.volume.toLocaleString()} (${hoveredPoint.day})`
          ) : zoomDomain ? (
            <span className="text-[10px] text-slate-500 font-sans font-normal">Double-click or click reset to zoom out</span>
          ) : (
            <span className="text-[9px] text-slate-400 font-sans font-normal">Click-and-drag to zoom</span>
          )}
        </span>
      </div>
      <div ref={containerRef} className="w-full flex-1 min-h-[48px] overflow-hidden relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 overflow-visible"
        />

        {/* Floating Reset Zoom Button overlay */}
        {zoomDomain && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomDomain(null);
            }}
            className="absolute top-1 right-1 bg-slate-900/80 hover:bg-slate-950 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs transition-colors z-20 cursor-pointer"
          >
            Reset Zoom
          </button>
        )}

        {/* Absolute-positioned Rich HTML Tooltip */}
        {hoveredPoint && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900 border border-slate-700/80 text-white rounded px-2.5 py-1.5 shadow-xl text-[10px] space-y-0.5 transition-all duration-75"
            style={{
              left: `${Math.min(dimensions.width - 110, Math.max(0, tooltipPos.x - 55))}px`,
              top: `${Math.max(0, tooltipPos.y - 12)}px`,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-bold text-slate-300">{hoveredPoint.day}</div>
            <div className="font-mono text-white flex items-center justify-between gap-3">
              <span>Volume:</span>
              <span className="font-extrabold">{hoveredPoint.volume.toLocaleString()}</span>
            </div>
            {hoveredPoint.changePercent !== null && hoveredPoint.changePercent !== undefined ? (
              <div className={`font-semibold flex items-center justify-between gap-3 font-mono ${
                hoveredPoint.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <span>Change:</span>
                <span className="font-extrabold">
                  {hoveredPoint.changePercent >= 0 ? '▲' : '▼'} {Math.abs(hoveredPoint.changePercent).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-slate-400 font-mono flex items-center justify-between gap-3">
                <span>Change:</span>
                <span>N/A</span>
              </div>
            )}
            {hoveredPoint.isForecast && (
              <div className="pt-0.5">
                <span className="inline-block text-[8px] font-bold tracking-wider uppercase bg-violet-500/20 text-violet-300 border border-violet-400/30 rounded px-1.5 py-0.5">
                  7d Forecast
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
