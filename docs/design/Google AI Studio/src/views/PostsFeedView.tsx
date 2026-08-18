import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Database,
  Code2,
  Tag,
  Building2,
  Calendar,
  Layers,
  Check,
} from 'lucide-react';
import { Post } from '../types';
import { RelativeTime } from '../components/RelativeTime';
import { Slideover } from '../components/Slideover';
import { RunEnrichmentButton } from '../components/RunEnrichmentButton';
import { EmptyState } from '../components/EmptyState';

export const PostsFeedView: React.FC = () => {
  const { posts, watchlists, enrichPost } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('ALL');
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('ALL');
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedProvider !== 'ALL' && post.provider !== selectedProvider) {
        return false;
      }
      if (selectedSentiment !== 'ALL' && post.enrichment.sentiment !== selectedSentiment) {
        return false;
      }
      if (selectedWatchlist !== 'ALL' && post.matchedWatchlistId !== selectedWatchlist) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = post.title.toLowerCase().includes(q);
        const inText = post.text.toLowerCase().includes(q);
        const inAuthor = post.author.toLowerCase().includes(q);
        const inPhrases = post.enrichment.keyPhrases.some((kp) => kp.toLowerCase().includes(q));
        if (!inTitle && !inText && !inAuthor && !inPhrases) return false;
      }
      return true;
    });
  }, [posts, selectedProvider, selectedSentiment, selectedWatchlist, searchQuery]);

  // Simulate cursor-based pagination
  const pageSize = 4;
  const paginatedPosts = useMemo(() => {
    return filteredPosts.slice(0, cursor ? filteredPosts.length : pageSize);
  }, [filteredPosts, cursor]);

  const hasNextPage = filteredPosts.length > pageSize && !cursor;

  const handleNextCursor = () => {
    // Generate simulated opaque cursor token
    const nextCursor = btoa(`cursor_${Date.now()}_offset_${pageSize}`);
    setCursor(nextCursor);
  };

  const handleResetCursor = () => {
    setCursor(null);
  };

  return (
    <div className="space-y-6" id="posts-feed-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Social & Media Posts
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time ingested articles, releases, and social mentions enriched with Azure AI
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-semibold text-slate-900">{paginatedPosts.length}</span> of {filteredPosts.length} matches
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headline, text, entity, key phrase..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-400 text-slate-900 focus-ring"
            />
          </div>

          {/* Provider Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Provider:</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring"
            >
              <option value="ALL">All Providers</option>
              <option value="GNEWS">GNews</option>
              <option value="NEWSWIRE">Newswire</option>
              <option value="TENANT_OWNED_FEED">Tenant Feed</option>
            </select>
          </div>

          {/* Sentiment Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Sentiment:</label>
            <select
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring"
            >
              <option value="ALL">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </div>

          {/* Watchlist Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Watchlist:</label>
            <select
              value={selectedWatchlist}
              onChange={(e) => setSelectedWatchlist(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring max-w-[180px] truncate"
            >
              <option value="ALL">All Watchlists</option>
              {watchlists.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Posts List */}
      {paginatedPosts.length === 0 ? (
        <EmptyState
          title="No matching posts found"
          description="Try broadening your keyword query or resetting provider and sentiment filters."
          action={{
            label: 'Reset Filters',
            onClick: () => {
              setSearchQuery('');
              setSelectedProvider('ALL');
              setSelectedSentiment('ALL');
              setSelectedWatchlist('ALL');
            },
          }}
        />
      ) : (
        <div className="space-y-4">
          {paginatedPosts.map((post) => (
            <article
              key={post.id}
              onClick={() => setActivePost(post)}
              className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200 rounded">
                    {post.provider}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {post.author}
                  </span>
                  {post.matchedWatchlistName && (
                    <span className="hidden sm:inline-flex text-[11px] text-slate-500 items-center gap-1 font-medium">
                      <span>• Matched:</span>
                      <span className="text-slate-700 font-semibold">{post.matchedWatchlistName}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <RelativeTime dateString={post.publishedAt} className="text-xs text-slate-400" />
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Open original source URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Title & Preview */}
              <h2 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">
                {post.text}
              </p>

              {/* AI Enrichment Summary Chips */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                {/* Sentiment chip */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                    post.enrichment.sentiment === 'Positive'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : post.enrichment.sentiment === 'Negative'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      post.enrichment.sentiment === 'Positive'
                        ? 'bg-emerald-500'
                        : post.enrichment.sentiment === 'Negative'
                        ? 'bg-rose-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {post.enrichment.sentiment} ({((post.enrichment.sentimentScores[post.enrichment.sentiment.toLowerCase() as 'positive' | 'neutral' | 'negative'] || 0.9) * 100).toFixed(0)}%)
                  </span>
                </span>

                {/* Entity chips */}
                {post.enrichment.entities.map((ent, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded"
                  >
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{ent.text}</span>
                  </span>
                ))}

                {/* Key phrases (up to 2 in preview) */}
                {post.enrichment.keyPhrases.slice(0, 2).map((phrase, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center text-[11px] bg-blue-50/70 border border-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium"
                  >
                    #{phrase}
                  </span>
                ))}

                <div className="ml-auto text-xs text-blue-600 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  <span>Inspect details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </article>
          ))}

          {/* Cursor-Based Pagination Footer (Story 6.11) */}
          <div className="flex items-center justify-between pt-4 pb-2 border-t border-slate-200 text-xs">
            <div className="text-slate-500 font-mono">
              {cursor ? (
                <span>Pagination token: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{cursor.slice(0, 18)}...</code></span>
              ) : (
                <span>Page 1 (Opaque cursor ready)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {cursor && (
                <button
                  type="button"
                  onClick={handleResetCursor}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium"
                >
                  Previous page
                </button>
              )}
              {hasNextPage && (
                <button
                  type="button"
                  id="btn-next-cursor"
                  onClick={handleNextCursor}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold shadow-xs flex items-center gap-1"
                >
                  <span>Next page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Inspection Slideover Drawer */}
      {activePost && (
        <Slideover
          isOpen={!!activePost}
          onClose={() => setActivePost(null)}
          title={activePost.title}
          subtitle={`Published ${new Date(activePost.publishedAt).toLocaleString()} via ${activePost.provider}`}
          width="lg"
          footer={
            <div className="w-full flex items-center justify-between">
              <a
                href={activePost.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open original article</span>
              </a>
              <RunEnrichmentButton
                postId={activePost.id}
                onEnrich={async (id) => {
                  await enrichPost(id);
                  // Refresh active post object in view
                  const updated = posts.find((p) => p.id === id);
                  if (updated) setActivePost({ ...updated });
                }}
              />
            </div>
          }
        >
          <div className="space-y-6 text-sm">
            {/* Full Body Text */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Ingested Article Body
              </h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 text-sm leading-relaxed">
                {activePost.text}
              </div>
            </div>

            {/* AI Enrichment Panel */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Azure AI Cognitive Analysis
                  </h3>
                </div>
                {activePost.enrichment.lastEnrichedAt && (
                  <span className="text-[11px] text-slate-400">
                    Analyzed <RelativeTime dateString={activePost.enrichment.lastEnrichedAt} />
                  </span>
                )}
              </div>

              {/* Sentiment Scores Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span>Sentiment Evaluation: <strong className="text-slate-900">{activePost.enrichment.sentiment}</strong></span>
                  <span className="font-mono text-slate-500">Confidence Distribution</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-emerald-700 font-medium">Positive</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${(activePost.enrichment.sentimentScores.positive * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="font-mono w-10 text-right text-slate-600 text-[11px]">
                      {(activePost.enrichment.sentimentScores.positive * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-slate-700 font-medium">Neutral</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-slate-400 h-2 rounded-full"
                        style={{ width: `${(activePost.enrichment.sentimentScores.neutral * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="font-mono w-10 text-right text-slate-600 text-[11px]">
                      {(activePost.enrichment.sentimentScores.neutral * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-rose-700 font-medium">Negative</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-2 rounded-full"
                        style={{ width: `${(activePost.enrichment.sentimentScores.negative * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="font-mono w-10 text-right text-slate-600 text-[11px]">
                      {(activePost.enrichment.sentimentScores.negative * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Named Entity Recognition (NER) */}
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Extracted Named Entities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activePost.enrichment.entities.map((entity, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded"
                    >
                      <Tag className="w-3 h-3 text-slate-500" />
                      <strong>{entity.text}</strong>
                      <span className="text-[10px] text-slate-500 uppercase">({entity.category})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Phrases */}
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Extracted Key Phrases:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activePost.enrichment.keyPhrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded font-medium"
                    >
                      #{phrase}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingestion Telemetry */}
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ingestion Run ID:</span>
                <span className="font-semibold text-slate-800">{activePost.ingestionRunId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ingested At:</span>
                <span>{new Date(activePost.ingestedAt).toISOString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Source Provider:</span>
                <span>{activePost.provider}</span>
              </div>
            </div>

            {/* Raw JSON Payload Drawer Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200/80 rounded-md text-xs font-semibold text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span>{showRawJson ? 'Hide Raw Ingestion JSON' : 'Inspect Raw Ingestion Payload'}</span>
                </div>
                <span className="text-slate-500 font-mono">{showRawJson ? '▲' : '▼'}</span>
              </button>

              {showRawJson && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-md font-mono text-[11px] overflow-x-auto max-h-56">
                  <pre>{JSON.stringify(activePost.rawPayload, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </Slideover>
      )}
    </div>
  );
};
