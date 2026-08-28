# BRD-0135: Preconfigured Analytics Views Refinements

**Status:** Proposed (2026-08-28)
**Source:** ADR-0135

## Requirements
- BR-135.1 Mandatory Postgres Row-Level Security (RLS) enforcement on all daily aggregate rollups.
- BR-135.2 Prohibits literal database MATERIALIZED VIEW DDL in favor of RLS-protected physical tables refreshed by worker.