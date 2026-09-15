---
title: "ADR-0142: Vault Ontological Topic Enrichment and Web Research Pipeline"
artifact_id: "ADR-0142"
entity_id: "23cbfa3247069c78199db3e1b92bb379"
version: "1.0.0"
source_document: "docs/adr/0142-vault-ontological-topic-enrichment-and-web-research-pipeline.md"
created_at: "2026-09-05T10:05:00.000Z"
modified_at: "2026-09-05T10:05:00.000Z"
authority_level: 2
confidence_score: 1.0
type: "adr"
pm_class: "GovernanceArtifact"
pm_subclass: "ArchitectureDecision"
pm_relationships:
  - governedBy
  - constrainedBy
  - compliesWith
  - influences
domain_cluster: "AI, NLP & Semantic Enrichment"
dmbok_category: "Metadata Management"
pmbok_category: "Quality Management"
babok_category: "Requirements Analysis & Design Definition (RADD)"
status: "Accepted"
aliases:
  - "ADR-0142"
  - "ADR 0142"
  - "Vault Ontological Topic Enrichment and Web Research Pipeline"
tags:
  - ADR
  - adr
  - domain/ai-nlp-semantic-enrichment
  - dmbok/metadata-management
  - pmbok/quality-management
  - babok/requirements-analysis-design-definition-radd
  - project/socialengage
  - ontology
  - enrichment
  - research
topics:
  - ontology
  - enrichment
  - websearch
  - validation
  - graphrag
  - discovery
  - groundtruth
  - linter
consequences:
  - Contextualizes internal decisions and user stories with external global consensus, frameworks, and metrics.
  - Reuses tenant-scoped search infrastructure (Brave/Bing connectors) and Azure OpenAI, adhering to zero-intermediation (ADR-0027).
  - Eliminates hallucination risk by decoupling generative extraction from a deterministic code linter and an adversarial decision auditor.
  - Automatically enriches MOC hubs (e.g. MOC - DMBOK - Data Governance) with authoritative atomic concept notes.
concept_grounding: "[[Concept-ai-nlp-semantic-enrichment|Concept: AI, NLP & Semantic Enrichment]]"
---
> [!NOTE] 🔗 **Conceptual & Standards Grounding**
> - 🧠 **Governing Enterprise Concept:** [[Concept-ai-nlp-semantic-enrichment|Concept: AI, NLP & Semantic Enrichment]] *(Aligned with DMBOK2, TOGAF & NIST)*



# ADR-0142: Vault Ontological Topic Enrichment and Web Research Pipeline

**Status:** Accepted (2026-09-05)

**Context:**  
The Second Brain vault functions as an active compiled knowledge graph governed by `ONTOLOGY.json` and `PROJECT-MANAGEMENT-ONTOLOGY.json`. While it tracks internal architecture decisions, user stories, and telemetry, high-level topics (e.g., *Data Governance*, *Aspect-Based Sentiment Analysis*, *Rate Limiting Token Bucket*) frequently exist only as isolated frontmatter tags or MOC links without formal definitions, production best practices, or quantitative benchmarks. Furthermore, static graphs suffer from semantic drift when disconnected from evolving industry standards.

**Decision:**  
Authorizes the **Ontological Topic Enrichment & Web Research Engine** (`socialengage/scripts/enrich-brain-topics.mjs`) operating under a 6-stage lifecycle:

1. **Discovery & Gap Prioritization**: Scans `topics: [...]` across `wiki/` and MOC hubs (`wiki/_MOCs/`) to detect un-synthesized topics. Ranks candidates by incoming backlink density and MOC presence (Priority 1: MOC stubs / $\ge 5$ backlinks).
2. **5-Facet Disambiguated Query Formulation**: Builds structured queries grounded in the topic's domain cluster and connected ADRs:
   - Definitional & Ontological boundaries.
   - Modern Industry Best Practices (2025/2026 production consensus).
   - Enterprise Framework Alignment (DMBOK, TOGAF, NIST, ISO/IEC).
   - Known Anti-Patterns & Operational Pitfalls.
   - Quantitative Metrics, SLOs & KPIs.
3. **Tenant-Scoped Search & Authority Scoring**: Queries the tenant's connected Brave Search and Bing Search connectors (`searchForResearch()`, per ADR-0076) using tenant credentials from `platform_credentials`. Enforces domain authority whitelisting (Tier-1 standards bodies, IEEE, ACM, Martin Fowler, official cloud architecture centers).
4. **Decoupled Architecture & Dual-Validation**: Rejects self-validation in a single LLM prompt. Splits execution into:
   - *Generator / Researcher*: Generative LLM extraction of candidate principles and metrics.
   - *Deterministic Code Linter*: Pure JavaScript validation enforcing `ONTOLOGY.json` schema rules and `allowedKeys`.
   - *Adversarial Decision Auditor*: Independent zero-temperature pass comparing proposed practices against accepted ADRs. Any contradiction (e.g. centralized caching vs. ADR-0027 zero-intermediation) is formatted as an explicit `> [!WARNING]` design trade-off rather than overwriting internal constraints.
5. **Vault Ingestion & MOC Recompilation**: Emits canonical atomic notes into `wiki/Projects/SocialEngage/06 Synthesis & Lessons Learned/Concept-<Topic>.md`, updates parent MOC hubs, and establishes bidirectional semantic relations (`groundedIn`, `compliesWith`).
6. **Maintenance & Self-Healing**: Integrated as Step 4b into `heal-obsidian-brain.mjs` with a 180-day staleness TTL and ADPA/ECS human review gates (`authority_level: 1` $\to$ `authority_level: 2`).

---

## Related Documentation
- [[wiki/System/Ontological-Topic-Enrichment-and-Web-Research-Engine|Ontological Topic Enrichment & Web-Searched Knowledge Engine Specification]]
- [[wiki/System/Compilation-and-Ingestion-Protocols|Compilation and Ingestion Protocols]]
- [[ONTOLOGY.json|Canonical Machine-Readable Ontology Schema]]
- [[Projects/SocialEngage/01 Architecture Decisions (ADR)/0076-composer-deep-research-agent|ADR-0076: Composer Deep Research Agent]]
- [[Projects/SocialEngage/01 Architecture Decisions (ADR)/0027-tenant-credential-storage|ADR-0027: Tenant Credential Storage]]
