import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export interface DateRangeValue {
  key: string;
  label: string;
  startDate: string; // ISO format YYYY-MM-DD or empty
  endDate: string;   // ISO format YYYY-MM-DD or empty
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

export const PRESET_DATE_RANGES: PresetOption[] = [
  {
    key: 'today',
    label: 'Today',
    sublabel: 'Live Ingestion',
    startDate: '2026-08-14',
    endDate: '2026-08-14',
    category: 'standard',
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    sublabel: 'Last 24 hours',
    startDate: '2026-08-13',
    endDate: '2026-08-13',
    category: 'standard',
  },
  {
    key: 'last_7_days',
    label: 'Last 7 Days',
    sublabel: '08/08 - 08/14',
    startDate: '2026-08-08',
    endDate: '2026-08-14',
    category: 'standard',
  },
  {
    key: 'last_14_days',
    label: 'Last 14 Days',
    sublabel: '08/01 - 08/14',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
    category: 'standard',
  },
  {
    key: 'last_30_days',
    label: 'Last 30 Days',
    sublabel: '07/15 - 08/14',
    startDate: '2026-07-15',
    endDate: '2026-08-14',
    category: 'standard',
  },
  {
    key: 'this_month',
    label: 'This Month',
    sublabel: 'August 2026',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    category: 'standard',
  },
  {
    key: 'last_month',
    label: 'Last Month',
    sublabel: 'July 2026',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    category: 'standard',
  },
  {
    key: 'week_future_decoded',
    label: 'Week 06/10 - 12/10/2017',
    sublabel: 'Future Decoded Event',
    startDate: '2017-10-06',
    endDate: '2017-10-12',
    category: 'campaign',
  },
  {
    key: 'month',
    label: 'Month 04/05 - 05/04/17',
    sublabel: 'Dynamics 365 Spring',
    startDate: '2017-04-05',
    endDate: '2017-05-04',
    category: 'campaign',
  },
  {
    key: 'week_oct',
    label: 'Week 10/13 - 10/19/2015',
    sublabel: 'Product Launch Week',
    startDate: '2015-10-13',
    endDate: '2015-10-19',
    category: 'campaign',
  },
  {
    key: 'custom_sep',
    label: 'Custom 09/01 - 09/14/15',
    sublabel: 'September Social Spike',
    startDate: '2015-09-01',
    endDate: '2015-09-14',
    category: 'campaign',
  },
  {
    key: 'all_time',
    label: 'All Available History',
    sublabel: 'Full Repository',
    startDate: '2015-01-01',
    endDate: '2026-12-31',
    category: 'standard',
  },
];

interface GlobalDateRangePickerProps {
  value: string; // active key (e.g. 'week_future_decoded', 'month', 'custom', etc.)
  onChange: (range: DateRangeValue) => void;
  className?: string;
}

export const GlobalDateRangePicker: React.FC<GlobalDateRangePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active selected preset or custom state
  const currentPreset = PRESET_DATE_RANGES.find((p) => p.key === value) || {
    key: 'custom',
    label: 'Custom Range',
    sublabel: 'Filtered interval',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
  };

  const [startDateInput, setStartDateInput] = useState<string>(currentPreset.startDate || '2026-08-01');
  const [endDateInput, setEndDateInput] = useState<string>(currentPreset.endDate || '2026-08-14');
  const [comparePrevious, setComparePrevious] = useState<boolean>(true);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => {
    if (currentPreset.startDate) {
      const parsed = new Date(currentPreset.startDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(2026, 7, 1); // August 2026 default
  });

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync internal inputs when `value` prop changes
  useEffect(() => {
    const matched = PRESET_DATE_RANGES.find((p) => p.key === value);
    if (matched) {
      setStartDateInput(matched.startDate);
      setEndDateInput(matched.endDate);
      const d = new Date(matched.startDate);
      if (!isNaN(d.getTime())) setCalendarViewDate(d);
    }
  }, [value]);

  const handleSelectPreset = (preset: PresetOption) => {
    setStartDateInput(preset.startDate);
    setEndDateInput(preset.endDate);
    const d = new Date(preset.startDate);
    if (!isNaN(d.getTime())) setCalendarViewDate(d);

    onChange({
      key: preset.key,
      label: preset.label,
      startDate: preset.startDate,
      endDate: preset.endDate,
      compareWithPrevious: comparePrevious,
    });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    let start = startDateInput;
    let end = endDateInput;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
      setStartDateInput(start);
      setEndDateInput(end);
    }

    const matched = PRESET_DATE_RANGES.find((p) => p.startDate === start && p.endDate === end);
    const key = matched ? matched.key : 'custom';
    const label = matched ? matched.label : `Custom ${start} - ${end}`;

    onChange({
      key,
      label,
      startDate: start,
      endDate: end,
      compareWithPrevious: comparePrevious,
    });
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
  };

  // Calendar Day Click Handler
  const handleDayClick = (dateStr: string) => {
    if (!startDateInput || (startDateInput && endDateInput)) {
      setStartDateInput(dateStr);
      setEndDateInput('');
    } else if (startDateInput && !endDateInput) {
      if (dateStr < startDateInput) {
        setEndDateInput(startDateInput);
        setStartDateInput(dateStr);
      } else {
        setEndDateInput(dateStr);
      }
    }
  };

  // Render Calendar Days
  const renderCalendarDays = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Leading empty padding days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`pad-${i}`} className="h-7 w-7" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isStart = startDateInput === dayStr;
      const isEnd = endDateInput === dayStr;
      const isSelected = isStart || isEnd;
      const isInRange =
        startDateInput &&
        endDateInput &&
        dayStr > startDateInput &&
        dayStr < endDateInput;
      const isHoveredRange =
        startDateInput &&
        !endDateInput &&
        hoveredDate &&
        dayStr > startDateInput &&
        dayStr <= hoveredDate;

      days.push(
        <button
          key={dayStr}
          type="button"
          onClick={() => handleDayClick(dayStr)}
          onMouseEnter={() => setHoveredDate(dayStr)}
          onMouseLeave={() => setHoveredDate(null)}
          className={`h-7 w-7 text-xs flex items-center justify-center font-mono rounded-xs transition-colors relative ${
            isSelected
              ? 'bg-[#0078D7] text-white font-semibold shadow-xs z-10'
              : isInRange || isHoveredRange
              ? 'bg-sky-100 text-sky-900 font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef} id="global-date-range-picker-container">
      {/* Trigger Button */}
      <button
        type="button"
        id="global-date-range-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xs text-xs text-slate-800 transition-colors shadow-2xs font-normal"
        title="Change Global Analytics Date Range"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="truncate max-w-[180px] md:max-w-[220px]">
          {currentPreset.label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown Window */}
      {isOpen && (
        <div
          id="global-date-range-picker-popover"
          className="absolute right-0 mt-1.5 w-[320px] sm:w-[540px] bg-white border border-slate-300 shadow-2xl rounded-none z-50 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Date Interval & Comparison</span>
            </div>
            <span className="text-[11px] text-slate-300 font-mono">
              {startDateInput} {endDateInput ? `→ ${endDateInput}` : '(select end)'}
            </span>
          </div>

          {/* Body: Presets List (Left) + Interactive Dual/Single Calendar & Inputs (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {/* Presets Column (Left 5 Cols) */}
            <div className="sm:col-span-5 p-2 bg-slate-50/70 max-h-[360px] overflow-y-auto space-y-1">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 pt-1 pb-0.5">
                Standard Ranges
              </div>
              {PRESET_DATE_RANGES.filter((p) => p.category === 'standard').map((preset) => {
                const isSelected = value === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-xs text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#0078D7] text-white font-medium shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <div>
                      <div className="leading-tight font-normal">{preset.label}</div>
                      {preset.sublabel && (
                        <div className={`text-[10px] ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                          {preset.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                  </button>
                );
              })}

              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 pt-2.5 pb-0.5">
                Campaign & Benchmark Datasets
              </div>
              {PRESET_DATE_RANGES.filter((p) => p.category === 'campaign').map((preset) => {
                const isSelected = value === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-xs text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#0078D7] text-white font-medium shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <div>
                      <div className="leading-tight font-normal">{preset.label}</div>
                      {preset.sublabel && (
                        <div className={`text-[10px] ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                          {preset.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* Calendar & Manual Range Selector (Right 7 Cols) */}
            <div className="sm:col-span-7 p-3.5 space-y-3 bg-white">
              {/* Date Input Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => {
                      setStartDateInput(e.target.value);
                      const d = new Date(e.target.value);
                      if (!isNaN(d.getTime())) setCalendarViewDate(d);
                    }}
                    className="w-full text-xs font-mono px-2 py-1 bg-slate-50 border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full text-xs font-mono px-2 py-1 bg-slate-50 border border-slate-300 rounded-xs focus:ring-1 focus:ring-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Month Header Nav */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded-xs"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-xs font-semibold text-slate-800">
                  {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded-xs"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Names Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Day Numbers Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {renderCalendarDays()}
              </div>

              {/* Comparison Checkbox */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={comparePrevious}
                    onChange={(e) => setComparePrevious(e.target.checked)}
                    className="rounded-xs text-[#0078D7] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="text-[11px] text-slate-600">Compare to previous period (+/- % change)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                const today = '2026-08-14';
                setStartDateInput(today);
                setEndDateInput(today);
                handleSelectPreset(PRESET_DATE_RANGES[0]);
              }}
              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Today</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs text-slate-700 hover:bg-slate-200/70 rounded-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="apply-custom-date-range-btn"
                onClick={handleApplyCustom}
                className="px-4 py-1 text-xs font-semibold text-white bg-[#0078D7] hover:bg-[#006cc1] rounded-xs transition-colors shadow-xs"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
