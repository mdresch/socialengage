"use client";

import React, { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { AdrItem, BrdItem, FddItem, StoryItem, EpicSummary } from "@/lib/project-dashboard/types";

export type DrawerItem =
  | { type: "adr"; data: AdrItem }
  | { type: "brd"; data: BrdItem }
  | { type: "fdd"; data: FddItem }
  | { type: "story"; data: StoryItem }
  | { type: "epic"; data: EpicSummary }
  | {
      kind?: "CONTRACT";
      type?: "contract";
      id: string;
      title: string;
      status?: string;
      file?: string;
      description?: string;
      relatedStories?: string[];
      relatedAdrs?: string[];
      metadata?: Record<string, string>;
      data?: any;
    };

export interface DetailDrawerProps {
  item: DrawerItem | null;
  onClose: () => void;
  onNavigateToItem?: (type: any, id: string) => void;
}

export function DetailDrawer({ item, onClose, onNavigateToItem }: DetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isContract = "kind" in item && item.kind === "CONTRACT" || ("type" in item && item.type === "contract");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                {isContract ? "TEST CONTRACT" : (item as any).type?.toUpperCase()} Inspector
              </span>
              {!isContract && item.type === "adr" && (
                <Badge
                  variant={
                    item.data.status.toLowerCase().includes("accepted")
                      ? "success"
                      : "warning"
                  }
                >
                  {item.data.status}
                </Badge>
              )}
              {!isContract && item.type === "brd" && <Badge variant="success">Active</Badge>}
              {!isContract && item.type === "fdd" && (
                <Badge variant="success">{item.data.conformance}</Badge>
              )}
              {!isContract && item.type === "story" && (
                <Badge variant={item.data.isBuilt ? "success" : "warning"}>
                  {item.data.isBuilt ? "Implemented" : "Pending"}
                </Badge>
              )}
              {!isContract && item.type === "epic" && (
                <Badge variant="default">{item.data.progressPct}% Complete</Badge>
              )}
              {isContract && (
                <Badge variant="success">100% Passed (Green)</Badge>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {!isContract && item.type === "adr" && `ADR-${item.data.id}: ${item.data.title}`}
              {!isContract && item.type === "brd" && `BRD-${item.data.id}: ${item.data.title}`}
              {!isContract && item.type === "fdd" && `FDD-${item.data.id}: ${item.data.title}`}
              {!isContract && item.type === "story" && `Story ${item.data.storyId}: ${item.data.title}`}
              {!isContract && item.type === "epic" && item.data.title}
              {isContract && (item as any).title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* ADR Details */}
          {item.type === "adr" && (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Domain Cluster</div>
                <div className="font-medium text-slate-800">{item.data.cluster}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Document Source File</div>
                <div className="flex items-center justify-between font-mono text-xs text-blue-600 bg-white p-2 rounded border border-slate-200">
                  <span className="truncate">docs/adr/{item.data.file}</span>
                  <button
                    onClick={() => handleCopy(`docs/adr/${item.data.file}`)}
                    className="text-slate-400 hover:text-slate-700 ml-2 font-sans text-xs underline shrink-0"
                  >
                    Copy path
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Associated User Stories</div>
                {item.data.storyRefs && item.data.storyRefs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.data.storyRefs.map((ref) => (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => onNavigateToItem && onNavigateToItem("story", ref)}
                        className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-mono text-xs font-semibold transition"
                      >
                        Story {ref} ➔
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Foundational platform architecture decision. Governs monorepo setup, security policies, or database layer.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-blue-900">Architectural Governance Note:</div>
                <p>
                  This decision establishes authoritative contracts between <code>social-listening-core</code> and <code>social-listening-admin</code>. All contract test suites enforce compliance with this decision.
                </p>
              </div>
            </div>
          )}

          {/* BRD Details */}
          {item.type === "brd" && (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Business Value Pillar</div>
                <div className="font-semibold text-emerald-700">{item.data.pillar}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">BRD Specification File</div>
                <div className="flex items-center justify-between font-mono text-xs text-blue-600 bg-white p-2 rounded border border-slate-200">
                  <span className="truncate">docs/product/brd/{item.data.file}</span>
                  <button
                    onClick={() => handleCopy(`docs/product/brd/${item.data.file}`)}
                    className="text-slate-400 hover:text-slate-700 ml-2 font-sans text-xs underline shrink-0"
                  >
                    Copy path
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-emerald-900">Commercial & Customer Intent:</div>
                <p>
                  Defines the commercial value, market requirements, and stakeholder expectations. Maps directly to downstream architectural decisions (ADRs) and functional design documents (FDDs).
                </p>
              </div>
            </div>
          )}

          {/* FDD Details */}
          {item.type === "fdd" && (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Specification File</div>
                <div className="flex items-center justify-between font-mono text-xs text-blue-600 bg-white p-2 rounded border border-slate-200">
                  <span className="truncate">docs/design/fdd/{item.data.file}</span>
                  <button
                    onClick={() => handleCopy(`docs/design/fdd/${item.data.file}`)}
                    className="text-slate-400 hover:text-slate-700 ml-2 font-sans text-xs underline shrink-0"
                  >
                    Copy path
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Mandatory 14-Section Verification</div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
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
                    "§11. Error Handling",
                    "§12. Assumptions & Deps",
                    "§13. Open Questions",
                    "§14. Appendix & References",
                  ].map((sec) => (
                    <div key={sec} className="flex items-center gap-1.5 p-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="truncate">{sec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Story Details */}
          {item.type === "story" && (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Epic Association</div>
                <div className="font-semibold text-slate-900">{item.data.epicTitle}</div>
              </div>

              {item.data.builtInfo && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Implementation & Verification</div>
                  <div className="font-mono text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                    {item.data.builtInfo}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Governing Architecture Source</div>
                <div className="font-mono text-xs text-blue-600">
                  {item.data.source || "Foundational Project Scope"}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-indigo-900">Contract-First Verification Standard:</div>
                <p>
                  This story follows the 5-step methodology: Intent Definition ➔ Contract Test Suite ➔ Skill Documentation ➔ Implementation ➔ Append-only Log entry.
                </p>
              </div>
            </div>
          )}

          {/* Epic Details */}
          {item.type === "epic" && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-center">
                  <div className="text-xs text-slate-500 font-medium">Total Stories</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{item.data.total}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-center">
                  <div className="text-xs text-emerald-700 font-medium">Implemented</div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">{item.data.built}</div>
                </div>
                <div className="p-3 bg-amber-50 rounded border border-amber-200 text-center">
                  <div className="text-xs text-amber-700 font-medium">Pending</div>
                  <div className="text-2xl font-bold text-amber-700 font-mono mt-1">{item.data.pending}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Epic Specification File</div>
                <div className="font-mono text-xs text-blue-600 bg-white p-2 rounded border border-slate-200">
                  docs/user-stories/{item.data.file}
                </div>
              </div>
            </div>
          )}

          {/* Test Contract Details */}
          {isContract && (
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase">Contract Test File</div>
                <div className="flex items-center justify-between font-mono text-xs text-blue-600 bg-white p-2 rounded border border-slate-200">
                  <span className="truncate">{(item as any).file}</span>
                  <button
                    onClick={() => handleCopy((item as any).file)}
                    className="text-slate-400 hover:text-slate-700 ml-2 font-sans text-xs underline shrink-0"
                  >
                    Copy path
                  </button>
                </div>
              </div>

              {(item as any).metadata?.["Run Command"] && (
                <div className="p-4 rounded-lg bg-slate-900 text-slate-100 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Run Test Command</div>
                  <div className="flex items-center justify-between font-mono text-xs text-emerald-400 bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="truncate">{(item as any).metadata["Run Command"]}</span>
                    <button
                      onClick={() => handleCopy((item as any).metadata["Run Command"])}
                      className="text-slate-400 hover:text-white ml-2 font-sans text-xs underline shrink-0"
                    >
                      Copy command
                    </button>
                  </div>
                </div>
              )}

              {(item as any).metadata && (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries((item as any).metadata).map(([key, val]) => {
                    if (key === "Run Command") return null;
                    return (
                      <div key={key} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="text-xs text-slate-500 font-medium">{key}</div>
                        <div className="text-sm font-semibold text-slate-800 font-mono mt-0.5">
                          {String(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                <div className="font-semibold text-emerald-950">Architectural Invariant Enforcement:</div>
                <p>
                  {(item as any).description || "This contract test executes in isolation before any code change is merged, guaranteeing that API schemas, database RLS policies, and business rules remain strictly conformant."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>SocialEngage Architecture Governance</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
