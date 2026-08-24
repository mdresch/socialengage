"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FDD_LIST } from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

const SECTIONS = [
  "§1. Document Control",
  "§2. Purpose & Scope",
  "§3. Context & Background",
  "§4. Goals & Objectives",
  "§5. Functional Requirements",
  "§6. Workflows & Actors",
  "§7. Data Requirements",
  "§8. Business Rules & Logic",
  "§9. Interfaces & Integrations",
  "§10. Non-Functional Criteria",
  "§11. Error Handling & Exceptions",
  "§12. Assumptions & Dependencies",
  "§13. Open Questions",
  "§14. Appendix & References",
];

export interface FddViewProps {
  onSelectItem?: (item: DrawerItem) => void;
}

export function FddView({ onSelectItem }: FddViewProps) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredFdds = useMemo(() => {
    return FDD_LIST.filter((fdd) => {
      return (
        fdd.id.toLowerCase().includes(search.toLowerCase()) ||
        fdd.title.toLowerCase().includes(search.toLowerCase()) ||
        fdd.file.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [search]);

  const totalPages = Math.ceil(filteredFdds.length / pageSize) || 1;
  const paginatedFdds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFdds.slice(start, start + pageSize);
  }, [filteredFdds, currentPage, pageSize]);

  const handleExportCsv = () => {
    const headers = "ID,Title,File,Conformance\n";
    const rows = filteredFdds
      .map(
        (f) =>
          `"${f.id}","${f.title.replace(/"/g, '""')}","${f.file}","${f.conformance}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socialengage-fdds-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Template Conformance Summary */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white text-xl">Functional Design Documents (FDDs)</CardTitle>
              <CardDescription className="text-slate-300">
                119 comprehensive functional specifications establishing exact API schemas, validation rules, entities, and error codes.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-semibold">
                ✓ 100% Template Conformance (119/119)
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-300 mb-3 font-semibold uppercase tracking-wider">
            Mandatory 14-Section Specification Standard:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {SECTIONS.map((s) => (
              <div key={s} className="bg-slate-800/80 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200">
                {s}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FDD List Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div>
              <CardTitle>Design Documents Directory</CardTitle>
              <CardDescription>
                Filter and inspect all functional design contracts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search FDDs by ID, title, or filename..."
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
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-300 flex items-center gap-1.5 shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">FDD ID</TableHead>
                <TableHead>Specification Title</TableHead>
                <TableHead className="w-56">Document File</TableHead>
                <TableHead className="w-48">Structure Conformance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFdds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No functional design documents match your query.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFdds.map((fdd) => (
                  <TableRow
                    key={fdd.id}
                    onClick={() => onSelectItem && onSelectItem({ type: "fdd", data: fdd })}
                    className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-indigo-600">
                      FDD-{fdd.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                        {fdd.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500 font-mono">
                        {fdd.file}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-xs">
                        {fdd.conformance}
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
              {Math.min(currentPage * pageSize, filteredFdds.length)} of {filteredFdds.length} specifications
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
