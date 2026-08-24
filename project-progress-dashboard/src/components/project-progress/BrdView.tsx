"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { BRD_LIST } from "@/lib/project-dashboard/data";

const PILLARS = [
  "All",
  "Multi-Tenant Isolation & Security",
  "Universal Sourcing & Connectors",
  "AI Enrichment & Topic Intelligence",
  "Analytics, Dashboards & Operations",
  "Trust, Compliance & Data Sovereignty"
];

const PILLAR_COLORS: Record<string, string> = {
  "Multi-Tenant Isolation & Security": "#2563eb",
  "Universal Sourcing & Connectors": "#10b981",
  "AI Enrichment & Topic Intelligence": "#8b5cf6",
  "Analytics, Dashboards & Operations": "#06b6d4",
  "Trust, Compliance & Data Sovereignty": "#f59e0b"
};

export function BrdView() {
  const [search, setSearch] = useState("");
  const [selectedPillar, setSelectedPillar] = useState("All");

  const filteredBrds = useMemo(() => {
    return BRD_LIST.filter(brd => {
      const matchSearch =
        brd.id.toLowerCase().includes(search.toLowerCase()) ||
        brd.title.toLowerCase().includes(search.toLowerCase());

      const matchPillar =
        selectedPillar === "All" || brd.pillar === selectedPillar;

      return matchSearch && matchPillar;
    });
  }, [search, selectedPillar]);

  // Pillar Donut Data
  const pillarDonutData: DonutSegment[] = useMemo(() => {
    const counts: Record<string, number> = {};
    BRD_LIST.forEach(brd => {
      counts[brd.pillar] = (counts[brd.pillar] || 0) + 1;
    });
    return Object.entries(counts).map(([pillar, count]) => ({
      label: pillar,
      value: count,
      color: PILLAR_COLORS[pillar] || "#94a3b8",
      formattedValue: `${count} BRDs`,
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Visual Pillar Donut & Strategic Value Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Business Value Pillars</CardTitle>
                <CardDescription>
                  119 commercial deliverables translating enterprise requirements into concrete capabilities.
                </CardDescription>
              </div>
              <Badge variant="default" className="text-xs py-1 px-3">
                119 Authored Requirements
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            <DonutChart
              data={pillarDonutData}
              size={210}
              centerTitle="119"
              centerSubtitle="Business Requirements"
            />
          </CardContent>
        </Card>

        {/* Quick Filter by Pillar */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Filter by Value Pillar</CardTitle>
            <CardDescription>Click to view requirements by strategic area.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {PILLARS.filter(p => p !== "All").map(p => {
              const count = BRD_LIST.filter(b => b.pillar === p).length;
              const isSelected = selectedPillar === p;

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPillar(isSelected ? "All" : p)}
                  className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors text-left ${
                    isSelected ? "bg-blue-100 text-blue-900 font-semibold" : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PILLAR_COLORS[p] }} />
                    <span className="truncate">{p}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Search business requirements by title or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
            />
            <select
              className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPillar}
              onChange={e => setSelectedPillar(e.target.value)}
            >
              {PILLARS.map(p => (
                <option key={p} value={p}>{p === "All" ? "All Business Value Pillars" : p}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">BRD ID</TableHead>
                <TableHead>Requirement Title</TableHead>
                <TableHead className="w-64">Value Pillar</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No business requirements match your search filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrds.map(brd => (
                  <TableRow key={brd.id}>
                    <TableCell className="font-mono text-xs font-semibold text-emerald-700">
                      {brd.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm">{brd.title}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{brd.file}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {brd.pillar}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-xs">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
