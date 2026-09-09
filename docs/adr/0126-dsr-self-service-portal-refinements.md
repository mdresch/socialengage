# ADR-0126: DSR self-service portal refinements — Article 18 restriction flags and verified receipts

**Status:** Accepted (2026-08-28)

**Authorizes:** refinements to ADR-0093's Data Subject Request (DSR) portal: GDPR Article 18 restriction-of-processing flag propagation into active ingestion/search indexers, and cryptographically signed request confirmation receipts.

**Source:** docs/product-research/feature-designs/15-dsr-self-service-portal.md, 15-dsr-self-service-portal-deep-research.md

---

## Context
ADR-0093 authorized the DSR portal for access, rectification, and erasure. GDPR Article 18 mandates that when an author contests data accuracy or processing legality, processing must be restricted (quarantined from analytics and export) without immediate hard deletion.

## Decision
1. **Article 18 Processing Restriction:** Add processing_restricted boolean flag to social_posts table. When enabled, posts are excluded from analytics aggregations, search RAG retrieval, and exports while preserving the underlying row pending review.
2. **Cryptographic Confirmation Receipts:** The portal issues a signed receipt (HMAC-SHA256 containing { requestId, timestamp, subjectHash }) upon verified DSR submission.