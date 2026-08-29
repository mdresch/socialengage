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
- **Connector Capability Warnings**: Compares clauses in the current AST against target platforms' `ConnectorQueryCapabilities`. If a clause type is unsupported by any target platform, a warning banner is displayed prior to save.
- **Debug AST Preview**: Displays canonical JSON structure.

### 2. AST Utilities (`src/lib/watchlist-ast.ts`)
- `parseBooleanQueryToAst(raw: string): WatchlistAST`: Converts boolean query string into canonical AST.
- `astToBooleanQuery(ast: WatchlistAST): string`: Serializes AST into standardized boolean query string.
- `validateAstAgainstCapabilities(ast: WatchlistAST, capabilities: ConnectorQueryCapabilities[])`: Identifies unsupported clauses and formatting warnings.

### 3. Core API Client (`src/lib/core-client.ts`)
- `getConnectorQueryCapabilities(platformId: string)`: Retrieves supported clauses, operators, and limits for a specific connector from Core `/v1/connectors/:platformId/query-capabilities`.
- `Watchlist` and `CreateWatchlistInput` include optional `ast?: WatchlistAST`.

### 4. BFF Proxy Route (`src/app/api/connectors/[platformId]/query-capabilities/route.ts`)
- Same-origin proxy endpoint for browser components to query connector capabilities securely.

### 5. Watchlist Form (`src/app/tenant/watchlists/WatchlistForm.tsx`)
- Embeds `BooleanQueryBuilder` when `matchType === 'boolean'`.
- Transmits `ast` alongside `booleanQuery` in create and update operations.
- Intercepts and renders 422 `UNSUPPORTED_QUERY_CLAUSE` error feedback.
