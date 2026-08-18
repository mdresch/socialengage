import React, { useState, useMemo } from 'react';
import {
  Smile,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  Globe,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  Layers,
  MapPin,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Post } from '../types';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';

interface LocationDashboardTabProps {
  filteredPosts: Post[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  activeRegionFilter: string | null;
  onSelectRegion: (region: string | null) => void;
  activeLanguageFilter: string | null;
  onSelectLanguage: (lang: string | null) => void;
  onSelectPhrase?: (phrase: string | null) => void;
  onOpenPostsDrawer: () => void;
  onExportWidgetData: (widgetName: string, data: any) => void;
}

export const LocationDashboardTab: React.FC<LocationDashboardTabProps> = ({
  filteredPosts,
  selectedTopic,
  onSelectTopic,
  activeRegionFilter,
  onSelectRegion,
  activeLanguageFilter,
  onSelectLanguage,
  onSelectPhrase,
  onOpenPostsDrawer,
  onExportWidgetData,
}) => {
  // Map visualization mode
  const [mapMode, setMapMode] = useState<'buzz' | 'trend' | 'sentiment'>('buzz');
  const [selectedMapPoint, setSelectedMapPoint] = useState<string | null>(null);

  // 1. Sentiment by Country / Region
  const sentimentByRegion = useMemo(() => [
    { id: 'uk', name: 'United King...', fullName: 'United Kingdom', score: '+10', widthPercent: 100, trend: 'up' },
    { id: 'us', name: 'United States', fullName: 'United States', score: '+10', widthPercent: 100, trend: 'up' },
    { id: 'in', name: 'India', fullName: 'India', score: '+10', widthPercent: 100, trend: 'up' },
    { id: 'it', name: 'Italy', fullName: 'Italy', score: '+10', widthPercent: 100, trend: 'up' },
  ], []);

  // 2. Location Groups (Continents)
  const locationGroups = useMemo(() => [
    { id: 'europe', name: 'EUROPE', count: 63, widthPercent: 80, trend: 'flat' },
    { id: 'asia', name: 'ASIA', count: 4, widthPercent: 6, trend: 'flat' },
    { id: 'north_america', name: 'NORTH AMERI...', fullName: 'NORTH AMERICA', count: 4, widthPercent: 6, trend: 'flat' },
  ], []);

  // 3. Locations (Countries)
  const countryLocations = useMemo(() => [
    { id: 'uk', name: 'United Kingdom', count: 59, widthPercent: 75, trend: 'flat' },
    { id: 'us', name: 'United States', count: 4, widthPercent: 6, trend: 'flat' },
    { id: 'in', name: 'India', count: 4, widthPercent: 6, trend: 'flat' },
    { id: 'it', name: 'Italy', count: 2, widthPercent: 4, trend: 'flat' },
    { id: 'ie', name: 'Ireland', count: 1, widthPercent: 2, trend: 'flat' },
  ], []);

  // 4. Cities
  const cityLocations = useMemo(() => [
    { id: 'london', name: 'London', count: 6, trend: 'flat' },
    { id: 'reading', name: 'Reading', count: 4, trend: 'flat' },
    { id: 'bath', name: 'Bath', count: 3, trend: 'flat' },
    { id: 'glasgow', name: 'Glasgow', count: 3, trend: 'flat' },
    { id: 'leeds', name: 'Leeds', count: 3, trend: 'flat' },
  ], []);

  // 5. Location Coverage (Author location: 80.5%, Unknown: 18.4%, Post location: 1.1%)
  const locationCoverageData = useMemo(() => {
    const slices = [
      { name: 'Author location', value: 80.5, color: '#0F172A' },
      { name: 'Unknown', value: 18.4, color: '#64748B' },
      { name: 'Post location', value: 1.1, color: '#0284C7' },
    ];
    const items = [
      { name: 'Post location', percent: '1.1%', color: 'bg-sky-600' },
      { name: 'Author location', percent: '80.5%', color: 'bg-slate-900' },
      { name: 'Unknown', percent: '18.4%', color: 'bg-slate-500' },
    ];
    return { slices, items };
  }, []);

  // 6. Phrases by Country / Region
  const phrasesByRegion = useMemo(() => [
    {
      country: 'United Kin...',
      countryId: 'uk',
      phrases: [
        { text: 'will', size: 'text-base font-normal text-slate-800' },
        { text: 'stand', size: 'text-xs text-slate-500' },
        { text: 'nov', size: 'text-xs text-slate-500' },
      ],
    },
    {
      country: 'United Sta...',
      countryId: 'us',
      phrases: [
        { text: 'years', size: 'text-base font-normal text-slate-800' },
        { text: 'will', size: 'text-xs text-slate-500' },
        { text: 'today', size: 'text-xs text-slate-500' },
      ],
    },
    {
      country: 'India',
      countryId: 'in',
      phrases: [
        { text: '#future...', size: 'text-base font-normal text-slate-800' },
        { text: 'join', size: 'text-xs text-slate-500' },
      ],
    },
    {
      country: 'Italy',
      countryId: 'it',
      phrases: [
        { text: 'join', size: 'text-sm font-medium text-slate-800' },
        { text: '@u...', size: 'text-xs text-slate-500' },
        { text: 'discusses ...', size: 'text-xs text-slate-500' },
        { text: 'challenges', size: 'text-xs text-slate-500' },
      ],
    },
    {
      country: 'Ireland',
      countryId: 'ie',
      phrases: [
        { text: 'find', size: 'text-base font-normal text-slate-800' },
        { text: 'today', size: 'text-xs text-slate-500' },
      ],
    },
  ], []);

  // 7. Languages (English 87)
  const languagesData = useMemo(() => [
    { id: 'en', name: 'English', count: 87, widthPercent: 100, barColor: 'bg-slate-700', trend: 'flat' },
  ], []);

  const renderTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    if (trend === 'down') {
      return <ArrowDownRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    }
    return <MoveRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
  };

  return (
    <div className="space-y-4" id="location-tab-view">
      {/* 3-COLUMN STRUCTURE MATCHING MICROSOFT SOCIAL ENGAGEMENT LOCATION VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (Sentiment Gauge, Sentiment by Region, Location Groups) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1.1 SENTIMENT GAUGE */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-location-sentiment">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Sentiment', { index: 10.0, change: 10.0 })}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Sentiment Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {/* Index score on left */}
              <div className="text-left">
                <div className="text-3xl font-extralight text-slate-900 tracking-tight">
                  10.0
                </div>
                <div className="text-[11px] text-slate-500 font-normal">index</div>
              </div>

              {/* Semicircular smiley gauge in center */}
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#E2E8F0"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Full Green Ring */}
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#15803D"
                    strokeWidth="7"
                    strokeDasharray="213"
                    strokeDashoffset="0"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                  <Smile className="w-7 h-7 text-slate-700 stroke-1.5" />
                </div>
              </div>

              {/* Change delta on right */}
              <div className="text-right">
                <div className="text-2xl font-extralight text-slate-900">
                  10.0
                </div>
                <div className="text-[11px] text-slate-500 font-normal flex items-center justify-end gap-1">
                  <span>change</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-700" />
                </div>
              </div>
            </div>

            {/* Slider bar from -10 to +10 with full green positive fill */}
            <div className="mt-4 pt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
              </div>
              <div className="relative h-3 w-full bg-slate-100 border border-slate-200/80 overflow-hidden flex">
                <div className="w-1/2 bg-transparent" />
                <div className="w-1/2 bg-emerald-600 h-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* 1.2 SENTIMENT BY COUNTRY/REGION */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sentiment-by-region">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT BY COUNTRY/REGION
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('SentimentByRegion', sentimentByRegion)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Sentiment by Region"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {sentimentByRegion.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectRegion(activeRegionFilter === item.id ? null : item.id)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                    activeRegionFilter === item.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-28 shrink-0 pr-1 text-left">
                    <span className="text-[11px] text-slate-700 truncate">{item.name}</span>
                    <span className="text-[11px] font-mono text-slate-800">{item.score}</span>
                  </div>

                  <div className="flex-1 h-3.5 bg-slate-100 rounded-none overflow-hidden mx-2">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${item.widthPercent}%` }}
                    />
                  </div>

                  <div className="shrink-0">
                    {renderTrendIcon(item.trend)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 1.3 LOCATION GROUPS */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-location-groups">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LOCATION GROUPS
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('LocationGroups', locationGroups)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Location Groups"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 mt-2">
              {locationGroups.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => onSelectRegion(activeRegionFilter === grp.id ? null : grp.id)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                    activeRegionFilter === grp.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-28 shrink-0 pr-2 text-left">
                    <span className="text-[11px] text-slate-700 font-normal truncate">{grp.name}</span>
                    <span className="text-[11px] font-mono text-slate-800">{grp.count}</span>
                  </div>

                  <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                    <div
                      className="h-full bg-slate-600"
                      style={{ width: `${grp.widthPercent}%` }}
                    />
                  </div>

                  <div className="shrink-0">
                    {renderTrendIcon(grp.trend)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (Big Map on top, Locations & Cities below) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* 2.1 LOCATION INSIGHTS (Big World Map with UK Cluster '59') */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-big-location-map">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LOCATION INSIGHTS
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('LocationInsightsMap', { totalLocations: 87, ukCluster: 59 })}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Location Map Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="relative w-full h-[320px] bg-[#B9CEEB] border border-slate-200 overflow-hidden select-none">
              <svg viewBox="0 0 1000 500" className="w-full h-full object-cover">
                {/* Landmasses (Off-white / Light stone) */}
                <path d="M150 90 L240 70 L300 80 L350 140 L280 200 L200 240 L160 180 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />
                <path d="M260 270 L320 280 L340 370 L300 440 L270 380 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />
                <path d="M470 70 L560 60 L580 130 L520 160 L450 110 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />
                <path d="M470 160 L560 160 L580 250 L540 340 L470 270 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />
                <path d="M570 70 L800 80 L850 190 L760 250 L590 200 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />
                <path d="M780 320 L860 310 L880 380 L800 390 Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.75" />

                {/* Continental Typography */}
                <text x="320" y="170" fill="#64748B" fontSize="16" fontFamily="sans-serif" letterSpacing="2">NORTH</text>
                <text x="310" y="195" fill="#64748B" fontSize="16" fontFamily="sans-serif" letterSpacing="2">AMERICA</text>

                <text x="380" y="320" fill="#64748B" fontSize="14" fontFamily="sans-serif" letterSpacing="2">SOUTH</text>
                <text x="370" y="340" fill="#64748B" fontSize="14" fontFamily="sans-serif" letterSpacing="2">AMERICA</text>

                <text x="510" y="270" fill="#64748B" fontSize="16" fontFamily="sans-serif" letterSpacing="2">AFRICA</text>
                <text x="635" y="150" fill="#64748B" fontSize="16" fontFamily="sans-serif" letterSpacing="2">ASIA</text>
                <text x="665" y="360" fill="#64748B" fontSize="14" fontFamily="sans-serif" letterSpacing="2">AUSTRALIA</text>

                <text x="415" y="235" fill="#3B82F6" fontSize="11" fontStyle="italic" fontFamily="sans-serif">Atlantic</text>
                <text x="417" y="247" fill="#3B82F6" fontSize="11" fontStyle="italic" fontFamily="sans-serif">Ocean</text>

                <text x="607" y="315" fill="#3B82F6" fontSize="11" fontStyle="italic" fontFamily="sans-serif">Indian</text>
                <text x="607" y="327" fill="#3B82F6" fontSize="11" fontStyle="italic" fontFamily="sans-serif">Ocean</text>

                {/* Hotspot Circles with Interactive Hover & Tooltips */}
                {/* 1. Large UK Cluster '59' */}
                <g
                  className="cursor-pointer group"
                  onClick={() => onSelectRegion(activeRegionFilter === 'uk' ? null : 'uk')}
                  onMouseEnter={() => setSelectedMapPoint('uk')}
                  onMouseLeave={() => setSelectedMapPoint(null)}
                >
                  <circle
                    cx="485"
                    cy="120"
                    r={selectedMapPoint === 'uk' ? 27 : 24}
                    fill="#64748B"
                    opacity={selectedMapPoint === 'uk' ? 0.95 : 0.85}
                    stroke="#334155"
                    strokeWidth={selectedMapPoint === 'uk' ? 2.5 : 1.5}
                    className="transition-all duration-200"
                  />
                  <text x="485" y="125" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">59</text>
                </g>

                {/* 2. Smaller Dot in US */}
                <g
                  className="cursor-pointer group"
                  onClick={() => onSelectRegion(activeRegionFilter === 'us' ? null : 'us')}
                  onMouseEnter={() => setSelectedMapPoint('us')}
                  onMouseLeave={() => setSelectedMapPoint(null)}
                >
                  <circle
                    cx="340"
                    cy="180"
                    r={selectedMapPoint === 'us' ? 8 : 5}
                    fill="#64748B"
                    opacity={0.85}
                    stroke="#334155"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                </g>

                {/* 3. Dot in Southern Europe / Italy */}
                <g
                  className="cursor-pointer group"
                  onClick={() => onSelectRegion(activeRegionFilter === 'it' ? null : 'it')}
                  onMouseEnter={() => setSelectedMapPoint('it')}
                  onMouseLeave={() => setSelectedMapPoint(null)}
                >
                  <circle
                    cx="510"
                    cy="155"
                    r={selectedMapPoint === 'it' ? 7.5 : 4.5}
                    fill="#64748B"
                    opacity={0.85}
                    stroke="#334155"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                </g>

                {/* 4. Dot in Germany/Central Europe */}
                <g
                  className="cursor-pointer group"
                  onMouseEnter={() => setSelectedMapPoint('de')}
                  onMouseLeave={() => setSelectedMapPoint(null)}
                >
                  <circle
                    cx="520"
                    cy="130"
                    r={selectedMapPoint === 'de' ? 6 : 3.5}
                    fill="#64748B"
                    opacity={0.85}
                    stroke="#334155"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                </g>

                {/* 5. Dot in India */}
                <g
                  className="cursor-pointer group"
                  onClick={() => onSelectRegion(activeRegionFilter === 'in' ? null : 'in')}
                  onMouseEnter={() => setSelectedMapPoint('in')}
                  onMouseLeave={() => setSelectedMapPoint(null)}
                >
                  <circle
                    cx="612"
                    cy="190"
                    r={selectedMapPoint === 'in' ? 8 : 5}
                    fill="#64748B"
                    opacity={0.85}
                    stroke="#334155"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                </g>
              </svg>

              {/* Smooth Animated Floating Map Hotspot Tooltip */}
              <AnimatePresence>
                {selectedMapPoint && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 2 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 350 }}
                    className="absolute top-4 right-4 bg-slate-900/95 text-white px-3 py-2 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs pointer-events-none z-30 min-w-[140px]"
                  >
                    {selectedMapPoint === 'uk' && (
                      <div>
                        <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                          United Kingdom
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Buzz Volume:</span>
                          <span className="font-mono font-bold text-white">59 posts</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Sentiment:</span>
                          <span className="text-emerald-400 font-semibold">+10.0 ↗</span>
                        </div>
                      </div>
                    )}
                    {selectedMapPoint === 'us' && (
                      <div>
                        <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                          United States
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Buzz Volume:</span>
                          <span className="font-mono font-bold text-white">4 posts</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Sentiment:</span>
                          <span className="text-emerald-400 font-semibold">+10.0 ↗</span>
                        </div>
                      </div>
                    )}
                    {selectedMapPoint === 'it' && (
                      <div>
                        <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                          Italy
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Buzz Volume:</span>
                          <span className="font-mono font-bold text-white">2 posts</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Sentiment:</span>
                          <span className="text-emerald-400 font-semibold">+10.0 ↗</span>
                        </div>
                      </div>
                    )}
                    {selectedMapPoint === 'de' && (
                      <div>
                        <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                          Germany / Central EU
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Buzz Volume:</span>
                          <span className="font-mono font-bold text-white">1 post</span>
                        </div>
                      </div>
                    )}
                    {selectedMapPoint === 'in' && (
                      <div>
                        <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1">
                          India
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Buzz Volume:</span>
                          <span className="font-mono font-bold text-white">4 posts</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Sentiment:</span>
                          <span className="text-emerald-400 font-semibold">+10.0 ↗</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Left: Buzz Volume Scale Graphic */}
              <div className="absolute bottom-2 left-2 bg-slate-800/80 text-white p-2 rounded-none text-[10px] space-y-1 backdrop-blur-xs">
                <div className="font-semibold text-slate-200">Buzz Volume</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-[9px]">
                    59
                  </div>
                  <div className="space-y-0.5 text-[9px] text-slate-300">
                    <div>59</div>
                    <div>30</div>
                    <div>0</div>
                  </div>
                </div>
              </div>

              {/* Bottom Center: Watermark */}
              <div className="absolute bottom-1 right-24 text-[8px] text-slate-600 font-sans">
                © 2017 Microsoft Corporation © 2017 HERE
              </div>

              {/* Bottom Right: Zoom Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-800/80 p-1 text-white rounded-none">
                <button type="button" className="p-1 hover:bg-slate-700" title="Zoom Out">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="p-1 hover:bg-slate-700" title="Zoom In">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Radio Filters under Map */}
            <div className="flex items-center gap-6 mt-3 pt-2 text-xs text-slate-700 border-t border-slate-100">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'buzz'}
                  onChange={() => setMapMode('buzz')}
                  className="text-sky-600 focus:ring-0"
                />
                <span>Buzz</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'trend'}
                  onChange={() => setMapMode('trend')}
                  className="text-sky-600 focus:ring-0"
                />
                <span>Trend/Buzz</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="mapMode"
                  checked={mapMode === 'sentiment'}
                  onChange={() => setMapMode('sentiment')}
                  className="text-sky-600 focus:ring-0"
                />
                <span>Sentiment/Buzz</span>
              </label>
            </div>
          </div>

          {/* 2.2 BOTTOM ROW UNDER MAP: LOCATIONS & CITIES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2.2.A LOCATIONS (Countries) */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-country-locations">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  LOCATIONS
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('Locations', countryLocations)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Locations"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {countryLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectRegion(activeRegionFilter === loc.id ? null : loc.id)}
                    className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                      activeRegionFilter === loc.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-28 shrink-0 pr-2 text-left">
                      <span className="text-[11px] text-slate-700 truncate">{loc.name}</span>
                      <span className="text-[11px] font-mono text-slate-800">{loc.count}</span>
                    </div>

                    <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                      <div
                        className="h-full bg-slate-600"
                        style={{ width: `${loc.widthPercent}%` }}
                      />
                    </div>

                    <div className="shrink-0">
                      {renderTrendIcon(loc.trend)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2.2.B CITIES */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-cities">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  CITIES
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('Cities', cityLocations)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Cities"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {cityLocations.map((city) => (
                  <div key={city.id} className="flex items-center justify-between p-1">
                    <span className="text-[11px] text-slate-700">{city.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-slate-800 font-medium">
                        {city.count}
                      </span>
                      {renderTrendIcon(city.trend)}
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
        <div className="lg:col-span-3 space-y-4">
          {/* 3.1 LOCATION COVERAGE DONUT */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-location-coverage">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LOCATION COVERAGE
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('LocationCoverage', locationCoverageData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Coverage"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <PieChart width={96} height={96}>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            items={[
                              {
                                name: String(item.name || ''),
                                value: `${item.value}%`,
                                color: (item.payload as any)?.color || '#0F172A',
                                badge: 'Click to filter',
                              },
                            ]}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={locationCoverageData.slices}
                    cx={44}
                    cy={44}
                    innerRadius={26}
                    outerRadius={40}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry) => {
                      if (entry && entry.name) {
                        onSelectRegion(activeRegionFilter === entry.name ? null : entry.name);
                      }
                    }}
                  >
                    {locationCoverageData.slices.map((entry, index) => (
                      <Cell key={`cov-slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              <div className="flex-1 pl-3 space-y-2 text-xs">
                {locationCoverageData.items.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => onSelectRegion(activeRegionFilter === item.name ? null : item.name)}
                    className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                      activeRegionFilter === item.name ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 ${item.color} shrink-0 inline-block`} />
                      <span className="text-[11px] text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-800 font-semibold shrink-0 ml-1">
                      {item.percent}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3.2 PHRASES BY COUNTRY/REGION */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-phrases-by-region">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                PHRASES BY COUNTRY/REGION
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('PhrasesByRegion', phrasesByRegion)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Phrases by Region"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 mt-2">
              {phrasesByRegion.map((row) => (
                <div key={row.country} className="flex items-center gap-2">
                  <span className="w-20 text-[11px] text-slate-700 truncate shrink-0">
                    {row.country}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {row.phrases.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectPhrase && onSelectPhrase(p.text)}
                        className={`${p.size} hover:underline cursor-pointer transition-colors`}
                      >
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3.3 LANGUAGES */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-languages-location">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LANGUAGES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Languages', languagesData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Languages"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {languagesData.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => onSelectLanguage(activeLanguageFilter === lang.id ? null : lang.id)}
                  className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors ${
                    activeLanguageFilter === lang.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-20 shrink-0 pr-2 text-left">
                    <span className="text-[11px] text-slate-700">{lang.name}</span>
                    <span className="text-[11px] font-mono text-slate-800">{lang.count}</span>
                  </div>

                  <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                    <div className={`h-full ${lang.barColor} w-full`} />
                  </div>

                  <div className="shrink-0">
                    {renderTrendIcon(lang.trend)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
