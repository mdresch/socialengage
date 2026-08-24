"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StackedBarChart, type StackedBarItem } from "@/components/charts/StackedBarChart";
import { STORIES_LIST, EPICS_SUMMARY } from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

export interface StoriesViewProps {
  onSelectItem?: (item: DrawerItem) => void;
}

export function StoriesView({ onSelectItem }: StoriesViewProps) {
  const [search, setSearch] = useState("");
  const [selectedEpic, setSelectedEpic] = useState("All");
  const [selectedBuiltStatus, setSelectedBuiltStatus] = useState("All");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStories = useMemo(() => {
    return STORIES_LIST.filter((story) => {
      const matchSearch =
        story.storyId.toLowerCase().includes(search.toLowerCase()) ||
        story.title.toLowerCase().includes(search.toLowerCase()) ||
        story.source.toLowerCase().includes(search.toLowerCase());

      const matchEpic =
        selectedEpic === "All" || story.epicId === selectedEpic;

      const matchBuilt =
        selectedBuiltStatus === "All" ||
        (selectedBuiltStatus === "Built" && story.isBuilt) ||
        (selectedBuiltStatus === "Pending" && !story.isBuilt);

      return matchSearch && matchEpic && matchBuilt;
    });
  }, [search, selectedEpic, selectedBuiltStatus]);

  const totalStories = STORIES_LIST.length;
  const builtStories = STORIES_LIST.filter((s) => s.isBuilt).length;
  const pendingStories = totalStories - builtStories;

  const totalPages = Math.ceil(filteredStories.length / pageSize) || 1;
  const paginatedStories = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStories.slice(start, start + pageSize);
  }, [filteredStories, currentPage, pageSize]);

  // Epic Stacked Bar Data
  const epicBarData: StackedBarItem[] = useMemo(() => {
    return EPICS_SUMMARY.map((ep) => ({
      id: ep.id,
      label: ep.title,
      built: ep.built,
      pending: ep.pending,
      total: ep.total,
      progressPct: ep.progressPct,
    }));
  }, []);

  const handleExportCsv = () => {
    const headers = "StoryId,Epic,Title,Source,Status,BuiltInfo\n";
    const rows = filteredStories
      .map(
        (s) =>
          `"${s.storyId}","${s.epicTitle}","${s.title.replace(/"/g, '""')}","${s.source}","${s.isBuilt ? "Implemented" : "Pending"}","${(s.builtInfo || "").replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socialengage-stories-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Epic Visual Progress Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Epics Delivery Matrix (Epics 1–13)</CardTitle>
              <CardDescription>
                Click any epic below to filter the story backlog table.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-xs py-1 px-3">
                {builtStories} Built (93.2%)
              </Badge>
              <Badge variant={pendingStories > 0 ? "warning" : "default"} className="text-xs py-1 px-3">
                {pendingStories} Pending
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            <StackedBarChart
              data={epicBarData}
              selectedEpicId={selectedEpic !== "All" ? selectedEpic : undefined}
              onSelectEpic={(id) => {
                setSelectedEpic(selectedEpic === id ? "All" : id);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter and Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <Input
                placeholder="Search stories by title, story ID, or source ADR..."
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
                value={selectedEpic}
                onChange={(e) => {
                  setSelectedEpic(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All 13 Epics</option>
                {EPICS_SUMMARY.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </select>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedBuiltStatus}
                onChange={(e) => {
                  setSelectedBuiltStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Stories ({totalStories})</option>
                <option value="Built">Implemented / Built Only ({builtStories})</option>
                <option value="Pending">Pending / Scheduled Only ({pendingStories})</option>
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
                <TableHead className="w-24">Story ID</TableHead>
                <TableHead className="w-48">Epic</TableHead>
                <TableHead>User Story Title</TableHead>
                <TableHead className="w-36">Source Reference</TableHead>
                <TableHead className="w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No user stories match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStories.map((story) => (
                  <TableRow
                    key={story.storyId}
                    onClick={() => onSelectItem && onSelectItem({ type: "story", data: story })}
                    className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-blue-600">
                      Story {story.storyId}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-medium">
                      {story.epicTitle}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm hover:text-blue-600 transition-colors">
                        {story.title}
                      </div>
                      {story.builtInfo && (
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {story.builtInfo}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600 font-mono">
                        {story.source || "Foundational"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={story.isBuilt ? "success" : "warning"} className="text-xs">
                        {story.isBuilt ? "Implemented" : "Pending"}
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
              {Math.min(currentPage * pageSize, filteredStories.length)} of {filteredStories.length} stories
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
                <option value={250}>All</option>
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
