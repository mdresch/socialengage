---
name: boolean-query-visual-builder
description: Boolean query visual builder component, AST schema, and platform query capability validation in admin UI
---

# Boolean Query Visual Builder (ADR-0102)

## Overview

Story 12.4 (ADR-0102, BRD-0102, FDD-0102) introduces `BooleanQueryBuilder.tsx` in `social-listening-admin`. It provides a visual query builder for constructing `WatchlistAST` queries across social and news ingestion platforms, supporting guided clause assembly, editable advanced text mode, and per-connector capability checking.

## Components & Architecture

### 1. `BooleanQueryBuilder` (`src/components/watchlists/BooleanQueryBuilder.tsx`)
- **Mode Toggle**: Guided Mode (visual block tree) vs. Advanced Mode (editable boolean query text with real-time AST synchronization).
- **Operators**: Root and nested group operators (`AND`, `OR`, `NOT`) pairing color badges with explicit text and icons.
- **Clause Types**:
  - `keyword`: single keyword term.
  - `phrase`: quoted multi-word phrase.
  - `hashtag`: `#hashtag` string.
  - `mention`: `@account` mention.
  - `author`: author external ID or username.
  - `source`: platform or publication provider ID.
  - `sentiment`: `positive` | `negative` | `neutral`.
  - `date`: relative or exact ISO date with operator (`>=`, `<=`, `=`, `>`, `<`).
  - `nested`: sub-group with its own operator and clause list.
- **Connector Capability Warnings**: Compares clauses in the current AST against target platforms' `ConnectorQueryCapabilities`. Story 13.3 (ADR-0110) adds per-clause warning chips with platform-specific `title` tooltips, and reports `hasErrors` separately from `hasWarnings` via `onValidationChange`.
- **Per-Clause Warning Chips & Tooltips**: Story 13.3 highlights each clause the selected connector(s) cannot translate natively and shows a `title` tooltip explaining the limitation and that fallback matching still applies.
- **Error vs. Warning Distinction**: `BooleanQueryBuilder` computes `hasErrors` (limit violations) and `hasWarnings` (unsupported clauses) separately and calls `onValidationChange({ hasErrors, hasWarnings })`.
- **Debug AST Preview**: Displays canonical JSON structure.

### 2. AST Utilities (`src/lib/watchlist-ast.ts`)
- `parseBooleanQueryToAst(raw: string): WatchlistAST`: Converts boolean query string into canonical AST.
- `astToBooleanQuery(ast: WatchlistAST): string`: Serializes AST into standardized boolean query string.
- `validateAstAgainstCapabilities(ast: WatchlistAST, capabilities: ConnectorQueryCapabilities[])`: Identifies unsupported clauses and formatting warnings (aggregate warning list).
- `getWarningsByClausePath(ast: WatchlistAST, capabilities: ConnectorQueryCapabilities[])`: Returns a map of clause path (`root.clauses.N`, `root.clauses.N.clauses.M`, etc.) to per-platform warnings. Used to highlight individual clause rows and render tooltips.
- `validateAstQueryLimits(ast: WatchlistAST, capabilities: ConnectorQueryCapabilities[])`: Returns `TOO_MANY_CLAUSES` / `QUERY_TOO_LONG` errors. These are treated as errors, not warnings, by `BooleanQueryBuilder`.
- `countClauses(ast: WatchlistAST)`: Counts all clause nodes recursively.

### 3. Core API Client (`src/lib/core-client.ts`)
- `getConnectorQueryCapabilities(platformId: string)`: Retrieves supported clauses, operators, and limits for a specific connector from Core `/v1/connectors/:platformId/query-capabilities`.
- `Watchlist` and `CreateWatchlistInput` include optional `ast?: WatchlistAST`.

### 4. BFF Proxy Route (`src/app/api/connectors/[platformId]/query-capabilities/route.ts`)
- Same-origin proxy endpoint for browser components to query connector capabilities securely.

### 5. Watchlist Form (`src/app/tenant/watchlists/WatchlistForm.tsx`)
- Embeds `BooleanQueryBuilder` when `matchType === 'boolean'` and passes `selectedPlatformIds={platformIds}`.
- Receives `onValidationChange` from `BooleanQueryBuilder` and disables the save button only when `hasErrors` is true (query-limit errors), not for unsupported-clause warnings.
- Transmits `ast` alongside `booleanQuery` in create and update operations.
- Intercepts and renders 422 `UNSUPPORTED_QUERY_CLAUSE` error feedback.
