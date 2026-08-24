"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { BRD_LIST } from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

const PILLARS = [
  "All",
  "Multi-Tenant Isolation & Security",
  "Universal Sourcing & Connectors",
  "AI Enrichment & Topic Intelligence",
  "Analytics, Dashboards & Operations",
  "Trust, Compliance & Data Sovereignty",
];

const PILLAR_COLORS: Record<string, string> = {
  "Multi-Tenant Isolation & Security": "#2563eb",
  "Universal Sourcing & Connectors": "#10b981",
  "AI Enrichment & Topic Intelligence": "#8b5cf6",
  "Analytics, Dashboards & Operations": "#06b6d4",
  "Trust, Compliance & Data Sovereignty": "#f59e0b",
};

export interface BrdViewProps {
  onSelectItem?: (item: DrawerItem) => void;
}

export function BrdView({ onSelectItem }: BrdViewProps) {
  const [search, setSearch] = useState("");
  const [selectedPillar, setSelectedPillar] = useState("All");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredBrds = useMemo(() => {
    return BRD_LIST.filter((brd) => {
      const matchSearch =
        brd.id.toLowerCase().includes(search.toLowerCase()) ||
        brd.title.toLowerCase().includes(search.toLowerCase());

      const matchPillar =
        selectedPillar === "All" || brd.pillar === selectedPillar;

      return matchSearch && matchPillar;
    });
  }, [search, selectedPillar]);

  const totalPages = Math.ceil(filteredBrds.length / pageSize) || 1;
  const paginatedBrds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBrds.slice(start, start + pageSize);
  }, [filteredBrds, currentPage, pageSize]);

  // Pillar Donut Data
  const pillarDonutData: DonutSegment[] = useMemo(() => {
    const counts: Record<string, number> = {};
    BRD_LIST.forEach((brd) => {
      counts[brd.pillar] = (counts[brd.pillar] || 0) + 1;
    });
    return Object.entries(counts).map(([pillar, count]) => ({
      label: pillar,
      value: count,
      color: PILLAR_COLORS[pillar] || "#94a3b8",
      formattedValue: `${count} BRDs`,
    }));
  }, []);

  const handleExportCsv = () => {
    const headers = "ID,Title,Pillar,Status,File\n";
    const rows = filteredBrds
      .map(
        (b) =>
          `"${b.id}","${b.title.replace(/"/g, '""')}","${b.pillar}","${b.status}","${b.file}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socialengage-brds-${Date.now()}.csv`;
    a.click();
  };

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
              onSelectSegment={(pillar) => {
                setSelectedPillar(pillar || "All");
                setCurrentPage(1);
              }}
              selectedSegment={selectedPillar !== "All" ? selectedPillar : null}
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
            {PILLARS.filter((p) => p !== "All").map((p) => {
              const count = BRD_LIST.filter((b) => b.pillar === p).length;
              const isSelected = selectedPillar === p;

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSelectedPillar(isSelected ? "All" : p);
                    setCurrentPage(1);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-blue-100 text-blue-900 font-semibold shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PILLAR_COLORS[p] }}
                    />
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
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <Input
                placeholder="Search business requirements by title or ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setSelectedPillar(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {PILLARS.map((p) => (
                  <option key={p} value={p}>
                    {p === "All" ? "All Business Value Pillars" : p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-300 flex items-center justify-center gap-1.5 shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
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
              {paginatedBrds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No business requirements match your search filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBrds.map((brd) => (
                  <TableRow
                    key={brd.id}
                    onClick={() => onSelectItem && onSelectItem({ type: "brd", data: brd })}
                    className="cursor-pointer hover:bg-emerald-50/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-emerald-700">
                      BRD-{brd.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm hover:text-emerald-700 transition-colors">
                        {brd.title}
                      </div>
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

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredBrds.length)} of {filteredBrds.length} requirements
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-8 px-2 rounded border border-slate-200 bg-white text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={120}>All</option>
              </select>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
