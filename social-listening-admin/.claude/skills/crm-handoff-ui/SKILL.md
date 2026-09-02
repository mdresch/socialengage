---
name: crm-handoff-ui
description: UI modal and BFF integration for escalating posts and prospecting leads to Microsoft Dynamics 365, Salesforce, and HubSpot.
---

# CRM Handoff UI

Governed by **ADR-0095**, **BRD-0095**, **FDD-0095**, **Story 11.2**, and **Story 13.14** (prospecting-list batch push).

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-11/story-11.2.case-handoff-ui.contract.test.ts` — Story 11.2 contract test.
- `social-listening-admin/contracts/epic-13/story-13.14.prospecting-export-and-crm-push-ui.contract.test.ts` — Story 13.14 contract test.

## Key Responsibilities

1. **`core-client.ts` CRM Integration**:
   - `pushCaseToCRM(id, payload)`: Dispatches `POST /v1/inbox/items/:id/case` to core.
   - `pushProspectingListToCrm(listId, payload)`: Dispatches `POST /v1/prospecting-lists/:id/crm-handoff` to core (Story 13.14).
   - `listCRMConnectors()`: Fetches active/available CRM connectors.
   - `listCRMFieldMappings()`, `upsertCRMFieldMapping()`, `deleteCRMFieldMapping()`: Manages custom field mappings.

2. **BFF Route Proxies**:
   - `/api/crm/push`: Proxies case push requests to core with session auth.
   - `/api/prospecting-lists/:id/crm-handoff`: Proxies prospecting-list batch push to core (Story 13.14).
   - `/api/crm/connectors`: Proxies connector status requests.
   - `/api/crm/field-mappings`: Proxies custom field mapping operations.

3. **`CRMHandoffModal.tsx`**:
   - Supports selecting provider (Dynamics 365, Salesforce, HubSpot).
   - Supports selecting entity target (`lead`, `opportunity`, `support`).
   - Surfaces `409 Conflict` duplicate alerts with existing CRM deep links and "Create duplicate anyway" (`allowDuplicate = true`) action.
   - Displays live clickable deep links upon successful creation.

4. **Integration Surfaces**:
   - `PostDetailPanel.tsx`: Post detail action button.
   - `ProspectingListDetailView.tsx`: Per-author lead escalation button and list-level **Push to CRM** action (Story 13.14).
   - `ProspectingListCrmPushModal.tsx`: Batch connector/entry selection and result display (Story 13.14).
