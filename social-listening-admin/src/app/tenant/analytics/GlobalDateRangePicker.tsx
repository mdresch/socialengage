'use client';

import { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Inline SVG icons (lucide-react is not installed)
// ---------------------------------------------------------------------------
function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconRotateCcw() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.7L1 10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DateRangeValue {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  compareWithPrevious?: boolean;
}

export interface PresetOption {
  key: string;
  label: string;
  sublabel?: string;
  startDate: string;
  endDate: string;
  category?: 'standard' | 'campaign';
}

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const PRESET_DATE_RANGES: PresetOption[] = [
  { key: 'today',        label: 'Today',             sublabel: 'Live Ingestion',          startDate: TODAY,     endDate: TODAY,     category: 'standard' },
  { key: 'yesterday',    label: 'Yesterday',         sublabel: 'Last 24 hours',           startDate: YESTERDAY, endDate: YESTERDAY, category: 'standard' },
  { key: 'last_7_days',  label: 'Last 7 Days',       sublabel: '7-day window',            startDate: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), endDate: TODAY, category: 'standard' },
  { key: 'last_14_days', label: 'Last 14 Days',      sublabel: '14-day window',           startDate: new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10), endDate: TODAY, category: 'standard' },
  { key: 'last_30_days', label: 'Last 30 Days',      sublabel: '30-day window',           startDate: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), endDate: TODAY, category: 'standard' },
  { key: 'this_month',   label: 'This Month',        sublabel: 'Current month',           startDate: `${TODAY.slice(0, 7)}-01`, endDate: TODAY, category: 'standard' },
  { key: 'last_month',   label: 'Last Month',        sublabel: 'Previous month',          startDate: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); })(), endDate: (() => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10); })(), category: 'standard' },
  { key: 'all_time',     label: 'All Available History', sublabel: 'Full Repository',     startDate: '2020-01-01', endDate: TODAY, category: 'standard' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Props {
  value: string;
  onChange: (range: DateRangeValue) => void;
  className?: string;
}

export function GlobalDateRangePicker({ value, onChange, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPreset = PRESET_DATE_RANGES.find((p) => p.key === value) ?? {
    key: 'custom', label: 'Custom Range', sublabel: 'Filtered interval',
    startDate: TODAY, endDate: TODAY,
  };

  const [startInput, setStartInput] = useState(currentPreset.startDate);
  const [endInput, setEndInput]     = useState(currentPreset.endDate);
  const [comparePrev, setComparePrev] = useState(true);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date(currentPreset.startDate);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  useEffect(() => {
    const preset = PRESET_DATE_RANGES.find((p) => p.key === value);
    if (preset) {
      setStartInput(preset.startDate);
      setEndInput(preset.endDate);
      const d = new Date(preset.startDate);
      if (!isNaN(d.getTime())) setViewDate(d);
    }
  }, [value]);

  function selectPreset(preset: PresetOption) {
    setStartInput(preset.startDate);
    setEndInput(preset.endDate);
    const d = new Date(preset.startDate);
    if (!isNaN(d.getTime())) setViewDate(d);
    onChange({ key: preset.key, label: preset.label, startDate: preset.startDate, endDate: preset.endDate, compareWithPrevious: comparePrev });
    setIsOpen(false);
  }

  function applyCustom() {
    let start = startInput;
    let end = endInput;
    if (start > end) { const tmp = start; start = end; end = tmp; setStartInput(start); setEndInput(end); }
    const matched = PRESET_DATE_RANGES.find((p) => p.startDate === start && p.endDate === end);
    onChange({ key: matched?.key ?? 'custom', label: matched?.label ?? `${start} – ${end}`, startDate: start, endDate: end, compareWithPrevious: comparePrev });
    setIsOpen(false);
  }

  function clickDay(dayStr: string) {
    if (!startInput || (startInput && endInput)) {
      setStartInput(dayStr);
      setEndInput('');
    } else {
      if (dayStr < startInput) { setEndInput(startInput); setStartInput(dayStr); }
      else setEndInput(dayStr);
    }
  }

  function renderDays() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`pad-${i}`} className="ad-cal-cell ad-cal-cell-empty" />);

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isStart = startInput === dayStr;
      const isEnd   = endInput === dayStr;
      const inRange = startInput && endInput && dayStr > startInput && dayStr < endInput;
      const inHover = startInput && !endInput && hoveredDay && dayStr > startInput && dayStr <= hoveredDay;

      cells.push(
        <button
          key={dayStr}
          type="button"
          onClick={() => clickDay(dayStr)}
          onMouseEnter={() => setHoveredDay(dayStr)}
          onMouseLeave={() => setHoveredDay(null)}
          className={`ad-cal-cell ${isStart || isEnd ? 'ad-cal-cell-selected' : (inRange || inHover) ? 'ad-cal-cell-range' : 'ad-cal-cell-normal'}`}
        >
          {d}
        </button>
      );
    }
    return cells;
  }

  return (
    <div className={`ad-drp-wrap ${className}`} ref={containerRef} id="global-date-range-picker-container">
      <button
        type="button"
        id="global-date-range-picker-trigger"
        onClick={() => setIsOpen((v) => !v)}
        className="ad-drp-trigger"
        title="Change Global Analytics Date Range"
      >
        <span className="ad-drp-trigger-icon"><IconCalendar /></span>
        <span className="ad-drp-trigger-label">{currentPreset.label}</span>
        <span className={`ad-drp-trigger-chevron${isOpen ? ' ad-drp-trigger-chevron-open' : ''}`}><IconChevronDown /></span>
      </button>

      {isOpen && (
        <div className="ad-drp-popover" id="global-date-range-picker-popover">
          {/* Header */}
          <div className="ad-drp-pop-header">
            <div className="ad-drp-pop-header-left">
              <span className="ad-drp-pop-clock"><IconClock /></span>
              <span className="ad-drp-pop-header-title">Date Interval &amp; Comparison</span>
            </div>
            <span className="ad-drp-pop-header-range">{startInput}{endInput ? ` → ${endInput}` : ' (select end)'}</span>
          </div>

          {/* Body */}
          <div className="ad-drp-pop-body">
            {/* Presets */}
            <div className="ad-drp-presets">
              <div className="ad-drp-preset-section-label">Standard Ranges</div>
              {PRESET_DATE_RANGES.filter((p) => p.category === 'standard').map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`ad-drp-preset-btn${value === preset.key ? ' ad-drp-preset-btn-active' : ''}`}
                >
                  <div>
                    <div className="ad-drp-preset-label">{preset.label}</div>
                    {preset.sublabel && <div className="ad-drp-preset-sub">{preset.sublabel}</div>}
                  </div>
                  {value === preset.key && <span className="ad-drp-preset-check"><IconCheck /></span>}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="ad-drp-calendar">
              <div className="ad-drp-date-inputs">
                <div>
                  <label className="ad-drp-date-label">Start Date</label>
                  <input
                    type="date"
                    value={startInput}
                    onChange={(e) => { setStartInput(e.target.value); const d = new Date(e.target.value); if (!isNaN(d.getTime())) setViewDate(d); }}
                    className="ad-drp-date-input"
                  />
                </div>
                <div>
                  <label className="ad-drp-date-label">End Date</label>
                  <input
                    type="date"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    className="ad-drp-date-input"
                  />
                </div>
              </div>

              <div className="ad-cal-nav">
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="ad-cal-nav-btn"><IconChevronLeft /></button>
                <span className="ad-cal-nav-month">{MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="ad-cal-nav-btn"><IconChevronRight /></button>
              </div>

              <div className="ad-cal-weekdays">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="ad-cal-grid">{renderDays()}</div>

              <div className="ad-drp-compare-row">
                <label className="ad-drp-compare-label">
                  <input type="checkbox" checked={comparePrev} onChange={(e) => setComparePrev(e.target.checked)} className="ad-drp-compare-checkbox" />
                  <span>Compare to previous period (+/- % change)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="ad-drp-pop-footer">
            <button
              type="button"
              onClick={() => selectPreset(PRESET_DATE_RANGES[0])}
              className="ad-drp-reset-btn"
            >
              <IconRotateCcw /> Reset to Today
            </button>
            <div className="ad-drp-footer-actions">
              <button type="button" onClick={() => setIsOpen(false)} className="ad-drp-cancel-btn">Cancel</button>
              <button type="button" id="apply-custom-date-range-btn" onClick={applyCustom} className="ad-drp-apply-btn">Apply Range</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
