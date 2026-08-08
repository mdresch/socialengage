import React, { useState } from 'react';
import { ScreenType, AuthViewType, SentimentType, PostItem } from './types';
import {
  INITIAL_SOURCES,
  INITIAL_POSTS,
  AUTHORS_LIST,
  LANGUAGES,
  GEO_LOCATIONS,
} from './data/mockData';

import { TopBar } from './components/TopBar';
import { FlyoutNav } from './components/FlyoutNav';
import { SubTabs } from './components/SubTabs';
import { FilterBar } from './components/FilterBar';
import { PostsPane } from './components/PostsPane';
import { ExportModal } from './components/ExportModal';

import { OverviewView } from './components/views/OverviewView';
import { ConversationsView } from './components/views/ConversationsView';
import { SentimentView } from './components/views/SentimentView';
import { LocationView } from './components/views/LocationView';
import { SourcesView } from './components/views/SourcesView';
import { PostDetailView } from './components/views/PostDetailView';
import { SocialCenterView } from './components/views/SocialCenterView';
import { ActivityMapView } from './components/views/ActivityMapView';
import { SearchSetupView } from './components/views/SearchSetupView';
import { SettingsView } from './components/views/SettingsView';
import { AlertsView } from './components/views/AlertsView';
import { AuthViews } from './components/views/AuthViews';

const SCREEN_TITLES: Record<ScreenType, string> = {
  overview: 'Analytics - Overview',
  conversations: 'Conversations',
  sentiment: 'Sentiment',
  location: 'Location',
  sources: 'Sources',
  'post-detail': 'Post Detail',
  'social-center': 'Social Center',
  'activity-map': 'Activity Map',
  'search-setup': 'Search Setup',
  alerts: 'Alerts',
  settings: 'Settings',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('overview');
  const [prevScreen, setPrevScreen] = useState<ScreenType>('overview');
  const [selectedPostHandle, setSelectedPostHandle] = useState<string>('@danabuilds');

  const [navOpen, setNavOpen] = useState<boolean>(false);
  const [postsPaneOpen, setPostsPaneOpen] = useState<boolean>(true);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);

  const [authView, setAuthView] = useState<AuthViewType>(null);

  const [topic, setTopic] = useState<string>('SocialEngage · AI · ADPA');
  const [dateRange, setDateRange] = useState<string>('Last 30 days');

  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [activeSources, setActiveSources] = useState<string[]>(
    INITIAL_SOURCES.map((s) => s.name)
  );
  const [activeSentiments, setActiveSentiments] = useState<SentimentType[]>([
    'Positive',
    'Neutral',
    'Negative',
  ]);

  const [posts, setPosts] = useState<PostItem[]>(INITIAL_POSTS);

  // Filter handlers
  const handleToggleSource = (name: string) => {
    setActiveSources((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const handleToggleSentiment = (sent: SentimentType) => {
    setActiveSentiments((prev) =>
      prev.includes(sent) ? prev.filter((s) => s !== sent) : [...prev, sent]
    );
  };

  const handleClearFilters = () => {
    setActiveSources(INITIAL_SOURCES.map((s) => s.name));
    setActiveSentiments(['Positive', 'Neutral', 'Negative']);
  };

  // Select post to view details
  const handleSelectPost = (handle: string) => {
    setSelectedPostHandle(handle);
    setPrevScreen(screen === 'post-detail' ? prevScreen : screen);
    setScreen('post-detail');
  };

  // Filtered post items
  const filteredPosts = posts.filter(
    (p) => activeSources.includes(p.source) && activeSentiments.includes(p.sentiment)
  );

  const activePost =
    posts.find((p) => p.handle === selectedPostHandle) || posts[0];

  const activeLabel =
    activeSources.length === sources.length
      ? 'all sources'
      : `${activeSources.length} of ${sources.length} sources`;

  const isAnalyticsScreen = [
    'overview',
    'conversations',
    'sentiment',
    'location',
    'sources',
  ].includes(screen);

  return (
    <div className="min-h-screen bg-[#F3F5F8] flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Bar */}
      <TopBar
        screenTitle={SCREEN_TITLES[screen]}
        topic={topic}
        setTopic={setTopic}
        dateRange={dateRange}
        setDateRange={setDateRange}
        toggleNav={() => setNavOpen(!navOpen)}
        setAuthView={setAuthView}
        unreadCount={7}
      />

      {/* Flyout Nav */}
      <FlyoutNav
        navOpen={navOpen}
        toggleNav={() => setNavOpen(!navOpen)}
        activeScreen={screen}
        setScreen={setScreen}
        setAuthView={setAuthView}
      />

      {/* Analytics Sub-Header & Filters */}
      {isAnalyticsScreen && (
        <>
          <SubTabs
            activeScreen={screen}
            setScreen={setScreen}
            postsOpen={postsPaneOpen}
            togglePosts={() => setPostsPaneOpen(!postsPaneOpen)}
            onOpenExport={() => setExportModalOpen(true)}
          />

          <FilterBar
            sources={sources}
            activeSources={activeSources}
            toggleSource={handleToggleSource}
            activeSentiments={activeSentiments}
            toggleSentiment={handleToggleSentiment}
            clearFilters={handleClearFilters}
          />
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">
          {screen === 'overview' && (
            <OverviewView
              sources={sources.filter((s) => activeSources.includes(s.name))}
              authors={AUTHORS_LIST}
              languages={LANGUAGES}
            />
          )}

          {screen === 'conversations' && <ConversationsView />}

          {screen === 'sentiment' && <SentimentView />}

          {screen === 'location' && (
            <LocationView locations={GEO_LOCATIONS} activeLabel={activeLabel} />
          )}

          {screen === 'sources' && (
            <SourcesView
              sources={sources.filter((s) => activeSources.includes(s.name))}
            />
          )}

          {screen === 'post-detail' && (
            <PostDetailView
              post={activePost}
              onBack={() => setScreen(prevScreen)}
              backLabel={SCREEN_TITLES[prevScreen] || 'Analytics'}
            />
          )}

          {screen === 'social-center' && (
            <SocialCenterView
              sources={sources}
              posts={posts}
              onSelectPost={handleSelectPost}
            />
          )}

          {screen === 'activity-map' && (
            <ActivityMapView activeLabel={activeLabel} />
          )}

          {screen === 'search-setup' && <SearchSetupView />}

          {screen === 'settings' && <SettingsView />}

          {screen === 'alerts' && <AlertsView />}
        </main>

        {/* Right side posts pane on analytics views */}
        {isAnalyticsScreen && (
          <PostsPane
            posts={filteredPosts}
            onSelectPost={handleSelectPost}
            postsOpen={postsPaneOpen}
          />
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        sources={sources}
        posts={filteredPosts}
      />

      {/* Authentication Views Overlay */}
      <AuthViews authView={authView} setAuthView={setAuthView} />
    </div>
  );
}
