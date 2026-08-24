"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { ADR_LIST } from "@/lib/project-dashboard/data";

const CLUSTERS = [
  "All",
  "Repository & Foundation",
  "Ingestion & Connectors",
  "Security & Multi-Tenancy",
  "Data Model & Archival",
  "AI Enrichment & Intelligence",
  "Analytics, Dashboards & Ops"
];

const CLUSTER_COLORS: Record<string, string> = {
  "Repository & Foundation": "#64748b",
  "Ingestion & Connectors": "#2563eb",
  "Security & Multi-Tenancy": "#10b981",
  "Data Model & Archival": "#f59e0b",
  "AI Enrichment & Intelligence": "#8b5cf6",
  "Analytics, Dashboards & Ops": "#06b6d4"
};

export function AdrView() {
  const [search, setSearch] = useState("");
  const [selectedCluster, setSelectedCluster] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const filteredAdrs = useMemo(() => {
    return ADR_LIST.filter(adr => {
      const matchSearch =
        adr.id.toLowerCase().includes(search.toLowerCase()) ||
        adr.title.toLowerCase().includes(search.toLowerCase()) ||
        adr.storyRefs.some(s => s.toLowerCase().includes(search.toLowerCase()));

      const matchCluster =
        selectedCluster === "All" || adr.cluster === selectedCluster;

      const isAccepted = adr.status.toLowerCase().includes("accepted");
      const matchStatus =
        selectedStatus === "All" ||
        (selectedStatus === "Accepted" && isAccepted) ||
        (selectedStatus === "Proposed" && !isAccepted);

      return matchSearch && matchCluster && matchStatus;
    });
  }, [search, selectedCluster, selectedStatus]);

  const acceptedCount = ADR_LIST.filter(a => a.status.toLowerCase().includes("accepted")).length;
  const proposedCount = ADR_LIST.length - acceptedCount;

  // ADR Cluster Donut Data
  const clusterDonutData: DonutSegment[] = useMemo(() => {
    const counts: Record<string, number> = {};
    ADR_LIST.forEach(adr => {
      counts[adr.cluster] = (counts[adr.cluster] || 0) + 1;
    });
    return Object.entries(counts).map(([cluster, count]) => ({
      label: cluster,
      value: count,
      color: CLUSTER_COLORS[cluster] || "#94a3b8",
      formattedValue: `${count} ADRs`,
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Visual Donut & Cluster Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>ADR Domain Distribution</CardTitle>
                <CardDescription>
                  119 Architectural Decisions partitioned across 6 foundational system domains.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">{acceptedCount} Accepted</Badge>
                <Badge variant="warning">{proposedCount} Proposed</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            <DonutChart
              data={clusterDonutData}
              size={210}
              centerTitle="119"
              centerSubtitle="Architecture Decisions"
            />
          </CardContent>
        </Card>

        {/* Quick Domain Filter Cards */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Filter by Domain</CardTitle>
            <CardDescription>Click to instantly filter decisions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {CLUSTERS.filter(c => c !== "All").map(c => {
              const count = ADR_LIST.filter(a => a.cluster === c).length;
              const isSelected = selectedCluster === c;

              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCluster(isSelected ? "All" : c)}
                  className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors text-left ${
                    isSelected ? "bg-blue-100 text-blue-900 font-semibold" : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[c] }} />
                    <span className="truncate">{c}</span>
                  </div>
                  <span className="font-mono text-slate-500">{count}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="col-span-1 md:col-span-1">
              <Input
                placeholder="Search ADRs by title, ID, or story ref..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
              />
            </div>
            <div>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedCluster}
                onChange={e => setSelectedCluster(e.target.value)}
              >
                {CLUSTERS.map(c => (
                  <option key={c} value={c}>{c === "All" ? "All Architectural Domains" : c}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses (Accepted & Proposed)</option>
                <option value="Accepted">Accepted Only ({acceptedCount})</option>
                <option value="Proposed">Proposed Only ({proposedCount})</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Decision Title</TableHead>
                <TableHead className="w-48">Domain Cluster</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-44">Related Stories</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdrs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No architectural decisions match your query.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdrs.map(adr => {
                  const isAccepted = adr.status.toLowerCase().includes("accepted");
                  return (
                    <TableRow key={adr.id}>
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">
                        {adr.id}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900 text-sm">{adr.title}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{adr.file}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {adr.cluster}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isAccepted ? "success" : "warning"} className="text-xs">
                          {isAccepted ? "Accepted" : "Proposed"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {adr.storyRefs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {adr.storyRefs.map(st => (
                              <span key={st} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                                Story {st}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Foundational / Platform</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
