# BRD-0123: Real-Time Alert Rules and Delivery Refinements

**Document Control**
- **Status:** Approved (2026-08-28)
- **Date:** 2026-08-28
- **Source ADR:** ADR-0123 (Proposed 2026-08-28)
- **Primary Stakeholders:** Tenant-Admin, Platform-Admin, SecOps

---

## 1. Executive Summary
This document defines the business requirements for refining real-time alert delivery rules, introducing rule-level noise exclusion, daily alert caps, sensitivity presets, and pre-save volume previewing to combat alert fatigue.

## 2. Business Objectives
- Reduce alert fatigue by up to 70% for high-volume brand watchlists.
- Provide intuitive sensitivity controls for non-technical administrators.
- Protect tenant webhook endpoints from runaway notification storms.

## 3. Scope & Requirements
- **BR-123.1 Noise Exclusions:** Allow administrators to specify excluded watchlists and topics per alert rule.
- **BR-123.2 Daily Volume Caps:** Enforce a configurable maximum alert trigger count per 24-hour window (default: 20).
- **BR-123.3 Sensitivity Presets:** Provide Low/Balanced/High sensitivity threshold multipliers in the alert configuration UI.
- **BR-123.4 Pre-Save Simulation:** Provide real-time historical volume simulation before committing alert rule thresholds.