"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STORIES_LIST, ADR_LIST, EPICS_SUMMARY } from "@/lib/project-dashboard/data";
import type { StoryItem } from "@/lib/project-dashboard/types";
import type { DrawerItem } from "./DetailDrawer";

export interface ProjectedWorkViewProps {
  onSelectItem?: (item: DrawerItem) => void;
}

export interface PhaseRoadmapItem {
  id: string;
  phaseNumber: string;
  name: string;
  versionTarget: string;
  epicId: string;
  epicTitle: string;
  adrRange: string;
  description: string;
  storyCount: number;
  status: "Ready for Build" | "Planned (Backlog)" | "Blocked — ADR Pending";
  keyDeliverables: string[];
  stories: StoryItem[];
}

export function ProjectedWorkView({ onSelectItem }: ProjectedWorkViewProps) {
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>("all");

  const pendingStories = STORIES_LIST.filter((s) => !s.isBuilt && !s.isRetired);

  // Group pending stories by phase
  const phase45Stories = pendingStories.filter((s) => {
    const num = parseInt(s.epicId.replace(/\D/g, ""), 10);
    return num >= 1 && num <= 8;
  });

  const phase5Stories = pendingStories.filter((s) => s.epicId === "Epic 9");
  const phase6Stories = pendingStories.filter((s) => s.epicId === "Epic 10");
  const phase7Stories = pendingStories.filter((s) => s.epicId === "Epic 11");
  const phase8Stories = pendingStories.filter((s) => s.epicId === "Epic 12");
  const phase9Stories = pendingStories.filter((s) => s.epicId === "Epic 13");

  const ROADMAP_PHASES: PhaseRoadmapItem[] = [
    {
      id: "phase-4.5",
      phaseNumber: "Phase 4.5",
      name: "Active Foundation Hardening & Core Scope Completion",
      versionTarget: "v1.0-RC",
      epicId: "Epics 1–8",
      epicTitle: "Foundation & Tenant Admin Hardening",
      adrRange: "ADRs 0028–0076",
      description:
        "Remaining 14 user stories in the active foundation scope: AI Spike Storyteller (8.8), Same-Domain Invites (5.16), and Tenant Offboarding.",
      storyCount: phase45Stories.length,
      status: "Ready for Build",
      keyDeliverables: [
        "POST /v1/posts/explain-spike (Story 8.8)",
        "Same-Domain Tenant Invite Assist (Story 5.16 / 6.10)",
        "Tenant Offboarding Data Lifecycle & Purge (Story 5.17 / 6.30)",
        "Platform Admin Audit Pack (Story 5.18)",
      ],
      stories: phase45Stories,
    },
    {
      id: "phase-5",
      phaseNumber: "Phase 5",
      name: "Crisis Management, Explainability & RAG Semantic Search",
      versionTarget: "v1.5",
      epicId: "Epic 9",
      epicTitle: "Epic 9: v1.5 feature implementations",
      adrRange: "ADRs 0077–0085",
      description:
        "Crisis threshold wizard, volumetric preview endpoint, onboarding state, and the end-to-end RAG vector embeddings & Ask AI search pipeline.",
      storyCount: phase5Stories.length,
      status: "Planned (Backlog)",
      keyDeliverables: [
        "Watchlist Connector Count & Volume Preview (Story 9.1 / ADR-0077)",
        "Metric Explainability Endpoint (Story 9.2 / ADR-0078)",
        "Crisis Threshold Wizard & Templates (Stories 9.3, 9.4 / ADR-0079)",
        "RAG Vector Embeddings Pipeline & Vector RLS (Stories 9.7, 9.8, 9.9 / ADRs 0081–0083)",
        "RAG Semantic Search & Ask AI Endpoint (Stories 9.10, 9.11 / ADRs 0084, 0085)",
      ],
      stories: phase5Stories,
    },
    {
      id: "phase-6",
      phaseNumber: "Phase 6",
      name: "Advanced Analytics, Operations & Trust / Compliance",
      versionTarget: "v1.6",
      epicId: "Epic 10",
      epicTitle: "Epic 10: Analytics, operations, and trust",
      adrRange: "ADRs 0086–0094",
      description:
        "Prospecting list sharing, preconfigured views, ad-hoc SQL query builder, real-time alert rules, author takedown & DSR self-service compliance pack.",
      storyCount: phase6Stories.length,
      status: "Planned (Backlog)",
      keyDeliverables: [
        "Prospecting List Model & Sharing (Stories 10.1, 10.2 / ADR-0086)",
        "Preconfigured Analytics Views & Ad-Hoc Queries (Stories 10.3, 10.4, 10.5 / ADRs 0087, 0088)",
        "Platform Operations Dashboard (Stories 10.6, 10.7 / ADR-0089)",
        "Real-Time Alert Rules & Webhook Delivery (Stories 10.9, 10.10 / ADR-0091)",
        "Author-Initiated Takedown & DSR Self-Service Portal (Stories 10.11, 10.12, 10.14 / ADRs 0092–0094)",
      ],
      stories: phase6Stories,
    },
    {
      id: "phase-7",
      phaseNumber: "Phase 7",
      name: "Engagement, CRM Case Handoff & Social Publishing",
      versionTarget: "v1.7",
      epicId: "Epic 11",
      epicTitle: "Epic 11: Engagement, workflow, and composer",
      adrRange: "ADRs 0095–0100",
      description:
        "CRM connector with lead/case handoff, daily digest email dispatcher, topic evolution timelines, unified inbox, and post scheduling composer.",
      storyCount: phase7Stories.length,
      status: "Planned (Backlog)",
      keyDeliverables: [
        "CRM Connector & Case Handoff (Stories 11.1, 11.2 / ADR-0095)",
        "Daily Digest Email Engine & UI (Stories 11.3, 11.4 / ADR-0096)",
        "Topic Evolution Timeline (Stories 11.5, 11.6 / ADR-0097)",
        "Publishing & Post Scheduling Engine (Stories 11.7, 11.8 / ADR-0098)",
        "Unified Social Inbox & Reply Composer (Stories 11.9, 11.10 / ADR-0099)",
        "Author Mention Auto-Suggestions (Stories 11.11, 11.12 / ADR-0100)",
      ],
      stories: phase7Stories,
    },
    {
      id: "phase-8",
      phaseNumber: "Phase 8",
      name: "Foundation Depth, Aspect AI & Public Webhooks API",
      versionTarget: "v1.8",
      epicId: "Epic 12",
      epicTitle: "Epic 12: Foundation depth and AI refinements",
      adrRange: "ADRs 0101–0108",
      description:
        "Connector capability matrix, visual boolean query builder, multi-aspect sentiment, topic clustering curation, public API versioning & webhooks, and influencer authority scoring.",
      storyCount: phase8Stories.length,
      status: "Planned (Backlog)",
      keyDeliverables: [
        "Connector Capability Matrix & Query Builder (Stories 12.1, 12.2, 12.3, 12.4 / ADRs 0101, 0102)",
        "Aspect-Based AI Sentiment Analysis (Stories 12.5, 12.6 / ADR-0103)",
        "AI Topic Clustering & Curation (Stories 12.7, 12.8 / ADR-0104)",
        "Public API Versioning & Outbound Webhooks (Stories 12.11, 12.12 / ADR-0106)",
        "Workspaces & Granular RBAC Permissions (Stories 12.13, 12.14 / ADR-0107)",
        "Influencer Discovery & Authority Scoring (Stories 12.15, 12.16 / ADR-0108)",
      ],
      stories: phase8Stories,
    },
    {
      id: "phase-9",
      phaseNumber: "Phase 9",
      name: "Sub-decisions, Media Targeting & Semantic Drift (v2.0)",
      versionTarget: "v2.0",
      epicId: "Epic 13",
      epicTitle: "Epic 13: Sub-decisions, v2 features, and closing loops",
      adrRange: "ADRs 0109–0117",
      description:
        "Automated connector recovery, query translation warnings, bounded streaming exports, feature gating seat limits, publishing media upload, semantic drift detection, and CRM push.",
      storyCount: phase9Stories.length,
      status: "Planned (Backlog)",
      keyDeliverables: [
        "Connector Health Auto-Disable & Self-Recovery (Story 13.1 / ADR-0109)",
        "Per-Connector Query Translation Warnings (Stories 13.2, 13.3 / ADR-0110)",
        "Bounded Streaming Data Exports (Story 13.4 / ADR-0111)",
        "Plan Feature Gating & Seat Limits (Stories 13.5, 13.6 / ADR-0112)",
        "Publishing Media Upload & Targeting (Stories 13.9, 13.10 / ADR-0115)",
        "Semantic Drift Detection Engine (Stories 13.11, 13.12 / ADR-0116)",
        "Prospecting List CRM Push (Stories 13.13, 13.14 / ADR-0117)",
      ],
      stories: phase9Stories,
    },
  ];

  const displayedPhases = ROADMAP_PHASES.filter((p) => {
    if (selectedPhaseFilter === "all") return true;
    return p.id === selectedPhaseFilter;
  });

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-sm text-amber-300 uppercase tracking-wider">
              Extended Phase Milestone Roadmap
            </span>
            <Badge variant="outline" className="text-[10px] text-white border-white/30">
              Phases 0 ➔ 9
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Future Capabilities & Multi-Phase Journey
          </h2>
          <p className="text-xs text-blue-200 mt-1 max-w-2xl">
            Phased sequencing extending the original delivery plan from Phase 4 foundation to v1.5, v1.6, v1.7, v1.8, and v2.0 roadmap milestones.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="p-3 bg-white/10 rounded-lg border border-white/15 text-center min-w-[120px]">
            <div className="text-[11px] text-blue-200">Pending Backlog</div>
            <div className="text-xl font-bold font-mono text-amber-300">{pendingStories.length} Stories</div>
          </div>
          <div className="p-3 bg-white/10 rounded-lg border border-white/15 text-center min-w-[120px]">
            <div className="text-[11px] text-blue-200">Extended Journey</div>
            <div className="text-xl font-bold font-mono text-emerald-300">6 Next Phases</div>
          </div>
        </div>
      </div>

      {/* Phase Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <span className="text-xs font-semibold text-slate-500 ml-2 mr-1">Filter Phase:</span>
        <button
          type="button"
          onClick={() => setSelectedPhaseFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            selectedPhaseFilter === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Next Phases ({ROADMAP_PHASES.length})
        </button>
        {ROADMAP_PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPhaseFilter(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedPhaseFilter === p.id
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.phaseNumber} ({p.storyCount})
          </button>
        ))}
      </div>

      {/* Extended Roadmap Phases Timeline Cards */}
      <div className="space-y-6">
        {displayedPhases.map((phase) => {
          const isPhase45 = phase.id === "phase-4.5";
          return (
            <Card
              key={phase.id}
              className={`shadow-sm border-l-4 transition hover:shadow-md ${
                isPhase45
                  ? "border-l-amber-500 bg-amber-50/20"
                  : "border-l-blue-600 bg-white"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {phase.phaseNumber}
                      </span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                        {phase.versionTarget}
                      </span>
                      <Badge
                        variant={isPhase45 ? "warning" : "default"}
                        className="text-[10px]"
                      >
                        {phase.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                      {phase.name}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium">Stories in Phase</div>
                    <div className="text-2xl font-bold font-mono text-slate-900">
                      {phase.storyCount} <span className="text-xs font-normal text-slate-500">stories</span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs text-slate-600 mt-1">
                  <strong>Aligned Scope:</strong> {phase.epicTitle} · <strong>Governing Decisions:</strong> {phase.adrRange}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  {phase.description}
                </p>

                {/* Key Deliverables Bullet Grid */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Key Milestone Deliverables
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {phase.keyDeliverables.map((deliv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 text-xs text-slate-800"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="truncate">{deliv}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phased User Stories Grid */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    User Stories Included in {phase.phaseNumber} ({phase.stories.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {phase.stories.map((s) => (
                      <div
                        key={s.storyId}
                        onClick={() => onSelectItem && onSelectItem({ type: "story", data: s })}
                        className="p-3 bg-white hover:bg-blue-50/60 rounded-lg border border-slate-200 cursor-pointer transition-all hover:border-blue-300 shadow-2xs space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-700 group-hover:text-blue-900">
                            Story {s.storyId}
                          </span>
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                            Pending
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 text-xs line-clamp-2">
                          {s.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {s.source || s.epicTitle}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
