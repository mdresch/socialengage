"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProjectedWorkView() {
  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <Card>
        <CardHeader>
          <CardTitle>Projected Engineering Work & Backlog</CardTitle>
          <CardDescription>
            High-leverage future capabilities, scaling optimizations, and downstream subsystem integrations.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Backlog Item Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-t-4 border-t-amber-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">1. Pending Story Execution</CardTitle>
              <Badge variant="warning">Immediate Phase</Badge>
            </div>
            <CardDescription>Direct next-story deliverables in the current phase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Story 8.8: AI Spike Storyteller</span>
                <span className="font-mono text-xs text-blue-600">POST /v1/posts/explain-spike</span>
              </div>
              <p className="text-xs text-slate-600">
                Automated volumetric anomaly detection with generative LLM explanations of post volume surges.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Story 5.16 / 6.10: Same-Domain Invite Assist</span>
                <span className="font-mono text-xs text-slate-500">ADR-0037</span>
              </div>
              <p className="text-xs text-slate-600">
                Tenant-Admin dashboard view for approving co-workers requesting workspace access under the same corporate domain.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">2. Scale-Out & Multi-Instance</CardTitle>
              <Badge variant="default">Infrastructure</Badge>
            </div>
            <CardDescription>Horizontal concurrency & rate-limit state coordination.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Distributed RequestGate State</span>
                <span className="font-mono text-xs text-blue-600">ADR-0020</span>
              </div>
              <p className="text-xs text-slate-600">
                Redis-backed distributed gate state for coordinating per-tenant per-provider quotas when multiple core worker instances run concurrently.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Streaming & Export Bounding</span>
                <span className="font-mono text-xs text-slate-500">ADR-0111</span>
              </div>
              <p className="text-xs text-slate-600">
                Bounded chunked streaming for massive CSV/JSON exports with automatic backpressure and memory caps.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-purple-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">3. Advanced Intelligence & Search</CardTitle>
              <Badge variant="outline">AI & Retrieval</Badge>
            </div>
            <CardDescription>Deep research agent and web search grounding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Composer Deep Research Agent</span>
                <span className="font-mono text-xs text-purple-600">ADR-0076, 0121</span>
              </div>
              <p className="text-xs text-slate-600">
                Multi-step research agent with token cost tracking, prompt caching, and cited polypost draft generation.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Active Search Provider Connectors</span>
                <span className="font-mono text-xs text-slate-500">ADR-0065, 0066, 0120</span>
              </div>
              <p className="text-xs text-slate-600">
                Shared one-off search abstraction for Brave Search & Bing Web APIs for targeted watchlist polling.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">4. Downstream Subsystem Handoff</CardTitle>
              <Badge variant="success">Platform Extension</Badge>
            </div>
            <CardDescription>Consuming REST API and Service Bus events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Brand Reputation & Alerts</span>
                <span className="font-mono text-xs text-emerald-600">ADR-0091</span>
              </div>
              <p className="text-xs text-slate-600">
                Consumes thin <code>SocialPostIngestedEvent</code> Service Bus messages to trigger real-time multi-channel incident alerts.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Social Care & CRM Handoff</span>
                <span className="font-mono text-xs text-slate-500">ADR-0095, 0099</span>
              </div>
              <p className="text-xs text-slate-600">
                Unified inbox triage and bi-directional support case handoff to Salesforce/HubSpot.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

