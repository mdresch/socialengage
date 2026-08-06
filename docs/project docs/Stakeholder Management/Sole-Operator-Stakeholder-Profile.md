# Sole-Operator Stakeholder Profile

## Purpose

This profile captures the requirements and concerns of the Sole-Operator stakeholder for the Social Listening / Insights subsystem. It is intended to support requirements elicitation, story drafting, and design review by making the Sole-Operator's needs explicit in a project context where this role is exercised by the single active project owner.

## Stakeholder Type

- Role: Sole-Operator
- Category: Internal stakeholder (single operator / project owner)
- Status: Actively instantiated in practice; the role is currently exercised by Menno
- Source basis: the stakeholder register, the Project Charter, and the implementation and operations model used by the project

## Core Responsibilities

The Sole-Operator is responsible for keeping the platform operational and sustainable. This includes:

- operating the deployed platform and its supporting services
- maintaining security posture and operational integrity
- managing costs, capacity, and operational risk
- responding to incidents and keeping the system running
- ensuring that changes remain aligned with project scope and governance

## Primary Goals

The Sole-Operator wants to:

- keep the system reliable and available
- maintain a manageable operational burden
- prevent avoidable failures and escalations
- preserve enough clarity to recover and continue work if interruptions occur
- balance delivery speed with operational discipline

## Key Concerns

### Operational resilience

The Sole-Operator cares most about whether the system can run safely and recover gracefully from failure. Reliability, observability, and clear recovery paths are essential.

### Scope discipline

The Sole-Operator needs to avoid overbuilding or overcommitting, especially in a solo, self-funded context where operational load matters.

### Cost and sustainability

The Sole-Operator needs visibility into the platform's ongoing operational cost and performance so that the system can remain maintainable over time.

## Requirements Implications

The Sole-Operator stakeholder implies the following product expectations:

- operational tooling should support monitoring, incident awareness, and recovery
- the system should expose health and status details useful for day-to-day operation
- administrative and operational workflows should be practical for a single operator
- the platform should support clear boundaries between development, administration, and runtime operation
- the system should remain maintainable without introducing unnecessary complexity

## Suggested Use in Requirements Work

Use this profile when drafting or reviewing:

- operations, monitoring, and reliability requirements
- admin and maintenance workflows
- cost and capacity-related requirements
- platform governance and operational controls

## Notes

This profile reflects the current operational reality of the project: one person is acting as Sponsor, Product Owner, developer, tester, and operator. It should be used to preserve operational clarity and avoid accidental overextension.
