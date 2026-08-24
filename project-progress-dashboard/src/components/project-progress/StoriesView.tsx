"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StackedBarChart, type StackedBarItem } from "@/components/charts/StackedBarChart";
import { STORIES_LIST, EPICS_SUMMARY } from "@/lib/project-dashboard/data";

export function StoriesView() {
  const [search, setSearch] = useState("");
  const [selectedEpic, setSelectedEpic] = useState("All");
  const [selectedBuiltStatus, setSelectedBuiltStatus] = useState("All");

  const filteredStories = useMemo(() => {
    return STORIES_LIST.filter(story => {
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
  const builtStories = STORIES_LIST.filter(s => s.isBuilt).length;
  const pendingStories = totalStories - builtStories;

  // Epic Stacked Bar Data
  const epicBarData: StackedBarItem[] = useMemo(() => {
    return EPICS_SUMMARY.map(ep => ({
      id: ep.id,
      label: ep.title,
      built: ep.built,
      pending: ep.pending,
      total: ep.total,
      progressPct: ep.progressPct,
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Epic Visual Progress Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Epics Delivery Matrix</CardTitle>
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
              onSelectEpic={(id) => setSelectedEpic(selectedEpic === id ? "All" : id)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filter and Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Search stories by title, story ID, or source ADR..."
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
              value={selectedEpic}
              onChange={e => setSelectedEpic(e.target.value)}
            >
              <option value="All">All 13 Epics</option>
              {EPICS_SUMMARY.map(ep => (
                <option key={ep.id} value={ep.id}>{ep.title}</option>
              ))}
            </select>
            <select
              className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedBuiltStatus}
              onChange={e => setSelectedBuiltStatus(e.target.value)}
            >
              <option value="All">All Stories ({totalStories})</option>
              <option value="Built">Implemented / Built Only ({builtStories})</option>
              <option value="Pending">Pending / Scheduled Only ({pendingStories})</option>
            </select>
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
              {filteredStories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No user stories match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStories.map(story => (
                  <TableRow key={story.storyId}>
                    <TableCell className="font-mono text-xs font-semibold text-blue-600">
                      Story {story.storyId}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-medium">
                      {story.epicTitle}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm">{story.title}</div>
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
        </CardContent>
      </Card>
    </div>
  );
}
