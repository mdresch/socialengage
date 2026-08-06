# Tenant-Admin Stakeholder Profile

## Purpose

This profile captures the requirements and concerns of the Tenant-Admin stakeholder for the Social Listening / Insights subsystem. It is intended to support requirements elicitation, story drafting, and design review by making the Tenant-Admin's needs explicit without implying that a real Tenant-Admin exists yet in the product.

## Stakeholder Type

- Role: Tenant-Admin
- Category: Future internal stakeholder (tenant-scoped administrator)
- Status: Not yet instantiated in production code; represented here as a requirements-facing persona for design and delivery planning
- Source basis: ADR-0031, ADR-0032, ADR-0034, ADR-0036, and the existing Epic 6 admin UI scope

## Core Responsibilities

A Tenant-Admin is responsible for operating a single tenant's configuration and administration within the platform. This includes:

- onboarding and managing tenant users within that tenant
- configuring tenant-scoped connectors and credentials
- creating and maintaining watchlists
- reviewing tenant-facing health and status information
- managing tenant-level settings without needing engineering support

## Primary Goals

A Tenant-Admin wants to:

- configure the tenant quickly and without friction
- understand the current state of connectors and ingestion health at a glance
- manage users, connectors, and watchlists safely within the tenant boundary
- trust that actions are scoped to the correct tenant and cannot accidentally affect another tenant
- recover from common operational issues without needing direct access to the database or code

## Key Concerns

### Setup and onboarding friction

The Tenant-Admin cares most about whether the tenant can be configured and trusted without requiring help from the platform owner or engineering team. Onboarding should feel straightforward, guided, and low-risk.

### Security and trust

The Tenant-Admin needs confidence that their actions are scoped correctly to their tenant and that platform-level or cross-tenant access is not accidentally exposed.

### Operational clarity

The Tenant-Admin needs clear visibility into connector health, watchlist status, and tenant-level configuration state so that issues can be identified quickly.

### Administrative efficiency

The Tenant-Admin wants repeatable, low-friction workflows for common administrative operations such as adding users, connecting providers, and managing watchlists.

## Requirements Implications

The Tenant-Admin stakeholder implies the following product expectations:

- tenant-scoped administrative screens should be clear and role-appropriate
- tenant-scoped actions should be constrained to the current tenant
- connector and watchlist management should be understandable without technical knowledge
- health and status views should be easy to interpret and actionable
- the system should avoid unnecessary steps, ambiguity, or hidden dependencies during setup

## Suggested Use in Requirements Work

Use this profile when drafting or reviewing:

- user stories for tenant-scoped administration
- UI flows for connector, watchlist, and user management
- authorization and tenant-isolation requirements
- onboarding and self-service setup flows

## Notes

This profile is a design-time stakeholder artifact, not a substitute for real user validation. It should be used to broaden coverage during requirements work, especially where no live Tenant-Admin currently exists in the system.
