# Tenant-User Stakeholder Profile

## Purpose

This profile captures the requirements and concerns of the Tenant-User stakeholder for the Social Listening / Insights subsystem. It is intended to support requirements elicitation, story drafting, and design review by making the Tenant-User's needs explicit without implying that a real Tenant-User exists yet in the product.

## Stakeholder Type

- Role: Tenant-User
- Category: Future internal stakeholder (tenant-scoped end user)
- Status: Not yet instantiated in production code; represented here as a requirements-facing persona for design and delivery planning
- Source basis: the stakeholder register, the future Tenant User persona, and the broader tenant-facing usage model of the platform

## Core Responsibilities

A Tenant-User consumes the platform's outputs as part of their role within a tenant. This includes:

- reviewing platform results and summaries
- reading analytics overviews for conversations, sentiment, location, and sources
- exploring social center views that organize posts by source
- using activity maps that visualize posts by location with live updates
- filtering live activity data by volume, sentiment, and reach
- participating in tenant-scoped workflows that rely on ingested and enriched data
- adding relevant connectors to social media platforms as the maintainer of those pages where access is granted
- connecting a personal social media page, a page where they are an admin, or a page that has been assigned to them by the Tenant-Admin
- deciding to remove their own personal social media content when they have that ownership or control
- deleting any page where they are the page admin, while not being able to delete pages that were assigned by the Tenant-Admin
- seeing the health status of their own connectors
- interacting with posts by replying to received posts
- sending on behalf of a managed page when the user is the admin of that page
- connecting to CRM systems and escalating a post to CRM when needed
- assigning a case manager to a post when required
- receiving access to a page post when that page has been assigned by the Tenant-Admin, so the Tenant-User can respond to it
- setting up new search topics, keywords, hashtags, boolean queries, and rules
- reviewing recent alerts and taking action when needed
- using Topic Center and Authors views to investigate topics and related authors
- using the platform to inform day-to-day decisions or operational activity
- interacting with tenant-specific content without managing the tenant itself

## Primary Goals

A Tenant-User wants to:

- use the platform with minimal effort and confusion
- understand what is being shown and why it matters
- trust the information presented to them
- act on relevant results without needing technical assistance
- maintain control over their own connected pages and personal social media content without affecting tenant-admin-assigned pages
- avoid unnecessary complexity in routine usage

## Key Concerns

### Usability and clarity

The Tenant-User cares most about whether the platform is easy to understand and use in everyday work. The experience should feel direct, relevant, and low-friction.

### Trust and confidence

The Tenant-User needs confidence that the information presented is accurate, timely, and meaningful enough to support action. If personal connectors to social media platforms are involved, they should work reliably and be understandable in the context of the broader tenant workflow, and the user should be able to see the health status of their own connectors. The user should also be able to interact with posts, including replying to received posts, sending on behalf of a page when they are the admin of that page, escalating a post to CRM when appropriate, assigning a case manager to a post when required, and responding to a post once that page has been assigned to them by the Tenant-Admin, in a clear and controlled way.

### Context and relevance

The Tenant-User needs enough context to interpret results correctly, including the source, recency, and scope of the information shown.

## Requirements Implications

The Tenant-User stakeholder implies the following product expectations:

- tenant-facing experiences should be clear, accessible, and easy to use
- information should be presented with sufficient context to support interpretation
- the platform should reduce cognitive load for routine users
- the experience should support trust, confidence, and straightforward action
- the user should be able to review analytics overviews for conversations, sentiment, location, and sources
- the user should be able to use social center and activity map views, including live activity maps with filters for volume, sentiment, and reach
- the user should be able to configure new search topics, keywords, hashtags, boolean logic, and rules
- the user should be able to review recent alerts and access Topic Center and Authors views
- personal connectors to social media platforms should be handled in a way that is consistent, reliable, and easy for the user to understand
- the system should allow the Tenant-User to connect a personal social media page, a page where they are an admin, or a page assigned by the Tenant-Admin
- the system should allow the Tenant-User to remove their own personal social media content and delete any page they administer, while preventing deletion of pages assigned by the Tenant-Admin
- connector health status should be visible to the user for their own connectors
- post interaction, including replying to received posts, sending on behalf of a managed page, escalating a post to CRM, assigning a case manager to a post, and responding to a page post once it has been assigned by the Tenant-Admin, should be supported in a reliable and understandable way
- the system should avoid exposing unnecessary technical detail to end users

## Suggested Use in Requirements Work

Use this profile when drafting or reviewing:

- end-user workflows and UI flows
- dashboard and summary presentation requirements
- tenant-facing usability and trust requirements
- everyday user interaction patterns

## Notes

This profile is a design-time stakeholder artifact, not a substitute for real user validation. It should be used to broaden coverage during requirements work, especially where no live Tenant-User currently exists in the system.
