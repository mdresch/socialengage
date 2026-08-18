import React, { useState, useMemo } from 'react';
import {
  Smile,
  Meh,
  Frown,
  Download,
  Maximize2,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  Search,
  Filter,
  Layers,
  Radio,
  Share2,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Post, IngestionSourceType } from '../types';
import { AnimatedChartTooltip } from './AnimatedChartTooltip';

interface ConversationsDashboardTabProps {
  filteredPosts: Post[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  activeIntentionFilter: string | null;
  onSelectIntention: (intention: string | null) => void;
  activeTagFilter: string | null;
  onSelectTag: (tag: string | null) => void;
  activePhraseFilter: string | null;
  onSelectPhrase: (phrase: string | null) => void;
  activeSourceFilter: string | null;
  onSelectSource: (source: string | null) => void;
  activeLanguageFilter: string | null;
  onSelectLanguage: (lang: string | null) => void;
  onOpenPostsDrawer: () => void;
  onExportWidgetData: (widgetName: string, data: any) => void;
}

export const ConversationsDashboardTab: React.FC<ConversationsDashboardTabProps> = ({
  filteredPosts,
  selectedTopic,
  onSelectTopic,
  activeIntentionFilter,
  onSelectIntention,
  activeTagFilter,
  onSelectTag,
  activePhraseFilter,
  onSelectPhrase,
  activeSourceFilter,
  onSelectSource,
  activeLanguageFilter,
  onSelectLanguage,
  onOpenPostsDrawer,
  onExportWidgetData,
}) => {
  // Modal for expanding widgets
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  // 1. Intentions dataset (from MSE reference: 53,398 posts with intentions)
  const intentionsData = useMemo(() => {
    const items = [
      { id: 'information_request', label: 'Information r...', fullLabel: 'Information request', count: 50996, trend: 'down', color: '#1E293B' },
      { id: 'purchase', label: 'Purchase', fullLabel: 'Purchase Intention', count: 1522, trend: 'up', color: '#334155' },
      { id: 'support_request', label: 'Support requ...', fullLabel: 'Support request', count: 1486, trend: 'flat', color: '#475569' },
      { id: 'complaint', label: 'Complaint', fullLabel: 'Customer Complaint', count: 144, trend: 'down', color: '#64748B' },
    ];
    const total = 53398;
    const slices = [
      { name: 'Information request', value: 50996, color: '#111827' },
      { name: 'Purchase', value: 1522, color: '#374151' },
      { name: 'Support request', value: 1486, color: '#4B5563' },
      { name: 'Complaint', value: 144, color: '#9CA3AF' },
    ];
    return { items, total, slices };
  }, []);

  // 2. Tags dataset (from MSE reference: 757 posts with tags)
  const tagsData = useMemo(() => {
    const items = [
      { id: 'announcement', label: 'Announcement', count: 701, trend: 'up', color: '#1E293B' },
      { id: 'advocate', label: 'Advocate', count: 64, trend: 'down', color: '#334155' },
      { id: 'mse_today', label: 'MSE today', count: 1, trend: 'flat', color: '#475569' },
    ];
    const total = 757;
    const slices = [
      { name: 'Announcement', value: 701, color: '#111827' },
      { name: 'Advocate', value: 64, color: '#4B5563' },
      { name: 'MSE today', value: 1, color: '#9CA3AF' },
    ];
    return { items, total, slices };
  }, []);

  // 3. Main Word Cloud Phrases (Exact matching MSE Screenshot)
  const mainPhrases = useMemo(() => {
    return [
      { text: 'artificial intelligence', size: 'text-3xl md:text-4xl font-normal text-slate-800 tracking-tight', count: 142500, highlight: true },
      { text: 'microsoft', size: 'text-xl font-normal text-slate-700', count: 88200 },
      { text: 'cloud', size: 'text-sm font-normal text-slate-500', count: 32000 },
      { text: 'ai', size: 'text-sm font-normal text-slate-600', count: 41000 },
      { text: 'company', size: 'text-sm font-normal text-slate-500', count: 28000 },
      { text: 'technology', size: 'text-sm font-normal text-slate-600', count: 36000 },
      { text: 'need', size: 'text-xs font-normal text-slate-400', count: 18000 },
      { text: 'get', size: 'text-xs font-normal text-slate-400', count: 15000 },
      { text: 'may', size: 'text-xs font-normal text-slate-400', count: 12000 },
      { text: 'one', size: 'text-xs font-normal text-slate-500', count: 19000 },
      { text: 'business', size: 'text-sm font-normal text-slate-600', count: 29000 },
      { text: 'learning', size: 'text-xs font-normal text-slate-500', count: 22000 },
      { text: 'office', size: 'text-xs font-normal text-slate-500', count: 16000 },
      { text: 'just', size: 'text-xs font-normal text-slate-400', count: 14000 },
      { text: 'new', size: 'text-base font-normal text-slate-600', count: 34000 },
      { text: 'like', size: 'text-xs font-normal text-slate-400', count: 17000 },
      { text: 'use', size: 'text-xs font-normal text-slate-500', count: 21000 },
      { text: 'future', size: 'text-xs font-normal text-slate-500', count: 19500 },
      { text: 'time', size: 'text-xs font-normal text-slate-400', count: 13000 },
      { text: 'now', size: 'text-xs font-normal text-slate-500', count: 16500 },
      { text: 'services', size: 'text-xs font-normal text-slate-500', count: 22500 },
      { text: 'people', size: 'text-sm font-normal text-slate-600', count: 27000 },
      { text: 'us', size: 'text-xs font-normal text-slate-400', count: 11000 },
      { text: '@xboxsupport', size: 'text-xs font-normal text-slate-500', count: 18400 },
      { text: 'azure', size: 'text-xs font-normal text-slate-500', count: 24000 },
      { text: 'will', size: 'text-sm font-normal text-slate-600', count: 26000 },
      { text: 'via', size: 'text-xs font-normal text-slate-400', count: 12500 },
      { text: 'make', size: 'text-xs font-normal text-slate-400', count: 14200 },
      { text: 'can', size: 'text-sm font-normal text-slate-500', count: 23000 },
      { text: 'using', size: 'text-xs font-normal text-slate-500', count: 19800 },
      { text: 'see', size: 'text-xs font-normal text-slate-400', count: 15100 },
      { text: '#ai', size: 'text-xs font-normal text-slate-500', count: 21000 },
      { text: 'also', size: 'text-xs font-normal text-slate-400', count: 13400 },
      { text: 'data', size: 'text-xs font-normal text-slate-500', count: 24200 },
      { text: 'way', size: 'text-xs font-normal text-slate-400', count: 14800 },
      { text: 'world', size: 'text-xs font-normal text-slate-400', count: 15600 },
      { text: 'help', size: 'text-xs font-normal text-slate-400', count: 16200 },
      { text: 'first', size: 'text-xs font-normal text-slate-400', count: 13900 },
      { text: 'work', size: 'text-xs font-normal text-slate-400', count: 17100 },
      { text: 'machine', size: 'text-xs font-normal text-slate-500', count: 20500 },
    ];
  }, []);

  // 4. Twitter (X) specific phrases
  const twitterPhrases = useMemo(() => {
    return [
      { text: '#bigdata', size: 'text-xs text-sky-700' },
      { text: '#machinelearning', size: 'text-xs text-sky-600' },
      { text: '#cloud', size: 'text-xs text-sky-700' },
      { text: '@xboxsupport', size: 'text-sm font-medium text-sky-800' },
      { text: 'artificial', size: 'text-xs text-sky-600' },
      { text: 'artificial intelligence', size: 'text-sm font-medium text-sky-800' },
      { text: '#ai', size: 'text-sm font-semibold text-sky-900' },
      { text: '#azure', size: 'text-xs text-sky-700' },
      { text: 'intelligence', size: 'text-xs text-sky-600' },
      { text: '#artificialintelligence', size: 'text-xs text-sky-700' },
      { text: '@azure', size: 'text-xs text-sky-800' },
      { text: '#ml', size: 'text-xs text-sky-600' },
      { text: '#artificialintelligence #ai', size: 'text-xs text-sky-700' },
      { text: '#tech', size: 'text-xs text-sky-600' },
    ];
  }, []);

  // 5. Sources dataset (MSE reference: Twitter 453.1k, RSS 77,684, FB 52,391, YouTube 8,966, Reddit/Blog 3,681)
  const sourcesData = useMemo(() => {
    return [
      {
        id: 'twitter',
        name: 'Twitter',
        count: '453.1k',
        numericCount: 453100,
        percentage: 75.1,
        trend: 'down',
        barColor: 'bg-sky-400',
        icon: (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-sky-500">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        ),
      },
      {
        id: 'rss',
        name: 'RSS / Feeds',
        count: '77,684',
        numericCount: 77684,
        percentage: 12.9,
        trend: 'flat',
        barColor: 'bg-amber-500',
        icon: (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-amber-600">
            <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
          </svg>
        ),
      },
      {
        id: 'facebook',
        name: 'Facebook',
        count: '52,391',
        numericCount: 52391,
        percentage: 8.7,
        trend: 'up',
        barColor: 'bg-blue-800',
        icon: (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-blue-700">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        ),
      },
      {
        id: 'youtube',
        name: 'YouTube',
        count: '8,966',
        numericCount: 8966,
        percentage: 1.5,
        trend: 'flat',
        barColor: 'bg-rose-900',
        icon: (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-rose-600">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        ),
      },
      {
        id: 'reddit',
        name: 'Reddit / Blogs',
        count: '3,681',
        numericCount: 3681,
        percentage: 0.6,
        trend: 'flat',
        barColor: 'bg-orange-600',
        icon: (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-orange-600">
            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 14c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701z" />
          </svg>
        ),
      },
    ];
  }, []);

  // 6. Phrases History Timeline Data (artificial int... navy, microsoft teal, new green)
  const phrasesHistoryData = useMemo(() => {
    const dates = [
      '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '01', '02',
    ];
    return dates.map((d, i) => {
      // Artificial Intelligence (Navy Blue - wave peaks up to 14,000)
      const aiBase = 8000 + Math.sin(i * 0.9) * 4500 + Math.cos(i * 0.4) * 2000;
      // Microsoft (Teal - wave peaks around 4,500)
      const msftBase = 3000 + Math.sin(i * 0.8 + 1) * 1800 + Math.cos(i * 0.5) * 800;
      // New (Green - wave peaks around 3,200)
      const newBase = 2000 + Math.sin(i * 0.7 + 2) * 1400;

      return {
        date: d,
        artificialIntelligence: Math.max(1000, Math.round(aiBase)),
        microsoft: Math.max(500, Math.round(msftBase)),
        newPhrase: Math.max(200, Math.round(newBase)),
      };
    });
  }, []);

  // 7. Trending Phrases word cloud
  const trendingPhrases = useMemo(() => {
    return [
      { text: 'updates', size: 'text-xs text-slate-500' },
      { text: 'cloud computing', size: 'text-xs text-slate-600' },
      { text: 'visual', size: 'text-xs text-slate-400' },
      { text: 'day using artificial', size: 'text-xs text-slate-500' },
      { text: 'basic', size: 'text-xs text-slate-400' },
      { text: 'processes', size: 'text-xs text-slate-600' },
      { text: 'outlook', size: 'text-sm text-slate-600' },
      { text: 'final', size: 'text-xs text-slate-400' },
      { text: 'april', size: 'text-base font-normal text-slate-700' },
      { text: 'algorithms', size: 'text-xs text-slate-500' },
      { text: 'modern', size: 'text-xs text-slate-400' },
      { text: 'education', size: 'text-xs text-slate-500' },
      { text: 'using artificial intelligence', size: 'text-sm font-medium text-slate-800' },
      { text: 'numbers', size: 'text-xs text-slate-400' },
      { text: 'requirements', size: 'text-xs text-slate-500' },
    ];
  }, []);

  // 8. Languages Breakdown (English 575.3k, Spanish 8,732, German 7,039, French 6,705, Portuguese 2,272)
  const languagesData = useMemo(() => {
    return [
      { id: 'en', name: 'English', count: '575.3k', numericCount: 575300, percentage: 95.3, barColor: 'bg-slate-700' },
      { id: 'es', name: 'Spanish', count: '8,732', numericCount: 8732, percentage: 1.4, barColor: 'bg-slate-400' },
      { id: 'de', name: 'German', count: '7,039', numericCount: 7039, percentage: 1.2, barColor: 'bg-slate-400' },
      { id: 'fr', name: 'French', count: '6,705', numericCount: 6705, percentage: 1.1, barColor: 'bg-slate-400' },
      { id: 'pt', name: 'Portuguese', count: '2,272', numericCount: 2272, percentage: 0.4, barColor: 'bg-slate-400' },
    ];
  }, []);

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
    <div className="space-y-4" id="conversations-tab-view">
      {/* 3-COLUMN GRID EXACTLY MATCHING MICROSOFT SOCIAL ENGAGEMENT CONVERSATIONS VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (SENTIMENT, INTENTIONS, TAGS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1.1 SENTIMENT CARD */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs relative" id="widget-sentiment">
            <div className="flex items-center justify-between pb-2 border-b border-transparent">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                SENTIMENT
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Sentiment', { index: 7.6, change: 0.0 })}
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
                  7.6
                </div>
                <div className="text-[11px] text-slate-500 font-normal">index</div>
              </div>

              {/* Semicircular smiley gauge in center */}
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  {/* Gray background arc */}
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#64748B"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Red Negative segment (top left) */}
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#DC2626"
                    strokeWidth="7"
                    strokeDasharray="213"
                    strokeDashoffset="180"
                    fill="transparent"
                  />
                  {/* Green Positive segment (right half) */}
                  <circle
                    cx="48"
                    cy="48"
                    r="34"
                    stroke="#15803D"
                    strokeWidth="7"
                    strokeDasharray="213"
                    strokeDashoffset="110"
                    strokeLinecap="butt"
                    fill="transparent"
                  />
                </svg>
                {/* Center smiley icon */}
                <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                  <Smile className="w-7 h-7 text-slate-700 stroke-1.5" />
                </div>
              </div>

              {/* Change delta on right */}
              <div className="text-right">
                <div className="text-2xl font-extralight text-slate-900">
                  0.0
                </div>
                <div className="text-[11px] text-slate-500 font-normal flex items-center justify-end gap-1">
                  <span>change</span>
                  <MoveRight className="w-3 h-3 text-slate-600" />
                </div>
              </div>
            </div>

            {/* Slider bar from -10 to +10 with green block on positive half */}
            <div className="mt-4 pt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
              </div>
              <div className="relative h-3 w-full bg-slate-100 border border-slate-200/80 overflow-hidden flex">
                <div className="w-1/2 bg-transparent" />
                <div className="w-1/2 bg-emerald-700/80 h-full" style={{ width: '38%' }} />
              </div>
            </div>
          </div>

          {/* 1.2 INTENTIONS CARD */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-intentions">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                INTENTIONS
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Intentions', intentionsData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Intentions Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sub-label */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 mb-3">
              <div className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              </div>
              <span className="font-normal text-[11px] text-slate-800">
                {intentionsData.total.toLocaleString()} posts with intentions
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Donut Chart (Solid Black / Dark Segments) */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <PieChart width={96} height={96}>
                  <Pie
                    data={intentionsData.slices}
                    cx={44}
                    cy={44}
                    innerRadius={26}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry) => {
                      const found = intentionsData.items.find((it) => it.fullLabel === entry.name || it.label === entry.name || it.id === (entry as any).id);
                      if (found) {
                        onSelectIntention(activeIntentionFilter === found.id ? null : found.id);
                      }
                    }}
                  >
                    {intentionsData.slices.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={activeIntentionFilter && intentionsData.items.find(i => i.id === activeIntentionFilter)?.fullLabel === entry.name ? '#3B82F6' : 'none'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              {/* Intentions Breakdown Table */}
              <div className="flex-1 space-y-1.5 text-xs">
                {intentionsData.items.map((item) => {
                  const isSelected = activeIntentionFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectIntention(isSelected ? null : item.id)}
                      className={`w-full flex items-center justify-between text-left p-1 rounded-xs transition-colors ${
                        isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2.5 h-2.5 bg-slate-900 shrink-0 inline-block" />
                        <span className="text-[11px] text-slate-800 truncate" title={item.fullLabel}>
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-slate-800">
                        <span>{item.count.toLocaleString()}</span>
                        {renderTrendIcon(item.trend)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 1.3 TAGS CARD */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-tags">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                TAGS
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onExportWidgetData('Tags', tagsData)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Tags Data"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedWidget(expandedWidget === 'tags' ? null : 'tags')}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Expand Tags Widget"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sub-label */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 mb-3">
              <div className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center">
                <Tag className="w-2 h-2 text-slate-700" />
              </div>
              <span className="font-normal text-[11px] text-slate-800">
                {tagsData.total.toLocaleString()} posts with tags
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Donut Chart */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <PieChart width={96} height={96}>
                  <Pie
                    data={tagsData.slices}
                    cx={44}
                    cy={44}
                    innerRadius={26}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry) => {
                      const entryName = String(entry.name || '');
                      const found = tagsData.items.find((it) => it.label.toLowerCase() === entryName.toLowerCase() || it.id === (entry as any).id);
                      if (found) {
                        onSelectTag(activeTagFilter === found.id ? null : found.id);
                      }
                    }}
                  >
                    {tagsData.slices.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={activeTagFilter && tagsData.items.find(i => i.id === activeTagFilter)?.label === entry.name ? '#3B82F6' : 'none'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              {/* Tags Breakdown Table */}
              <div className="flex-1 space-y-1.5 text-xs">
                {tagsData.items.map((item) => {
                  const isSelected = activeTagFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTag(isSelected ? null : item.id)}
                      className={`w-full flex items-center justify-between text-left p-1 rounded-xs transition-colors ${
                        isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2.5 h-2.5 bg-slate-900 shrink-0 inline-block" />
                        <span className="text-[11px] text-slate-800 truncate" title={item.label}>
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-slate-800">
                        <span>{item.count.toLocaleString()}</span>
                        {renderTrendIcon(item.trend)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (PHRASES WORD CLOUD ON TOP, SOURCES & PHRASES ON TWITTER BELOW) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* 2.1 BIG CENTRAL PHRASES WORD CLOUD */}
          <div className="bg-white rounded-none border border-slate-200/90 p-5 shadow-2xs" id="widget-main-phrases">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                PHRASES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Phrases', mainPhrases)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Phrases Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Word Cloud Visual Canvas matching exact MSE spacing & typography hierarchy */}
            <div className="min-h-[290px] flex flex-col justify-center items-center py-6 px-4 select-none relative">
              {/* Top tier words */}
              <div className="flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-center mb-1">
                <span onClick={() => onSelectPhrase('company')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">company</span>
                <span onClick={() => onSelectPhrase('need')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">need</span>
              </div>

              {/* Upper-middle tier words */}
              <div className="flex items-center justify-center gap-x-5 gap-y-1 flex-wrap text-center mb-2">
                <span onClick={() => onSelectPhrase('technology')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">technology</span>
                <span onClick={() => onSelectPhrase('get')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">get</span>
                <span onClick={() => onSelectPhrase('may')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">may</span>
                <span onClick={() => onSelectPhrase('one')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">one</span>
                <span onClick={() => onSelectPhrase('cloud')} className="text-sm text-slate-500 hover:text-slate-900 cursor-pointer">cloud</span>
                <span onClick={() => onSelectPhrase('ai')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">ai</span>
                <span onClick={() => onSelectPhrase('business')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">business</span>
              </div>

              {/* Upper centered row */}
              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center mb-2">
                <span onClick={() => onSelectPhrase('future')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">future</span>
                <span onClick={() => onSelectPhrase('time')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">time</span>
                <span onClick={() => onSelectPhrase('office')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">office</span>
                <span onClick={() => onSelectPhrase('just')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">just</span>
                <span onClick={() => onSelectPhrase('new')} className="text-base font-normal text-slate-700 hover:text-slate-900 cursor-pointer">new</span>
                <span onClick={() => onSelectPhrase('like')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">like</span>
                <span onClick={() => onSelectPhrase('microsoft')} className="text-xl font-normal text-slate-700 hover:text-blue-700 cursor-pointer">microsoft</span>
                <span onClick={() => onSelectPhrase('use')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">use</span>
                <span onClick={() => onSelectPhrase('learning')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">learning</span>
              </div>

              {/* MASSIVE HERO PHRASE: artificial intelligence */}
              <div className="my-2 text-center">
                <button
                  type="button"
                  onClick={() => onSelectPhrase(activePhraseFilter === 'artificial intelligence' ? null : 'artificial intelligence')}
                  className={`text-3xl md:text-[38px] font-normal tracking-tight leading-tight transition-all cursor-pointer ${
                    activePhraseFilter === 'artificial intelligence'
                      ? 'text-blue-600 underline font-medium'
                      : 'text-slate-800 hover:text-blue-600'
                  }`}
                >
                  artificial intelligence
                </button>
              </div>

              {/* Lower centered row */}
              <div className="flex items-center justify-center gap-x-5 gap-y-1 flex-wrap text-center mt-1">
                <span onClick={() => onSelectPhrase('us')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">us</span>
                <span onClick={() => onSelectPhrase('@xboxsupport')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">@xboxsupport</span>
                <span onClick={() => onSelectPhrase('azure')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">azure</span>
                <span onClick={() => onSelectPhrase('will')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">will</span>
                <span onClick={() => onSelectPhrase('via')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">via</span>
                <span onClick={() => onSelectPhrase('make')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">make</span>
                <span onClick={() => onSelectPhrase('can')} className="text-sm text-slate-500 hover:text-slate-900 cursor-pointer">can</span>
                <span onClick={() => onSelectPhrase('using')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">using</span>
                <span onClick={() => onSelectPhrase('services')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">services</span>
                <span onClick={() => onSelectPhrase('people')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">people</span>
              </div>

              {/* Sub-tier phrases */}
              <div className="flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-center mt-2">
                <span onClick={() => onSelectPhrase('world')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">world</span>
                <span onClick={() => onSelectPhrase('help')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">help</span>
                <span onClick={() => onSelectPhrase('first')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">first</span>
                <span onClick={() => onSelectPhrase('work')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">work</span>
                <span onClick={() => onSelectPhrase('#ai')} className="text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer">#ai</span>
                <span onClick={() => onSelectPhrase('also')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">also</span>
                <span onClick={() => onSelectPhrase('data')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">data</span>
                <span onClick={() => onSelectPhrase('see')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">see</span>
              </div>

              {/* Bottom tier */}
              <div className="flex items-center justify-center gap-x-8 gap-y-1 flex-wrap text-center mt-3">
                <span onClick={() => onSelectPhrase('machine')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">machine</span>
                <span onClick={() => onSelectPhrase('way')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">way</span>
              </div>
            </div>
          </div>

          {/* 2.2 BOTTOM TWO SUB-WIDGETS (SOURCES on Left, PHRASES ON TWITTER on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2.2.A SOURCES */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-sources">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  SOURCES
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onExportWidgetData('Sources', sourcesData)}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="Download Sources Data"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedWidget(expandedWidget === 'sources' ? null : 'sources')}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="Expand Sources Widget"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                {sourcesData.map((src) => {
                  const isSelected = activeSourceFilter === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => onSelectSource(isSelected ? null : src.id)}
                      className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors group ${
                        isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Left icon & count */}
                      <div className="flex items-center gap-2 w-20 shrink-0">
                        {src.icon}
                        <span className="text-[11px] font-mono text-slate-800 text-left truncate">
                          {src.count}
                        </span>
                      </div>

                      {/* Bar indicator in center */}
                      <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                        <div
                          className={`h-full ${src.barColor}`}
                          style={{ width: `${Math.min(100, Math.max(8, src.percentage * 1.15))}%` }}
                        />
                      </div>

                      {/* Trend arrow */}
                      <div className="shrink-0">
                        {renderTrendIcon(src.trend)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2.2.B PHRASES ON TWITTER */}
            <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-twitter-phrases">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                  <span>PHRASES ON TWITTER</span>
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-sky-500">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </h2>
                <button
                  type="button"
                  onClick={() => onExportWidgetData('TwitterPhrases', twitterPhrases)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                  title="Download Twitter Phrases"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Blue-tinted word cloud matching screenshot */}
              <div className="min-h-[140px] flex flex-col justify-center items-center py-2 px-2 select-none">
                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
                  <span onClick={() => onSelectPhrase('#bigdata')} className="text-xs text-sky-700 hover:underline cursor-pointer">#bigdata</span>
                  <span onClick={() => onSelectPhrase('#machinelearning')} className="text-xs text-sky-600 hover:underline cursor-pointer">#machinelearning</span>
                  <span onClick={() => onSelectPhrase('#cloud')} className="text-xs text-sky-700 hover:underline cursor-pointer">#cloud</span>
                </div>

                <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center my-1.5">
                  <span onClick={() => onSelectPhrase('@xboxsupport')} className="text-sm font-medium text-sky-800 hover:underline cursor-pointer">@xboxsupport</span>
                  <span onClick={() => onSelectPhrase('artificial')} className="text-xs text-sky-600 hover:underline cursor-pointer">artificial</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                  <span onClick={() => onSelectPhrase('artificial intelligence')} className="text-xs font-normal text-sky-800 hover:underline cursor-pointer">artificial intelligence</span>
                  <span onClick={() => onSelectPhrase('#ai')} className="text-sm font-semibold text-sky-900 hover:underline cursor-pointer">#ai</span>
                  <span onClick={() => onSelectPhrase('#azure')} className="text-xs text-sky-700 hover:underline cursor-pointer">#azure</span>
                  <span onClick={() => onSelectPhrase('intelligence')} className="text-xs text-sky-600 hover:underline cursor-pointer">intelligence</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                  <span onClick={() => onSelectPhrase('#artificialintelligence')} className="text-xs text-sky-700 hover:underline cursor-pointer">#artificialintelligence</span>
                  <span onClick={() => onSelectPhrase('@azure')} className="text-xs text-sky-800 hover:underline cursor-pointer">@azure</span>
                  <span onClick={() => onSelectPhrase('#ml')} className="text-xs text-sky-600 hover:underline cursor-pointer">#ml</span>
                </div>

                <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center mt-1">
                  <span onClick={() => onSelectPhrase('#artificialintelligence #ai')} className="text-xs text-sky-700 hover:underline cursor-pointer">#artificialintelligence #ai</span>
                  <span onClick={() => onSelectPhrase('#tech')} className="text-xs text-sky-600 hover:underline cursor-pointer">#tech</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (PHRASES HISTORY, TRENDING PHRASES, LANGUAGES) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* 3.1 PHRASES HISTORY */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-phrases-history">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                PHRASES HISTORY
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('PhrasesHistory', phrasesHistoryData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Phrases History Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[11px] text-slate-700 pt-1 pb-2">
              <button
                type="button"
                onClick={() => onSelectPhrase(activePhraseFilter === 'artificial intelligence' ? null : 'artificial intelligence')}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${activePhraseFilter === 'artificial intelligence' ? 'font-bold text-blue-900 bg-blue-50 px-1 rounded' : ''}`}
              >
                <span className="w-3 h-0.5 bg-[#1E3A8A]" />
                <span className="truncate">artificial int...</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectPhrase(activePhraseFilter === 'microsoft' ? null : 'microsoft')}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${activePhraseFilter === 'microsoft' ? 'font-bold text-teal-900 bg-teal-50 px-1 rounded' : ''}`}
              >
                <span className="w-3 h-0.5 bg-[#0D9488]" />
                <span>microsoft</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectPhrase(activePhraseFilter === 'new' ? null : 'new')}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${activePhraseFilter === 'new' ? 'font-bold text-emerald-900 bg-emerald-50 px-1 rounded' : ''}`}
              >
                <span className="w-3 h-0.5 bg-[#16A34A]" />
                <span>new</span>
              </button>
            </div>

            {/* Line Chart */}
            <div className="h-40 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={phrasesHistoryData}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  className="cursor-pointer"
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      // Toggle first active phrase or cycle through
                      const phraseKey = e.activePayload[0].dataKey;
                      const phraseName = phraseKey === 'artificialIntelligence' ? 'artificial intelligence' : phraseKey === 'microsoft' ? 'microsoft' : 'new';
                      onSelectPhrase(activePhraseFilter === phraseName ? null : phraseName);
                    }
                  }}
                >
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    interval={6}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    domain={[0, 20000]}
                    ticks={[0, 10000, 20000]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={`Timeline: Day ${label} (Click to filter)`}
                            items={[
                              {
                                name: 'Artificial Intelligence',
                                value: `${Number(payload[0]?.value || 0).toLocaleString()} posts`,
                                color: '#1E3A8A',
                                badge: activePhraseFilter === 'artificial intelligence' ? 'Active' : undefined,
                              },
                              {
                                name: 'Microsoft',
                                value: `${Number(payload[1]?.value || 0).toLocaleString()} posts`,
                                color: '#0D9488',
                                badge: activePhraseFilter === 'microsoft' ? 'Active' : undefined,
                              },
                              {
                                name: 'New',
                                value: `${Number(payload[2]?.value || 0).toLocaleString()} posts`,
                                color: '#059669',
                                badge: activePhraseFilter === 'new' ? 'Active' : undefined,
                              },
                            ]}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Artificial Intelligence Line (Dark Navy) */}
                  <Line
                    type="monotone"
                    dataKey="artificialIntelligence"
                    stroke="#1E3A8A"
                    strokeWidth={activePhraseFilter === 'artificial intelligence' ? 3 : 1.75}
                    dot={false}
                  />
                  {/* Microsoft Line (Teal) */}
                  <Line
                    type="monotone"
                    dataKey="microsoft"
                    stroke="#0D9488"
                    strokeWidth={activePhraseFilter === 'microsoft' ? 3 : 1.75}
                    dot={false}
                  />
                  {/* New Line (Green) */}
                  <Line
                    type="monotone"
                    dataKey="newPhrase"
                    stroke="#16A34A"
                    strokeWidth={activePhraseFilter === 'new' ? 3 : 1.75}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3.2 TRENDING PHRASES */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-trending-phrases">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                TRENDING PHRASES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('TrendingPhrases', trendingPhrases)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Trending Phrases"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Trending Word Cloud */}
            <div className="min-h-[140px] flex flex-col justify-center items-center py-2 px-1 select-none">
              <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center">
                <span onClick={() => onSelectPhrase('updates')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">updates</span>
                <span onClick={() => onSelectPhrase('cloud computing')} className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer">cloud computing</span>
                <span onClick={() => onSelectPhrase('visual')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">visual</span>
              </div>

              <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                <span onClick={() => onSelectPhrase('day using artificial')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">day using artificial</span>
                <span onClick={() => onSelectPhrase('basic')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">basic</span>
                <span onClick={() => onSelectPhrase('processes')} className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer">processes</span>
              </div>

              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center my-1">
                <span onClick={() => onSelectPhrase('outlook')} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer">outlook</span>
                <span onClick={() => onSelectPhrase('final')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">final</span>
                <span onClick={() => onSelectPhrase('april')} className="text-base font-normal text-slate-700 hover:text-slate-900 cursor-pointer">april</span>
                <span onClick={() => onSelectPhrase('algorithms')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">algorithms</span>
                <span onClick={() => onSelectPhrase('modern')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">modern</span>
              </div>

              <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-center my-1">
                <span onClick={() => onSelectPhrase('education')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">education</span>
                <span onClick={() => onSelectPhrase('using artificial intelligence')} className="text-sm font-medium text-slate-800 hover:text-blue-700 cursor-pointer">using artificial intelligence</span>
              </div>

              <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-center mt-1">
                <span onClick={() => onSelectPhrase('numbers')} className="text-xs text-slate-400 hover:text-slate-900 cursor-pointer">numbers</span>
                <span onClick={() => onSelectPhrase('requirements')} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">requirements</span>
              </div>
            </div>
          </div>

          {/* 3.3 LANGUAGES */}
          <div className="bg-white rounded-none border border-slate-200/90 p-4 shadow-2xs" id="widget-conversations-languages">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                LANGUAGES
              </h2>
              <button
                type="button"
                onClick={() => onExportWidgetData('Languages', languagesData)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Download Languages Data"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {languagesData.map((lang) => {
                const isSelected = activeLanguageFilter === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => onSelectLanguage(isSelected ? null : lang.id)}
                    className={`w-full flex items-center justify-between p-1 rounded-xs transition-colors group ${
                      isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Left Language Name */}
                    <div className="w-20 text-left text-[11px] text-slate-800 font-normal">
                      {lang.name}
                    </div>

                    {/* Numeric Count */}
                    <div className="w-14 text-right font-mono text-[11px] text-slate-800">
                      {lang.count}
                    </div>

                    {/* Horizontal Bar */}
                    <div className="flex-1 h-3 bg-slate-100 rounded-none overflow-hidden mx-2">
                      <div
                        className={`h-full ${lang.barColor}`}
                        style={{ width: `${Math.min(100, Math.max(5, lang.percentage))}%` }}
                      />
                    </div>

                    {/* Right Arrow */}
                    <div className="shrink-0">
                      <MoveRight className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER TRANSLATION GUIDE (Matching screenshot bottom text) */}
      <div className="text-center pt-3 pb-2 text-[10px] text-slate-400 font-normal">
        © 2017 Microsoft &bull; Translation Guide &bull; High-Throughput Tenant Telemetry Ingestion Active
      </div>
    </div>
  );
};
