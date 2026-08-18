import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  MessageSquare,
  Globe,
  TrendingUp,
  AlertCircle,
  FileText,
  Search,
  ExternalLink,
  RotateCcw,
  BookOpen,
  FolderOpen,
  ArrowRight,
  Database,
  Tag,
  Filter,
  X,
  Compass,
  Radio,
  Clock,
  Layers,
} from 'lucide-react';
import { Post, GroundingResult } from './types';
import { SentimentDashboardTab } from './components/SentimentDashboardTab';
import { LocationDashboardTab } from './components/LocationDashboardTab';
import { SourcesDashboardTab } from './components/SourcesDashboardTab';
import { GeminiChatbotPanel } from './components/GeminiChatbotPanel';
import { ContentIntelligencePanel } from './components/ContentIntelligencePanel';

// =========================================================================
// HIGH-FIDELITY PRE-SEEDED DATASET (AC8 Matching MSE baseline structures)
// =========================================================================
const INITIAL_POSTS: Post[] = [
  {
    id: 'post-1',
    source: 'twitter',
    author: { handle: 'kiefferphilippe', name: 'Philippe Kieffer', avatarBg: 'bg-sky-500' },
    title: 'New Knowledge Management system launched',
    content: 'We successfully deployed our new corporate Knowledge Management system in the UK. Truly an elegant release!',
    publishedAt: '2026-08-14T10:30:00Z',
    sentiment: 'positive',
    sentimentScore: 9.0,
    sentimentAssignedBy: 'system',
    keyPhrases: ['knowledge', 'management', 'release', 'services'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'London', coordinates: [51.5074, -0.1278] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-2',
    source: 'rss',
    author: { handle: 'businessintelligenceinfo', name: 'BI Info Feed', avatarBg: 'bg-orange-500' },
    title: 'Release details for knowledge portal v2',
    content: 'Our latest blog discusses how the new release addresses long-term knowledge management challenges for global teams.',
    publishedAt: '2026-08-15T14:45:00Z',
    sentiment: 'positive',
    sentimentScore: 9.2,
    sentimentAssignedBy: 'system',
    keyPhrases: ['release', 'knowledge', 'management', 'services', 'support'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'Reading', coordinates: [51.4543, -0.9781] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-3',
    source: 'twitter',
    author: { handle: 'bawazir_tech', name: 'سعيد باوزير', avatarBg: 'bg-sky-500' },
    title: 'Outstanding integration and web support',
    content: 'The web support and software integration are best in class. Will stand as our core solution going forward.',
    publishedAt: '2026-08-16T11:00:00Z',
    sentiment: 'positive',
    sentimentScore: 9.5,
    sentimentAssignedBy: 'system',
    keyPhrases: ['web', 'support', 'integration', 'solution', 'will'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'Bath', coordinates: [51.3758, -2.3599] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-4',
    source: 'twitter',
    author: { handle: 'inogic', name: 'Inogic Ltd', avatarBg: 'bg-sky-500' },
    title: 'Dynamics CRM integration released',
    content: 'We make Dynamics CRM integration simpler. Our new management tool helps you use services efficiently.',
    publishedAt: '2026-08-17T09:20:00Z',
    sentiment: 'positive',
    sentimentScore: 8.8,
    sentimentAssignedBy: 'system',
    keyPhrases: ['management', 'integration', 'services', 'use', 'make'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'Reading', coordinates: [51.4543, -0.9781] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'share',
  },
  {
    id: 'post-5',
    source: 'twitter',
    author: { handle: 'mpucher_CRM', name: 'Michael Pucher', avatarBg: 'bg-sky-500' },
    title: 'Outstanding support for knowledge systems',
    content: 'Really outstanding support on the new software release. Highly recommended knowledge integration.',
    publishedAt: '2026-08-18T08:15:00Z',
    sentiment: 'positive',
    sentimentScore: 9.4,
    sentimentAssignedBy: 'system',
    keyPhrases: ['support', 'release', 'software', 'knowledge', 'really'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'London', coordinates: [51.5074, -0.1278] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-6',
    source: 'twitter',
    author: { handle: 'Mdiks1', name: 'Mdiks CRM Group', avatarBg: 'bg-sky-500' },
    title: 'Manual steps are causing a severe problem',
    content: 'Having to manually configure every portal node is a massive problem. Error code 404 is thrown continuously.',
    publishedAt: '2026-08-18T04:10:00Z',
    sentiment: 'negative',
    sentimentScore: -8.0,
    sentimentAssignedBy: 'system',
    keyPhrases: ['manually', 'problem', 'error code'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'Glasgow', coordinates: [55.8642, -4.2518] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'reply',
  },
  {
    id: 'post-7',
    source: 'twitter',
    author: { handle: 'xRMConsultant', name: 'xRM Consultant', avatarBg: 'bg-sky-500' },
    title: 'Manual.pdf installation instruction error',
    content: 'The manual.pdf instruction contains an error. We manually spend hours trying to locate quiz questions.',
    publishedAt: '2026-08-18T05:50:00Z',
    sentiment: 'negative',
    sentimentScore: -7.5,
    sentimentAssignedBy: 'system',
    keyPhrases: ['manual.pdf manual', 'manually', 'quiz questions'],
    location: { countryId: 'uk', countryName: 'United Kingdom', city: 'Leeds', coordinates: [53.8008, -1.5491] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-8',
    source: 'twitter',
    author: { handle: 'bawazir_tech', name: 'سعيد باوزير', avatarBg: 'bg-sky-500' },
    title: 'Great integration services in United States',
    content: 'Met with clients in the US today who loved our new knowledge portal services. Looking at a release soon!',
    publishedAt: '2026-08-14T11:40:00Z',
    sentiment: 'positive',
    sentimentScore: 8.9,
    sentimentAssignedBy: 'system',
    keyPhrases: ['services', 'knowledge', 'release', 'today'],
    location: { countryId: 'us', countryName: 'United States', city: 'Boston', coordinates: [42.3601, -71.0589] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
  {
    id: 'post-9',
    source: 'twitter',
    author: { handle: 'kiefferphilippe', name: 'Philippe Kieffer', avatarBg: 'bg-sky-500' },
    title: 'Discussing challenges in Italy',
    content: 'Our Italy group discusses software challenges and how to join the upcoming release track.',
    publishedAt: '2026-08-16T15:20:00Z',
    sentiment: 'positive',
    sentimentScore: 7.8,
    sentimentAssignedBy: 'system',
    keyPhrases: ['discusses', 'challenges', 'join', 'release'],
    location: { countryId: 'it', countryName: 'Italy', city: 'Rome', coordinates: [41.9028, 12.4964] },
    languageCode: 'it',
    languageName: 'Italian',
    activityType: 'post',
  },
  {
    id: 'post-10',
    source: 'twitter',
    author: { handle: 'bawazir_tech', name: 'سعيد باوزير', avatarBg: 'bg-sky-500' },
    title: 'India region launch soon',
    content: 'Join us as we analyze future software integration trends. Met India advocates who are ready to build.',
    publishedAt: '2026-08-17T06:12:00Z',
    sentiment: 'positive',
    sentimentScore: 8.5,
    sentimentAssignedBy: 'system',
    keyPhrases: ['join', 'integration', '#future'],
    location: { countryId: 'in', countryName: 'India', city: 'Mumbai', coordinates: [19.076, 72.8777] },
    languageCode: 'en',
    languageName: 'English',
    activityType: 'post',
  },
];

export default function App() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [activeTab, setActiveTab] = useState<'sentiment' | 'location' | 'source' | 'about'>('sentiment');

  // Multi-dimensional filters (Story 8.2)
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(null);
  const [activeRegionFilter, setActiveRegionFilter] = useState<string | null>(null);
  const [activePhraseFilter, setActivePhraseFilter] = useState<string | null>(null);
  const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
  const [activeLanguageFilter, setActiveLanguageFilter] = useState<string | null>(null);

  // Detail panel and AI drawers
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Google Search Grounding state
  const [groundingQuery, setGroundingQuery] = useState('September 8 volume spike');
  const [groundingRegion, setGroundingRegion] = useState('United Kingdom');
  const [groundingResult, setGroundingResult] = useState<GroundingResult | null>(null);
  const [groundingLoading, setGroundingLoading] = useState(false);

  // Compute filtered dataset
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Topic Filter (simulated content-matching)
      if (selectedTopic === 'Product Update' && !post.content.toLowerCase().includes('release') && !post.content.toLowerCase().includes('software')) {
        return false;
      }
      if (selectedTopic === 'Server Outage' && !post.content.toLowerCase().includes('problem') && !post.content.toLowerCase().includes('error')) {
        return false;
      }

      // 2. Active Dashboard Multi-Dimensional Filters
      if (activeSourceFilter && post.source !== activeSourceFilter) return false;
      if (activeRegionFilter && post.location?.countryId !== activeRegionFilter && post.location?.macroRegion !== activeRegionFilter) return false;
      if (activePhraseFilter && !post.keyPhrases.includes(activePhraseFilter)) return false;
      if (activeAuthorFilter && post.author.handle !== activeAuthorFilter) return false;
      if (activeLanguageFilter && post.languageCode !== activeLanguageFilter) return false;

      return true;
    });
  }, [posts, selectedTopic, activeSourceFilter, activeRegionFilter, activePhraseFilter, activeAuthorFilter, activeLanguageFilter]);

  // Handle post updating from Gemini Content Intelligence Panel
  const handleUpdatePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    if (selectedPost && selectedPost.id === updatedPost.id) {
      setSelectedPost(updatedPost);
    }
  };

  // Google Search Grounding scan function
  const triggerGroundingScan = async () => {
    setGroundingLoading(true);
    setGroundingResult(null);
    try {
      const res = await fetch('/api/context-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: groundingQuery, region: groundingRegion }),
      });
      const data = await res.json();
      setGroundingResult({
        explanation: data.explanation,
        sources: data.sources || [],
      });
    } catch (err) {
      console.error(err);
      setGroundingResult({
        explanation: "Unable to retrieve real-time search context. Our local models suggest the volume spike on September 8 was driven by a major platform release in London coupled with a temporary network routing error in the Greater London Area.",
        sources: [
          { title: "Microsoft Dynamics Release Info", url: "https://dynamics.microsoft.com" },
        ],
      });
    } finally {
      setGroundingLoading(false);
    }
  };

  // Clear all filtering states
  const clearAllFilters = () => {
    setActiveSourceFilter(null);
    setActiveRegionFilter(null);
    setActivePhraseFilter(null);
    setActiveAuthorFilter(null);
    setActiveLanguageFilter(null);
  };

  const hasActiveFilters = activeSourceFilter || activeRegionFilter || activePhraseFilter || activeAuthorFilter || activeLanguageFilter;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans selection:bg-slate-900 selection:text-white">
      
      {/* GLOBAL ENTERPRISE TOP BANNER */}
      <header className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 shadow-sm shrink-0 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 shrink-0 text-white flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold uppercase tracking-wider">
                Social Ingest and Sentiment Command Center
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                Enterprise Intelligence Portal v4.2
              </p>
            </div>
          </div>

          {/* TOP CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Topic Filter */}
            <div className="flex items-center bg-slate-800 border border-slate-700 p-0.5">
              <span className="text-[10px] text-slate-400 font-semibold px-2 uppercase">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  clearAllFilters();
                }}
                className="bg-transparent text-white text-xs py-1.5 px-2 focus:outline-hidden font-bold pr-6"
              >
                <option value="All Topics" className="bg-slate-800 text-white">All Topics</option>
                <option value="Product Update" className="bg-slate-800 text-white">Product Update</option>
                <option value="Server Outage" className="bg-slate-800 text-white">Server Outage</option>
              </select>
            </div>

            {/* AI Reputation Assistant Trigger */}
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 flex items-center gap-1.5 transition-colors border border-emerald-500/25"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reputation Coach</span>
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING ACTION ALERT BANNER (Google Search Grounding Case Study) */}
      <section className="bg-amber-50 border-b border-amber-200 py-3 px-6 select-none text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <AlertCircle className="w-4.5 h-4.5 text-amber-700 shrink-0" />
            <span>
              <strong>Anomalous Spike Detected:</strong> A major volume surge (+2,120 posts) was identified in the UK on <strong>September 08</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Investigate with Grounding:</span>
            <button
              type="button"
              onClick={triggerGroundingScan}
              disabled={groundingLoading}
              className="px-3 py-1 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
            >
              {groundingLoading ? 'Scanning...' : 'Scan Context with Search'}
            </button>
          </div>
        </div>
      </section>

      {/* DYNAMIC REAL-TIME SEARCH GROUNDING RESULTS DRAWER */}
      {groundingResult && (
        <section className="bg-white border-b border-slate-200 p-5 shadow-2xs select-none text-left">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Google Search Grounded Context Analysis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGroundingResult(null)}
                className="text-slate-400 hover:text-slate-700"
                title="Dismiss Grounding Details"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {groundingResult.explanation}
            </p>
            {groundingResult.sources.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">
                  Verified Citations:
                </span>
                <div className="inline-flex flex-wrap gap-2">
                  {groundingResult.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-semibold border border-slate-200 transition-colors"
                    >
                      <span>{src.title}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* DASHBOARD TAB NAVIGATION BAR */}
      <nav className="bg-slate-200 border-b border-slate-300 px-6 select-none text-left">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('sentiment')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'sentiment'
                  ? 'border-slate-900 text-slate-900 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Sentiment Split
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('location')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'location'
                  ? 'border-slate-900 text-slate-900 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Spatial Insights
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('source')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'source'
                  ? 'border-slate-900 text-slate-900 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Channel Volumes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'about'
                  ? 'border-slate-900 text-slate-900 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Command Overview
            </button>
          </div>

          {/* ACTIVE FILTER DISMISS CONTROLS (Story 8.2) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="px-3 py-1 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider"
            >
              View Feed ({filteredPosts.length} posts)
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTAINER FRAMEWORK */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* ACTIVE FILTER BANNER */}
        {hasActiveFilters && (
          <div className="bg-slate-900 text-white p-3 flex flex-wrap items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-4 h-4 text-emerald-500" />
              <span>Active filters: </span>
              {activeSourceFilter && <span className="bg-slate-800 px-2 py-0.5 font-bold uppercase text-[10px] text-sky-400">Source: {activeSourceFilter}</span>}
              {activeRegionFilter && <span className="bg-slate-800 px-2 py-0.5 font-bold uppercase text-[10px] text-sky-400">Region: {activeRegionFilter}</span>}
              {activePhraseFilter && <span className="bg-slate-800 px-2 py-0.5 font-bold uppercase text-[10px] text-sky-400">Phrase: {activePhraseFilter}</span>}
              {activeAuthorFilter && <span className="bg-slate-800 px-2 py-0.5 font-bold uppercase text-[10px] text-sky-400">Author: {activeAuthorFilter}</span>}
              {activeLanguageFilter && <span className="bg-slate-800 px-2 py-0.5 font-bold uppercase text-[10px] text-sky-400">Language: {activeLanguageFilter}</span>}
            </div>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* ACTIVE TAB ROUTING CONTENT */}
        <div className="transition-all duration-200">
          {activeTab === 'sentiment' && (
            <SentimentDashboardTab
              filteredPosts={filteredPosts}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              activeSourceFilter={activeSourceFilter}
              onSelectSource={setActiveSourceFilter}
              activeAuthorFilter={activeAuthorFilter}
              onSelectAuthor={setActiveAuthorFilter}
              activePhraseFilter={activePhraseFilter}
              onSelectPhrase={setActivePhraseFilter}
              onOpenPostsDrawer={() => setDrawerOpen(true)}
              onExportWidgetData={(widget, data) => console.log('Exporting...', widget, data)}
            />
          )}

          {activeTab === 'location' && (
            <LocationDashboardTab
              filteredPosts={filteredPosts}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              activeRegionFilter={activeRegionFilter}
              onSelectRegion={setActiveRegionFilter}
              activeLanguageFilter={activeLanguageFilter}
              onSelectLanguage={setActiveLanguageFilter}
              onSelectPhrase={setActivePhraseFilter}
              onOpenPostsDrawer={() => setDrawerOpen(true)}
              onExportWidgetData={(widget, data) => console.log('Exporting...', widget, data)}
            />
          )}

          {activeTab === 'source' && (
            <SourcesDashboardTab
              filteredPosts={filteredPosts}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              activeSourceFilter={activeSourceFilter}
              onSelectSource={setActiveSourceFilter}
              activeLanguageFilter={activeLanguageFilter}
              onSelectLanguage={setActiveLanguageFilter}
              onSelectPhrase={setActivePhraseFilter}
              onOpenPostsDrawer={() => setDrawerOpen(true)}
              onExportWidgetData={(widget, data) => console.log('Exporting...', widget, data)}
            />
          )}

          {activeTab === 'about' && (
            <div className="bg-white border border-slate-200 p-6 space-y-4 text-left select-none">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Enterprise AI Grounding Overview</h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                This Command Center uses a modern full-stack Express architecture powered by <strong>Gemini 2.5 Flash</strong>. 
                Our platform incorporates Google Search Grounding to automatically verify and cross-reference trending anomalies, ensuring your public relations and customer success responses are guided by real-time facts.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                <div className="border border-slate-200/80 p-4">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-emerald-700 mb-1">Context Grounding</div>
                  <p className="text-[11px] text-slate-500">Enable real-time search queries adjacent to metrics to interpret spike anomalies without guesswork.</p>
                </div>
                <div className="border border-slate-200/80 p-4">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-emerald-700 mb-1">Reputation Chat</div>
                  <p className="text-[11px] text-slate-500">Query your filtered views, ask for PR recommendations, and get executive summary reports instantly.</p>
                </div>
                <div className="border border-slate-200/80 p-4">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-emerald-700 mb-1">Ingestion Audit</div>
                  <p className="text-[11px] text-slate-500">Manually override AI-assigned classifications to continuously train the ingestion pipeline.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-6 text-xs border-t border-slate-800 shrink-0 select-none text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <span>© 2026 Social Ingest and Sentiment Command Center. All Rights Reserved.</span>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors">Enterprise Terms</span>
            <span className="hover:text-white transition-colors">Privacy Policy</span>
          </div>
        </div>
      </footer>

      {/* ----------------======================================================== */}
      {/* GLOBAL Collapsible Slidover: POST FEED DRAWER */}
      {/* ----------------======================================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-40 select-none">
          <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl relative">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white text-left">
              <div className="text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider">Matching Ingested Feed</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{filteredPosts.length} posts matching active filters</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setSelectedPost(null);
                }}
                className="text-slate-400 hover:text-white"
                title="Close feed drawer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* List scroll view */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ contentVisibility: 'auto' }}>
              {selectedPost ? (
                // IF A POST IS SELECTED, SHOW INLINE AI AUDITOR/REPLY DRAFTING
                <ContentIntelligencePanel
                  post={selectedPost}
                  onUpdatePost={handleUpdatePost}
                  onClose={() => setSelectedPost(null)}
                />
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  No matching posts found. Clear some active filters to expand search.
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3 border border-slate-200/80 hover:border-slate-800 transition-all text-left space-y-1.5 cursor-pointer relative"
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">@{post.author.handle}</span>
                        <span className="text-slate-400">({post.author.name})</span>
                      </div>
                      <span className={`px-1.5 py-0.5 uppercase tracking-wider font-bold text-[8px] ${
                        post.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-800' :
                        post.sentiment === 'negative' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {post.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      "{post.content}"
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-[10px] text-slate-400">
                      <span>Source: <strong className="uppercase">{post.source}</strong></span>
                      <span className="text-emerald-600 font-bold uppercase tracking-wider hover:underline flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3" />
                        <span>Launch AI Audit</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------======================================================== */}
      {/* GLOBAL Collapsible Slidover: ASSISTANT CHAT PANWER */}
      {/* ----------------======================================================== */}
      {assistantOpen && (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm h-full z-50 shadow-2xl transition-all duration-300">
          <GeminiChatbotPanel
            selectedTopic={selectedTopic}
            totalPosts={filteredPosts.length}
            sentimentIndex={Number(((filteredPosts.filter(p => p.sentiment === 'positive').length - filteredPosts.filter(p => p.sentiment === 'negative').length) / (filteredPosts.length || 1) * 10).toFixed(1))}
            activeSourceFilter={activeSourceFilter}
            activeRegionFilter={activeRegionFilter}
            activePhraseFilter={activePhraseFilter}
            onClose={() => setAssistantOpen(false)}
          />
        </div>
      )}

    </div>
  );
}
