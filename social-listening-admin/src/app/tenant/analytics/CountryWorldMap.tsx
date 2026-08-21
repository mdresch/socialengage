'use client';

import React, { useState } from 'react';
import type { CountryBreakdownItem } from './analyticsData';

interface CountryWorldMapProps {
  countryBreakdown: CountryBreakdownItem[];
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string) => void;
}

interface CountryPathDef {
  code: string;
  name: string;
  d: string;
}

/**
 * Lightweight, zero-dependency SVG world map paths (Equirectangular 1000x500).
 * Covers major geographic territories and regions cleanly without heavy external geojson/topojson/d3 bundles.
 */
const WORLD_COUNTRY_PATHS: CountryPathDef[] = [
  // North America
  {
    code: 'US',
    name: 'United States',
    d: 'M 140 145 L 260 145 L 285 195 L 290 230 L 265 240 L 220 240 L 195 220 L 140 185 Z M 90 85 L 145 75 L 140 120 L 80 115 Z',
  },
  {
    code: 'CA',
    name: 'Canada',
    d: 'M 140 145 L 140 85 L 210 60 L 280 75 L 295 125 L 260 145 Z',
  },
  {
    code: 'MX',
    name: 'Mexico',
    d: 'M 155 225 L 195 220 L 220 240 L 235 270 L 190 270 L 165 250 Z',
  },
  // South America
  {
    code: 'BR',
    name: 'Brazil',
    d: 'M 290 290 L 375 305 L 385 365 L 340 405 L 305 375 L 275 320 Z',
  },
  {
    code: 'AR',
    name: 'Argentina',
    d: 'M 295 385 L 335 385 L 325 470 L 300 485 L 290 420 Z',
  },
  {
    code: 'CL',
    name: 'Chile',
    d: 'M 285 380 L 295 385 L 290 480 L 280 475 Z',
  },
  {
    code: 'CO',
    name: 'Colombia',
    d: 'M 255 275 L 290 275 L 285 315 L 255 305 Z',
  },
  // Europe
  {
    code: 'GB',
    name: 'United Kingdom',
    d: 'M 460 140 L 475 130 L 480 155 L 465 165 Z M 450 145 L 460 145 L 455 155 Z',
  },
  {
    code: 'IE',
    name: 'Ireland',
    d: 'M 445 145 L 455 145 L 450 160 L 440 155 Z',
  },
  {
    code: 'FR',
    name: 'France',
    d: 'M 470 165 L 505 165 L 505 195 L 475 205 L 465 180 Z',
  },
  {
    code: 'DE',
    name: 'Germany',
    d: 'M 505 150 L 535 150 L 530 180 L 505 180 Z',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    d: 'M 495 150 L 505 150 L 505 160 L 495 160 Z',
  },
  {
    code: 'BE',
    name: 'Belgium',
    d: 'M 490 160 L 505 160 L 500 170 L 490 170 Z',
  },
  {
    code: 'ES',
    name: 'Spain',
    d: 'M 445 205 L 480 205 L 475 240 L 440 235 Z',
  },
  {
    code: 'PT',
    name: 'Portugal',
    d: 'M 435 205 L 445 205 L 440 235 L 430 230 Z',
  },
  {
    code: 'IT',
    name: 'Italy',
    d: 'M 515 185 L 535 185 L 545 225 L 535 235 L 525 210 Z',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    d: 'M 505 180 L 520 180 L 520 190 L 505 190 Z',
  },
  {
    code: 'AT',
    name: 'Austria',
    d: 'M 520 175 L 545 175 L 540 188 L 520 188 Z',
  },
  {
    code: 'PL',
    name: 'Poland',
    d: 'M 535 145 L 575 145 L 570 175 L 535 175 Z',
  },
  {
    code: 'SE',
    name: 'Sweden',
    d: 'M 525 90 L 545 85 L 550 140 L 530 145 Z',
  },
  {
    code: 'NO',
    name: 'Norway',
    d: 'M 505 95 L 525 90 L 525 145 L 505 145 Z',
  },
  {
    code: 'DK',
    name: 'Denmark',
    d: 'M 510 135 L 525 135 L 525 148 L 510 148 Z',
  },
  {
    code: 'FI',
    name: 'Finland',
    d: 'M 550 85 L 575 80 L 570 135 L 550 135 Z',
  },
  // Africa
  {
    code: 'ZA',
    name: 'South Africa',
    d: 'M 530 405 L 585 405 L 575 455 L 525 450 Z',
  },
  {
    code: 'EG',
    name: 'Egypt',
    d: 'M 555 225 L 595 225 L 595 265 L 555 265 Z',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    d: 'M 495 285 L 530 285 L 525 320 L 495 320 Z',
  },
  {
    code: 'KE',
    name: 'Kenya',
    d: 'M 580 305 L 610 305 L 605 340 L 580 335 Z',
  },
  // Middle East & Asia
  {
    code: 'SA',
    name: 'Saudi Arabia',
    d: 'M 600 240 L 655 250 L 640 300 L 595 280 Z',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    d: 'M 650 260 L 665 260 L 660 275 L 648 275 Z',
  },
  {
    code: 'IL',
    name: 'Israel',
    d: 'M 585 228 L 595 228 L 593 245 L 585 245 Z',
  },
  {
    code: 'TR',
    name: 'Turkey',
    d: 'M 565 190 L 625 190 L 620 215 L 560 215 Z',
  },
  {
    code: 'RU',
    name: 'Russia',
    d: 'M 575 80 L 890 80 L 870 160 L 640 160 L 575 145 Z',
  },
  {
    code: 'IN',
    name: 'India',
    d: 'M 690 230 L 745 230 L 730 315 L 700 315 Z',
  },
  {
    code: 'CN',
    name: 'China',
    d: 'M 725 165 L 835 165 L 840 245 L 760 260 L 725 220 Z',
  },
  {
    code: 'JP',
    name: 'Japan',
    d: 'M 855 180 L 880 180 L 870 235 L 845 225 Z',
  },
  {
    code: 'KR',
    name: 'South Korea',
    d: 'M 830 200 L 845 200 L 840 220 L 828 215 Z',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    d: 'M 770 330 L 875 330 L 870 365 L 765 365 Z',
  },
  {
    code: 'TH',
    name: 'Thailand',
    d: 'M 760 260 L 785 260 L 780 305 L 760 300 Z',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    d: 'M 785 255 L 800 255 L 790 310 L 780 300 Z',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    d: 'M 770 315 L 815 315 L 810 335 L 770 330 Z',
  },
  {
    code: 'PH',
    name: 'Philippines',
    d: 'M 825 270 L 845 270 L 840 320 L 820 315 Z',
  },
  {
    code: 'SG',
    name: 'Singapore',
    d: 'M 778 335 A 4 4 0 1 1 778 343 A 4 4 0 1 1 778 335 Z',
  },
  {
    code: 'TW',
    name: 'Taiwan',
    d: 'M 835 245 L 845 245 L 842 260 L 832 258 Z',
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    d: 'M 802 252 A 3 3 0 1 1 802 258 A 3 3 0 1 1 802 252 Z',
  },
  // Oceania
  {
    code: 'AU',
    name: 'Australia',
    d: 'M 805 385 L 905 385 L 890 465 L 820 460 Z',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    d: 'M 920 445 L 945 445 L 935 485 L 915 480 Z',
  },
];

export function CountryWorldMap({
  countryBreakdown,
  selectedCountry,
  onSelectCountry,
}: CountryWorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<{
    code: string;
    name: string;
    count: number;
    share: number;
    sentimentText: string;
    x: number;
    y: number;
  } | null>(null);

  // Index breakdown items by country code for quick O(1) lookup
  const breakdownByCode = new Map<string, CountryBreakdownItem>();
  for (const item of countryBreakdown) {
    breakdownByCode.set(item.countryCode, item);
  }

  // Calculate maximum count to compute graduated fill colors
  const maxCount = Math.max(1, ...countryBreakdown.map((c) => (c.countryCode !== 'UNKNOWN' ? c.count : 0)));

  function getCountryFill(code: string): string {
    const item = breakdownByCode.get(code);
    const count = item?.count ?? 0;
    if (count === 0) return '#f1f5f9'; // Slate 100

    const intensity = Math.min(1, count / maxCount);
    if (intensity < 0.25) return '#93c5fd'; // Blue 300
    if (intensity < 0.6) return '#3b82f6'; // Blue 500
    if (intensity < 0.85) return '#2563eb'; // Blue 600
    return '#1d4ed8'; // Blue 700
  }

  function handleMouseMove(e: React.MouseEvent<SVGPathElement>, code: string, name: string) {
    const item = breakdownByCode.get(code);
    const count = item?.count ?? 0;
    const share = item?.share ?? 0;

    let sentimentText = '0 posts';
    if (count > 0) {
      if (item?.sentiment) {
        sentimentText = `${item.sentiment.positive} pos · ${item.sentiment.neutral} neu · ${item.sentiment.negative} neg`;
      } else {
        sentimentText = `${count} post${count > 1 ? 's' : ''} (suppressed < 3)`;
      }
    }

    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      setHoveredCountry({
        code,
        name,
        count,
        share,
        sentimentText,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2">
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto max-h-[300px] select-none"
        aria-label="Interactive world map of social conversation density"
      >
        <rect width="1000" height="500" fill="transparent" />
        <g>
          {WORLD_COUNTRY_PATHS.map((country) => {
            const isSelected = selectedCountry === country.code;
            const item = breakdownByCode.get(country.code);
            const count = item?.count ?? 0;
            const fill = getCountryFill(country.code);

            return (
              <path
                key={country.code}
                d={country.d}
                fill={fill}
                stroke={isSelected ? '#f59e0b' : '#cbd5e1'}
                strokeWidth={isSelected ? 3 : 1}
                className="cursor-pointer transition-colors duration-150 hover:opacity-80 dark:stroke-slate-700"
                onClick={() => onSelectCountry(country.code)}
                onMouseMove={(e) => handleMouseMove(e, country.code, country.name)}
                onMouseLeave={() => setHoveredCountry(null)}
                aria-label={`${country.name}: ${count} posts`}
              />
            );
          })}
        </g>
      </svg>

      {/* Floating Map Hover Tooltip */}
      {hoveredCountry && (
        <div
          className="pointer-events-none absolute z-20 rounded bg-slate-900/90 text-white px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(hoveredCountry.x + 12, 380),
            top: Math.max(hoveredCountry.y - 45, 10),
          }}
        >
          <div className="font-semibold">{hoveredCountry.name}</div>
          <div className="text-slate-300">
            {hoveredCountry.count} posts ({hoveredCountry.share.toFixed(1)}%)
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5">{hoveredCountry.sentimentText}</div>
        </div>
      )}

      {/* Map Legend */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium">Density:</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-[#f1f5f9] border border-slate-300 dark:border-slate-700" title="0 posts" />
          <span className="text-[10px]">0</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-[#93c5fd]" title="Low" />
          <span className="inline-block w-3 h-3 rounded-sm bg-[#3b82f6]" title="Medium" />
          <span className="inline-block w-3 h-3 rounded-sm bg-[#1d4ed8]" title="High" />
          <span className="text-[10px]">High</span>
        </div>
        {breakdownByCode.has('UNKNOWN') && (
          <div
            className={`cursor-pointer px-2 py-0.5 rounded text-[11px] transition-colors ${
              selectedCountry === 'UNKNOWN'
                ? 'bg-amber-100 text-amber-900 font-semibold dark:bg-amber-900/40 dark:text-amber-200'
                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
            onClick={() => onSelectCountry('UNKNOWN')}
            title="Click to filter unmapped posts"
          >
            Unmapped / Unknown: {breakdownByCode.get('UNKNOWN')?.count} posts ({breakdownByCode.get('UNKNOWN')?.share.toFixed(1)}%)
          </div>
        )}
      </div>
    </div>
  );
}
