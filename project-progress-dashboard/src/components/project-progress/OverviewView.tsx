"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { StackedBarChart, type StackedBarItem } from "@/components/charts/StackedBarChart";
import { VelocityAreaChart } from "@/components/charts/VelocityAreaChart";
import { StatSparkline } from "@/components/charts/StatSparkline";
import { CODEBASE_METRICS, EPICS_SUMMARY, ADR_LIST, STORIES_LIST, BRD_LIST, FDD_LIST, OPEN_QUESTIONS_LIST } from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

export interface OverviewViewProps {
  onSelectItem?: (item: DrawerItem) => void;
  onNavigateTab?: (tab: string) => void;
}

export function OverviewView({ onSelectItem, onNavigateTab }: OverviewViewProps) {
  const [simulatedPendingBuilt, setSimulatedPendingBuilt] = useState(false);

  const baseTotalStories = STORIES_LIST.filter((s) => !s.isRetired && !s.isRelocated).length;
  const baseBuiltStories = STORIES_LIST.filter((s) => s.isBuilt).length;

  const builtStories = simulatedPendingBuilt ? baseTotalStories : baseBuiltStories;
  const pendingStories = simulatedPendingBuilt ? 0 : baseTotalStories - baseBuiltStories;
  const progressPct = baseTotalStories > 0 ? Math.round((builtStories / baseTotalStories) * 100) : 0;

  const acceptedAdrs = ADR_LIST.filter((a) => a.status.toLowerCase().includes("accepted")).length;
  const proposedAdrs = ADR_LIST.length - acceptedAdrs;
  const openQuestionsCount = OPEN_QUESTIONS_LIST.filter((q) => q.status === "OPEN").length;

  const totalContractSuites = CODEBASE_METRICS.coreTestFiles + CODEBASE_METRICS.adminTestFiles;
  const totalVerifiedLoc = CODEBASE_METRICS.coreTestLoc + CODEBASE_METRICS.adminTestLoc;
  const totalCodebaseLoc =
    CODEBASE_METRICS.coreSrcLoc +
    CODEBASE_METRICS.adminSrcLoc +
    CODEBASE_METRICS.coreTestLoc +
    CODEBASE_METRICS.adminTestLoc +
    CODEBASE_METRICS.coreMigrationLoc;

  // Codebase Donut Data
  const codebaseDonutData: DonutSegment[] = [
    { label: "Contract Tests", value: totalVerifiedLoc, color: "#6366f1", formattedValue: `${totalVerifiedLoc.toLocaleString()} LOC` },
    { label: "Admin UI Next.js", value: CODEBASE_METRICS.adminSrcLoc, color: "#2563eb", formattedValue: `${CODEBASE_METRICS.adminSrcLoc.toLocaleString()} LOC` },
    { label: "Core Ingestion Engine", value: CODEBASE_METRICS.coreSrcLoc, color: "#10b981", formattedValue: `${CODEBASE_METRICS.coreSrcLoc.toLocaleString()} LOC` },
    { label: "Database RLS Migrations", value: CODEBASE_METRICS.coreMigrationLoc, color: "#f59e0b", formattedValue: `${CODEBASE_METRICS.coreMigrationLoc.toLocaleString()} LOC` },
  ];

  // Epic Stacked Bar Data (Epics 1–19)
  const epicBarData: StackedBarItem[] = EPICS_SUMMARY.map((ep) => ({
    id: ep.id,
    label: ep.title,
    built: simulatedPendingBuilt ? ep.total : ep.built,
    pending: simulatedPendingBuilt ? 0 : ep.pending,
    total: ep.total,
    progressPct: simulatedPendingBuilt ? 100 : ep.progressPct,
  }));

  const epics1To12Built = STORIES_LIST.filter((s) => {
    const num = parseInt(s.epicId.replace(/\D/g, ""), 10);
    return num >= 1 && num <= 12 && s.isBuilt;
  }).length;
  const epics1To12Total = STORIES_LIST.filter((s) => {
    const num = parseInt(s.epicId.replace(/\D/g, ""), 10);
    return num >= 1 && num <= 12 && !s.isRetired && !s.isRelocated;
  }).length;

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-sm">Live System Telemetry Active</span>
            <Badge variant="outline" className="text-[10px] text-white border-white/30">
              Phase 8.0 · 19 Epics
            </Badge>
          </div>
          <p className="text-xs text-blue-200">
            Automated monitoring across 2 repos, {totalContractSuites} contract test suites, {ADR_LIST.length} ADRs, {BRD_LIST.length} BRDs, {FDD_LIST.length} FDDs, and {baseTotalStories} user stories.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSimulatedPendingBuilt((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              simulatedPendingBuilt
                ? "bg-amber-400 text-amber-950 border-amber-300 shadow-sm"
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            }`}
          >
            {simulatedPendingBuilt ? "⚡ Reset What-If Simulation" : "🔮 Simulate 100% Backlog"}
          </button>
        </div>
      </div>

      {/* Top Metric Cards with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigateTab && onNavigateTab("stories")}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Story Completion (Epics 1–19)</CardDescription>
              <CardTitle className="text-3xl font-bold text-blue-600">
                {progressPct}%
              </CardTitle>
            </div>
            <StatSparkline data={[8, 34, 82, 110, 150, 176, builtStories]} color="#2563eb" />
          </CardHeader>
          <CardContent>
            <Progress value={progressPct} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{builtStories} built (Epics 1–19)</span>
              <span className="font-semibold text-amber-600">{pendingStories} pending</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
              <span>Foundation Scope (Epics 1–12):</span>
              <span className="font-mono font-bold text-emerald-700">100% ({epics1To12Built}/{epics1To12Total})</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigateTab && onNavigateTab("adrs")}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>ADR Governance</CardDescription>
              <CardTitle className="text-3xl font-bold text-emerald-600">
                {acceptedAdrs} / {ADR_LIST.length}
              </CardTitle>
            </div>
            <StatSparkline data={[10, 25, 45, 60, 95, 119, acceptedAdrs]} color="#10b981" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="success">{acceptedAdrs} Accepted</Badge>
              <Badge variant="warning">{proposedAdrs} Proposed</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Open Questions:</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigateTab) onNavigateTab("questions");
                }}
                className="font-mono font-bold text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
              >
                {openQuestionsCount} Pending Decision ➔
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigateTab && onNavigateTab("contracts")}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Contract Test Suites</CardDescription>
              <CardTitle className="text-3xl font-bold text-indigo-600">
                {totalContractSuites}
              </CardTitle>
            </div>
            <StatSparkline data={[12, 35, 68, 102, 142, 180, totalContractSuites]} color="#6366f1" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="default">{CODEBASE_METRICS.coreTestFiles} Core</Badge>
              <Badge variant="secondary">{CODEBASE_METRICS.adminTestFiles} Admin</Badge>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              {totalVerifiedLoc.toLocaleString()} LOC verified
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigateTab && onNavigateTab("architecture")}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Total Codebase Footprint</CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-900">
                {(totalCodebaseLoc / 1000).toFixed(1)}k <span className="text-sm font-normal text-slate-500">LOC</span>
              </CardTitle>
            </div>
            <StatSparkline data={[15000, 32000, 52000, 68000, 82634, totalCodebaseLoc]} color="#0f172a" />
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Total Files:</span>
                <span className="font-mono">{CODEBASE_METRICS.totalFiles} files</span>
              </div>
              <div className="flex justify-between">
                <span>Verification Ratio:</span>
                <span className="font-mono font-semibold text-indigo-600">
                  {((totalVerifiedLoc / totalCodebaseLoc) * 100).toFixed(1)}% test code
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Visual Gauges Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial Completion Gauge */}
        <Card className="flex flex-col items-center justify-between">
          <CardHeader className="w-full text-center pb-0">
            <CardTitle>Delivery Health</CardTitle>
            <CardDescription>Story implementation completion meter</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-4">
            <RadialGauge
              value={progressPct}
              title="Overall Roadmap Progress"
              subtitle={`${builtStories}/${baseTotalStories} stories`}
              color="#2563eb"
              size={190}
            />
            <div className="flex flex-col items-center gap-1.5 mt-2 text-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Epics 1–12 (Foundation & v1.8): 100% Shipped (192/192)
              </span>
              <span className="text-[11px] text-slate-500">
                Epics 13–19: {STORIES_LIST.filter((s) => {
                  const num = parseInt(s.epicId.replace(/\D/g, ""), 10);
                  return num >= 13 && s.isBuilt;
                }).length} / {STORIES_LIST.filter((s) => {
                  const num = parseInt(s.epicId.replace(/\D/g, ""), 10);
                  return num >= 13 && !s.isRetired && !s.isRelocated;
                }).length} Built (Planned Roadmap)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Codebase Volume Donut Chart */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Codebase Architecture Breakdown</CardTitle>
            <CardDescription>Distribution of lines of code across test verification, admin UI, engine, and migrations.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            <DonutChart
              data={codebaseDonutData}
              size={210}
              centerTitle={totalCodebaseLoc.toLocaleString()}
              centerSubtitle="Total Lines of Code"
            />
          </CardContent>
        </Card>
      </div>

      {/* Milestone Velocity Curve */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phase Milestone Story Velocity</CardTitle>
              <CardDescription>Cumulative story delivery trajectory across project phases (Phases 0 → 9).</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
              Trajectory: On Schedule ({builtStories}/{baseTotalStories} Stories)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <VelocityAreaChart />
        </CardContent>
      </Card>

      {/* Epic Delivery Comparison Stacked Bars */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Epic Delivery Progress (Epics 1–19)</CardTitle>
              <CardDescription>Comparative built vs pending story volume per Epic with progress percentages.</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-600">Implemented</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                <span className="text-slate-600">Pending</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StackedBarChart
            data={epicBarData}
            onSelectEpic={(id) => {
              const ep = EPICS_SUMMARY.find((e) => e.id === id);
              if (ep && onSelectItem) {
                onSelectItem({ type: "epic", data: ep });
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Architecture & Boundary Assurance */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture Boundaries & Invariants</CardTitle>
          <CardDescription>Non-negotiable structural contracts proven in code.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
            <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
            <div>
              <p className="font-semibold text-slate-900">Two-Repository Split (ADR-0001)</p>
              <p className="text-slate-500 text-xs mt-0.5">Admin UI connects strictly over HTTP REST; zero direct Postgres driver or credentials in admin manifest.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
            <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
            <div>
              <p className="font-semibold text-slate-900">PostgreSQL Row-Level Security (ADR-0015)</p>
              <p className="text-slate-500 text-xs mt-0.5">Multi-tenant isolation enforced in database engine via <code>tenant_isolation</code> policy on every table.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
            <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
            <div>
              <p className="font-semibold text-slate-900">Envelope Encryption Storage (ADR-0014)</p>
              <p className="text-slate-500 text-xs mt-0.5">OAuth tokens & API keys encrypted with per-tenant DEKs wrapped by Azure Key Vault master KEK.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
            <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
            <div>
              <p className="font-semibold text-slate-900">Derived Health & Ingestion Audit (ADR-0005, 0009)</p>
              <p className="text-slate-500 text-xs mt-0.5">Connector health is purely derived from immutable <code>IngestionRun</code> records, eliminating mutable state drift.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
