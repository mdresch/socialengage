---
name: mention-suggestions-ui
description: Frontend UI components and BFF routes for intelligent author mention suggestions in the social composer with 300ms debouncing and one-click insertion.
---

# Composed Post Mention Suggestions UI

Governed by **ADR-0100**, **BRD-0100**, **FDD-0100**, and **Story 11.12**.

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-11/story-11.12.mention-suggestions-ui.contract.test.ts` — Story 11.12 contract test.

## Architecture & Responsibilities

1. **Client & BFF**:
   - `core-client.ts`: `getMentionSuggestions(params)` calls `POST /v1/composer/mention-suggestions`.
   - `POST /api/composer/mention-suggestions`: same-origin proxy.

2. **Components**:
   - `MentionSuggestionsDropdown.tsx`:
     - Renders suggested author mention pills with source badges (`TOPIC`, `RAG`, `KEYWORD`), confidence, `@handle`, author name, and short reason.
     - Invokes `onSelectMention(handle)` to insert `@handle` into the composer draft.
   - `OutboundComposerModal.tsx`:
     - 300ms debounced trigger when `text` changes while target platforms are selected.
     - Inserts chosen mention tag at the cursor or appends to draft without duplicates.
