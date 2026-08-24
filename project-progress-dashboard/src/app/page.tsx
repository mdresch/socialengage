"use client";

import React, { useState, useEffect } from "react";
import { OverviewView } from "@/components/project-progress/OverviewView";
import { TraceabilityView } from "@/components/project-progress/TraceabilityView";
import { AdrView } from "@/components/project-progress/AdrView";
import { BrdView } from "@/components/project-progress/BrdView";
import { FddView } from "@/components/project-progress/FddView";
import { StoriesView } from "@/components/project-progress/StoriesView";
import { ArchitectureExplorerView } from "@/components/project-progress/ArchitectureExplorerView";
import { ProjectedWorkView } from "@/components/project-progress/ProjectedWorkView";
import { TestContractsView } from "@/components/project-progress/TestContractsView";
import { AdrOpenQuestionsView } from "@/components/project-progress/AdrOpenQuestionsView";
import { SidebarNav, NAV_GROUPS } from "@/components/project-progress/SidebarNav";
import { DetailDrawer, type DrawerItem } from "@/components/project-progress/DetailDrawer";
import { GlobalSearchDialog } from "@/components/project-progress/GlobalSearchDialog";
import {
  ADR_LIST,
  BRD_LIST,
  FDD_LIST,
  STORIES_LIST,
  EPICS_SUMMARY,
  CODEBASE_METRICS,
  TEST_CONTRACTS_LIST,
  MONOREPO_COVERAGE,
  OPEN_QUESTIONS_LIST,
} from "@/lib/project-dashboard/data";

export default function DashboardRootPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<DrawerItem | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExportFullJson = () => {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: CODEBASE_METRICS,
      coverage: MONOREPO_COVERAGE,
      testContracts: TEST_CONTRACTS_LIST,
      openQuestions: OPEN_QUESTIONS_LIST,
      epics: EPICS_SUMMARY,
      stories: STORIES_LIST,
      adrs: ADR_LIST,
      brds: BRD_LIST,
      fdds: FDD_LIST,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socialengage-full-telemetry-${Date.now()}.json`;
    a.click();
  };

  const handleNavigateToItem = (type: any, id: string) => {
    if (type === "story") {
      const story = STORIES_LIST.find((s) => s.storyId === id);
      if (story) setSelectedDrawerItem({ type: "story", data: story });
    } else if (type === "adr") {
      const adr = ADR_LIST.find((a) => a.id === id);
      if (adr) setSelectedDrawerItem({ type: "adr", data: adr });
    } else if (type === "brd") {
      const brd = BRD_LIST.find((b) => b.id === id);
      if (brd) setSelectedDrawerItem({ type: "brd", data: brd });
    } else if (type === "fdd") {
      const fdd = FDD_LIST.find((f) => f.id === id);
      if (fdd) setSelectedDrawerItem({ type: "fdd", data: fdd });
    }
  };

  // Find active tab info
  const allNavItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentNav = allNavItems.find((n) => n.id === activeTab) || allNavItems[0];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/70 text-slate-900 font-sans">
      {/* Sidebar Navigation Drawer */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onExportJson={handleExportFullJson}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top App Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 flex items-center justify-between shadow-2xs z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Open Navigation Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Breadcrumb & Section Title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-600 hidden sm:inline">Telemetry</span>
              <span className="text-xs text-slate-600 hidden sm:inline">/</span>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          {/* Quick Header Badges & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Quick Search Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-500 transition shadow-2xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Search artifacts...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-slate-300 rounded text-slate-600">
                ⌘K
              </kbd>
            </button>

            {/* Passing Suites Status Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              143/143 Passing
            </span>

            {/* Export JSON Button */}
            <button
              type="button"
              onClick={handleExportFullJson}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              title="Download full project telemetry JSON"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export JSON
            </button>
          </div>
        </header>

        {/* Scrollable Main Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === "overview" && (
              <OverviewView
                onSelectItem={setSelectedDrawerItem}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === "traceability" && (
              <TraceabilityView onSelectItem={setSelectedDrawerItem} />
            )}
            {activeTab === "contracts" && (
              <TestContractsView onSelectItem={setSelectedDrawerItem} />
            )}
            {activeTab === "architecture" && <ArchitectureExplorerView />}
            {activeTab === "adrs" && <AdrView onSelectItem={setSelectedDrawerItem} />}
            {activeTab === "questions" && (
              <AdrOpenQuestionsView onSelectItem={setSelectedDrawerItem} />
            )}
            {activeTab === "brds" && <BrdView onSelectItem={setSelectedDrawerItem} />}
            {activeTab === "fdds" && <FddView onSelectItem={setSelectedDrawerItem} />}
            {activeTab === "stories" && <StoriesView onSelectItem={setSelectedDrawerItem} />}
            {activeTab === "projected" && (
              <ProjectedWorkView onSelectItem={setSelectedDrawerItem} />
            )}
          </div>
        </main>
      </div>

      {/* Slideover Detail Inspector Drawer */}
      <DetailDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        onNavigateToItem={handleNavigateToItem}
      />

      {/* Command Palette Global Search Modal */}
      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectItem={setSelectedDrawerItem}
      />
    </div>
  );
}
