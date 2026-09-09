'use client';

import { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  'Aggregating real-time social conversations and post feeds...',
  'Processing AI sentiment scores, key phrases, and author insights...',
  'Crunching high-volume dataset... Generating multi-dimensional analytics dashboard...',
  'Finalizing charts and geospatial distribution... Almost ready!',
];

export default function AnalyticsLoading() {
  const [seconds, setSeconds] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds < 3) {
      setMessageIndex(0);
    } else if (seconds < 7) {
      setMessageIndex(1);
    } else if (seconds < 12) {
      setMessageIndex(2);
    } else {
      setMessageIndex(3);
    }
  }, [seconds]);

  return (
    <div className="an-loading-root" aria-live="polite" aria-busy="true">
      {/* Header bar skeleton with live status */}
      <div className="an-loading-header-card">
        <div className="an-loading-header-left">
          <div className="an-loading-spinner" aria-hidden="true" />
          <div>
            <h2 className="an-loading-title">Loading Analytics Dashboard</h2>
            <p className="an-loading-msg">{LOADING_MESSAGES[messageIndex]}</p>
          </div>
        </div>
        <div className="an-loading-timer-badge">
          <span>{seconds}s elapsed</span>
          {seconds >= 8 && <span className="an-loading-deep-badge">Deep dataset</span>}
        </div>
      </div>

      {/* Navigation tabs placeholder */}
      <div className="an-loading-tabs-bar">
        <div className="an-skeleton-tab an-skeleton-tab-active" />
        <div className="an-skeleton-tab" />
        <div className="an-skeleton-tab" />
        <div className="an-skeleton-tab" />
      </div>

      {/* 3-Column Skeleton Grid */}
      <div className="an-overview-grid" style={{ opacity: 0.85 }}>
        {/* Column 1 */}
        <div className="an-overview-col an-overview-col-left" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="an-widget" style={{ minHeight: 220 }}>
            <div className="an-skeleton-line an-skeleton-title" />
            <div className="an-skeleton-box" style={{ height: 140, marginTop: 12 }} />
          </div>
          <div className="an-widget" style={{ minHeight: 180 }}>
            <div className="an-skeleton-line an-skeleton-title" />
            <div className="an-skeleton-box" style={{ height: 100, marginTop: 12 }} />
          </div>
        </div>

        {/* Column 2 */}
        <div className="an-overview-col an-overview-col-centre" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="an-widget" style={{ minHeight: 260 }}>
            <div className="an-skeleton-line an-skeleton-title" />
            <div className="an-skeleton-box" style={{ height: 180, marginTop: 12 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div className="an-widget" style={{ minHeight: 180 }}>
              <div className="an-skeleton-line an-skeleton-title" />
              <div className="an-skeleton-box" style={{ height: 100, marginTop: 12 }} />
            </div>
            <div className="an-widget" style={{ minHeight: 180 }}>
              <div className="an-skeleton-line an-skeleton-title" />
              <div className="an-skeleton-box" style={{ height: 100, marginTop: 12 }} />
            </div>
          </div>
        </div>

        {/* Column 3 */}
        <div className="an-overview-col an-overview-col-right" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="an-widget" style={{ minHeight: 220 }}>
            <div className="an-skeleton-line an-skeleton-title" />
            <div className="an-skeleton-box" style={{ height: 140, marginTop: 12 }} />
          </div>
          <div className="an-widget" style={{ minHeight: 220 }}>
            <div className="an-skeleton-line an-skeleton-title" />
            <div className="an-skeleton-box" style={{ height: 140, marginTop: 12 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
