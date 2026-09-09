# Technical Design Specification (TDS) — RAG UI/UX & Loading Patterns Refinements

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0140: RAG UI/UX & Loading Patterns Refinements — Frame-Aligned SSE Stream Draining & Interactive Citation Locks |
| **Document ID** | `TDS-0140` |
| **Feature Name** | High-Framerate Token Stream Buffer, Citation Popover Locking & Accessible Live Regions |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-admin/.claude/skills/admin-ui/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0140` | [ADR-0140: RAG UI/UX and Loading Patterns — Streaming Refinements](../../adr/0140-rag-ui-ux-and-loading-patterns-refinements.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0140` | [BRD-0140: RAG UI/UX And Loading Patterns Refinements](../Business-Requirements/BRD-0140-RAG-UI-UX-And-Loading-Patterns-Refinements.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0140` | [FDD-0140: RAG UI/UX And Loading Patterns Refinements](../Functional-Design/FDD-0140-RAG-UI-UX-And-Loading-Patterns-Refinements.md) | Fully Aligned |
| **Governing User Story** | `Story 19.5` | [Epic 19: ADRs 0136–0140](../../user-stories/epic-19-adr-0136-to-0140.md#story-195--rag-uiux-streaming-and-citation-popover-refinements-frontend) | Acceptance Target |
| **Related User Stories** | `Story 9.11`, `Story 19.4` | Baseline RAG UI, Namespace Search Resolution | Architectural Lineage |
| **Related Architecture Decisions** | `ADR-0085`, `ADR-0136`, `ADR-0139` | Base RAG UI, Namespace Isolation, Query Resolution | System Architecture |
| **Executable Contract Tests** | `Story 19.5 Contract` | `social-listening-admin/contracts/epic-19/story-19.5.rag-ui-refinements.contract.test.ts` | Ready for Suite Execution |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph StreamSource["Server-Sent Events Stream"]
        SSEPipe["SSE EventSource (/api/rag/ask?stream=true)"]
    end

    subgraph ClientPipeline["social-listening-admin UI Engine"]
        TokenBuffer["RAF Token Buffer (Batched at 60fps)"]
        StreamView["RAGAskStreamingView (Smooth Typewriter)"]
        CitationManager["Citation Lock Controller (Persistent Popover State)"]
        LiveRegion["ARIA Live Region Manager (Screen Reader Milestones)"]
    end

    subgraph UIComponents["Rendered Discovery Interface"]
        MarkdownView["Markdown Answer Container"]
        CitationPopover["Locked Citation Popover Modal"]
        CitationsRail["RAGCitationsRail (Auto-Scroll with Glow Accent)"]
    end

    SSEPipe -->|event: delta| TokenBuffer
    TokenBuffer -->|requestAnimationFrame| StreamView
    StreamView --> MarkdownView

    MarkdownView -->|Click [^1] Citation Pill| CitationManager
    CitationManager -->|Lock Active Popover| CitationPopover
    CitationManager -->|Highlight & Scroll| CitationsRail

    SSEPipe -->|event: done| LiveRegion
```

### 2.2 Architectural Boundaries & Invariants
- **Frame-Aligned Stream Draining:** To eliminate UI stuttering during high-velocity token generation ($> 60\text{ tokens/sec}$), incoming `delta` text chunks are buffered in a queue and flushed synchronously using `window.requestAnimationFrame`. This prevents DOM layout thrashing and ensures smooth 60fps rendering.
- **Interactive Citation Lock Invariant:** Clicking an inline citation pill (`[^1]`) explicitly locks the popover in the DOM. Background streaming and markdown updates are forbidden from unmounting, closing, or re-rendering the active popover while locked.
- **Auto-Scroll & Accent Glow:** Hovering or clicking a citation pill triggers smooth scroll alignment to the corresponding card in `RAGCitationsRail`, decorating the card with a temporary high-contrast glow border.
- **Screen Reader Accessibility:** Delta tokens are marked `aria-hidden="true"` during typewriter streaming. Upon `event: done`, an `aria-live="polite"` container announces: *"AI generation complete with N supporting citations. Confidence: high."*

---

## 3. Data Architecture & Persistence Design

### 3.1 Refined UI State Interfaces
`social-listening-admin/src/features/discovery/types.ts`:
```typescript
export interface LockedCitationState {
  citationIndex: number;
  isLocked: boolean;
  anchorElement: HTMLElement | null;
}

export interface StreamBufferState {
  pendingTokens: string[];
  renderedLength: number;
  isFlushing: boolean;
}
```

---

## 4. Application Logic & Workflows

### 4.1 High-Framerate RAF Buffer Hook (`useTokenStreamBuffer.ts`)
```typescript
export function useTokenStreamBuffer() {
  const [displayText, setDisplayText] = useState('');
  const tokenQueue = useRef<string[]>([]);
  const rafHandle = useRef<number | null>(null);

  const flushQueue = () => {
    if (tokenQueue.current.length > 0) {
      const chunk = tokenQueue.current.join('');
      tokenQueue.current = [];
      setDisplayText(prev => prev + chunk);
    }
    rafHandle.current = null;
  };

  const pushToken = (token: string) => {
    tokenQueue.current.push(token);
    if (!rafHandle.current) {
      rafHandle.current = requestAnimationFrame(flushQueue);
    }
  };

  const resetBuffer = () => {
    if (rafHandle.current) cancelAnimationFrame(rafHandle.current);
    tokenQueue.current = [];
    setDisplayText('');
    rafHandle.current = null;
  };

  return { displayText, pushToken, resetBuffer };
}
```

---

## 5. Interface & API Contracts

### 5.1 Component Interaction States
| Interaction Event | Component Reaction | State Transition |
|---|---|---|
| `event: delta` | Queued in RAF buffer | Drained at 60fps |
| Click `[^N]` Pill | Locks Popover & highlights Rail card | `lockedCitation = N`, `isLocked = true` |
| Click Outside Popover | Dismisses locked popover | `lockedCitation = null` |
| `event: done` | Triggers ARIA live region announcement | `streamStatus = 'completed'` |

---

## 6. Security, Tenancy & Isolation Model
- **DOM Injection Protection:** Content within locked citation popovers is rendered strictly via sanitized text nodes, neutralizing stored XSS vectors in crawled web citations.

---

## 7. Performance, Scalability & Resource Caps
- **Render Budget:** `requestAnimationFrame` bounding limits React state mutations to at most one render per display refresh cycle (16.6ms at 60Hz).

---

## 8. Resilience, Recovery & Failure Semantics
- **Clean Animation Teardown:** Hook unmounting immediately cancels active `requestAnimationFrame` callbacks to prevent detached DOM memory leaks.

---

## 9. Observability, Telemetry & Auditability
- **Client Telemetry:**
  - `rag_ui_popover_locked_total{citation_index}`
  - `rag_ui_token_buffer_max_depth_gauge`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Compatibility:** Drop-in refinement to `RAGAskPanel.tsx` without changing upstream backend contracts.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-admin/contracts/epic-19/story-19.5.rag-ui-refinements.contract.test.ts`:
  - (1) Confirms RAF token buffer prevents sub-frame React re-renders.
  - (2) Proves clicking citation pill locks popover during ongoing stream.
  - (3) Verifies screen reader live region announcement upon stream completion.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0140-1]** **Multi-Citation Split View:** Allowing users to lock multiple citation popovers side-by-side for comparative evidence analysis.
