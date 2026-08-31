'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import type { CountryBreakdownItem } from './analyticsData';

interface CountryWorldMapProps {
  countryBreakdown: CountryBreakdownItem[];
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string) => void;
}

/**
 * Centroid geographic coordinates (Latitude, Longitude) for ISO 3166-1 alpha-2 countries.
 */
const COUNTRY_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  US: { lat: 37.0902, lng: -95.7129, name: 'United States' },
  GB: { lat: 55.3781, lng: -3.436, name: 'United Kingdom' },
  CA: { lat: 56.1304, lng: -106.3468, name: 'Canada' },
  DE: { lat: 51.1657, lng: 10.4515, name: 'Germany' },
  FR: { lat: 46.2276, lng: 2.2137, name: 'France' },
  IT: { lat: 41.8719, lng: 12.5674, name: 'Italy' },
  ES: { lat: 40.4637, lng: -3.7492, name: 'Spain' },
  NL: { lat: 52.1326, lng: 5.2913, name: 'Netherlands' },
  BE: { lat: 50.5039, lng: 4.4699, name: 'Belgium' },
  CH: { lat: 46.8182, lng: 8.2275, name: 'Switzerland' },
  AT: { lat: 47.5162, lng: 14.5501, name: 'Austria' },
  SE: { lat: 60.1282, lng: 18.6435, name: 'Sweden' },
  NO: { lat: 60.472, lng: 8.4689, name: 'Norway' },
  DK: { lat: 56.2639, lng: 9.5018, name: 'Denmark' },
  FI: { lat: 61.9241, lng: 25.7482, name: 'Finland' },
  IE: { lat: 53.1424, lng: -7.6921, name: 'Ireland' },
  PT: { lat: 39.3999, lng: -8.2245, name: 'Portugal' },
  PL: { lat: 51.9194, lng: 19.1451, name: 'Poland' },
  CZ: { lat: 49.8175, lng: 15.473, name: 'Czechia' },
  RO: { lat: 45.9432, lng: 24.9668, name: 'Romania' },
  GR: { lat: 39.0742, lng: 21.8243, name: 'Greece' },
  UA: { lat: 48.3794, lng: 31.1656, name: 'Ukraine' },
  RU: { lat: 61.524, lng: 105.3188, name: 'Russia' },
  JP: { lat: 36.2048, lng: 138.2529, name: 'Japan' },
  CN: { lat: 35.8617, lng: 104.1954, name: 'China' },
  IN: { lat: 20.5937, lng: 78.9629, name: 'India' },
  AU: { lat: -25.2744, lng: 133.7751, name: 'Australia' },
  NZ: { lat: -40.9006, lng: 174.886, name: 'New Zealand' },
  BR: { lat: -14.235, lng: -51.9253, name: 'Brazil' },
  MX: { lat: 23.6345, lng: -102.5528, name: 'Mexico' },
  AR: { lat: -38.4161, lng: -63.6167, name: 'Argentina' },
  CL: { lat: -35.6751, lng: -71.543, name: 'Chile' },
  CO: { lat: 4.5709, lng: -74.2973, name: 'Colombia' },
  ZA: { lat: -30.5595, lng: 22.9375, name: 'South Africa' },
  EG: { lat: 26.8206, lng: 30.8025, name: 'Egypt' },
  NG: { lat: 9.082, lng: 8.6753, name: 'Nigeria' },
  KE: { lat: -0.0236, lng: 37.9062, name: 'Kenya' },
  KR: { lat: 35.9078, lng: 127.7669, name: 'South Korea' },
  SG: { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  ID: { lat: -0.7893, lng: 113.9213, name: 'Indonesia' },
  MY: { lat: 4.2105, lng: 101.9758, name: 'Malaysia' },
  TH: { lat: 15.87, lng: 100.9925, name: 'Thailand' },
  VN: { lat: 14.0583, lng: 108.2772, name: 'Vietnam' },
  PH: { lat: 12.8797, lng: 121.774, name: 'Philippines' },
  PK: { lat: 30.3753, lng: 69.3451, name: 'Pakistan' },
  BD: { lat: 23.685, lng: 90.3563, name: 'Bangladesh' },
  TR: { lat: 38.9637, lng: 35.2433, name: 'Turkey' },
  SA: { lat: 23.8859, lng: 45.0792, name: 'Saudi Arabia' },
  AE: { lat: 23.4241, lng: 53.8478, name: 'United Arab Emirates' },
  IL: { lat: 31.0461, lng: 34.8516, name: 'Israel' },
};

export function CountryWorldMap({
  countryBreakdown,
  selectedCountry,
  onSelectCountry,
}: CountryWorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2);

  const maxCount = useMemo(() => {
    return Math.max(1, ...countryBreakdown.map((c) => (c.countryCode !== 'UNKNOWN' ? c.count : 0)));
  }, [countryBreakdown]);

  // Compute 3D markers from active countries
  const markers = useMemo(() => {
    const list: Array<{ location: [number, number]; size: number; color?: [number, number, number]; id: string }> = [];

    for (const item of countryBreakdown) {
      if (item.countryCode === 'UNKNOWN') continue;
      const coords = COUNTRY_COORDINATES[item.countryCode];
      if (!coords) continue;

      const isSelected = selectedCountry === item.countryCode;
      const normalizedSize = Math.max(0.04, Math.min(0.14, (item.count / maxCount) * 0.12 + 0.04));

      list.push({
        location: [coords.lat, coords.lng],
        size: isSelected ? normalizedSize * 1.5 : normalizedSize,
        color: isSelected ? [0.96, 0.62, 0.04] : [0.14, 0.39, 0.92],
        id: item.countryCode,
      });
    }

    return list;
  }, [countryBreakdown, maxCount, selectedCountry]);

  useEffect(() => {
    let width = 0;
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      if (canvas) {
        width = canvas.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    let globeInstance: { update: (opts: Record<string, unknown>) => void; destroy: () => void } | null = null;
    let animationFrameId: number | null = null;

    // Load cobe dynamically in browser to ensure clean SSR & Jest test execution
    import('cobe')
      .then(({ default: createGlobe }) => {
        if (!isMounted || !canvas) return;

        try {
          globeInstance = createGlobe(canvas, {
            devicePixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2),
            width: (width || 320) * 2,
            height: (width || 320) * 2,
            phi: 0,
            theta: 0.2,
            dark: 0,
            diffuse: 1.2,
            mapSamples: 16000,
            mapBrightness: 6,
            baseColor: [0.93, 0.95, 0.98],
            markerColor: [0.14, 0.39, 0.92],
            glowColor: [0.8, 0.88, 0.98],
            markers,
          });

          const animate = () => {
            if (!isMounted) return;
            if (!pointerInteracting.current) {
              phiRef.current += 0.003;
            }
            globeInstance?.update({
              phi: phiRef.current + pointerInteractionMovement.current,
              theta: thetaRef.current,
              width: (width || 320) * 2,
              height: (width || 320) * 2,
              markers,
            });
            animationFrameId = requestAnimationFrame(animate);
          };

          animationFrameId = requestAnimationFrame(animate);
        } catch {
          // Graceful fallback for non-WebGL environments
        }
      })
      .catch(() => {
        // Module load fallback
      });

    return () => {
      isMounted = false;
      window.removeEventListener('resize', onResize);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      globeInstance?.destroy();
    };
  }, [markers]);

  return (
    <div className="an-location-globe-card relative w-full overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
      {/* 3D WebGL Globe Canvas Container */}
      <div className="relative mx-auto flex items-center justify-center" style={{ width: '100%', maxWidth: '340px', aspectRatio: '1/1' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: 'grab', contain: 'layout paint size' }}
          onPointerDown={(e) => {
            pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
          }}
          onPointerUp={() => {
            pointerInteracting.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            pointerInteracting.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
          }}
          onMouseMove={(e) => {
            if (pointerInteracting.current !== null) {
              const delta = e.clientX - pointerInteracting.current;
              pointerInteractionMovement.current = delta * 0.005;
            }
          }}
          onTouchMove={(e) => {
            if (pointerInteracting.current !== null && e.touches[0]) {
              const delta = e.touches[0].clientX - pointerInteracting.current;
              pointerInteractionMovement.current = delta * 0.005;
            }
          }}
        />

        {/* Floating Globe HUD / Compass Badge */}
        <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-xs backdrop-blur-xs">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>3D Globe</span>
        </div>

        {/* Drag Hint */}
        <div className="pointer-events-none absolute bottom-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Drag to rotate · Auto-spinning
        </div>
      </div>

      {/* Screen-reader accessible country breakdown list */}
      <div className="sr-only" aria-live="polite">
        {countryBreakdown.map((c) => (
          <span key={c.countryCode}>
            {c.name}: {c.count} posts ({c.share.toFixed(1)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
