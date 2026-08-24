"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  OPEN_QUESTIONS_LIST,
  ADR_LIST,
  type AdrOpenQuestionItem,
} from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

export interface AdrOpenQuestionsViewProps {
  onSelectItem?: (item: DrawerItem) => void;
}

export function AdrOpenQuestionsView({ onSelectItem }: AdrOpenQuestionsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Local state for interactive question resolutions (persisted in localStorage)
  const [resolvedOverrides, setResolvedOverrides] = useState<Record<string, { status: "RESOLVED"; note: string }>>({});
  const [resolvingItem, setResolvingItem] = useState<AdrOpenQuestionItem | null>(null);
  const [customResolutionNote, setCustomResolutionNote] = useState("");

  // Load persisted decisions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("socialengage_adr_resolutions");
      if (saved) {
        setResolvedOverrides(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage whenever overrides change
  const saveOverrides = (newOverrides: Record<string, { status: "RESOLVED"; note: string }>) => {
    setResolvedOverrides(newOverrides);
    try {
      localStorage.setItem("socialengage_adr_resolutions", JSON.stringify(newOverrides));
    } catch {
      // ignore
    }
  };

  // Merge static list with local overrides
  const effectiveQuestions = useMemo(() => {
    return OPEN_QUESTIONS_LIST.map((q) => {
      const override = resolvedOverrides[q.id];
      if (override) {
        return {
          ...q,
          status: override.status,
          resolutionNote: override.note || q.resolutionNote || "Decided in dashboard review.",
        };
      }
      return q;
    });
  }, [resolvedOverrides]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    OPEN_QUESTIONS_LIST.forEach((q) => set.add(q.category));
    return Array.from(set).sort();
  }, []);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return effectiveQuestions.filter((q) => {
      const matchesSearch =
        searchTerm.trim() === "" ||
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.adrId.includes(searchTerm) ||
        q.adrTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.resolutionNote && q.resolutionNote.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        selectedStatus === "ALL" || q.status === selectedStatus;
      const matchesCategory =
        selectedCategory === "ALL" || q.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [effectiveQuestions, searchTerm, selectedStatus, selectedCategory]);

  // Summary Metrics
  const totalQuestions = effectiveQuestions.length;
  const resolvedCount = effectiveQuestions.filter((q) => q.status === "RESOLVED").length;
  const supersededCount = effectiveQuestions.filter((q) => q.status === "SUPERSEDED").length;
  const openCount = effectiveQuestions.filter((q) => q.status === "OPEN").length;
  const closedCount = resolvedCount + supersededCount;
  const resolutionPct = Math.round((closedCount / totalQuestions) * 100);

  // Pagination calculations
  const totalItems = filteredQuestions.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
  const displayedQuestions = useMemo(() => {
    if (pageSize === -1) return filteredQuestions;
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  // Handle Mark Resolved
  const handleConfirmResolve = (qId: string, note: string) => {
    const updated = {
      ...resolvedOverrides,
      [qId]: {
        status: "RESOLVED" as const,
        note: note.trim() || "Resolved during architectural alignment review.",
      },
    };
    saveOverrides(updated);
    setResolvingItem(null);
    setCustomResolutionNote("");
  };

  // Handle Reopen
  const handleReopen = (qId: string) => {
    const updated = { ...resolvedOverrides };
    delete updated[qId];
    saveOverrides(updated);
  };

  // Reset all overrides
  const handleResetAllOverrides = () => {
    if (confirm("Reset all interactive decisions to default repository state?")) {
      saveOverrides({});
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Question ID",
      "ADR ID",
      "ADR Title",
      "Category",
      "Cluster",
      "Status",
      "Question Text",
      "Resolution Note",
    ];
    const rows = filteredQuestions.map((q) => [
      `"${q.id}"`,
      `"ADR-${q.adrId}"`,
      `"${q.adrTitle.replace(/"/g, '""')}"`,
      `"${q.category}"`,
      `"${q.cluster}"`,
      `"${q.status}"`,
      `"${q.question.replace(/"/g, '""')}"`,
      `"${(q.resolutionNote || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `socialengage-adr-open-questions-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Row inspection
  const handleInspect = (q: AdrOpenQuestionItem) => {
    const adr = ADR_LIST.find((a) => a.id === q.adrId || a.id.padStart(4, "0") === q.adrId);
    if (adr && onSelectItem) {
      onSelectItem({ type: "adr", data: adr });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              ADR Open Questions & Decision Resolution Center
            </h2>
            <Badge variant="warning" className="text-[11px] font-mono">
              {openCount} Unresolved
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Architectural questions and decision points across all 119 ADRs. Review and record decisions to reduce ambiguity and unblock Phase 4.5–9 implementations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(resolvedOverrides).length > 0 && (
            <button
              type="button"
              onClick={handleResetAllOverrides}
              className="text-xs text-slate-500 hover:text-red-600 underline mr-2"
            >
              Reset {Object.keys(resolvedOverrides).length} manual decisions
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            📥 Export Decision Matrix CSV ({filteredQuestions.length})
          </button>
        </div>
      </div>

      {/* Burn-Down & Resolution KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Decision Resolution Progress</CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-600">
              {resolutionPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={resolutionPct} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{closedCount} decided</span>
              <span className="font-semibold text-amber-600">{openCount} pending</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Open / Pending Questions</CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600">
              {openCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="warning">{openCount} Active</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Requiring sponsor sign-off or prototype proof
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Decided & Resolved Questions</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-600">
              {resolvedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="success">{resolvedCount} Formally Decided</Badge>
              {Object.keys(resolvedOverrides).length > 0 && (
                <Badge variant="default">+{Object.keys(resolvedOverrides).length} in UI</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Explicitly answered with rationale
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Superseded by Later ADRs</CardDescription>
            <CardTitle className="text-3xl font-bold text-purple-600">
              {supersededCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-2">
              <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
                {supersededCount} Superseded
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Resolved by subsequent architecture decisions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Progress Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const inCat = effectiveQuestions.filter((q) => q.category === cat);
          const catTotal = inCat.length;
          const catClosed = inCat.filter((q) => q.status !== "OPEN").length;
          const catPct = catTotal > 0 ? Math.round((catClosed / catTotal) * 100) : 0;

          return (
            <div
              key={cat}
              onClick={() => {
                setSelectedCategory(selectedCategory === cat ? "ALL" : cat);
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="truncate text-slate-800">{cat}</span>
                <span className="font-mono text-slate-600 shrink-0 ml-2">
                  {catClosed}/{catTotal} ({catPct}%)
                </span>
              </div>
              <Progress value={catPct} className="h-1.5 mb-1" />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{catTotal - catClosed} open questions</span>
                <span>{catClosed} resolved</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Resolution Modal */}
      {resolvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600 uppercase">
                  Resolve Question · ADR-{resolvingItem.adrId}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {resolvingItem.adrTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200/80 text-xs text-slate-800 leading-relaxed">
              <strong>Question:</strong> {resolvingItem.question}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Resolution Decision Note:
              </label>
              <textarea
                value={customResolutionNote}
                onChange={(e) => setCustomResolutionNote(e.target.value)}
                placeholder="Enter the authoritative decision, architectural rationale, or chosen implementation default..."
                className="w-full h-24 p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResolve(resolvingItem.id, customResolutionNote)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
              >
                ✓ Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Explorer */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold">
                ADR Questions Registry ({filteredQuestions.length})
              </CardTitle>
              <CardDescription>
                Click any question to inspect its source ADR or click the resolution action to complete decisions.
              </CardDescription>
            </div>
            <div className="w-full md:w-80">
              <Input
                placeholder="Search questions, keywords, ADRs..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus("ALL");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({effectiveQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus("OPEN");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === "OPEN"
                    ? "bg-amber-500 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Open ({openCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus("RESOLVED");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === "RESOLVED"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Resolved ({resolvedCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus("SUPERSEDED");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === "SUPERSEDED"
                    ? "bg-purple-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Superseded ({supersededCount})
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">ADR</TableHead>
                <TableHead>Open Question / Decision Point</TableHead>
                <TableHead className="w-40">Category</TableHead>
                <TableHead className="w-48">Resolution / Status Note</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedQuestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No open questions match your search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                displayedQuestions.map((q) => {
                  const isOpen = q.status === "OPEN";
                  const isResolved = q.status === "RESOLVED";
                  const isSuperseded = q.status === "SUPERSEDED";

                  return (
                    <TableRow
                      key={q.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant={
                            isResolved
                              ? "success"
                              : isOpen
                              ? "warning"
                              : "outline"
                          }
                          className={`text-[10px] ${
                            isSuperseded
                              ? "border-purple-200 text-purple-700 bg-purple-50"
                              : ""
                          }`}
                        >
                          {q.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleInspect(q)}
                          className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 underline text-left"
                        >
                          ADR-{q.adrId}
                        </button>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {q.adrTitle}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div
                          className={`text-xs leading-relaxed ${
                            isResolved ? "text-slate-500 line-through" : "text-slate-900 font-medium"
                          }`}
                        >
                          {q.question}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-[11px] text-slate-600 font-medium px-2 py-0.5 bg-slate-100 rounded border border-slate-200/60">
                          {q.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        {q.resolutionNote ? (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-1.5 rounded border border-emerald-200 line-clamp-3">
                            {q.resolutionNote}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pending resolution</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOpen ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingItem(q);
                                setCustomResolutionNote("");
                              }}
                              className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition"
                            >
                              Resolve ➔
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopen(q.id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] transition"
                              title="Reopen question"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={-1}>All ({totalItems})</option>
                </select>
                <span>
                  Showing {pageSize === -1 ? 1 : (currentPage - 1) * pageSize + 1} to{" "}
                  {pageSize === -1 ? totalItems : Math.min(currentPage * pageSize, totalItems)} of{" "}
                  {totalItems} questions
                </span>
              </div>

              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-600 px-2 font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
