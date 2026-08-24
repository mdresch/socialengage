"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { MONOREPO_COVERAGE } from "@/lib/project-dashboard/data";

export interface NavItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "success" | "warning" | "secondary" | "outline";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
  onExportJson: () => void;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Executive & Traceability",
    items: [
      {
        id: "overview",
        label: "Executive Overview",
        shortLabel: "Overview",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        ),
        badge: "Live",
        badgeVariant: "success",
      },
      {
        id: "traceability",
        label: "Traceability Matrix",
        shortLabel: "Traceability",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        ),
        badge: "E2E",
        badgeVariant: "default",
      },
    ],
  },
  {
    title: "Quality & Architecture",
    items: [
      {
        id: "contracts",
        label: "Jest Contracts & Coverage",
        shortLabel: "Contracts",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
        badge: "143 Suites",
        badgeVariant: "success",
      },
      {
        id: "architecture",
        label: "Architecture & Codebase",
        shortLabel: "Architecture",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        ),
        badge: "82.6k LOC",
        badgeVariant: "secondary",
      },
    ],
  },
  {
    title: "Specifications & Decisions",
    items: [
      {
        id: "adrs",
        label: "ADR Architecture Decisions",
        shortLabel: "ADRs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
        ),
        badge: "119",
        badgeVariant: "outline",
      },
      {
        id: "brds",
        label: "Business Requirements (BRD)",
        shortLabel: "BRDs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="m9 14 2 2 4-4" />
          </svg>
        ),
        badge: "119",
        badgeVariant: "outline",
      },
      {
        id: "fdds",
        label: "Functional Designs (FDD)",
        shortLabel: "FDDs",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        ),
        badge: "119",
        badgeVariant: "outline",
      },
      {
        id: "questions",
        label: "ADR Open Questions",
        shortLabel: "Questions",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        badge: "244 Open",
        badgeVariant: "warning",
      },
    ],
  },
  {
    title: "Delivery & Backlog",
    items: [
      {
        id: "stories",
        label: "User Stories Explorer",
        shortLabel: "Stories",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          </svg>
        ),
        badge: "125/206",
        badgeVariant: "default",
      },
      {
        id: "projected",
        label: "Projected Work & Roadmap",
        shortLabel: "Projected",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        badge: "Phase 5",
        badgeVariant: "warning",
      },
    ],
  },
];

export function SidebarNav({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenSearch,
  onExportJson,
}: SidebarNavProps) {
  const content = (
    <div className="h-full flex flex-col justify-between bg-[#0f172a] text-slate-100 select-none">
      {/* Top Header & Brand */}
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-blue-500/20 shrink-0">
              SE
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white tracking-tight truncate">
                    SocialEngage
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-400/30">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Engineering Telemetry</p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Command Search Shortcut Bar */}
        <div className="p-3 border-b border-slate-800/80">
          <button
            type="button"
            onClick={onOpenSearch}
            className={`w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-400 transition border border-slate-700/60 ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Search artifacts (Cmd+K)"
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {!isCollapsed && <span>Search telemetry...</span>}
            </div>
            {!isCollapsed && (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-900 border border-slate-700 rounded text-slate-400">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation Group Items */}
        <div className="p-2.5 space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all group ${
                      isActive
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    } ${isCollapsed ? "justify-center px-2" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <Badge
                        variant={item.badgeVariant || "outline"}
                        className={`text-[10px] shrink-0 font-mono ${
                          isActive
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Status Section */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2.5">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Monorepo
              </span>
              <span className="font-mono text-emerald-400 font-bold">100% Pass</span>
            </div>

            <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Phase 4 Active:</span>
                <span className="text-white font-mono font-bold">89.9% (125/139)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Roadmap (Epics 1–13):</span>
                <span className="text-blue-300 font-mono font-bold">60.7% (125/206)</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Coverage:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {MONOREPO_COVERAGE.overallStatementsPct}% Stmts
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onExportJson}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Full JSON
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" title="System Live" />
            <button
              type="button"
              onClick={onExportJson}
              className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              title="Export Full JSON"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-screen transition-all duration-200 sticky top-0 z-40 border-r border-slate-800 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {content}
      </aside>

      {/* Mobile Drawer Slideover */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
