"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewView } from "@/components/project-progress/OverviewView";
import { AdrView } from "@/components/project-progress/AdrView";
import { BrdView } from "@/components/project-progress/BrdView";
import { FddView } from "@/components/project-progress/FddView";
import { StoriesView } from "@/components/project-progress/StoriesView";
import { ProjectedWorkView } from "@/components/project-progress/ProjectedWorkView";

export default function DashboardRootPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
              SE
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                SocialEngage Project Development Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Live multi-dimensional telemetry across Code, ADRs, BRDs, FDDs, and User Stories (Epics 1–13)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              142/142 Contract Suites Passing
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="bg-slate-200/80 p-1 border border-slate-200">
              <TabsTrigger value="overview">
                📊 Executive Overview
              </TabsTrigger>
              <TabsTrigger value="adrs">
                🏛️ ADR Decisions (119)
              </TabsTrigger>
              <TabsTrigger value="brds">
                📋 Business Requirements (119)
              </TabsTrigger>
              <TabsTrigger value="fdds">
                📐 Functional Designs (119)
              </TabsTrigger>
              <TabsTrigger value="stories">
                🚀 User Stories (206)
              </TabsTrigger>
              <TabsTrigger value="projected">
                🔮 Projected Work & Backlog
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewView />
          </TabsContent>

          <TabsContent value="adrs">
            <AdrView />
          </TabsContent>

          <TabsContent value="brds">
            <BrdView />
          </TabsContent>

          <TabsContent value="fdds">
            <FddView />
          </TabsContent>

          <TabsContent value="stories">
            <StoriesView />
          </TabsContent>

          <TabsContent value="projected">
            <ProjectedWorkView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

