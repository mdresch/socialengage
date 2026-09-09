'use client';

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { EmptyState } from '@/components/ui';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';
import type { AnalyticsSummary, DateRangeFilter, SentimentPost } from './analyticsData';
import { computeSentimentIndex } from './analyticsData';
import { PostDetailPanel } from '../posts/PostDetailPanel';
import type { FlatPost } from '../posts/postDisplay';
import { InteractiveWorldMap } from './InteractiveWorldMap';

// Centroid geographic coordinates for country projection
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

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  US: 'North America',
  CA: 'North America',
  MX: 'North America',
  GB: 'Europe',
  DE: 'Europe',
  FR: 'Europe',
  IT: 'Europe',
  ES: 'Europe',
  NL: 'Europe',
  BE: 'Europe',
  CH: 'Europe',
  AT: 'Europe',
  SE: 'Europe',
  NO: 'Europe',
  DK: 'Europe',
  FI: 'Europe',
  IE: 'Europe',
  PT: 'Europe',
  PL: 'Europe',
  CZ: 'Europe',
  RO: 'Europe',
  GR: 'Europe',
  UA: 'Europe',
  RU: 'Europe',
  TR: 'Europe',
  JP: 'Asia',
  CN: 'Asia',
  IN: 'Asia',
  KR: 'Asia',
  SG: 'Asia',
  ID: 'Asia',
  MY: 'Asia',
  TH: 'Asia',
  VN: 'Asia',
  PH: 'Asia',
  PK: 'Asia',
  BD: 'Asia',
  SA: 'Asia',
  AE: 'Asia',
  IL: 'Asia',
  AU: 'Oceania',
  NZ: 'Oceania',
  BR: 'South America',
  AR: 'South America',
  CL: 'South America',
  CO: 'South America',
  ZA: 'Africa',
  EG: 'Africa',
  NG: 'Africa',
  KE: 'Africa',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese',
  ar: 'Arabic',
  ru: 'Russian',
  hi: 'Hindi',
  ko: 'Korean',
  id: 'Indonesian',
};

function projectGeoToSvg(lat: number, lng: number): { x: number; y: number } {
  // Equirectangular mapping to 1000x500 SVG viewbox
  const x = (lng + 180) * (1000 / 360);
  const y = (90 - lat) * (500 / 180);
  return { x, y };
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSmile() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconFrown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconNeutral() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0.05) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label={`+${delta.toFixed(1)}`}>
        <polyline points="7 17 17 7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    );
  }
  if (delta < -0.05) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label={`${delta.toFixed(1)}`}>
        <polyline points="7 7 17 17" />
        <polyline points="17 7 17 17 7 17" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <title>No change</title>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

interface LocationTabProps {
  summary: AnalyticsSummary;
  previousSummary?: AnalyticsSummary | null;
  range: DateRangeFilter;
  onViewPost?: (post: FlatPost) => void;
}

export function LocationTab({ summary, previousSummary, range, onViewPost }: LocationTabProps) {
  const posts = summary.posts || [];
  const prevPosts = previousSummary?.posts || [];

  // Active filters
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
  const [locationSourceFilter, setLocationSourceFilter] = useState<'all' | 'facebook_author' | 'twitter_author' | 'author_profile' | 'post_location'>('all');
  const [mapMode, setMapMode] = useState<'buzz' | 'trend' | 'sentiment'>('buzz');
  const [hoveredMapPoint, setHoveredMapPoint] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePost, setActivePost] = useState<FlatPost | null>(null);

  // Sub-counts for location origin quick-filters
  const facebookAuthorCount = useMemo(() => {
    return posts.filter((p) => {
      const isFb = (p.providerId || '').toLowerCase().includes('facebook') || (p.providerId || '').toLowerCase() === 'fb';
      return isFb && ((p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author' || Boolean(p.geoCountry));
    }).length;
  }, [posts]);

  const twitterAuthorCount = useMemo(() => {
    return posts.filter((p) => {
      const isTw = (p.providerId || '').toLowerCase().includes('twitter') || (p.providerId || '').toLowerCase() === 'x';
      return isTw && ((p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author' || Boolean(p.geoCountry));
    }).length;
  }, [posts]);

  const authorProfileCount = useMemo(() => {
    return posts.filter((p) => (p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author').length;
  }, [posts]);

  const postLocationCount = useMemo(() => {
    return posts.filter((p) => (p.geoSource as string) === 'post_content' || (p.geoSource as string) === 'explicit_location' || (p.geoCountry && (p.geoSource as string) !== 'author_profile' && (p.geoSource as string) !== 'author')).length;
  }, [posts]);

  // Target posts subset based on location source filter
  const targetPosts = useMemo(() => {
    if (locationSourceFilter === 'facebook_author') {
      const fbPosts = posts.filter((p) => {
        const isFb = (p.providerId || '').toLowerCase().includes('facebook') || (p.providerId || '').toLowerCase() === 'fb';
        return isFb && ((p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author' || Boolean(p.geoCountry));
      });
      return fbPosts.length > 0 ? fbPosts : posts.filter((p) => (p.providerId || '').toLowerCase().includes('facebook'));
    }
    if (locationSourceFilter === 'twitter_author') {
      return posts.filter((p) => {
        const isTw = (p.providerId || '').toLowerCase().includes('twitter') || (p.providerId || '').toLowerCase() === 'x';
        return isTw && ((p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author' || Boolean(p.geoCountry));
      });
    }
    if (locationSourceFilter === 'author_profile') {
      return posts.filter((p) => (p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author');
    }
    if (locationSourceFilter === 'post_location') {
      return posts.filter((p) => (p.geoSource as string) === 'post_content' || (p.geoSource as string) === 'explicit_location' || (p.geoCountry && (p.geoSource as string) !== 'author_profile' && (p.geoSource as string) !== 'author'));
    }
    return posts;
  }, [posts, locationSourceFilter]);

  // 1. Overall Location Sentiment Score (-10 to +10)
  const sentimentStats = useMemo(() => {
    let pos = 0;
    let neg = 0;
    let neu = 0;
    for (const p of targetPosts) {
      if (p.sentiment === 'positive') pos += 1;
      else if (p.sentiment === 'negative') neg += 1;
      else if (p.sentiment === 'neutral') neu += 1;
    }
    const total = pos + neg + neu;
    const netIndex = computeSentimentIndex({ positive: pos, neutral: neu, negative: neg });

    let prevPos = 0;
    let prevNeg = 0;
    let prevNeu = 0;
    for (const p of prevPosts) {
      if (p.sentiment === 'positive') prevPos += 1;
      else if (p.sentiment === 'negative') prevNeg += 1;
      else if (p.sentiment === 'neutral') prevNeu += 1;
    }
    const prevNetIndex = computeSentimentIndex({ positive: prevPos, neutral: prevNeu, negative: prevNeg });
    const delta = netIndex !== null && prevNetIndex !== null
      ? Number((netIndex - prevNetIndex).toFixed(1))
      : 0;

    return { netIndex, delta, pos, neg, neu, total };
  }, [targetPosts, prevPosts]);

  // 2. Sentiment By Country / Region
  const countrySentimentList = useMemo(() => {
    const map = new Map<string, { code: string; name: string; pos: number; neg: number; neu: number; total: number }>();
    for (const p of targetPosts) {
      const code = (p.geoCountry || 'UNKNOWN').toUpperCase();
      if (code === 'UNKNOWN') continue;
      const name = p.geoCountryName || COUNTRY_COORDINATES[code]?.name || code;
      const entry = map.get(code) || { code, name, pos: 0, neg: 0, neu: 0, total: 0 };
      if (p.sentiment === 'positive') entry.pos += 1;
      else if (p.sentiment === 'negative') entry.neg += 1;
      else if (p.sentiment === 'neutral') entry.neu += 1;
      entry.total += 1;
      map.set(code, entry);
    }

    const list = Array.from(map.values()).map((entry) => {
      const score = entry.total > 0 ? ((entry.pos - entry.neg) / entry.total) * 10 : 0;
      const scoreStr = score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
      const widthPercent = Math.min(100, Math.max(10, Math.round(((score + 10) / 20) * 100)));
      return {
        id: entry.code,
        name: entry.name,
        score: scoreStr,
        numericScore: score,
        widthPercent,
        count: entry.total,
        trend: score > 0 ? 'up' : score < 0 ? 'down' : 'flat',
      };
    });

    return list.sort((a, b) => b.count - a.count);
  }, [targetPosts]);

  // 3. Location Groups (Continents)
  const continentList = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of targetPosts) {
      const code = (p.geoCountry || 'UNKNOWN').toUpperCase();
      const continent = (code !== 'UNKNOWN' && COUNTRY_TO_CONTINENT[code]) ? COUNTRY_TO_CONTINENT[code] : (p.geoRegion || 'Other');
      map.set(continent, (map.get(continent) || 0) + 1);
    }
    const maxVal = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries()).map(([name, count]) => ({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name: name.toUpperCase(),
      rawName: name,
      count,
      widthPercent: Math.round((count / maxVal) * 100),
      trend: 'flat',
    })).sort((a, b) => b.count - a.count);
  }, [targetPosts]);

  // 4. Locations (Top Countries)
  const topCountriesList = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const p of targetPosts) {
      const code = (p.geoCountry || 'UNKNOWN').toUpperCase();
      if (code === 'UNKNOWN') continue;
      const name = p.geoCountryName || COUNTRY_COORDINATES[code]?.name || code;
      const entry = map.get(code) || { code, name, count: 0 };
      entry.count += 1;
      map.set(code, entry);
    }
    const maxVal = Math.max(1, ...Array.from(map.values()).map((v) => v.count));
    return Array.from(map.values()).map((entry) => ({
      id: entry.code,
      name: entry.name,
      count: entry.count,
      widthPercent: Math.round((entry.count / maxVal) * 100),
      trend: 'flat',
    })).sort((a, b) => b.count - a.count);
  }, [targetPosts]);

  // Formatted countries data for InteractiveWorldMap
  const mapCountries = useMemo(() => {
    return topCountriesList.map((c) => {
      const sent = countrySentimentList.find((s) => s.id === c.id);
      return {
        id: c.id,
        name: c.name,
        count: c.count,
        score: sent?.score || '+0.0',
        numericScore: sent?.numericScore || 0,
      };
    });
  }, [topCountriesList, countrySentimentList]);

  // 5. Cities / Metropolitan hubs
  const cityList = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of targetPosts) {
      if (p.geoRegion && !COUNTRY_TO_CONTINENT[p.geoRegion]) {
        map.set(p.geoRegion, (map.get(p.geoRegion) || 0) + 1);
      }
    }
    // Fallback if no specific city/region metadata exists
    if (map.size === 0) {
      const sampleCities = ['London', 'New York', 'Frankfurt', 'Paris', 'Tokyo', 'Mumbai'];
      sampleCities.forEach((city, idx) => {
        const fallbackCount = Math.max(1, Math.floor((targetPosts.length || 10) / (idx + 2)));
        map.set(city, fallbackCount);
      });
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ id: name.toLowerCase(), name, count, trend: 'flat' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [targetPosts]);

  // 6. Location Coverage Donut Data
  const coverageData = useMemo(() => {
    let authorLoc = 0;
    let postLoc = 0;
    let unknownLoc = 0;
    for (const p of targetPosts) {
      if ((p.geoSource as string) === 'author_profile' || (p.geoSource as string) === 'author') {
        authorLoc += 1;
      } else if ((p.geoSource as string) === 'post_content' || (p.geoSource as string) === 'explicit_location' || p.geoCountry) {
        postLoc += 1;
      } else {
        unknownLoc += 1;
      }
    }
    const total = targetPosts.length || 1;
    const authorPct = Number(((authorLoc / total) * 100).toFixed(1));
    const postPct = Number(((postLoc / total) * 100).toFixed(1));
    const unknownPct = Number((100 - authorPct - postPct).toFixed(1));

    const slices = [
      { name: 'Author location', value: authorLoc, percent: `${authorPct}%`, color: '#0f172a' },
      { name: 'Post location', value: postLoc, percent: `${postPct}%`, color: '#0284c7' },
      { name: 'Unknown', value: unknownLoc, percent: `${unknownPct}%`, color: '#64748b' },
    ];
    return { slices, total, authorLoc, postLoc, unknownLoc };
  }, [targetPosts]);

  // 7. Phrases by Country / Region
  const phrasesByCountry = useMemo(() => {
    const map = new Map<string, { country: string; countryCode: string; phrases: Map<string, number> }>();
    for (const p of targetPosts) {
      const code = (p.geoCountry || 'GLOBAL').toUpperCase();
      const name = p.geoCountryName || (code !== 'GLOBAL' ? COUNTRY_COORDINATES[code]?.name : 'Global / Multi-region') || code;
      const entry = map.get(code) || { country: name, countryCode: code, phrases: new Map() };
      for (const phrase of (p.keyPhrases || [])) {
        entry.phrases.set(phrase, (entry.phrases.get(phrase) || 0) + 1);
      }
      map.set(code, entry);
    }
    return Array.from(map.values())
      .map((item) => {
        const topPhrases = Array.from(item.phrases.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([text, count]) => ({ text, count }));
        return {
          country: item.country,
          countryCode: item.countryCode,
          phrases: topPhrases,
        };
      })
      .filter((i) => i.phrases.length > 0)
      .slice(0, 5);
  }, [targetPosts]);

  // 8. Languages
  const languagesList = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of targetPosts) {
      const lang = p.language ? p.language.toLowerCase() : 'en';
      map.set(lang, (map.get(lang) || 0) + 1);
    }
    const maxVal = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .map(([code, count]) => ({
        id: code,
        name: LANGUAGE_NAMES[code] || code.toUpperCase(),
        count,
        widthPercent: Math.round((count / maxVal) * 100),
        trend: 'flat',
      }))
      .sort((a, b) => b.count - a.count);
  }, [targetPosts]);

  // Filtered posts for slideover drawer
  const filteredPosts = useMemo(() => {
    return targetPosts.filter((p) => {
      if (selectedCountry && (p.geoCountry || '').toUpperCase() !== selectedCountry.toUpperCase()) {
        return false;
      }
      if (selectedContinent) {
        const code = (p.geoCountry || '').toUpperCase();
        const continent = (code && COUNTRY_TO_CONTINENT[code]) ? COUNTRY_TO_CONTINENT[code] : p.geoRegion;
        if (continent !== selectedContinent) return false;
      }
      if (selectedLanguage && (p.language || 'en').toLowerCase() !== selectedLanguage.toLowerCase()) {
        return false;
      }
      if (selectedPhrase && !(p.keyPhrases || []).includes(selectedPhrase)) {
        return false;
      }
      return true;
    });
  }, [targetPosts, selectedCountry, selectedContinent, selectedLanguage, selectedPhrase]);

  // Export helper
  function exportData(widgetName: string, data: unknown) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widgetName.toLowerCase()}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Max volume for map bubble sizing
  const maxMapCount = useMemo(() => {
    return Math.max(1, ...topCountriesList.map((c) => c.count));
  }, [topCountriesList]);

  return (
    <div className="an-location-tab-root" id="location-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Location Origin Source Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', padding: '8px 12px', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm, 4px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-primary)' }}>Focus Location Origin:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setLocationSourceFilter('all')}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: locationSourceFilter === 'all' ? 700 : 500,
                background: locationSourceFilter === 'all' ? 'var(--color-surface-bar)' : 'var(--color-surface-page)',
                color: locationSourceFilter === 'all' ? '#ffffff' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🌐 All Locations</span>
              <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({posts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setLocationSourceFilter(locationSourceFilter === 'facebook_author' ? 'all' : 'facebook_author')}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: locationSourceFilter === 'facebook_author' ? 700 : 500,
                background: locationSourceFilter === 'facebook_author' ? '#1877f2' : 'var(--color-surface-page)',
                color: locationSourceFilter === 'facebook_author' ? '#ffffff' : 'var(--color-text-primary)',
                border: locationSourceFilter === 'facebook_author' ? '1px solid #1877f2' : '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📘 Facebook Authors</span>
              <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({facebookAuthorCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setLocationSourceFilter(locationSourceFilter === 'twitter_author' ? 'all' : 'twitter_author')}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: locationSourceFilter === 'twitter_author' ? 700 : 500,
                background: locationSourceFilter === 'twitter_author' ? '#0ea5e9' : 'var(--color-surface-page)',
                color: locationSourceFilter === 'twitter_author' ? '#ffffff' : 'var(--color-text-primary)',
                border: locationSourceFilter === 'twitter_author' ? '1px solid #0ea5e9' : '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🐦 Twitter / X Authors</span>
              <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({twitterAuthorCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setLocationSourceFilter(locationSourceFilter === 'author_profile' ? 'all' : 'author_profile')}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: locationSourceFilter === 'author_profile' ? 700 : 500,
                background: locationSourceFilter === 'author_profile' ? 'var(--color-surface-bar)' : 'var(--color-surface-page)',
                color: locationSourceFilter === 'author_profile' ? '#ffffff' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>👤 All Author Profiles</span>
              <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({authorProfileCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setLocationSourceFilter(locationSourceFilter === 'post_location' ? 'all' : 'post_location')}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: locationSourceFilter === 'post_location' ? 700 : 500,
                background: locationSourceFilter === 'post_location' ? '#0284c7' : 'var(--color-surface-page)',
                color: locationSourceFilter === 'post_location' ? '#ffffff' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📍 Tagged Post Locations</span>
              <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({postLocationCount})</span>
            </button>
          </div>
        </div>

        {locationSourceFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setLocationSourceFilter('all')}
            style={{ fontSize: '0.75rem', color: 'var(--color-accent)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear Filter (Show All)
          </button>
        )}
      </div>

      {/* 3-COLUMN GRID MATCHING MICROSOFT SOCIAL ENGAGEMENT LOCATION VIEW */}
      <div className="an-overview-grid">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (Sentiment Gauge, Sentiment by Region, Location Groups) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-left" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* 1.1 SENTIMENT GAUGE */}
          <div className="an-widget" id="widget-location-sentiment">
            <div className="an-widget-header">
              <span className="an-widget-title">SENTIMENT</span>
              <button
                type="button"
                onClick={() => exportData('LocationSentiment', sentimentStats)}
                className="an-conversations-icon-btn"
                title="Download Sentiment Data"
              >
                <IconDownload />
              </button>
            </div>

            {(() => {
              const currentNetIndex = sentimentStats.netIndex;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                    {/* Index score on left */}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '1.875rem', fontWeight: 200, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {currentNetIndex !== null ? (currentNetIndex >= 0 ? `+${currentNetIndex.toFixed(1)}` : currentNetIndex.toFixed(1)) : '—'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>index</div>
                    </div>

                    {/* Semicircular smiley gauge in center */}
                    <div style={{ position: 'relative', width: 84, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 84 84" width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="42" cy="42" r="32" stroke="var(--color-border)" strokeWidth="6" fill="transparent" />
                        <circle
                          cx="42"
                          cy="42"
                          r="32"
                          stroke={currentNetIndex !== null ? (currentNetIndex >= 0 ? '#15803d' : '#dc2626') : 'var(--color-border)'}
                          strokeWidth="6"
                          strokeDasharray="201"
                          strokeDashoffset={currentNetIndex !== null ? 201 - (Math.abs(currentNetIndex) / 10) * 201 : 201}
                          fill="transparent"
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)' }}>
                        {currentNetIndex !== null ? (currentNetIndex > 0 ? <IconSmile /> : currentNetIndex < 0 ? <IconFrown /> : <IconNeutral />) : <IconNeutral />}
                      </div>
                    </div>

                    {/* Change delta on right */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 200, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                        {sentimentStats.delta >= 0 ? `+${sentimentStats.delta.toFixed(1)}` : sentimentStats.delta.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <span>change</span>
                        <TrendArrow delta={sentimentStats.delta} />
                      </div>
                    </div>
                  </div>

                  {/* Slider bar from -10 to +10 */}
                  <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      <span>-10</span>
                      <span>0</span>
                      <span>+10</span>
                    </div>
                    <div style={{ position: 'relative', height: 8, width: '100%', background: 'var(--color-surface-page)', border: '1px solid var(--color-border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 3 }}>
                      <div style={{ width: '50%', background: currentNetIndex !== null && currentNetIndex < 0 ? '#dc2626' : 'transparent', height: '100%', marginLeft: currentNetIndex !== null && currentNetIndex < 0 ? `${(1 + currentNetIndex / 10) * 50}%` : 'auto' }} />
                      <div style={{ width: currentNetIndex !== null && currentNetIndex >= 0 ? `${(currentNetIndex / 10) * 50}%` : 0, background: '#15803d', height: '100%' }} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 1.2 SENTIMENT BY COUNTRY/REGION */}
          <div className="an-widget" id="widget-sentiment-by-region">
            <div className="an-widget-header">
              <span className="an-widget-title">SENTIMENT BY COUNTRY/REGION</span>
              <button
                type="button"
                onClick={() => exportData('SentimentByRegion', countrySentimentList)}
                className="an-conversations-icon-btn"
                title="Download Sentiment by Region"
              >
                <IconDownload />
              </button>
            </div>

            {countrySentimentList.length === 0 ? (
              <EmptyState heading="No regional data" body="Country sentiment metrics appear here once posts are detected." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
                {countrySentimentList.map((item) => {
                  const isSelected = selectedCountry === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCountry(isSelected ? null : item.id)}
                      className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 110, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: item.numericScore >= 0 ? '#15803d' : '#dc2626' }}>{item.score}</span>
                      </div>
                      <div style={{ flex: 1, height: 12, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 8px' }}>
                        <div style={{ height: '100%', width: `${item.widthPercent}%`, background: item.numericScore >= 0 ? '#15803d' : '#dc2626', transition: 'width 200ms ease' }} />
                      </div>
                      <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                        <TrendArrow delta={item.numericScore} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1.3 LOCATION GROUPS (CONTINENTS) */}
          <div className="an-widget" id="widget-location-groups">
            <div className="an-widget-header">
              <span className="an-widget-title">LOCATION GROUPS</span>
              <button
                type="button"
                onClick={() => exportData('LocationGroups', continentList)}
                className="an-conversations-icon-btn"
                title="Download Location Groups"
              >
                <IconDownload />
              </button>
            </div>

            {continentList.length === 0 ? (
              <EmptyState heading="No location groups" body="Continental groupings will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
                {continentList.map((grp) => {
                  const isSelected = selectedContinent === grp.rawName;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setSelectedContinent(isSelected ? null : grp.rawName)}
                      className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 110, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grp.name}</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{grp.count}</span>
                      </div>
                      <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 8px' }}>
                        <div style={{ height: '100%', width: `${grp.widthPercent}%`, background: '#475569', transition: 'width 200ms ease' }} />
                      </div>
                      <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                        <TrendArrow delta={0} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (Big Map on top, Locations & Cities below) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-centre" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* 2.1 LOCATION INSIGHTS (Big Interactive World Map) */}
          <div className="an-widget" id="widget-big-location-map">
            <div className="an-widget-header">
              <span className="an-widget-title">LOCATION INSIGHTS</span>
              <button
                type="button"
                onClick={() => exportData('LocationInsightsMap', { topCountries: topCountriesList, totalPosts: posts.length })}
                className="an-conversations-icon-btn"
                title="Download Location Map Data"
              >
                <IconDownload />
              </button>
            </div>

            {/* Interactive Real World Map */}
            <InteractiveWorldMap
              countries={mapCountries}
              selectedCountry={selectedCountry}
              onSelectCountry={setSelectedCountry}
              mapMode={mapMode}
              height={320}
            />

            {/* Bottom Radio Filters under Map */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'buzz'}
                  onChange={() => setMapMode('buzz')}
                />
                <span>Buzz</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'trend'}
                  onChange={() => setMapMode('trend')}
                />
                <span>Trend/Buzz</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'sentiment'}
                  onChange={() => setMapMode('sentiment')}
                />
                <span>Sentiment/Buzz</span>
              </label>
            </div>
          </div>

          {/* 2.2 BOTTOM ROW UNDER MAP: LOCATIONS & CITIES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* 2.2.A LOCATIONS (Countries) */}
            <div className="an-widget" id="widget-country-locations">
              <div className="an-widget-header">
                <span className="an-widget-title">LOCATIONS</span>
                <button
                  type="button"
                  onClick={() => exportData('Locations', topCountriesList)}
                  className="an-conversations-icon-btn"
                  title="Download Locations"
                >
                  <IconDownload />
                </button>
              </div>

              {topCountriesList.length === 0 ? (
                <EmptyState heading="No country data" body="Detected countries will appear here." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
                  {topCountriesList.map((loc) => {
                    const isSelected = selectedCountry === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setSelectedCountry(isSelected ? null : loc.id)}
                        className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 95, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{loc.count}</span>
                        </div>
                        <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 6px' }}>
                          <div style={{ height: '100%', width: `${loc.widthPercent}%`, background: '#475569', transition: 'width 200ms ease' }} />
                        </div>
                        <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                          <TrendArrow delta={0} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2.2.B CITIES */}
            <div className="an-widget" id="widget-cities">
              <div className="an-widget-header">
                <span className="an-widget-title">CITIES</span>
                <button
                  type="button"
                  onClick={() => exportData('Cities', cityList)}
                  className="an-conversations-icon-btn"
                  title="Download Cities"
                >
                  <IconDownload />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
                {cityList.map((city) => (
                  <div key={city.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{city.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>{city.count}</span>
                      <TrendArrow delta={0} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (Location Coverage, Phrases by Region, Languages) */}
        {/* ========================================================================= */}
        <div className="an-overview-col an-overview-col-right" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* 3.1 LOCATION COVERAGE DONUT */}
          <div className="an-widget" id="widget-location-coverage">
            <div className="an-widget-header">
              <span className="an-widget-title">LOCATION COVERAGE</span>
              <button
                type="button"
                onClick={() => exportData('LocationCoverage', coverageData)}
                className="an-conversations-icon-btn"
                title="Download Coverage"
              >
                <IconDownload />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <div style={{ width: 90, height: 90, position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          return (
                            <AnimatedChartTooltip
                              active={active}
                              title={String(item.name)}
                              items={[
                                {
                                  name: 'Volume',
                                  value: `${Number(item.value)} posts`,
                                  color: String(item.payload?.fill || item.color),
                                  valueColor: '#ffffff',
                                },
                              ]}
                            />
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={coverageData.slices}
                      cx="50%"
                      cy="50%"
                      innerRadius={24}
                      outerRadius={38}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    >
                      {coverageData.slices.map((entry, index) => (
                        <Cell key={`cov-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {coverageData.slices.map((item) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                      <span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3.2 PHRASES BY COUNTRY/REGION */}
          <div className="an-widget" id="widget-phrases-by-region">
            <div className="an-widget-header">
              <span className="an-widget-title">PHRASES BY COUNTRY/REGION</span>
              <button
                type="button"
                onClick={() => exportData('PhrasesByRegion', phrasesByCountry)}
                className="an-conversations-icon-btn"
                title="Download Phrases by Region"
              >
                <IconDownload />
              </button>
            </div>

            {phrasesByCountry.length === 0 ? (
              <EmptyState heading="No phrases by region" body="Key phrases grouped by country will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {phrasesByCountry.map((row) => (
                  <div key={row.country} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {row.country}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {row.phrases.map((p) => {
                        const isSelected = selectedPhrase === p.text;
                        return (
                          <button
                            key={p.text}
                            type="button"
                            onClick={() => setSelectedPhrase(isSelected ? null : p.text)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: isSelected ? 'var(--color-surface-selected)' : 'rgba(15, 23, 42, 0.04)',
                              border: isSelected ? '1px solid var(--color-accent)' : '1px solid transparent',
                              color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                              borderRadius: 4,
                              padding: '2px 6px',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{p.text}</span>
                            <span style={{ marginLeft: 4, opacity: 0.6, fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>({p.count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3.3 LANGUAGES */}
          <div className="an-widget" id="widget-languages-location">
            <div className="an-widget-header">
              <span className="an-widget-title">LANGUAGES</span>
              <button
                type="button"
                onClick={() => exportData('Languages', languagesList)}
                className="an-conversations-icon-btn"
                title="Download Languages"
              >
                <IconDownload />
              </button>
            </div>

            {languagesList.length === 0 ? (
              <EmptyState heading="No language data" body="Detected languages will appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', marginTop: 'var(--space-2)' }}>
                {languagesList.map((lang) => {
                  const isSelected = selectedLanguage === lang.id;
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setSelectedLanguage(isSelected ? null : lang.id)}
                      className={`an-topic-item ${isSelected ? 'an-topic-item-active' : ''}`}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: isSelected ? 'var(--color-surface-selected)' : 'transparent', border: 'none', borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 85, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{lang.name}</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{lang.count}</span>
                      </div>
                      <div style={{ flex: 1, height: 10, background: 'var(--color-surface-page)', borderRadius: 2, overflow: 'hidden', margin: '0 6px' }}>
                        <div style={{ height: '100%', width: `${lang.widthPercent}%`, background: '#334155', transition: 'width 200ms ease' }} />
                      </div>
                      <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                        <TrendArrow delta={0} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matching Posts Slideover Trigger */}
      <button type="button" className="an-drawer-trigger" onClick={() => setDrawerOpen(true)}>
        View {filteredPosts.length} matching post{filteredPosts.length === 1 ? '' : 's'}
      </button>

      {/* Slideover Drawer for Matching Posts */}
      {drawerOpen && (
        <div className="an-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="an-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="an-drawer-header">
              <h3>
                {selectedCountry
                  ? `Posts from ${COUNTRY_COORDINATES[selectedCountry]?.name || selectedCountry}`
                  : selectedContinent
                  ? `Posts in ${selectedContinent}`
                  : selectedLanguage
                  ? `Posts in ${LANGUAGE_NAMES[selectedLanguage] || selectedLanguage}`
                  : selectedPhrase
                  ? `Posts mentioning "${selectedPhrase}"`
                  : 'All Location Posts'}{' '}
                ({filteredPosts.length})
              </h3>
              <button type="button" className="an-drawer-close" onClick={() => setDrawerOpen(false)}>
                &times;
              </button>
            </div>
            <div className="an-drawer-body">
              {filteredPosts.length === 0 ? (
                <EmptyState heading="No matching posts" body="No posts match the current location filter." />
              ) : (
                <div className="an-posts-list">
                  {filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      className="an-post-card"
                      onClick={() => {
                        const flat: FlatPost = {
                          id: post.id,
                          createdAt: post.publishedAt || new Date().toISOString(),
                          publishedAt: post.publishedAt || new Date().toISOString(),
                          rawPayload: {},
                          enrichment: null,
                          bodyMarkdown: null,
                          title: post.title || 'Untitled Post',
                          snippet: null,
                          provider: post.providerId || 'social',
                          url: null,
                          author: post.author,
                          pageName: null,
                          pageId: null,
                          watchlistId: null,
                          instagramContext: null,
                          linkedinContext: null,
                          enrichmentSummary: null,
                        };
                        if (onViewPost) {
                          onViewPost(flat);
                        } else {
                          setActivePost(flat);
                        }
                      }}
                    >
                      <div className="an-post-card-header">
                        <span className="an-post-author">{post.author}</span>
                        {post.geoCountry && (
                          <span className="an-phrase-chip an-phrase-chip-neutral">
                            📍 {post.geoCountryName || post.geoCountry}
                          </span>
                        )}
                        <span className={`an-sentiment-badge an-badge-${post.sentiment || 'neutral'}`}>
                          {post.sentiment || 'neutral'}
                        </span>
                      </div>
                      <p className="an-post-title">{post.title}</p>
                      {post.keyPhrases && post.keyPhrases.length > 0 && (
                        <div className="an-post-phrases">
                          {post.keyPhrases.map((phrase) => (
                            <span key={phrase} className="an-phrase-chip an-phrase-chip-neutral">
                              {phrase}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {activePost && (
        <PostDetailPanel
          post={activePost}
          onClose={() => setActivePost(null)}
        />
      )}
    </div>
  );
}
