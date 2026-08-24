"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FDD_LIST } from "@/lib/project-dashboard/data";

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
  "§14. Appendix & References"
];

export function FddView() {
  const [search, setSearch] = useState("");

  const filteredFdds = useMemo(() => {
    return FDD_LIST.filter(fdd => {
      return (
        fdd.id.toLowerCase().includes(search.toLowerCase()) ||
        fdd.title.toLowerCase().includes(search.toLowerCase()) ||
        fdd.file.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [search]);

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
            {SECTIONS.map(s => (
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Design Documents Directory</CardTitle>
              <CardDescription>
                Filter and inspect all functional design contracts.
              </CardDescription>
            </div>
            <div className="w-full md:w-72">
              <Input
                placeholder="Search FDDs by ID, title, or filename..."
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
              {filteredFdds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No functional design documents match your query.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFdds.map(fdd => (
                  <TableRow key={fdd.id}>
                    <TableCell className="font-mono text-xs font-semibold text-indigo-600">
                      {fdd.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm">{fdd.title}</div>
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
        </CardContent>
      </Card>
    </div>
  );
}

