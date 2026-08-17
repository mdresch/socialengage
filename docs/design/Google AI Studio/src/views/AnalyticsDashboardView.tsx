import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Smile,
  Meh,
  Frown,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Users,
  Search,
  Filter,
  Calendar,
  X,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
  Share2,
  ChevronRight,
  Maximize2,
  MessageSquare,
  BarChart3,
  Flame,
  Radio,
  FileText,
  Building,
  Plus,
  Download,
  Check,
  MoveRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Languages,
  UserCheck,
  MapPin,
  Activity,
  CheckCircle,
  Sliders,
  Tag,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Post, IngestionSourceType } from '../types';
import { ConversationsDashboardTab } from '../components/ConversationsDashboardTab';
import { SourcesDashboardTab } from '../components/SourcesDashboardTab';
import { SentimentDashboardTab } from '../components/SentimentDashboardTab';
import { LocationDashboardTab } from '../components/LocationDashboardTab';
import { GlobalDateRangePicker, DateRangeValue, PRESET_DATE_RANGES } from '../components/GlobalDateRangePicker';
import { AnimatedChartTooltip } from '../components/AnimatedChartTooltip';
import { D3Sparkline } from '../components/D3Sparkline';
import { D3SentimentGauge } from '../components/D3SentimentGauge';
import { D3TrendingTopicsChart } from '../components/D3TrendingTopicsChart';

// Custom icons for the 8 requested ingestion sources
const SourceIcon: React.FC<{ source: string; className?: string }> = ({ source, className = 'w-4 h-4' }) => {
  const normalized = source.toLowerCase();
  switch (normalized) {
    case 'x':
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75c.97 0 1.76.78 1.76 1.75s-.79 1.76-1.76 1.76m1.39 9.74v-8.37H5.07v8.37h2.78z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'blog':
    case 'tenant_owned_feed':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
        </svg>
      );
    case 'gnews':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
        </svg>
      );
    case 'newswire':
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V18a1 1 0 0 0-1-1 3 3 0 0 1-3-3v-1a2 2 0 0 0-2-2H5.07A8 8 0 0 1 12 4v1a2 2 0 0 0 2 2 2 2 0 0 1 2 2v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v.07A8 8 0 0 1 13 19.93z" />
        </svg>
      );
  }
};

const getSourceColor = (source: string) => {
  switch (source.toLowerCase()) {
    case 'x':
    case 'twitter':
      return 'bg-sky-500 text-white';
    case 'linkedin':
      return 'bg-[#0077B5] text-white';
    case 'youtube':
      return 'bg-[#FF0000] text-white';
    case 'instagram':
      return 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white';
    case 'facebook':
      return 'bg-[#1877F2] text-white';
    case 'blog':
    case 'tenant_owned_feed':
      return 'bg-[#F26522] text-white';
    case 'gnews':
      return 'bg-emerald-600 text-white';
    case 'newswire':
      return 'bg-indigo-600 text-white';
    default:
      return 'bg-slate-700 text-slate-100';
  }
};

export const AnalyticsDashboardView: React.FC = () => {
  const { posts, watchlists, activeTenant, navigateTo, activeRoute } = useApp();

  // Active UI filters
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('week_future_decoded');
  const [dateRangeInfo, setDateRangeInfo] = useState<DateRangeValue>({
    key: 'week_future_decoded',
    label: 'Week 06/10 - 12/10/2017',
    startDate: '2017-10-06',
    endDate: '2017-10-12',
    compareWithPrevious: true,
  });
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'sentiment' | 'location' | 'sources'>('overview');
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(null);
  const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  const [activeLanguageFilter, setActiveLanguageFilter] = useState<string | null>(null);
  const [activeRegionFilter, setActiveRegionFilter] = useState<string | null>(null);
  const [activeSentimentFilter, setActiveSentimentFilter] = useState<string | null>(null);
  const [activeIntentionFilter, setActiveIntentionFilter] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // AI Spike Storyteller states
  const [spikeExplanation, setSpikeExplanation] = useState<any | null>(null);
  const [loadingSpike, setLoadingSpike] = useState<boolean>(false);
  const [customSpikePrompt, setCustomSpikePrompt] = useState<string>('');
  const [spikeError, setSpikeError] = useState<string | null>(null);

  const fetchSpikeExplanation = (targetDate: string, userPrompt?: string) => {
    setLoadingSpike(true);
    setSpikeError(null);

    // Filter relevant sample posts for context
    const datePosts = posts.filter(p => {
      try {
        const dateVal = (p as any).createdAt || p.publishedAt || p.ingestedAt || '';
        if (!dateVal) return false;
        const postDate = new Date(dateVal);
        if (isNaN(postDate.getTime())) return false;
        const dayStr = postDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        const rawDate = dateVal.slice(0, 10);
        return (
          dayStr.toLowerCase() === targetDate.toLowerCase() ||
          rawDate.includes(targetDate) ||
          targetDate.toLowerCase().includes(dayStr.toLowerCase())
        );
      } catch (err) {
        return false;
      }
    }).map(p => ({
      author: p.author || '',
      text: p.text || '',
      sentiment: p.enrichment?.sentiment || 'Neutral',
      platform: p.provider || p.sourceType || 'Social Feed',
    }));

    fetch('/api/explain-spike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: targetDate,
        source: activeSourceFilter || 'All Ingestion Sources',
        topic: selectedTopic,
        postCount: `${datePosts.length || 1420} posts (spike window)`,
        sentimentScore: 'Dynamic volume focus',
        contextPosts: datePosts.slice(0, 15),
        customPrompt: userPrompt || undefined
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success && res.data) {
        setSpikeExplanation(res.data);
      } else {
        setSpikeError("Could not retrieve AI breakdown details.");
      }
    })
    .catch(err => {
      console.error(err);
      setSpikeError("Failed to reach intelligence servers.");
    })
    .finally(() => {
      setLoadingSpike(false);
    });
  };

  React.useEffect(() => {
    if (activeDateFilter) {
      fetchSpikeExplanation(activeDateFilter, customSpikePrompt);
    } else {
      setSpikeExplanation(null);
      setCustomSpikePrompt('');
      setSpikeError(null);
    }
  }, [activeDateFilter, activeSourceFilter, selectedTopic]);

  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Parse deep link parameters on mount/load
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const topic = params.get('topic');
      const source = params.get('source');
      const author = params.get('author');
      const keyword = params.get('keyword');
      const language = params.get('language');
      const region = params.get('region');
      const sentiment = params.get('sentiment');
      const intention = params.get('intention');
      const tag = params.get('tag');
      const range = params.get('range');

      if (tab) setActiveTab(tab as any);
      if (topic) setSelectedTopic(topic);
      if (source) setActiveSourceFilter(source);
      if (author) setActiveAuthorFilter(author);
      if (keyword) setActiveKeywordFilter(keyword);
      if (language) setActiveLanguageFilter(language);
      if (region) setActiveRegionFilter(region);
      if (sentiment) setActiveSentimentFilter(sentiment);
      if (intention) setActiveIntentionFilter(intention);
      if (tag) setActiveTagFilter(tag);
      if (range) {
        setSelectedDateRange(range);
        const preset = PRESET_DATE_RANGES.find(p => p.key === range);
        if (preset) {
          setDateRangeInfo(preset);
        }
      }
    } catch (err) {
      console.error('Failed to parse share parameters', err);
    }
  }, []);

  React.useEffect(() => {
    if (activeRoute === '/tenant/analytics' || activeRoute === '/analytics' || activeRoute === '/tenant/post-dashboard') {
      const hasSharedParams = window.location.search.length > 1;
      if (!hasSharedParams) {
        setSelectedTopic('all');
        setActiveTab('overview');
      }
    }
  }, [activeRoute]);

  const handleShareView = () => {
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('topic', selectedTopic);
      if (activeSourceFilter) params.set('source', activeSourceFilter);
      if (activeAuthorFilter) params.set('author', activeAuthorFilter);
      if (activeKeywordFilter) params.set('keyword', activeKeywordFilter);
      if (activeLanguageFilter) params.set('language', activeLanguageFilter);
      if (activeRegionFilter) params.set('region', activeRegionFilter);
      if (activeSentimentFilter) params.set('sentiment', activeSentimentFilter);
      if (activeIntentionFilter) params.set('intention', activeIntentionFilter);
      if (activeTagFilter) params.set('tag', activeTagFilter);
      params.set('range', selectedDateRange);

      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      navigator.clipboard.writeText(shareUrl);
      
      setShareCopied(true);
      setExportToast('Copied shareable dashboard URL with active filters to clipboard!');
      
      setTimeout(() => {
        setShareCopied(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy share link', err);
    }
  };

  const [showPostsDrawer, setShowPostsDrawer] = useState<boolean>(false);
  const [showAddFiltersModal, setShowAddFiltersModal] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);

  // Detail view simulation states
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [assignedMember, setAssignedMember] = useState<string>('Unassigned');
  const [assignSuccess, setAssignSuccess] = useState<boolean>(false);
  const [responseMsg, setResponseMsg] = useState<string>('');
  const [responseSuccess, setResponseSuccess] = useState<boolean>(false);
  const [isHighPriority, setIsHighPriority] = useState<boolean>(false);

  // Reset simulation states when selected post changes or drawer closes
  React.useEffect(() => {
    setTranslatedText(null);
    setIsTranslating(false);
    setAssignedMember('Unassigned');
    setAssignSuccess(false);
    setResponseMsg('');
    setResponseSuccess(false);
    setIsHighPriority(false);
  }, [selectedPostForDetail, showPostsDrawer]);

  const handleTranslate = () => {
    setIsTranslating(true);
    setTimeout(() => {
      setTranslatedText("Simulated Multi-lingual Translation (MSE Engine): We are facing some minor connection timeouts when establishing tenant single sign-on sync profiles. Resolving with the development team.");
      setIsTranslating(false);
    }, 600);
  };

  const handleAssign = (member: string) => {
    setAssignedMember(member);
    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 2500);
  };

  const handleSendResponse = () => {
    if (!responseMsg.trim()) return;
    setResponseSuccess(true);
    setResponseMsg('');
    setTimeout(() => setResponseSuccess(false), 3000);
  };

  const handleDateRangeChange = (newRange: DateRangeValue) => {
    setSelectedDateRange(newRange.key);
    setDateRangeInfo(newRange);
  };

  // Trigger download / export toast
  const handleExportWidgetData = (widgetName: string, data: any) => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `MSE_${widgetName}_Export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportToast(`Exported ${widgetName} dataset`);
    setTimeout(() => setExportToast(null), 3000);
  };

  // Filtered dataset
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Topic/Watchlist filter
      if (selectedTopic !== 'all') {
        if (post.matchedWatchlistId !== selectedTopic && post.matchedWatchlistName !== selectedTopic) {
          return false;
        }
      }
      // Date filter from clicking chart point/segment
      if (activeDateFilter) {
        try {
          const dateVal = (post as any).createdAt || post.publishedAt || post.ingestedAt || '';
          if (!dateVal) return false;
          const postDate = new Date(dateVal);
          if (isNaN(postDate.getTime())) return false;
          const dayStr = postDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          const dayNum = String(postDate.getDate()).padStart(2, '0');
          const dayShort = String(postDate.getDate());
          const rawDate = dateVal.slice(0, 10);
          const matchesDate =
            dayStr.toLowerCase() === activeDateFilter.toLowerCase() ||
            dayNum === activeDateFilter ||
            dayShort === activeDateFilter ||
            rawDate.includes(activeDateFilter) ||
            activeDateFilter.toLowerCase().includes(dayShort);
          if (!matchesDate) {
            // If activeDateFilter is '08 Sep' or '13 Oct' or 'Day 12' or '12'
            const cleanFilter = activeDateFilter.replace(/day\s*/i, '').trim();
            if (cleanFilter !== dayNum && cleanFilter !== dayShort && !dayStr.toLowerCase().includes(cleanFilter.toLowerCase())) {
              return false;
            }
          }
        } catch (err) {
          return false;
        }
      }
      // Source filter
      if (activeSourceFilter) {
        const pSource = (post.sourceType || post.provider || '').toLowerCase();
        if (pSource !== activeSourceFilter.toLowerCase() && post.provider.toLowerCase() !== activeSourceFilter.toLowerCase()) {
          return false;
        }
      }
      // Author filter
      if (activeAuthorFilter) {
        if (post.author !== activeAuthorFilter) return false;
      }
      // Keyword/Phrase filter
      if (activeKeywordFilter) {
        const k = activeKeywordFilter.toLowerCase();
        const hasPhrase = post.enrichment.keyPhrases?.some((kp) => kp.toLowerCase().includes(k));
        const inText = post.text.toLowerCase().includes(k) || post.title.toLowerCase().includes(k);
        if (!hasPhrase && !inText) return false;
      }
      // Language filter
      if (activeLanguageFilter) {
        const lang = post.language || post.rawPayload?.language || 'en';
        if (lang.toLowerCase() !== activeLanguageFilter.toLowerCase()) return false;
      }
      // Region filter
      if (activeRegionFilter) {
        const reg = (post.location?.region || 'North America').toLowerCase();
        const actReg = activeRegionFilter.toLowerCase();
        if (actReg === 'uk' || actReg === 'united kingdom') {
          if (!reg.includes('uk') && !reg.includes('kingdom') && !reg.includes('europe')) return false;
        } else if (actReg === 'us' || actReg === 'united states') {
          if (!reg.includes('us') && !reg.includes('america')) return false;
        } else if (actReg === 'in' || actReg === 'india') {
          if (!reg.includes('india') && !reg.includes('asia')) return false;
        } else if (actReg === 'it' || actReg === 'italy') {
          if (!reg.includes('italy') && !reg.includes('europe')) return false;
        } else if (reg !== actReg && !reg.includes(actReg)) {
          return false;
        }
      }
      // Sentiment filter
      if (activeSentimentFilter) {
        if (post.enrichment.sentiment.toLowerCase() !== activeSentimentFilter.toLowerCase()) return false;
      }
      // Intention filter
      if (activeIntentionFilter) {
        if (activeIntentionFilter === 'complaint' && post.enrichment.sentiment !== 'Negative') return false;
        if (activeIntentionFilter === 'purchase' && !post.text.toLowerCase().includes('buy') && !post.text.toLowerCase().includes('order') && !post.text.toLowerCase().includes('enterprise') && !post.text.toLowerCase().includes('cloud')) return false;
      }
      // Tag filter
      if (activeTagFilter) {
        if (activeTagFilter === 'announcement' && !post.text.toLowerCase().includes('announce') && !post.text.toLowerCase().includes('release') && !post.text.toLowerCase().includes('microsoft')) return false;
      }
      return true;
    });
  }, [posts, selectedTopic, activeDateFilter, activeSourceFilter, activeAuthorFilter, activeKeywordFilter, activeLanguageFilter, activeRegionFilter, activeSentimentFilter, activeIntentionFilter, activeTagFilter]);

  // Aggregate Sentiment Index calculation (-10 to +10 scale)
  const sentimentStats = useMemo(() => {
    if (filteredPosts.length === 0) {
      return { positive: 0, neutral: 0, negative: 0, index: 7.6, delta: '+1.3', posPct: 68, neuPct: 22, negPct: 10 };
    }
    let pos = 0;
    let neu = 0;
    let neg = 0;
    let scoreSum = 0;

    filteredPosts.forEach((p) => {
      const s = p.enrichment.sentiment;
      if (s === 'Positive') {
        pos += 1;
        scoreSum += (p.enrichment.sentimentScores?.positive || 0.8) * 10;
      } else if (s === 'Negative') {
        neg += 1;
        scoreSum -= (p.enrichment.sentimentScores?.negative || 0.8) * 10;
      } else {
        neu += 1;
        scoreSum += 2.5; // neutral baseline
      }
    });

    const total = filteredPosts.length;
    const posPct = Math.round((pos / total) * 100);
    const neuPct = Math.round((neu / total) * 100);
    const negPct = 100 - posPct - neuPct;
    const rawIndex = (scoreSum / total);
    // Normalize to MSE 0-10 or -10 to +10
    const normalizedIndex = Number(Math.max(0, Math.min(10, (rawIndex + 10) / 2)).toFixed(1));

    return {
      positive: pos,
      neutral: neu,
      negative: neg,
      index: normalizedIndex || 7.6,
      delta: normalizedIndex >= 5 ? '+1.3' : '-0.8',
      posPct: posPct || 68,
      neuPct: neuPct || 22,
      negPct: negPct || 10,
    };
  }, [filteredPosts]);

  // Predictive Forecasting States
  const [showForecast, setShowForecast] = useState<boolean>(true);
  const [forecastResponse, setForecastResponse] = useState<any | null>(null);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const fetchPredictiveForecast = () => {
    setLoadingForecast(true);
    setForecastError(null);

    fetch('/api/predictive-forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: selectedTopic,
        activeSource: activeSourceFilter || 'All Ingestion Channels',
        sentimentStats: sentimentStats,
        currentPosts: posts.slice(0, 15).map(p => ({
          text: p.text || '',
          sentiment: p.enrichment?.sentiment || 'Neutral',
          source: p.provider || p.sourceType || 'Social'
        }))
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success && res.data) {
        setForecastResponse(res.data);
      } else {
        setForecastError("Failed to fetch predictive metrics.");
      }
    })
    .catch(err => {
      console.error(err);
      setForecastError("Intelligence server unreachable.");
    })
    .finally(() => {
      setLoadingForecast(false);
    });
  };

  React.useEffect(() => {
    fetchPredictiveForecast();
  }, [selectedTopic, activeSourceFilter]);

  // Daily Timeline Volume Series (7 days + 7 forecast days)
  const timelineData = useMemo(() => {
    const days = ['10 Aug', '11 Aug', '12 Aug', '13 Aug', '14 Aug', '15 Aug', '16 Aug'];
    const baseVolumes = [680, 1420, 1150, 720, 890, 1540, 2250];
    const avgVolumes = [700, 780, 840, 890, 930, 1020, 1100];

    const multiplier = Math.max(0.4, filteredPosts.length / 8);

    // Build historical points
    const historical = days.map((day, idx) => {
      const vol = Math.round(baseVolumes[idx] * multiplier);
      const avg = Math.round(avgVolumes[idx] * multiplier);
      return {
        day,
        volume: vol,
        average: avg,
        projectedVolume: null,
        sentimentPositive: Math.round(vol * 0.72),
        sentimentNegative: Math.round(vol * 0.12),
        isForecast: false,
      };
    });

    if (!showForecast) {
      return historical;
    }

    // Append 7-day projections
    if (forecastResponse && forecastResponse.projectedVolumes) {
      const apiForecast = forecastResponse.projectedVolumes.map((item: any) => ({
        day: `${item.day} • Proj`,
        volume: null,
        average: null,
        projectedVolume: Math.round(item.volume * multiplier),
        sentimentPositive: Math.round(item.sentimentPositive * multiplier),
        sentimentNegative: Math.round(item.sentimentNegative * multiplier),
        isForecast: true,
      }));
      return [...historical, ...apiForecast];
    }

    // Statistical fallback/decay modeling if api not finished yet
    const forecastDays = ['17 Aug', '18 Aug', '19 Aug', '20 Aug', '21 Aug', '22 Aug', '23 Aug'];
    const lastVol = Math.round(baseVolumes[6] * multiplier);
    const lastAvg = Math.round(avgVolumes[6] * multiplier);

    const statisticalForecast = forecastDays.map((day, idx) => {
      const decay = Math.pow(0.85, idx + 1);
      const projVol = Math.round((lastVol * decay + 850 * (1 - decay)) * multiplier);
      const avg = Math.round((lastAvg + (idx + 1) * 35) * multiplier);
      return {
        day: `${day} • Proj`,
        volume: null,
        average: avg,
        projectedVolume: projVol,
        sentimentPositive: Math.round(projVol * 0.72),
        sentimentNegative: Math.round(projVol * 0.12),
        isForecast: true,
      };
    });

    return [...historical, ...statisticalForecast];
  }, [filteredPosts, showForecast, forecastResponse]);

  // Sources Aggregation (All 8 requested ingestion sources)
  const sourcesData = useMemo(() => {
    const sourceKeys: { id: IngestionSourceType; label: string; defaultCount: number; defaultAuthors: number }[] = [
      { id: 'x', label: 'X (Twitter)', defaultCount: 4839, defaultAuthors: 1994 },
      { id: 'linkedin', label: 'LinkedIn', defaultCount: 212, defaultAuthors: 125 },
      { id: 'facebook', label: 'Facebook', defaultCount: 126, defaultAuthors: 80 },
      { id: 'instagram', label: 'Instagram', defaultCount: 29, defaultAuthors: 7 },
      { id: 'youtube', label: 'YouTube', defaultCount: 9, defaultAuthors: 5 },
      { id: 'blog', label: 'Blogs & RSS', defaultCount: 84, defaultAuthors: 42 },
      { id: 'gnews', label: 'Google News', defaultCount: 145, defaultAuthors: 68 },
      { id: 'newswire', label: 'Global Newswire', defaultCount: 62, defaultAuthors: 24 },
    ];

    const totalCalculated = sourceKeys.reduce((acc, s) => acc + s.defaultCount, 0);

    return sourceKeys.map((item) => {
      // Find matching in filtered posts
      const actualMatches = filteredPosts.filter((p) => {
        const src = (p.sourceType || p.provider || '').toLowerCase();
        return src === item.id || (item.id === 'x' && src === 'twitter') || (item.id === 'blog' && src === 'tenant_owned_feed');
      });

      const count = actualMatches.length > 0 ? actualMatches.length * 180 + (item.defaultCount % 100) : item.defaultCount;
      const percentage = Math.round((count / (totalCalculated || 1)) * 100);

      return {
        id: item.id,
        name: item.label,
        count,
        authors: Math.round(count * 0.42) || item.defaultAuthors,
        percentage: Math.max(1, percentage),
        trend: count > 100 ? 'up' : count > 30 ? 'flat' : 'down',
      };
    });
  }, [filteredPosts]);

  // Authors Aggregation
  const authorsData = useMemo(() => {
    const list = [
      {
        name: 'Diane Prescott',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
        source: 'x',
        postsCount: 232,
        trend: 'up',
      },
      {
        name: 'Annie Herriman',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
        source: 'facebook',
        postsCount: 164,
        trend: 'flat',
      },
      {
        name: 'Lori Penor',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        source: 'x',
        postsCount: 106,
        trend: 'up',
      },
      {
        name: 'Justin Harrison',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        source: 'facebook',
        postsCount: 78,
        trend: 'down',
      },
      {
        name: 'Kim Akers',
        avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=120&auto=format&fit=crop&q=80',
        source: 'instagram',
        postsCount: 35,
        trend: 'flat',
      },
    ];

    // Include dynamically found authors from store
    const uniqueStoreAuthors: string[] = Array.from(new Set(filteredPosts.map((p) => p.author)));
    uniqueStoreAuthors.forEach((authorName: string) => {
      if (!list.some((a) => a.name.toLowerCase() === authorName.toLowerCase())) {
        const postItem = filteredPosts.find((p) => p.author === authorName);
        list.push({
          name: authorName,
          avatar: postItem?.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          source: (postItem?.sourceType || 'x') as IngestionSourceType,
          postsCount: 45,
          trend: 'up',
        });
      }
    });

    return list.slice(0, 6);
  }, [filteredPosts]);

  // Word Cloud Keywords
  const wordCloudKeywords = useMemo(() => {
    return [
      { text: '#msdyncrm', weight: 'text-2xl font-bold', color: 'text-slate-800 hover:text-blue-600', sentiment: 'pos', count: 1840 },
      { text: 'Microsoft', weight: 'text-xl font-semibold', color: 'text-slate-700 hover:text-blue-600', sentiment: 'pos', count: 1420 },
      { text: 'MSFT', weight: 'text-lg font-medium', color: 'text-slate-600 hover:text-blue-600', sentiment: 'pos', count: 980 },
      { text: 'crm', weight: 'text-base font-normal', color: 'text-slate-500 hover:text-slate-800', sentiment: 'neu', count: 720 },
      { text: '#msdynamics', weight: 'text-sm font-medium', color: 'text-slate-500 hover:text-blue-600', sentiment: 'pos', count: 640 },
      { text: '#conv15', weight: 'text-xs font-normal', color: 'text-slate-400 hover:text-slate-700', sentiment: 'neu', count: 320 },
      { text: 'Integration', weight: 'text-sm font-medium', color: 'text-slate-600 hover:text-slate-900', sentiment: 'pos', count: 580 },
      { text: '#msdyncomm', weight: 'text-xs font-normal', color: 'text-slate-400 hover:text-slate-700', sentiment: 'neu', count: 290 },
      { text: 'sales', weight: 'text-sm font-medium', color: 'text-slate-500 hover:text-slate-800', sentiment: 'neu', count: 480 },
      { text: 'Subscription', weight: 'text-xs font-normal', color: 'text-slate-400 hover:text-slate-700', sentiment: 'neu', count: 260 },
      { text: 'Bing', weight: 'text-xs font-normal', color: 'text-slate-400 hover:text-slate-700', sentiment: 'neu', count: 240 },
      { text: 'ebook', weight: 'text-xs font-normal', color: 'text-slate-400 hover:text-slate-700', sentiment: 'neu', count: 210 },
      { text: 'Azure OpenAI', weight: 'text-base font-semibold', color: 'text-emerald-700 hover:text-emerald-800', sentiment: 'pos', count: 690 },
      { text: '#EnterpriseAI', weight: 'text-lg font-semibold', color: 'text-blue-700 hover:text-blue-900', sentiment: 'pos', count: 850 },
      { text: 'Data Sovereignty', weight: 'text-xs font-normal', color: 'text-slate-500 hover:text-slate-800', sentiment: 'neu', count: 310 },
    ];
  }, []);

  // Watchlist Topics Coverage Data
  const watchlistCoverage = useMemo(() => {
    const matchedCount = 4376;
    const totalVolume = 5215;
    const percentageCategory = 16.92;
    const percentageDataset = 16.25;

    const slices = [
      { name: 'Dynamics CRM / Acme Brand', value: 3200, color: '#3B82F6' },
      { name: 'Competitor Intelligence', value: 1100, color: '#10B981' },
      { name: '#EnterpriseAI Watchlist', value: 650, color: '#8B5CF6' },
      { name: 'Public Feed Stream', value: 265, color: '#CBD5E1' },
    ];

    return {
      matchedCount,
      totalVolume,
      percentageCategory,
      percentageDataset,
      slices,
    };
  }, []);

  // Languages Aggregation
  const languagesData = useMemo(() => {
    return [
      { code: 'en', name: 'English', count: 3899, percentage: 74.8, trend: 'up' },
      { code: 'de', name: 'German', count: 397, percentage: 7.6, trend: 'flat' },
      { code: 'fr', name: 'French', count: 388, percentage: 7.4, trend: 'up' },
      { code: 'it', name: 'Italian', count: 246, percentage: 4.7, trend: 'down' },
      { code: 'es', name: 'Spanish', count: 184, percentage: 3.5, trend: 'up' },
      { code: 'ja', name: 'Japanese', count: 101, percentage: 1.9, trend: 'flat' },
    ];
  }, []);

  // Active filters count
  const activeFiltersCount = [
    activeDateFilter,
    activeSourceFilter,
    activeAuthorFilter,
    activeKeywordFilter,
    activeLanguageFilter,
    activeRegionFilter,
    activeSentimentFilter,
    activeIntentionFilter,
    activeTagFilter,
    selectedTopic !== 'all' ? selectedTopic : null,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedTopic('all');
    setActiveDateFilter(null);
    setActiveSourceFilter(null);
    setActiveAuthorFilter(null);
    setActiveKeywordFilter(null);
    setActiveLanguageFilter(null);
    setActiveRegionFilter(null);
    setActiveSentimentFilter(null);
    setActiveIntentionFilter(null);
    setActiveTagFilter(null);
  };

  // Dynamic posts total and growth delta calculation for the global date range
  const dateRangeMetrics = useMemo(() => {
    if (activeFiltersCount > 0) {
      const cnt = filteredPosts.length;
      return {
        formattedCount: cnt > 10 ? `${cnt}` : `${cnt}`,
        rawCount: cnt,
        deltaText: cnt > 0 ? '+18%' : '0%',
        deltaTrend: 'up' as const,
      };
    }

    switch (selectedDateRange) {
      case 'week_future_decoded':
        return { formattedCount: '87', rawCount: 87, deltaText: '∞', deltaTrend: 'infinity' as const };
      case 'week_oct':
        return { formattedCount: '920', rawCount: 920, deltaText: '+1,331%', deltaTrend: 'up' as const };
      case 'custom_sep':
        return { formattedCount: '5.8k', rawCount: 5800, deltaText: '+87%', deltaTrend: 'up' as const };
      case 'month':
        return { formattedCount: '603.5k', rawCount: 603500, deltaText: '+1%', deltaTrend: 'flat' as const };
      case 'today':
        return { formattedCount: `${Math.max(6, filteredPosts.length)}`, rawCount: filteredPosts.length || 6, deltaText: '+300%', deltaTrend: 'up' as const };
      case 'yesterday':
        return { formattedCount: `${Math.max(12, filteredPosts.length * 2)}`, rawCount: 12, deltaText: '+45%', deltaTrend: 'up' as const };
      case 'last_7_days':
        return { formattedCount: `${Math.max(34, filteredPosts.length * 4)}`, rawCount: 34, deltaText: '+12.4%', deltaTrend: 'up' as const };
      case 'last_14_days':
        return { formattedCount: `${Math.max(68, filteredPosts.length * 8)}`, rawCount: 68, deltaText: '+8.6%', deltaTrend: 'up' as const };
      case 'last_30_days':
        return { formattedCount: `${Math.max(145, filteredPosts.length * 16)}`, rawCount: 145, deltaText: '+15.2%', deltaTrend: 'up' as const };
      case 'this_month':
        return { formattedCount: `${Math.max(89, filteredPosts.length * 10)}`, rawCount: 89, deltaText: '+5.8%', deltaTrend: 'up' as const };
      case 'last_month':
        return { formattedCount: `${Math.max(210, filteredPosts.length * 25)}`, rawCount: 210, deltaText: '-2.1%', deltaTrend: 'down' as const };
      case 'all_time':
        return { formattedCount: `${Math.max(840, filteredPosts.length * 90)}`, rawCount: 840, deltaText: '+240%', deltaTrend: 'up' as const };
      default:
        return {
          formattedCount: `${Math.max(filteredPosts.length, 12)}`,
          rawCount: filteredPosts.length,
          deltaText: '+14%',
          deltaTrend: 'up' as const,
        };
    }
  }, [selectedDateRange, activeFiltersCount, filteredPosts.length]);

  // Dynamic trending topics list from filtered posts
  const dynamicTrendingTopics = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredPosts.forEach(post => {
      post.enrichment.keyPhrases?.forEach(kp => {
        const clean = kp.trim();
        if (clean) {
          counts[clean] = (counts[clean] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(counts)
      .map(([text, count]) => ({ text: text.startsWith('#') ? text : `#${text.toLowerCase()}`, count }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length >= 3) {
      return sorted;
    }

    return wordCloudKeywords.map(k => ({ text: k.text, count: k.count }));
  }, [filteredPosts, wordCloudKeywords]);

  return (
    <div className="space-y-4" id="post-analytics-dashboard">
      {/* EXPORT TOAST NOTIFICATION */}
      {exportToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{exportToast}</span>
        </div>
      )}

      {/* 1. TOP HEADER & FILTER BAR (Classic Microsoft Social Engagement Style) */}
      <div className="bg-white rounded-none border border-slate-200/90 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Topic Selector with Dropdown */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <select
                id="select-analytics-topic"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                aria-label="Filter posts by search topic or watchlist"
                className="text-xl md:text-2xl font-light text-slate-800 bg-transparent border-0 focus:ring-0 cursor-pointer pr-6 py-0 leading-tight"
              >
                <option value="future_decoded">Future Decoded</option>
                <option value="all">All Search Topics</option>
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <span className="text-slate-400 hover:text-blue-600 cursor-pointer" title="Linked Search Topics">
                <Share2 className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center gap-4 mt-2">
              {(['overview', 'conversations', 'sentiment', 'location', 'sources'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-normal capitalize transition-colors pb-1 ${
                    activeTab === tab
                      ? 'text-sky-600 font-medium border-b-2 border-sky-500'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}

              {/* Add filters button */}
              <button
                type="button"
                id="btn-add-filters"
                onClick={() => setShowAddFiltersModal(true)}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 ml-2"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">
                  +
                </div>
                <span>Add filters</span>
              </button>

              {/* Share View button */}
              <button
                type="button"
                id="btn-share-dashboard"
                onClick={handleShareView}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm transition-all duration-150 ml-3 border font-medium cursor-pointer shadow-2xs ${
                  shareCopied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50 hover:text-blue-800 hover:border-slate-300'
                }`}
                title="Copy direct shareable link with current filters to clipboard"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{shareCopied ? 'Link Copied!' : 'Share View'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Global Date Range Picker, KPI summary, and Posts Slideout Button */}
        <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
          {/* Active Filter Chips Button */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xs border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-600" />
              <span>{activeFiltersCount} Filter{activeFiltersCount > 1 ? 's' : ''}</span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="hover:bg-slate-200 rounded-full p-0.5 ml-1"
                title="Clear all filters"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Global Interactive Date Range Picker */}
          <GlobalDateRangePicker
            value={selectedDateRange}
            onChange={handleDateRangeChange}
          />

          {/* KPI Total Posts Pill */}
          <div className="flex items-center gap-2 pl-2">
            <div className="flex items-center gap-2">
              <div className="text-xl font-light text-slate-900 leading-none">
                {dateRangeMetrics.formattedCount}{' '}
                <span className="text-xs font-light text-slate-500">posts</span>
              </div>
              <div className="text-xs font-normal text-slate-700 flex items-center gap-0.5">
                {dateRangeMetrics.deltaTrend === 'infinity' ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                    <span className="font-semibold text-slate-900 text-sm">∞</span>
                  </>
                ) : dateRangeMetrics.deltaTrend === 'up' ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                    <span className="font-semibold text-slate-900">{dateRangeMetrics.deltaText}</span>
                  </>
                ) : dateRangeMetrics.deltaTrend === 'down' ? (
                  <>
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                    <span className="font-semibold text-rose-600">{dateRangeMetrics.deltaText}</span>
                  </>
                ) : (
                  <>
                    <MoveRight className="w-3 h-3 text-slate-600" />
                    <span>{dateRangeMetrics.deltaText}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Posts Slideout Trigger Button (MSE Right Tab) */}
          <button
            type="button"
            id="btn-toggle-posts-drawer"
            onClick={() => setShowPostsDrawer(!showPostsDrawer)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-slate-700 hover:text-slate-900 text-xs font-normal border-l border-slate-200 pl-3 cursor-pointer"
          >
            <span className="tracking-wider uppercase text-[11px] font-semibold text-slate-600">POSTS</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPostsDrawer ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Interactive Filter Chips Bar */}
      {activeFiltersCount > 0 && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Active Filters:
          </span>

          {selectedTopic !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs">
              <span>Topic: {selectedTopic}</span>
              <button type="button" onClick={() => setSelectedTopic('all')} className="hover:text-blue-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeDateFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-xs">
              <span>Date: {activeDateFilter}</span>
              <button type="button" onClick={() => setActiveDateFilter(null)} className="hover:text-sky-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeSourceFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs capitalize">
              <span>Source: {activeSourceFilter}</span>
              <button type="button" onClick={() => setActiveSourceFilter(null)} className="hover:text-indigo-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeAuthorFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-xs">
              <span>Author: @{activeAuthorFilter}</span>
              <button type="button" onClick={() => setActiveAuthorFilter(null)} className="hover:text-purple-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeKeywordFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs">
              <span>Phrase: "{activeKeywordFilter}"</span>
              <button type="button" onClick={() => setActiveKeywordFilter(null)} className="hover:text-amber-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeRegionFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">
              <span>Region: {activeRegionFilter}</span>
              <button type="button" onClick={() => setActiveRegionFilter(null)} className="hover:text-emerald-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeLanguageFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 text-xs uppercase">
              <span>Lang: {activeLanguageFilter}</span>
              <button type="button" onClick={() => setActiveLanguageFilter(null)} className="hover:text-teal-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeIntentionFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-xs capitalize">
              <span>Intention: {activeIntentionFilter}</span>
              <button type="button" onClick={() => setActiveIntentionFilter(null)} className="hover:text-rose-950 font-bold ml-0.5">×</button>
            </span>
          )}

          {activeTagFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs capitalize">
              <span>Tag: {activeTagFilter}</span>
              <button type="button" onClick={() => setActiveTagFilter(null)} className="hover:text-cyan-950 font-bold ml-0.5">×</button>
            </span>
          )}

          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-slate-500 hover:text-rose-600 underline ml-2 cursor-pointer font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* QUICK INSIGHT SUMMARY CARDS WITH D3 VISUALIZATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2" id="quick-insight-cards">
        {/* Card 1: Total Mentions */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-stretch justify-between gap-4 md:h-[120px] min-h-[120px] pb-3 md:pb-0 transition-all hover:border-blue-300">
          <div className="flex flex-col justify-between py-0.5 shrink-0">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Total Mentions</span>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {dateRangeMetrics.formattedCount}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {dateRangeMetrics.deltaTrend === 'down' ? (
                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" /> {dateRangeMetrics.deltaText}
                </span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> {dateRangeMetrics.deltaText}
                </span>
              )}
              <span className="text-slate-400 text-[10px] font-medium">vs prev period</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 h-full border-l border-slate-100 pl-4 flex items-center relative">
            <D3Sparkline timelineData={timelineData} />
          </div>
        </div>

        {/* Card 2: Sentiment Score */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-stretch justify-between gap-4 md:h-[120px] min-h-[120px] pb-3 md:pb-0 transition-all hover:border-emerald-300">
          <div className="flex flex-col justify-between py-0.5 shrink-0">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Sentiment Score</span>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-baseline gap-1.5">
                <span>{sentimentStats.index}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  sentimentStats.index >= 6.5 ? 'bg-emerald-100 text-emerald-800' : sentimentStats.index >= 4.0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {sentimentStats.index >= 6.5 ? 'Favorable' : sentimentStats.index >= 4.0 ? 'Mixed' : 'Critical'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`font-bold flex items-center gap-0.5 ${sentimentStats.index >= 5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {sentimentStats.index >= 5 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} {sentimentStats.delta}
              </span>
              <span className="text-slate-400 text-[10px] font-medium">net change</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 h-full border-l border-slate-100 pl-4 flex items-center relative">
            <D3SentimentGauge sentimentStats={sentimentStats} />
          </div>
        </div>

        {/* Card 3: Trending Topic */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-stretch justify-between gap-4 md:h-[120px] min-h-[120px] pb-3 md:pb-0 transition-all hover:border-violet-300">
          <div className="flex flex-col justify-between py-0.5 shrink-0 w-[120px]">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Trending Topic</span>
              <div className="text-sm font-bold text-slate-800 tracking-tight mt-1 truncate max-w-full" title={dynamicTrendingTopics[0]?.text}>
                {dynamicTrendingTopics[0]?.text || 'None'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-violet-600 font-bold flex items-center gap-0.5">
                <Flame className="w-3.5 h-3.5" /> Active
              </span>
              <span className="text-slate-400 text-[10px] font-medium">real-time trends</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 h-full border-l border-slate-100 pl-4 flex items-center">
            <D3TrendingTopicsChart keywords={dynamicTrendingTopics} />
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE TAB VIEW */}
      {activeTab === 'conversations' ? (
        <ConversationsDashboardTab
          filteredPosts={filteredPosts}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
          activeIntentionFilter={activeIntentionFilter}
          onSelectIntention={setActiveIntentionFilter}
          activeTagFilter={activeTagFilter}
          onSelectTag={setActiveTagFilter}
          activePhraseFilter={activeKeywordFilter}
          onSelectPhrase={setActiveKeywordFilter}
          activeSourceFilter={activeSourceFilter}
          onSelectSource={setActiveSourceFilter}
          activeLanguageFilter={activeLanguageFilter}
          onSelectLanguage={setActiveLanguageFilter}
          onOpenPostsDrawer={() => setShowPostsDrawer(true)}
          onExportWidgetData={handleExportWidgetData}
        />
      ) : activeTab === 'sentiment' ? (
        <SentimentDashboardTab
          filteredPosts={filteredPosts}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
          activeSourceFilter={activeSourceFilter}
          onSelectSource={setActiveSourceFilter}
          activeAuthorFilter={activeAuthorFilter}
          onSelectAuthor={setActiveAuthorFilter}
          activePhraseFilter={activeKeywordFilter}
          onSelectPhrase={setActiveKeywordFilter}
          onOpenPostsDrawer={() => setShowPostsDrawer(true)}
          onExportWidgetData={handleExportWidgetData}
        />
      ) : activeTab === 'location' ? (
        <LocationDashboardTab
          filteredPosts={filteredPosts}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
          activeRegionFilter={activeRegionFilter}
          onSelectRegion={setActiveRegionFilter}
          activeLanguageFilter={activeLanguageFilter}
          onSelectLanguage={setActiveLanguageFilter}
          onSelectPhrase={setActiveKeywordFilter}
          onOpenPostsDrawer={() => setShowPostsDrawer(true)}
          onExportWidgetData={handleExportWidgetData}
        />
      ) : activeTab === 'sources' ? (
        <SourcesDashboardTab
          filteredPosts={filteredPosts}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
          activeSourceFilter={activeSourceFilter}
          onSelectSource={setActiveSourceFilter}
          activeLanguageFilter={activeLanguageFilter}
          onSelectLanguage={setActiveLanguageFilter}
          onSelectPhrase={setActiveKeywordFilter}
          onOpenPostsDrawer={() => setShowPostsDrawer(true)}
          onExportWidgetData={handleExportWidgetData}
        />
      ) : (
        /* OVERVIEW / DEFAULT ANALYTICS GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR (Top: Sentiment Gauge, Center: Location Map, Bottom: Sources) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* LEFT TOP: SENTIMENT GAUGE */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-sentiment-gauge">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Sentiment
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Score Scale</span>
            </div>

            <div className="pt-4 flex items-center justify-between">
              {/* Score index */}
              <div className="text-left">
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {sentimentStats.index}
                </div>
                <div className="text-[11px] text-slate-500 font-medium -mt-1">index</div>
              </div>

              {/* Central Semicircular Smile Donut */}
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Positive Arc (Emerald) */}
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="#10B981"
                    strokeWidth="8"
                    strokeDasharray="238"
                    strokeDashoffset={238 - (238 * sentimentStats.posPct) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                  {/* Negative Arc (Rose) */}
                  <circle
                    cx="48"
                    cy="48"
                    r="38"
                    stroke="#F43F5E"
                    strokeWidth="8"
                    strokeDasharray="238"
                    strokeDashoffset={238 - (238 * sentimentStats.negPct) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="opacity-70"
                  />
                </svg>
                {/* Center Face Icon */}
                <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                  {sentimentStats.index >= 6 ? (
                    <Smile className="w-8 h-8 text-emerald-500" />
                  ) : sentimentStats.index >= 4 ? (
                    <Meh className="w-8 h-8 text-amber-500" />
                  ) : (
                    <Frown className="w-8 h-8 text-rose-500" />
                  )}
                </div>
              </div>

              {/* Change delta */}
              <div className="text-right">
                <div className="text-xl font-bold text-slate-800">
                  {sentimentStats.delta}
                </div>
                <div className="text-[11px] text-slate-500 font-medium -mt-1 flex items-center justify-end gap-0.5">
                  <span>change</span>
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Slider bar from -10 to +10 */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>-10</span>
                <span className="text-slate-600 font-semibold">{sentimentStats.posPct}% Positive</span>
                <span>10+</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${sentimentStats.posPct}%` }} className="bg-emerald-500 h-full" title={`Positive: ${sentimentStats.posPct}%`} />
                <div style={{ width: `${sentimentStats.neuPct}%` }} className="bg-slate-300 h-full" title={`Neutral: ${sentimentStats.neuPct}%`} />
                <div style={{ width: `${sentimentStats.negPct}%` }} className="bg-rose-500 h-full" title={`Negative: ${sentimentStats.negPct}%`} />
              </div>
            </div>
          </div>

          {/* LEFT CENTER: LOCATION AND POST DENSITY MAP */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-location-insights">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                Location Insights
              </h2>
              <span className="text-[10px] font-mono text-slate-400">GEO DENSITY</span>
            </div>

            {/* World Density Map Vector Canvas */}
            <div className="relative mt-3 bg-blue-50/50 rounded-lg p-2 border border-blue-100/80 overflow-hidden">
              <svg viewBox="0 0 500 280" className="w-full h-auto text-blue-200">
                {/* Stylized Continents Outlines */}
                {/* North America */}
                <path
                  d="M40,50 Q70,30 110,40 Q150,55 170,90 Q150,140 100,145 Q80,160 70,180 Q55,140 40,110 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('North America')}
                />
                {/* South America */}
                <path
                  d="M110,185 Q145,180 160,210 Q150,260 125,275 Q105,250 105,200 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('Latin America')}
                />
                {/* Europe */}
                <path
                  d="M210,45 Q260,35 290,60 Q285,100 245,115 Q215,95 210,70 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('Europe')}
                />
                {/* Africa */}
                <path
                  d="M225,120 Q280,120 290,165 Q275,230 245,240 Q215,200 220,150 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('Africa')}
                />
                {/* Asia */}
                <path
                  d="M295,45 Q380,30 450,70 Q460,135 410,160 Q340,150 300,105 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('Asia Pacific')}
                />
                {/* Australia */}
                <path
                  d="M390,195 Q445,190 455,230 Q425,255 385,240 Z"
                  fill="#CBD5E1"
                  className="hover:fill-blue-300 transition-colors cursor-pointer"
                  onClick={() => setActiveRegionFilter('Australia')}
                />

                {/* Density Pulsing Hotspots (Nodes from MSE) */}
                {/* NA Hotspots */}
                <circle cx="85" cy="80" r="10" fill="#2563EB" opacity="0.75" className="animate-pulse" />
                <circle cx="130" cy="95" r="14" fill="#1D4ED8" opacity="0.8" />
                <circle cx="95" cy="120" r="8" fill="#3B82F6" opacity="0.7" />

                {/* Europe Hotspots */}
                <circle cx="235" cy="75" r="12" fill="#2563EB" opacity="0.8" />
                <circle cx="255" cy="85" r="11" fill="#1D4ED8" opacity="0.75" />
                <circle cx="270" cy="70" r="9" fill="#3B82F6" opacity="0.7" />

                {/* Asia Hotspots */}
                <circle cx="370" cy="110" r="10" fill="#2563EB" opacity="0.7" />
                <circle cx="430" cy="100" r="12" fill="#1D4ED8" opacity="0.8" />

                {/* Latin America Hotspot */}
                <circle cx="135" cy="225" r="7" fill="#3B82F6" opacity="0.7" />
              </svg>

              {/* Map labels */}
              <div className="absolute bottom-1 right-2 text-[9px] text-slate-400 font-mono">
                © Microsoft Social Engagement Geo-Mesh
              </div>
            </div>

            {/* Regional breakdown pills */}
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveRegionFilter(activeRegionFilter === 'North America' ? null : 'North America')}
                className={`px-2 py-1 rounded text-left border transition-all ${
                  activeRegionFilter === 'North America' ? 'bg-blue-50 border-blue-500 font-bold text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[10px] text-slate-400 uppercase">North Am.</div>
                <div className="font-semibold text-slate-800">2,418 (46%)</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveRegionFilter(activeRegionFilter === 'Europe' ? null : 'Europe')}
                className={`px-2 py-1 rounded text-left border transition-all ${
                  activeRegionFilter === 'Europe' ? 'bg-blue-50 border-blue-500 font-bold text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[10px] text-slate-400 uppercase">Europe</div>
                <div className="font-semibold text-slate-800">1,512 (29%)</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveRegionFilter(activeRegionFilter === 'Asia Pacific' ? null : 'Asia Pacific')}
                className={`px-2 py-1 rounded text-left border transition-all ${
                  activeRegionFilter === 'Asia Pacific' ? 'bg-blue-50 border-blue-500 font-bold text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[10px] text-slate-400 uppercase">Asia Pac.</div>
                <div className="font-semibold text-slate-800">820 (16%)</div>
              </button>
            </div>
          </div>

          {/* LEFT BOTTOM: AUTHORS BY SOURCE (Requested: Facebook, YouTube, Instagram, LinkedIn, X, Blog, GNews, Newswire) */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-authors-by-source">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Authors by Source
              </h2>
              <span className="text-[10px] text-slate-400 font-semibold">8 PLATFORMS</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              {/* Center Donut Graphic */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" stroke="#E2E8F0" strokeWidth="6" fill="transparent" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#0284C7"
                    strokeWidth="6"
                    strokeDasharray="200"
                    strokeDashoffset="30"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Users className="w-4 h-4 text-slate-700" />
                  <span className="text-[10px] font-bold text-slate-800">2,211</span>
                  <span className="text-[8px] text-slate-400 leading-none">authors</span>
                </div>
              </div>

              {/* Ingestion Source Rows */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-48 pr-1 text-xs">
                {sourcesData.map((src) => {
                  const isSelected = activeSourceFilter === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setActiveSourceFilter(isSelected ? null : src.id)}
                      className={`w-full flex items-center justify-between p-1.5 rounded transition-all ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-500 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 ${getSourceColor(src.id)}`}>
                          <SourceIcon source={src.id} className="w-2.5 h-2.5" />
                        </span>
                        <span className="truncate text-[11px]">{src.authors} auth...</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-mono">{src.name.split(' ')[0]}</span>
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER (Top: Timeline Graph, Underneath: Sources Left & Authors Right) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          {/* CENTER TOP: TIMELINE GRAPH (VOLUME & AVERAGE) */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-timeline-volume">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-3 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Volume &amp; Projections
                </h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-800 border-b-2 border-slate-800 pb-0.5">
                    Timeline
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowForecast(!showForecast)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      showForecast ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse' : 'bg-slate-100 text-slate-400 border border-transparent'
                    }`}
                  >
                    Forecast {showForecast ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                  <span>Total Ingested</span>
                </span>
                {showForecast && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                    <span>Projected (7d)</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-0.5 bg-slate-400" />
                  <span>Moving Avg</span>
                </span>
              </div>
            </div>

            {/* Predictive Sentiment Trajectory & Crisis Alert Banner */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Crisis Radar Banner */}
              <div className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                forecastResponse?.crisisRadar?.alertLevel === 'CRITICAL' || forecastResponse?.crisisRadar?.alertLevel === 'WARNING'
                  ? 'bg-amber-50/50 border-amber-200 text-amber-900' 
                  : 'bg-emerald-50/30 border-emerald-100 text-emerald-900'
              }`}>
                <div className="p-1 rounded bg-white shrink-0 shadow-3xs">
                  <Radio className={`w-3.5 h-3.5 ${
                    forecastResponse?.crisisRadar?.alertLevel === 'CRITICAL' || forecastResponse?.crisisRadar?.alertLevel === 'WARNING'
                      ? 'text-amber-600 animate-pulse'
                      : 'text-emerald-600'
                  }`} />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>Crisis Alert Radar</span>
                    <span className={`text-[8px] px-1 py-0.2 rounded-full uppercase font-mono tracking-wider ${
                      forecastResponse?.crisisRadar?.alertLevel === 'CRITICAL' || forecastResponse?.crisisRadar?.alertLevel === 'WARNING'
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}>
                      {forecastResponse?.crisisRadar?.alertLevel || 'WARNING'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-tight">
                    {forecastResponse?.crisisRadar?.title || 'Emerging SSO Latency & Connection Timeouts'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Cluster: <span className="font-semibold text-slate-600">{forecastResponse?.crisisRadar?.flaggedCluster || 'Integration Sync'}</span> ({forecastResponse?.crisisRadar?.viralityIndex || '68% virality probability'})
                  </p>
                </div>
              </div>

              {/* Sentiment Trajectory Banner */}
              <div className="p-2.5 bg-indigo-50/30 border border-indigo-100 rounded-lg text-indigo-950 flex items-start gap-2.5">
                <div className="p-1 rounded bg-white shrink-0 shadow-3xs">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>Sentiment Trajectory</span>
                    <span className="text-[8px] px-1 py-0.2 bg-indigo-100 text-indigo-800 rounded-full font-mono uppercase tracking-wider">
                      {forecastResponse?.sentimentTrajectory?.trend || 'RECOVERING'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-tight">
                    Velocity of <span className="font-bold text-indigo-700">{forecastResponse?.sentimentTrajectory?.rate || '+2.4% / day'}</span> based on moving averages.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Confidence: <span className="font-semibold text-indigo-600">{forecastResponse?.sentimentTrajectory?.confidenceLevel || 'High (89%)'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Recharts Timeline Area Chart */}
            <div className="h-56 mt-3 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) {
                      setActiveDateFilter(activeDateFilter === e.activeLabel ? null : e.activeLabel);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    domain={[0, 2500]}
                    ticks={[0, 750, 1500, 2250]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const isForecastPoint = label?.includes('• Proj');
                        const volVal = payload.find(p => p.dataKey === 'volume')?.value;
                        const projVal = payload.find(p => p.dataKey === 'projectedVolume')?.value;
                        const avgVal = payload.find(p => p.dataKey === 'average')?.value;

                        return (
                          <AnimatedChartTooltip
                            active={active}
                            title={`${isForecastPoint ? '🔮 Forecast Window' : '📊 Historical data'}: ${label}`}
                            items={[
                              {
                                name: 'Historical Volume',
                                value: volVal !== undefined && volVal !== null ? `${Number(volVal).toLocaleString()} posts` : 'N/A',
                                color: '#2563EB',
                                badge: activeDateFilter === label ? 'Filtered' : undefined,
                                badgeColor: 'bg-blue-600/30 text-blue-300',
                              },
                              {
                                name: 'Projected Volume',
                                value: projVal !== undefined && projVal !== null ? `${Number(projVal).toLocaleString()} posts (Proj)` : 'N/A',
                                color: '#8B5CF6',
                              },
                              {
                                name: '7-Day Avg',
                                value: avgVal !== undefined && avgVal !== null ? Number(avgVal).toLocaleString() : 'N/A',
                                color: '#94A3B8',
                              },
                            ]}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#volumeGradient)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="projectedVolume"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#forecastGradient)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke="#94A3B8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Advanced Proactive Intelligence Insights Section */}
            {showForecast && forecastResponse && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Proactive Decision-Making Analysis Outlook</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {forecastResponse?.sentimentTrajectory?.narrative}
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px]">
                  <span className="font-semibold text-rose-700">Virality Warning:</span>
                  <span className="text-slate-500">{forecastResponse?.crisisRadar?.recommAction}</span>
                </div>
              </div>
            )}

            {/* AI-Powered "Explain the Spike" Narrative Summary */}
            {activeDateFilter ? (
              <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 -mx-4 px-4 pb-4 rounded-b-lg">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        AI Spike Explanation &amp; Storytelling Brief
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Analyzing activity surge for <span className="font-semibold text-slate-600">{activeDateFilter}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchSpikeExplanation(activeDateFilter, customSpikePrompt)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="Re-analyze / Refresh"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDateFilter(null)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Clear Filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {loadingSpike ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="animate-spin text-blue-600">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Gemini AI is scanning post context, clustering influencers, and compiling storytelling brief...
                    </p>
                  </div>
                ) : spikeError ? (
                  <div className="p-3 rounded-lg border border-red-100 bg-red-50/30 text-xs text-red-600 flex items-center justify-between">
                    <span>{spikeError}</span>
                    <button
                      type="button"
                      onClick={() => fetchSpikeExplanation(activeDateFilter, customSpikePrompt)}
                      className="underline font-bold"
                    >
                      Retry
                    </button>
                  </div>
                ) : spikeExplanation ? (
                  <div className="space-y-4">
                    {/* Primary Narrative */}
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h4 className="text-sm font-bold text-slate-800 leading-snug">
                          {spikeExplanation.headline}
                        </h4>
                        <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                          {spikeExplanation.spikeMagnitude || '+340% surge'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {spikeExplanation.rootCause}
                      </p>
                    </div>

                    {/* Three Columns of Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Executive Bullet Brief */}
                      <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" /> Executive Brief
                        </h5>
                        <ul className="space-y-1.5 text-[11px] text-slate-600 leading-normal list-none pl-0">
                          {spikeExplanation.executiveBrief?.map((bullet: string, i: number) => {
                            const parts = bullet.split(':');
                            if (parts.length > 1) {
                              return (
                                <li key={i}>
                                  <span className="font-semibold text-slate-800">{parts[0]}:</span>{parts.slice(1).join(':')}
                                </li>
                              );
                            }
                            return <li key={i}>{bullet}</li>;
                          })}
                        </ul>
                      </div>

                      {/* Catalyst Analysis */}
                      <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-500" /> Impact Catalysts
                        </h5>
                        <div className="space-y-2">
                          {spikeExplanation.catalysts?.map((cat: any, i: number) => (
                            <div key={i} className="text-[11px]">
                              <div className="flex items-center justify-between font-semibold text-slate-700">
                                <span className="truncate">{cat.factor}</span>
                                <span className={`text-[9px] font-mono font-bold uppercase px-1 rounded-xs ${
                                  cat.impact === 'High' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {cat.impact} Impact
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{cat.details}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Key Influencer Mentions */}
                      <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" /> Top Amplifier Nodes
                        </h5>
                        <div className="space-y-2">
                          {spikeExplanation.keyInfluencers?.map((inf: any, i: number) => (
                            <div key={i} className="text-[11px]">
                              <div className="flex items-center justify-between font-semibold text-slate-800">
                                <span>{inf.handle}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-normal">{inf.reach}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 italic truncate" title={inf.quote}>
                                "{inf.quote}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Operational Recommendations */}
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/60 text-xs font-medium">
                      <h5 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Recommended Action Items
                      </h5>
                      <ul className="space-y-1 text-[11px] text-slate-700 list-disc pl-4">
                        {spikeExplanation.recommendedActions?.map((act: string, i: number) => (
                          <li key={i}>{act}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Custom Instruction Box */}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Refine spike storytelling brief (e.g. 'Focus on product stability complaints')..."
                        value={customSpikePrompt}
                        onChange={(e) => setCustomSpikePrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            fetchSpikeExplanation(activeDateFilter, customSpikePrompt);
                          }
                        }}
                        className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white shadow-3xs"
                      />
                      <button
                        type="button"
                        onClick={() => fetchSpikeExplanation(activeDateFilter, customSpikePrompt)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-950 text-white text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        Refine
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5 py-4">
                <div className="p-1 bg-white border border-slate-200 rounded text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span>
                  Click any spike point or day on the chart above to generate an <strong>AI storytelling root-cause explanation</strong>
                </span>
              </div>
            )}
          </div>

          {/* CENTER UNDERNEATH: TWO SUB-CARDS (Left: Sources Count, Right: Authors Count) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CENTER UNDERNEATH LEFT: SOURCES LIST WITH PROPORTIONAL BARS */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-sources-list">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Sources
                </h2>
                <span className="text-[10px] text-slate-400">POSTS COUNT</span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                {sourcesData.map((src) => {
                  const isSelected = activeSourceFilter === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setActiveSourceFilter(isSelected ? null : src.id)}
                      className={`w-full flex items-center justify-between p-1.5 rounded transition-all group ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-500 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-white shrink-0 ${getSourceColor(src.id)}`}>
                          <SourceIcon source={src.id} className="w-3 h-3" />
                        </span>
                        <span className="font-semibold text-slate-800 text-xs">{src.count.toLocaleString()}</span>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden mx-2">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(12, src.percentage * 1.2))}%` }}
                        />
                      </div>

                      <TrendingUp className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CENTER UNDERNEATH RIGHT: AUTHORS AND TOTAL NUMBER OF POSTS */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-top-authors">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Authors
                </h2>
                <span className="text-[10px] text-slate-400">TOP CONTRIBUTORS</span>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                {authorsData.map((author) => {
                  const isSelected = activeAuthorFilter === author.name;
                  return (
                    <button
                      key={author.name}
                      type="button"
                      onClick={() => setActiveAuthorFilter(isSelected ? null : author.name)}
                      className={`w-full flex items-center justify-between p-1.5 rounded transition-all group ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-500 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-300 shrink-0"
                        />
                        <span className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center text-white shrink-0 ${getSourceColor(author.source)}`}>
                          <SourceIcon source={author.source} className="w-2 h-2" />
                        </span>
                        <span className="truncate text-slate-800 font-medium text-xs">
                          {author.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-800 text-xs">
                          {author.postsCount}
                        </span>
                        {author.trend === 'up' ? (
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                        ) : author.trend === 'down' ? (
                          <TrendingDown className="w-3 h-3 text-rose-600" />
                        ) : (
                          <Minus className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT SIDEBAR (Top: Word Cloud, Center: Gauge Donut, Bottom: Languages) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* RIGHT TOP: WORD CLOUD WITH ENRICHED RESULTS OF KEYWORDS */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-phrases-wordcloud">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Phrases
              </h2>
              <span className="text-[10px] text-slate-400">ENRICHED TOPICS</span>
            </div>

            {/* Word Cloud Typography Cloud (MSE Style) */}
            <div className="mt-3 p-3 bg-slate-50/70 rounded-md border border-slate-200/80 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center select-none">
              {wordCloudKeywords.map((tag) => {
                const isSelected = activeKeywordFilter === tag.text;
                return (
                  <button
                    key={tag.text}
                    type="button"
                    onClick={() => setActiveKeywordFilter(isSelected ? null : tag.text)}
                    className={`transition-transform hover:scale-105 cursor-pointer leading-tight ${tag.weight} ${tag.color} ${
                      isSelected ? 'bg-blue-600 text-white! px-2 py-0.5 rounded shadow-sm' : ''
                    }`}
                    title={`${tag.text}: ${tag.count} matches`}
                  >
                    {tag.text}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT MIDDLE: GAUGE DONUT CIRCLE DIAGRAM (Watchlist percentage items vs total ingested) */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-search-topics-gauge">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Search Topics
              </h2>
              <span className="text-[10px] text-slate-400">WATCHLIST COVERAGE</span>
            </div>

            <div className="mt-3 flex items-center gap-4">
              {/* Donut Circle Gauge */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <PieChart width={96} height={96}>
                  <Pie
                    data={watchlistCoverage.slices}
                    cx={44}
                    cy={44}
                    innerRadius={28}
                    outerRadius={42}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {watchlistCoverage.slices.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              {/* Topic Description & Percentages */}
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-slate-900 text-sm">Dynamics CRM</div>
                <div className="text-[11px] text-slate-600 font-medium">
                  <span className="font-bold text-slate-900">16.92%</span> of posts in the category
                </div>
                <div className="text-[11px] text-slate-500">
                  <span className="font-bold text-slate-800">16.25%</span> of posts in your data set
                </div>
              </div>
            </div>

            {/* Topic Legend */}
            <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
              {watchlistCoverage.slices.map((slice) => (
                <div key={slice.name} className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="truncate max-w-[140px]">{slice.name}</span>
                  </div>
                  <span className="font-mono font-medium text-slate-700">{slice.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT BOTTOM: LANGUAGES AND AMOUNT OF POSTS */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" id="widget-languages">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Languages
              </h2>
              <span className="text-[10px] text-slate-400">DISTRIBUTION</span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              {languagesData.map((lang) => {
                const isSelected = activeLanguageFilter === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setActiveLanguageFilter(isSelected ? null : lang.code)}
                    className={`w-full flex items-center justify-between p-1.5 rounded transition-all group ${
                      isSelected ? 'bg-blue-50 ring-1 ring-blue-500 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-16 text-left font-medium text-slate-700">
                      {lang.name}
                    </div>

                    <div className="font-mono font-bold text-slate-800 text-right w-12">
                      {lang.count.toLocaleString()}
                    </div>

                    {/* Horizontal Bar */}
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden mx-2">
                      <div
                        className="h-full bg-slate-600 group-hover:bg-blue-600 rounded-full transition-colors"
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>

                    {lang.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : lang.trend === 'down' ? (
                      <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
                    ) : (
                      <Minus className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 3. ADD FILTERS MODAL (Microsoft Social Engagement Filter Builder) */}
      {showAddFiltersModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Filters"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-none border border-slate-300 shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-sm">Add Analytics Filters</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFiltersModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Keyword / Phrase */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Search Phrase / Keyword
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. artificial intelligence, microsoft, azure"
                    defaultValue={activeKeywordFilter || ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setActiveKeywordFilter((e.target as HTMLInputElement).value || null);
                        setShowAddFiltersModal(false);
                      }
                    }}
                    id="input-filter-phrase"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xs text-xs focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('input-filter-phrase') as HTMLInputElement;
                      setActiveKeywordFilter(el?.value || null);
                      setShowAddFiltersModal(false);
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Intentions Filter */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Filter by Intention
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'information_request', label: 'Information request' },
                    { id: 'purchase', label: 'Purchase intention' },
                    { id: 'support_request', label: 'Support request' },
                    { id: 'complaint', label: 'Customer Complaint' },
                  ].map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setActiveIntentionFilter(activeIntentionFilter === it.id ? null : it.id);
                      }}
                      className={`px-2.5 py-1.5 text-left border rounded-xs transition-colors flex items-center justify-between ${
                        activeIntentionFilter === it.id
                          ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{it.label}</span>
                      {activeIntentionFilter === it.id && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Filter by Tag
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {['Announcement', 'Advocate', 'MSE today'].map((tg) => {
                    const id = tg.toLowerCase().replace(/\s+/g, '_');
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTagFilter(activeTagFilter === id ? null : id);
                        }}
                        className={`px-3 py-1 text-xs border rounded-xs transition-colors ${
                          activeTagFilter === id
                            ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {tg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ingestion Sources */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Filter by Ingestion Source
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'twitter', label: 'Twitter / X' },
                    { id: 'rss', label: 'RSS & Blogs' },
                    { id: 'facebook', label: 'Facebook' },
                    { id: 'youtube', label: 'YouTube' },
                    { id: 'linkedin', label: 'LinkedIn' },
                    { id: 'reddit', label: 'Reddit / Blogs' },
                  ].map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => {
                        setActiveSourceFilter(activeSourceFilter === src.id ? null : src.id);
                      }}
                      className={`px-2.5 py-1.5 text-left border rounded-xs transition-colors flex items-center justify-between ${
                        activeSourceFilter === src.id
                          ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{src.label}</span>
                      {activeSourceFilter === src.id && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Filter by Language
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'es', label: 'Spanish' },
                    { id: 'de', label: 'German' },
                    { id: 'fr', label: 'French' },
                    { id: 'pt', label: 'Portuguese' },
                  ].map((lng) => (
                    <button
                      key={lng.id}
                      type="button"
                      onClick={() => {
                        setActiveLanguageFilter(activeLanguageFilter === lng.id ? null : lng.id);
                      }}
                      className={`px-3 py-1 text-xs border rounded-xs transition-colors ${
                        activeLanguageFilter === lng.id
                          ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lng.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Filter by Sentiment
                </label>
                <div className="flex gap-1.5">
                  {['Positive', 'Neutral', 'Negative'].map((sent) => (
                    <button
                      key={sent}
                      type="button"
                      onClick={() => {
                        setActiveSentimentFilter(activeSentimentFilter === sent ? null : sent);
                      }}
                      className={`flex-1 py-1 text-xs border rounded-xs transition-colors text-center ${
                        activeSentimentFilter === sent
                          ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {sent}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                Clear all active filters
              </button>
              <button
                type="button"
                onClick={() => setShowAddFiltersModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SLIDE-OUT POSTS INSPECTION DRAWER (MSE Real-Time Post Viewer) */}
      {showPostsDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtered Posts Stream"
          className={`fixed inset-y-0 right-0 z-50 w-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200 transition-all ${
            selectedPostForDetail ? 'max-w-3xl md:max-w-4xl' : 'max-w-md'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-bold text-sm">Filtered Posts Stream</h3>
                <p className="text-[11px] text-slate-400">
                  Showing {filteredPosts.length} matching posts from active dashboard filters
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPostForDetail(null);
                setShowPostsDrawer(false);
              }}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Filter summary */}
          {activeFiltersCount > 0 && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800">
              <span>Applied filters: {activeFiltersCount}</span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="font-bold underline hover:text-blue-900"
              >
                Reset All
              </button>
            </div>
          )}

          {/* Post cards list / Click-through Details View */}
          <div className="flex-1 flex overflow-hidden bg-slate-50">
            {/* COLUMN 1: Master Message List */}
            <div
              className={`w-full shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 overflow-y-auto transition-all ${
                selectedPostForDetail ? 'hidden md:flex md:w-[360px]' : 'flex'
              }`}
            >
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {filteredPosts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No posts match the current filter selection.</p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md font-semibold"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  filteredPosts.map((post) => {
                    const sType = (post.sourceType || post.provider || 'x').toLowerCase();
                    const sentiment = post.enrichment.sentiment;
                    const isCurrentlySelected = selectedPostForDetail?.id === post.id;
                    return (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPostForDetail(post)}
                        className={`p-3.5 rounded-lg border transition-all group cursor-pointer select-none space-y-2 ${
                          isCurrentlySelected
                            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-400'
                            : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs'
                        }`}
                      >
                        {/* Author & Source Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src={post.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                              alt={post.author}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 flex items-center gap-1 transition-colors">
                                <span>{post.author}</span>
                                <span className={`w-3.5 h-3.5 rounded-xs inline-flex items-center justify-center text-white ${getSourceColor(sType)}`}>
                                  <SourceIcon source={sType} className="w-2 h-2" />
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{post.authorHandle || `@${post.author.toLowerCase().replace(/\s+/g, '')}`}</span>
                            </div>
                          </div>

                          {/* Sentiment Badge */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sentiment === 'Positive'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sentiment === 'Negative'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {sentiment}
                          </span>
                        </div>

                        {/* Post text */}
                        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                          {post.text}
                        </p>

                        {/* Key Phrases */}
                        {post.enrichment.keyPhrases && post.enrichment.keyPhrases.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {post.enrichment.keyPhrases.slice(0, 2).map((kp, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium"
                              >
                                #{kp}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer metadata */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                          <span className={`font-semibold flex items-center gap-0.5 text-[9px] uppercase tracking-wider transition-opacity ${
                            isCurrentlySelected ? 'text-blue-600 opacity-100 font-bold' : 'text-blue-500 opacity-0 group-hover:opacity-100'
                          }`}>
                            {isCurrentlySelected ? 'Viewing Details •' : 'View Details →'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 2: Message Details Panel */}
            {selectedPostForDetail && (
              <div className="flex-1 bg-white overflow-y-auto p-5 space-y-5 flex flex-col border-l border-slate-200 animate-in fade-in slide-in-from-right duration-150">
                {/* Back Button / Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-150 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPostForDetail(null)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Full List
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    ID: {selectedPostForDetail.id}
                  </span>
                </div>

                {/* Main Post Card Details */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3">
                  {/* Author Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={selectedPostForDetail.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                        alt={selectedPostForDetail.author}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-3xs"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{selectedPostForDetail.author}</span>
                          <span className={`w-4 h-4 rounded-xs inline-flex items-center justify-center text-white ${getSourceColor((selectedPostForDetail.sourceType || selectedPostForDetail.provider || 'x').toLowerCase())}`}>
                            <SourceIcon source={(selectedPostForDetail.sourceType || selectedPostForDetail.provider || 'x').toLowerCase()} className="w-2.5 h-2.5" />
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{selectedPostForDetail.authorHandle || `@${selectedPostForDetail.author.toLowerCase().replace(/\s+/g, '')}`}</span>
                      </div>
                    </div>

                    {/* Sentiment Badge */}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedPostForDetail.enrichment.sentiment === 'Positive'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : selectedPostForDetail.enrichment.sentiment === 'Negative'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {selectedPostForDetail.enrichment.sentiment}
                    </span>
                  </div>

                  {/* Post Text */}
                  <div className="space-y-2">
                    {selectedPostForDetail.title && (
                      <h4 className="font-bold text-xs text-slate-900">{selectedPostForDetail.title}</h4>
                    )}
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-100">
                      {selectedPostForDetail.text}
                    </p>
                  </div>

                  {/* Translation Tool */}
                  <div className="pt-1.5">
                    {translatedText ? (
                      <div className="p-2.5 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-950 space-y-1 animate-in slide-in-from-top duration-150">
                        <div className="flex items-center gap-1 font-bold text-blue-900">
                          <Languages className="w-3.5 h-3.5" />
                          <span>English Translation</span>
                        </div>
                        <p className="italic leading-relaxed">"{translatedText}"</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isTranslating}
                        onClick={handleTranslate}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-slate-200 rounded text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium transition-colors cursor-pointer"
                      >
                        {isTranslating ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                            <span>Translating Post...</span>
                          </>
                        ) : (
                          <>
                            <Languages className="w-3.5 h-3.5 text-blue-500" />
                            <span>Translate to English</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI NLP & Cognitive Analyses Dashboard */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3.5">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Cognitive AI Enrichment Analytics</span>
                  </div>

                  {/* Sentiment Weights */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sentiment Confidence Breakdown</span>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
                      <div className="p-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                        Positive: {selectedPostForDetail.enrichment.sentimentScores?.positive !== undefined ? `${Math.round(selectedPostForDetail.enrichment.sentimentScores.positive * 100)}%` : '72%'}
                      </div>
                      <div className="p-1 rounded bg-slate-50 text-slate-600 border border-slate-100">
                        Neutral: {selectedPostForDetail.enrichment.sentimentScores?.neutral !== undefined ? `${Math.round(selectedPostForDetail.enrichment.sentimentScores.neutral * 100)}%` : '18%'}
                      </div>
                      <div className="p-1 rounded bg-rose-50 text-rose-800 border border-rose-100">
                        Negative: {selectedPostForDetail.enrichment.sentimentScores?.negative !== undefined ? `${Math.round(selectedPostForDetail.enrichment.sentimentScores.negative * 100)}%` : '10%'}
                      </div>
                    </div>
                  </div>

                  {/* Extracted Named Entities */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Extracted Named Entities</span>
                    {selectedPostForDetail.enrichment.entities && selectedPostForDetail.enrichment.entities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPostForDetail.enrichment.entities.map((ent, idx) => {
                          const catColors = 
                            ent.category === 'Organization' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            ent.category === 'Person' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            ent.category === 'Location' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                            ent.category === 'Product' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-slate-50 text-slate-700 border-slate-200';
                          return (
                            <span key={idx} className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${catColors}`}>
                              <span className="font-bold uppercase text-[8px] opacity-75">{ent.category}:</span>
                              <span>{ent.text}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic block">No named entities extracted by current model pass.</span>
                    )}
                  </div>

                  {/* Key Phrases */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Key Phrases & Taxonomy Tags</span>
                    {selectedPostForDetail.enrichment.keyPhrases && selectedPostForDetail.enrichment.keyPhrases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedPostForDetail.enrichment.keyPhrases.map((kp, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-100 font-medium">
                            #{kp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic block">No secondary key phrases detected.</span>
                    )}
                  </div>
                </div>

                {/* Metadata Insights Grid */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2.5 text-[11px]">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>Metadata & System Diagnostics</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 font-mono">
                    <div>
                      <span className="text-slate-400">Ingested At:</span>
                      <p className="text-slate-800 font-semibold">{new Date(selectedPostForDetail.ingestedAt || selectedPostForDetail.publishedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Published At:</span>
                      <p className="text-slate-800 font-semibold">{new Date(selectedPostForDetail.publishedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Source Channel:</span>
                      <p className="text-slate-800 font-semibold uppercase">{selectedPostForDetail.provider || selectedPostForDetail.sourceType || 'X (Twitter)'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Watchlist Match:</span>
                      <p className="text-blue-600 font-semibold truncate">{selectedPostForDetail.matchedWatchlistName || 'Dynamics CRM'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Language:</span>
                      <p className="text-slate-800 font-semibold uppercase">{selectedPostForDetail.language || 'en'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Geographic Node:</span>
                      <p className="text-slate-800 font-semibold">{selectedPostForDetail.location?.country ? `📍 ${selectedPostForDetail.location.country}` : 'Global Ingestion Hub'}</p>
                    </div>
                  </div>
                </div>

                {/* CRM Engagement Actions Workflow */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3.5">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Enterprise Support Workflow</span>
                  </div>

                  {/* Ticket Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assign Case Owner</label>
                    <div className="flex gap-2">
                      <select
                        value={assignedMember}
                        onChange={(e) => handleAssign(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Unassigned">Unassigned (Queue)</option>
                        <option value="Diane Prescott">Diane Prescott (X Specialist)</option>
                        <option value="Lori Penor">Lori Penor (Brand Advocate)</option>
                        <option value="Annie Herriman">Annie Herriman (Support Lead)</option>
                        <option value="Justin Harrison">Justin Harrison (PR Incident team)</option>
                      </select>
                    </div>
                    {assignSuccess && (
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Successfully assigned ownership to {assignedMember}!</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Reply Box */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submit Public Reply / Direct Response</label>
                    <textarea
                      placeholder="Compose reply to publish directly to the raw post feed..."
                      rows={3}
                      value={responseMsg}
                      onChange={(e) => setResponseMsg(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 leading-relaxed"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={isHighPriority}
                          onChange={(e) => setIsHighPriority(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>Escalate as High Priority Alert</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleSendResponse}
                        disabled={!responseMsg.trim()}
                        className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                          responseMsg.trim() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Send Response
                      </button>
                    </div>
                    {responseSuccess && (
                      <div className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded text-[10px] font-medium flex items-center gap-1.5 animate-in slide-in-from-top duration-150">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Response published! Incident escalated to high priority tracking queue.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
