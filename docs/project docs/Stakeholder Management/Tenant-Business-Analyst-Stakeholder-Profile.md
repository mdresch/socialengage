# Tenant-Business-Analyst Stakeholder Profile

## Purpose

This profile captures the requirements and concerns of the Tenant-Business-Analyst stakeholder for the Social Listening / Insights subsystem. It is intended to support requirements elicitation, story drafting, and design review by making the Tenant-Business-Analyst's needs explicit without implying that a real analyst exists yet in the product.

## Stakeholder Type

- Role: Tenant-Business-Analyst
- Category: Future internal stakeholder (tenant-scoped analyst)
- Status: Not yet instantiated in production code; represented here as a requirements-facing persona for design and delivery planning
- Source basis: the stakeholder register, the future Tenant User persona, and the existing data-access and API-oriented design direction

## Core Responsibilities

A Tenant-Business-Analyst works with ingested and enriched data to answer business questions. This includes:

- filtering and exploring data for analysis
- correlating platform signals with other business context
- exporting or querying data for reporting and investigation
- pushing the limits of the available API and query capabilities

## Primary Goals

A Tenant-Business-Analyst wants to:

- answer real analytical questions with the available data
- access data flexibly without unnecessary restrictions
- export or query results in a useful and reliable way
- trust that the data is complete enough for analysis
- avoid workarounds caused by missing or overly narrow capabilities

## Key Concerns

### Completeness and flexibility

The Tenant-Business-Analyst cares most about whether the platform can support genuine analysis rather than only basic browsing. They need the data model, query capabilities, and export options to be rich enough for real questions.

### Data quality and confidence

The analyst needs confidence that the dataset is complete, well-structured, and understandable enough to support reliable conclusions.

### Query and export capability

The analyst needs practical ways to retrieve, filter, and export relevant information for reporting, correlation, and deeper investigation.

## Requirements Implications

The Tenant-Business-Analyst stakeholder implies the following product expectations:

- query and filtering capabilities should support realistic analytical use cases
- exports and data retrieval should be usable and predictable
- APIs and data models should support meaningful correlation and exploration
- the system should avoid unnecessary constraints that block practical analysis
- results should be understandable enough to support reporting and decision support

## Suggested Use in Requirements Work

Use this profile when drafting or reviewing:

- API and query capability requirements
- export and reporting workflows
- data model and filtering requirements
- analytics-oriented user stories

## Notes

This profile is a design-time stakeholder artifact, not a substitute for real user validation. It should be used to broaden coverage during requirements work, especially where no live Tenant-Business-Analyst currently exists in the system.
