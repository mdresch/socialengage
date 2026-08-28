# FDD-0124: Data Export Posts CSV Sampling and Bounded Lookback

**Document Control**
- **Status:** Proposed
- **Date:** 2026-08-28
- **Source ADR:** ADR-0124 (Proposed 2026-08-28)

---

## 1. Technical Contract
GET /v1/posts/export.csv?start=...&end=...&sample=true
- Validates (end - start) <= 730 days (24 months). Returns 400 EXPORT_RANGE_TOO_LARGE on breach.
- When sample=true, executes fixed-stride sampling across the matched result set up to the synchronous row cap.
- Emits response header X-SocialEngage-Sampled: true.