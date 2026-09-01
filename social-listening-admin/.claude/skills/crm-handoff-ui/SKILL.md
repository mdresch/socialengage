---
name: crm-handoff-ui
description: UI modal and BFF integration for escalating posts and prospecting leads to Microsoft Dynamics 365, Salesforce, and HubSpot.
---

# CRM Handoff UI

Governed by **ADR-0095**, **BRD-0095**, **FDD-0095**, and **Story 11.2**.

## Key Responsibilities

1. **`core-client.ts` CRM Integration**:
   - `pushCaseToCRM(id, payload)`: Dispatches `POST /v1/inbox/items/:id/case` to core.
   - `listCRMConnectors()`: Fetches active/available CRM connectors.
   - `listCRMFieldMappings()`, `upsertCRMFieldMapping()`, `deleteCRMFieldMapping()`: Manages custom field mappings.

2. **BFF Route Proxies**:
   - `/api/crm/push`: Proxies push requests to core with session auth.
   - `/api/crm/connectors`: Proxies connector status requests.
   - `/api/crm/field-mappings`: Proxies custom field mapping operations.

3. **`CRMHandoffModal.tsx`**:
   - Supports selecting provider (Dynamics 365, Salesforce, HubSpot).
   - Supports selecting entity target (`lead`, `opportunity`, `support`).
   - Surfaces `409 Conflict` duplicate alerts with existing CRM deep links and "Create duplicate anyway" (`allowDuplicate = true`) action.
   - Displays live clickable deep links upon successful creation.

4. **Integration Surfaces**:
   - `PostDetailPanel.tsx`: Post detail action button.
   - `ProspectingListDetailView.tsx`: Author lead escalation button.
