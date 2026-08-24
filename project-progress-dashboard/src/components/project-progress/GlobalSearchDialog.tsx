"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ADR_LIST, BRD_LIST, FDD_LIST, STORIES_LIST, EPICS_SUMMARY, TEST_CONTRACTS_LIST, OPEN_QUESTIONS_LIST } from "@/lib/project-dashboard/data";
import type { DrawerItem } from "./DetailDrawer";

export interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: DrawerItem) => void;
}

export function GlobalSearchDialog({
  isOpen,
  onClose,
  onSelectItem,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return [
        ...STORIES_LIST.filter((s) => !s.isBuilt)
          .slice(0, 3)
          .map((s) => ({ type: "story" as const, data: s, label: `Pending Story ${s.storyId}: ${s.title}`, group: "Pending Stories" })),
        ...TEST_CONTRACTS_LIST.slice(0, 3).map((c) => ({
          kind: "CONTRACT" as const,
          type: "contract" as const,
          id: c.id,
          title: c.fileName,
          status: c.status,
          file: c.fullRelPath,
          description: `Contract test suite in ${c.repo} (${c.domain})`,
          metadata: {
            Repository: c.repo,
            "Run Command": `npm test ${c.filePath}`,
          },
          label: `${c.fileName} (${c.repo})`,
          group: "Contract Test Suites",
        })),
        ...ADR_LIST.slice(0, 2).map((a) => ({
          type: "adr" as const,
          data: a,
          label: `ADR-${a.id}: ${a.title}`,
          group: "Key Architectural Decisions",
        })),
      ];
    }

    const q = query.toLowerCase();
    const matches: Array<any> = [];

    // Search Contracts
    TEST_CONTRACTS_LIST.forEach((c) => {
      if (
        c.fileName.toLowerCase().includes(q) ||
        c.filePath.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        (c.storyRef && c.storyRef.toLowerCase().includes(q))
      ) {
        matches.push({
          kind: "CONTRACT",
          type: "contract",
          id: c.id,
          title: c.fileName,
          status: c.status,
          file: c.fullRelPath,
          description: `Contract test suite in ${c.repo} verifying ${c.domain}. Contains ${c.testCount} tests.`,
          relatedStories: c.storyRef ? [c.storyRef] : [],
          relatedAdrs: c.adrRef ? [c.adrRef] : [],
          metadata: {
            Repository: c.repo,
            "Run Command": `npm test ${c.filePath}`,
            Assertions: c.testCount.toString(),
            LOC: c.loc.toString(),
          },
          label: `🧪 ${c.fileName} (${c.repo})`,
          group: "Jest Test Contracts",
        });
      }
    });

    // Search Stories
    STORIES_LIST.forEach((s) => {
      if (s.storyId.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.source?.toLowerCase().includes(q)) {
        matches.push({
          type: "story",
          data: s,
          label: `Story ${s.storyId}: ${s.title}`,
          group: "User Stories",
        });
      }
    });

    // Search ADRs
    ADR_LIST.forEach((a) => {
      if (a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.cluster.toLowerCase().includes(q)) {
        matches.push({
          type: "adr",
          data: a,
          label: `ADR-${a.id}: ${a.title}`,
          group: "Architecture Decisions (ADR)",
        });
      }
    });

    // Search BRDs
    BRD_LIST.forEach((b) => {
      if (b.id.toLowerCase().includes(q) || b.title.toLowerCase().includes(q) || b.pillar.toLowerCase().includes(q)) {
        matches.push({
          type: "brd",
          data: b,
          label: `BRD-${b.id}: ${b.title}`,
          group: "Business Requirements (BRD)",
        });
      }
    });

    // Search FDDs
    FDD_LIST.forEach((f) => {
      if (f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)) {
        matches.push({
          type: "fdd",
          data: f,
          label: `FDD-${f.id}: ${f.title}`,
          group: "Functional Design Documents (FDD)",
        });
      }
    });

    // Search Open Questions
    OPEN_QUESTIONS_LIST.forEach((qItem) => {
      if (
        qItem.question.toLowerCase().includes(q) ||
        qItem.adrId.includes(q) ||
        qItem.adrTitle.toLowerCase().includes(q) ||
        qItem.category.toLowerCase().includes(q)
      ) {
        const adr = ADR_LIST.find((a) => a.id === qItem.adrId || a.id.padStart(4, "0") === qItem.adrId);
        if (adr) {
          matches.push({
            type: "adr",
            data: adr,
            label: `❓ ADR-${qItem.adrId} Question: ${qItem.question.slice(0, 70)}...`,
            group: "ADR Open Questions",
          });
        }
      }
    });

    return matches.slice(0, 25);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        const sel = results[selectedIndex];
        if (sel.kind === "CONTRACT" || sel.type === "contract") {
          onSelectItem(sel as any);
        } else {
          onSelectItem({ type: sel.type, data: sel.data } as DrawerItem);
        }
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[80vh] animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-200 bg-white">
          <svg
            className="h-5 w-5 text-slate-400 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-3.5 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder="Search across ADRs, BRDs, FDDs, User Stories, and Epics..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 flex-1 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No project artifacts matched &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.label}-${index}`}
                  onClick={() => {
                    if (item.kind === "CONTRACT" || item.type === "contract") {
                      onSelectItem(item as any);
                    } else {
                      onSelectItem({ type: item.type, data: item.data } as DrawerItem);
                    }
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-950 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 text-xs font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                      {item.type}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                    {item.group}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Navigate with <kbd className="px-1 py-0.5 bg-white border rounded text-[10px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 bg-white border rounded text-[10px] font-mono">↓</kbd></span>
            <span>Select with <kbd className="px-1 py-0.5 bg-white border rounded text-[10px] font-mono">↵</kbd></span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
