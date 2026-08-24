"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { StackedBarChart, type StackedBarItem } from "@/components/charts/StackedBarChart";
import { VelocityAreaChart } from "@/components/charts/VelocityAreaChart";
import { StatSparkline } from "@/components/charts/StatSparkline";
import { CODEBASE_METRICS, EPICS_SUMMARY, ADR_LIST, STORIES_LIST } from "@/lib/project-dashboard/data";

export function OverviewView() {
  const totalStories = STORIES_LIST.length;
  const builtStories = STORIES_LIST.filter(s => s.isBuilt).length;
  const pendingStories = totalStories - builtStories;
  const progressPct = Math.round((builtStories / totalStories) * 100);

  const acceptedAdrs = ADR_LIST.filter(a => a.status.toLowerCase().includes("accepted")).length;
  const proposedAdrs = ADR_LIST.length - acceptedAdrs;

  // Codebase Donut Data
  const codebaseDonutData: DonutSegment[] = [
    { label: "Contract Tests", value: CODEBASE_METRICS.coreTestLoc + CODEBASE_METRICS.adminTestLoc, color: "#6366f1", formattedValue: "36,947 LOC" },
    { label: "Admin UI Next.js", value: CODEBASE_METRICS.adminSrcLoc, color: "#2563eb", formattedValue: "26,458 LOC" },
    { label: "Core Ingestion Engine", value: CODEBASE_METRICS.coreSrcLoc, color: "#10b981", formattedValue: "17,648 LOC" },
    { label: "Database RLS Migrations", value: CODEBASE_METRICS.coreMigrationLoc, color: "#f59e0b", formattedValue: "1,581 LOC" },
  ];

  // Epic Stacked Bar Data
  const epicBarData: StackedBarItem[] = EPICS_SUMMARY.map(ep => ({
    id: ep.id,
    label: ep.title,
    built: ep.built,
    pending: ep.pending,
    total: ep.total,
    progressPct: ep.progressPct,
  }));

  return (
    <div className="space-y-6">
      {/* Top Interactive Metric Cards with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Story Completion</CardDescription>
              <CardTitle className="text-3xl font-bold text-blue-600">
                {progressPct}%
              </CardTitle>
            </div>
            <StatSparkline data={[8, 34, 82, 138, 185, 192]} color="#2563eb" />
          </CardHeader>
          <CardContent>
            <Progress value={progressPct} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-slate-500">
              <span>{builtStories} built</span>
              <span className="font-semibold text-amber-600">{pendingStories} pending</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>ADR Governance</CardDescription>
              <CardTitle className="text-3xl font-bold text-emerald-600">
                {acceptedAdrs} / {ADR_LIST.length}
              </CardTitle>
            </div>
            <StatSparkline data={[10, 25, 45, 60, 70, 74]} color="#10b981" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="success">{acceptedAdrs} Accepted</Badge>
              <Badge variant="warning">{proposedAdrs} Proposed</Badge>
            </div>
            <p className="text-xs text-slate-500">
              100% architectural coverage across 6 core domains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Contract Test Suites</CardDescription>
              <CardTitle className="text-3xl font-bold text-indigo-600">
                {CODEBASE_METRICS.coreTestFiles + CODEBASE_METRICS.adminTestFiles}
              </CardTitle>
            </div>
            <StatSparkline data={[12, 35, 68, 102, 130, 142]} color="#6366f1" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="default">{CODEBASE_METRICS.coreTestFiles} Core</Badge>
              <Badge variant="secondary">{CODEBASE_METRICS.adminTestFiles} Admin</Badge>
            </div>
            <p className="text-xs text-slate-500">
              {(CODEBASE_METRICS.coreTestLoc + CODEBASE_METRICS.adminTestLoc).toLocaleString()} LOC automated contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription>Total Codebase Footprint</CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-900">
                82.6k <span className="text-sm font-normal text-slate-500">LOC</span>
              </CardTitle>
            </div>
            <StatSparkline data={[15000, 32000, 52000, 68000, 78000, 82634]} color="#0f172a" />
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Total Files:</span>
                <span className="font-mono">{CODEBASE_METRICS.totalFiles} files</span>
              </div>
              <div className="flex justify-between">
                <span>Verification Ratio:</span>
                <span className="font-mono font-semibold text-indigo-600">44.7% test code</span>
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
              title="Overall Epics Progress"
              subtitle={`${builtStories}/${totalStories} stories`}
              color="#2563eb"
              size={190}
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Phase 4: 93.2% Complete
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
              centerTitle="82,634"
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
              <CardDescription>Cumulative story delivery trajectory across project phases (Phases 0 → 4.5).</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Trajectory: On Schedule
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
              <CardTitle>Epic Delivery Progress (Epics 1–13)</CardTitle>
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
          <StackedBarChart data={epicBarData} />
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
