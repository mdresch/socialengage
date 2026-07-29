# Stakeholder Register
### Social Listening & Engagement Platform

**Author:** Menno
**Date:** 28 July 2026
**Status:** Draft — v0.1 (solo project; register will expand if the project gains collaborators, users, or a sponsor)

---

> **Note:** given this is currently a solo project, several entries below are dependencies and future/indirect parties rather than traditional organisational stakeholders. This register should be revisited and expanded once real users, collaborators, or sponsors are involved.

## Register

| Stakeholder | Category | Role / Relationship | Interest / Stake | Influence | Engagement Level | Engagement Strategy |
|---|---|---|---|---|---|---|
| Menno | Internal | Sponsor, Product Owner, Sole Developer | Owns the vision, funds the project, builds and maintains the system | High | Lead | N/A — is the project |
| Future end users / tenants | External (future) | Prospective users of the platform once it exists | Reliable ingestion, accurate sentiment, trustworthy data handling | Low (currently) | Monitor | Revisit once Phase 1 is validated; gather feedback before Phase 2 scope decisions |
| Social platform providers (X, Reddit, YouTube, LinkedIn, Meta, RSS/newswire sources) | External | API/data providers each connector depends on | ToS compliance, fair use of their APIs, not being treated as a scraping target | High (can revoke access or change pricing/terms unilaterally) | Manage closely | Build each connector strictly against current published API terms; monitor for pricing/policy changes; design connectors to degrade gracefully if access changes |
| Microsoft Azure | External / Vendor | Cloud infrastructure provider (Postgres, Key Vault, Service Bus, AI Language) | Platform usage within service terms | Medium | Keep informed | Standard vendor relationship; monitor service health and pricing changes |
| AI enrichment providers (Azure AI Language now; OpenAI/Claude potential future) | External / Vendor | Sentiment/entity/key-phrase enrichment | API usage within terms | Medium | Keep informed | Connector abstraction already isolates this dependency — swappable if terms or pricing change |
| Data subjects (authors of ingested social posts) | External / Indirect | Individuals whose public posts are collected and analysed | Fair, lawful, privacy-respecting handling of their public data | Low (no direct relationship) but ethically significant | Monitor / respect by design | Retain only what's needed, respect platform ToS on data use, avoid resolving free-text location into precise geodata, no repurposing beyond stated listening/insights use |
| Future collaborators / team members | Internal (future, TBD) | Potential contributors if the project grows beyond solo scope | Clear architecture and documentation to onboard into | Low (currently) | Monitor | Design specs (like the Phase 1 design doc) double as onboarding material if this becomes a team effort |
