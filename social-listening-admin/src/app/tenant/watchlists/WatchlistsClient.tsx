'use client';

import { useState } from 'react';
import type { Watchlist } from '@/lib/core-client';
import { Slideover } from '@/components/ui';
import { WatchlistForm } from './WatchlistForm';
import { WatchlistRow } from './WatchlistRow';

/**
 * Client wrapper for the Watchlists page — owns the "New watchlist" drawer
 * state. The Server Component (page.tsx) fetches data and passes it as props;
 * this component handles all interactive state.
 */
export function WatchlistsClient({
  watchlists,
  connectedPlatforms,
}: {
  watchlists: Watchlist[];
  connectedPlatforms: { id: string; name: string }[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeCount = watchlists.filter((w) => w.isActive).length;

  return (
    <>
      {/* Toolbar: stats + search hint */}
      <div className="watchlist-toolbar">
        <p className="watchlist-toolbar-stats">
          <strong>{watchlists.length}</strong> watchlist{watchlists.length !== 1 ? 's' : ''} (
          <span className="active-count">{activeCount} active</span>)
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setDrawerOpen(true)}
        >
          + New watchlist
        </button>
      </div>

      {/* Watchlist Table */}
      {watchlists.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No watchlists yet</p>
          <p className="empty-state-body">
            Create your first monitoring watchlist to start capturing real-time social conversations and news.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setDrawerOpen(true)}>
            New watchlist
          </button>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Watchlist Name</th>
                <th>Match Type</th>
                <th>Query / Terms</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {watchlists.map((watchlist) => (
                <WatchlistRow
                  key={watchlist.id}
                  watchlist={watchlist}
                  connectedPlatforms={connectedPlatforms}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Watchlist Slideover */}
      <Slideover
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create Watchlist"
        subtitle="Specify brand query terms, match semantics, and target ingestion platforms"
        width="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="watchlist-form" className="btn btn-primary btn-sm">
              Create watchlist
            </button>
          </>
        }
      >
        <WatchlistForm
          mode="create"
          connectedPlatforms={connectedPlatforms}
        />
      </Slideover>
    </>
  );
}
