"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CODEBASE_METRICS } from "@/lib/project-dashboard/data";
import { DonutChart } from "@/components/charts/DonutChart";

export function ArchitectureExplorerView() {
  const [activeTab, setActiveTab] = useState<"layers" | "invariants" | "connectors">("layers");

  const donutData = [
    { label: "Core Contract Tests", value: CODEBASE_METRICS.coreTestLoc, color: "#6366f1", formattedValue: "23,430 LOC" },
    { label: "Admin UI Next.js", value: CODEBASE_METRICS.adminSrcLoc, color: "#2563eb", formattedValue: "26,458 LOC" },
    { label: "Core Ingestion Engine", value: CODEBASE_METRICS.coreSrcLoc, color: "#10b981", formattedValue: "17,648 LOC" },
    { label: "Admin Contract Tests", value: CODEBASE_METRICS.adminTestLoc, color: "#8b5cf6", formattedValue: "13,517 LOC" },
    { label: "Postgres Migrations", value: CODEBASE_METRICS.coreMigrationLoc, color: "#f59e0b", formattedValue: "1,581 LOC" },
  ];

  const INVARIANTS = [
    {
      id: "ADR-0001",
      title: "Strict Two-Repository Split",
      summary: "Admin UI acts strictly as an HTTP client to Core API. Zero direct database drivers or credentials in admin manifest.",
      status: "Enforced in Contract Suites",
      badge: "Non-Negotiable",
    },
    {
      id: "ADR-0015",
      title: "PostgreSQL Row-Level Security (RLS)",
      summary: "Every tenant query is gated by `app.current_tenant_id` session settings with database-level isolation.",
      status: "42 Versioned Migrations",
      badge: "Database Guardrail",
    },
    {
      id: "ADR-0014",
      title: "Azure Key Vault Envelope Encryption",
      summary: "Per-tenant data encryption keys (DEKs) wrapped with master KEK in Azure Key Vault for all social platform credentials.",
      status: "Cryptographic Isolation",
      badge: "Security Standard",
    },
    {
      id: "ADR-0005 / 0009",
      title: "Immutable Ingestion & Derived Health",
      summary: "Connector health is 100% computed from append-only `IngestionRun` records. Zero mutable drift in state.",
      status: "Mathematical State",
      badge: "Audit Anchor",
    },
    {
      id: "ADR-0036",
      title: "BFF Cookie Sessions & Role Gating",
      summary: "No bearer tokens stored in browser JavaScript. HTTP-only signed session cookies with backend identity resolution.",
      status: "Enterprise Auth",
      badge: "Zero-Trust",
    },
    {
      id: "ADR-0011",
      title: "Cursor-Based Deterministic Pagination",
      summary: "All high-throughput post APIs use timestamp-ID cursors with bounded page sizes (50 items max) to prevent offset lag.",
      status: "High Scale",
      badge: "Performance",
    },
  ];

  const CONNECTORS = [
    { name: "Reddit Connector", type: "Social Platform", auth: "OAuth2 App-Only & User", status: "Active (Tier 2/3)", ref: "ADR-0028" },
    { name: "Bluesky / AT Protocol", type: "Decentralized", auth: "App Passwords & Session", status: "Active", ref: "ADR-0002" },
    { name: "Mastodon Fediverse", type: "Decentralized", auth: "Instance Access Tokens", status: "Active", ref: "ADR-0002" },
    { name: "GNews RSS Connector", type: "News & Publications", auth: "API Key", status: "Active", ref: "ADR-0026" },
    { name: "Newswire Wire RSS", type: "Direct Wire Service", auth: "Public Feeds", status: "Active", ref: "ADR-0024" },
    { name: "Azure AI Language", type: "AI Enrichment Provider", auth: "Key Vault Secret", status: "Active", ref: "ADR-0038" },
    { name: "OpenAI / Anthropic LLM", type: "Structured Extraction", auth: "Key Vault Secret", status: "Active (Swappable)", ref: "ADR-0038" },
    { name: "Brave Search Connector", type: "Web Search Polling", auth: "API Key", status: "Backlog / v2", ref: "ADR-0065" },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("layers")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "layers" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Codebase Layers & LOC
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invariants")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "invariants" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Architecture Invariants (6 Guardrails)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("connectors")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "connectors" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Provider Connectors & Integrations
        </button>
      </div>

      {/* Tab: Layers */}
      {activeTab === "layers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Monorepo Volume Breakdown</CardTitle>
                <CardDescription>
                  82,634 total lines of code partitioned across runtime code, contract verification, and migrations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={donutData} size={220} centerTitle="82.6k" centerSubtitle="Total Monorepo LOC" />
              </CardContent>
            </Card>

            <Card className="flex flex-col justify-between">
              <CardHeader>
                <CardTitle>Verification Quality</CardTitle>
                <CardDescription>Contract testing vs production code ratio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="text-xs font-bold uppercase text-indigo-700">Contract Verification Ratio</div>
                  <div className="text-3xl font-extrabold text-indigo-900 font-mono mt-1">44.7%</div>
                  <p className="text-xs text-indigo-700/80 mt-1">
                    36,947 LOC dedicated solely to automated contracts and boundary verification.
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-xs font-bold uppercase text-emerald-700">Contract Test Suites</div>
                  <div className="text-3xl font-extrabold text-emerald-900 font-mono mt-1">142 / 142</div>
                  <p className="text-xs text-emerald-700/80 mt-1">
                    100% passing contract verification across backend API and frontend BFF.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>social-listening-core</span>
                  <Badge variant="default">132 Files · 17,648 LOC</Badge>
                </CardTitle>
                <CardDescription>Backend ingestion engine, REST API, rate gates, and RLS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Provider Connectors (Reddit, Mastodon, Bluesky, RSS):</span>
                  <span className="font-mono font-semibold">6,420 LOC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Rate Gates & Tenant Isolation:</span>
                  <span className="font-mono font-semibold">3,810 LOC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>REST API Router & Auth Middleware:</span>
                  <span className="font-mono font-semibold">4,120 LOC</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Database Repositories & Entities:</span>
                  <span className="font-mono font-semibold">3,298 LOC</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>social-listening-admin</span>
                  <Badge variant="default">152 Files · 26,458 LOC</Badge>
                </CardTitle>
                <CardDescription>Next.js BFF role-gated admin UI and analytics dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Analytics & Telemetry Dashboards:</span>
                  <span className="font-mono font-semibold">8,940 LOC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Watchlist Visual Builder & Filters:</span>
                  <span className="font-mono font-semibold">6,210 LOC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Tenant & User Management UI:</span>
                  <span className="font-mono font-semibold">5,480 LOC</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>BFF Auth, Middleware & Design System:</span>
                  <span className="font-mono font-semibold">5,828 LOC</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Invariants */}
      {activeTab === "invariants" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INVARIANTS.map((inv) => (
            <Card key={inv.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-600">{inv.id}</span>
                <Badge variant="outline">{inv.badge}</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">{inv.title}</h4>
              <p className="text-xs text-slate-600">{inv.summary}</p>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <span>✓</span>
                <span>{inv.status}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Connectors */}
      {activeTab === "connectors" && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Connector Architecture</CardTitle>
            <CardDescription>Standardized connectors adhering to ADR-0002 provider pattern.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CONNECTORS.map((c) => (
                <div key={c.name} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-slate-500">{c.type} · {c.auth}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <Badge variant={c.status.includes("Active") ? "success" : "secondary"}>{c.status}</Badge>
                    <div className="font-mono text-[10px] text-slate-400">{c.ref}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
