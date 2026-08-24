# SocialEngage — Project Development Dashboard

Standalone Next.js 15/16 + Tailwind CSS + shadcn/ui-styled dashboard providing live engineering telemetry, architectural decisions, business requirements, functional design documents, and user story progress for the SocialEngage ecosystem.

---

## Features

- **📊 Executive Overview:** Real-time story completion rate (93.2%), 13-Epic progress meters, codebase volume distribution (82.6k LOC), and architecture boundary checklist.
- **🏛️ ADR Decision Matrix:** Interactive search and filters across all 119 Architecture Decision Records by status (*Accepted* vs *Proposed*) and domain cluster.
- **📋 Business Requirements (BRDs):** Full directory of 119 BRDs organized by 5 core value pillars with traceability.
- **📐 Functional Design Documents (FDDs):** Specification viewer highlighting 100% 14-section template conformance across all 119 FDDs.
- **🚀 User Stories Explorer:** Search and filter 206 user stories across Epics 1 through 13 by build status (*Implemented* vs *Pending*).
- **🔮 Projected Work & Backlog:** Forward-looking roadmap detailing immediate deliverables (Story 8.8 AI Spike Storyteller, Same-Domain Invite Assist), multi-instance distributed gate state, deep research agents, and downstream subsystem integrations.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3060](http://localhost:3060) in your browser to explore the dashboard.

### 3. Build for Production
```bash
npm run build
npm start
```

