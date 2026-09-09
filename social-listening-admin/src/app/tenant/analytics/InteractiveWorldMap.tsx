'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

interface CountryMarkerData {
  id: string;
  name: string;
  count: number;
  score: string;        // display label, e.g. "+4.1" or "7.1"
  numericScore: number; // on the -10..+10 scale
  positive?: number;
  neutral?: number;
  negative?: number;
}

interface InteractiveWorldMapProps {
  countries: CountryMarkerData[];
  selectedCountry: string | null;
  onSelectCountry: (countryCode: string | null) => void;
  mapMode?: 'buzz' | 'trend' | 'sentiment';
  height?: number | string;
}

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

export function InteractiveWorldMap({
  countries,
  selectedCountry,
  onSelectCountry,
  mapMode = 'buzz',
  height = 360,
}: InteractiveWorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const maxVolume = Math.max(1, ...countries.map((c) => c.count));

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    async function initLeaflet() {
      const L = await import('leaflet');

      if (!isMounted || !containerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          center: [28, 12],
          zoom: 2,
          minZoom: 1.5,
          maxZoom: 10,
          zoomControl: false,
          attributionControl: false,
        });

        // OpenStreetMap free standard tile layer (zero API key required)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Add custom zoom control in bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Add attribution control in bottom left
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;
        setMapReady(true);
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers whenever data, selection, or mapMode changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return;

    let isMounted = true;

    async function updateMarkers() {
      const L = await import('leaflet');
      if (!isMounted || !markersLayerRef.current) return;

      markersLayerRef.current.clearLayers();

      countries.forEach((country) => {
        const coords = COUNTRY_COORDINATES[country.id.toUpperCase()];
        if (!coords) return;

        const isSelected = selectedCountry === country.id;
        const volumeRatio = country.count / maxVolume;
        const size = Math.max(22, Math.min(52, Math.round(volumeRatio * 32 + 20)));

        // Color based on mapMode
        let bgColor = '#0f172a';
        let borderColor = '#ffffff';
        let pinLabel = String(country.count);

        if (isSelected) {
          bgColor = '#f59e0b';
          borderColor = '#ffffff';
        } else if (mapMode === 'sentiment') {
          // Continuous gradient from deep red (−10) through amber (0) to deep green (+10)
          const clamped = Math.max(-10, Math.min(10, country.numericScore));
          const t = (clamped + 10) / 20; // 0..1 where 0.5 = neutral
          if (t < 0.4) {
            // Red → amber
            const sub = t / 0.4; // 0..1
            const r = 220;
            const g = Math.round(sub * 120);
            bgColor = `rgb(${r},${g},0)`;
          } else if (t < 0.55) {
            // Amber zone (near zero)
            bgColor = '#d97706';
          } else {
            // Amber → green
            const sub = (t - 0.55) / 0.45; // 0..1
            const r = Math.round((1 - sub) * 210);
            const g = Math.round(100 + sub * 28);
            bgColor = `rgb(${r},${g},0)`;
          }
          // Show the index value inside the pin
          const idx = country.numericScore;
          pinLabel = idx >= 0 ? `+${idx.toFixed(1)}` : idx.toFixed(1);
        } else if (mapMode === 'trend') {
          bgColor = '#0284c7';
        }

        const iconHtml = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: var(--font-mono, monospace);
            font-size: ${size > 30 ? '9px' : '8px'};
            font-weight: 700;
            box-shadow: 0 4px 14px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: transform 180ms ease;
            text-shadow: 0 1px 2px rgba(0,0,0,0.4);
            line-height: 1;
            text-align: center;
            padding: 2px;
          ">
            ${pinLabel}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'an-map-cluster-pin',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([coords.lat, coords.lng], { icon: customIcon });

        // Tooltip
        const popupContent = `
          <div style="font-family: var(--font-sans, sans-serif); padding: 2px 4px; min-width: 150px;">
            <div style="font-weight: 700; font-size: 12px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
              ${coords.name}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 2px;">
              <span>Posts:</span>
              <span style="font-weight: 700; color: #0f172a;">${country.count.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 2px;">
              <span>Sentiment index:</span>
              <span style="font-weight: 700; color: ${country.numericScore >= 2 ? '#15803d' : country.numericScore <= -2 ? '#dc2626' : '#d97706'};">${country.score}</span>
            </div>
            ${(country.positive !== undefined) ? `
            <div style="display: flex; gap: 10px; font-size: 10px; margin-top: 3px; padding-top: 3px; border-top: 1px solid #f1f5f9;">
              <span style="color: #15803d;">+${country.positive} pos</span>
              <span style="color: #64748b;">${country.neutral} neu</span>
              <span style="color: #dc2626;">&#8722;${country.negative} neg</span>
            </div>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent, { offset: [0, -size / 2] });
        marker.on('click', () => {
          onSelectCountry(selectedCountry === country.id ? null : country.id);
        });

        if (markersLayerRef.current) {
          marker.addTo(markersLayerRef.current);
        }
      });
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [countries, selectedCountry, mapMode, mapReady, maxVolume, onSelectCountry]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 'var(--radius-sm, 4px)',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#b9ceeb' }} />
      {!mapReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#b9ceeb',
            color: '#1e293b',
            fontSize: '0.8125rem',
            fontWeight: 500,
            gap: 8,
          }}
        >
          <div className="an-loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          <span>Loading interactive map...</span>
        </div>
      )}
    </div>
  );
}
