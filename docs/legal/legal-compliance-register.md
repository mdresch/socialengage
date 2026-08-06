# Legal & Compliance Register

**Maintained by:** the Legal & Compliance Reviewer role (OpenAI `gpt-5.2`, via Azure AI Foundry/Sweden Central — `docs/project docs/Stakeholder-Register.md` S-22), per `docs/ai-roles/legal-compliance-reviewer.md`. External, episodic, human-mediated — Menno runs the invocation (manual paste, or a future `invoke-azure-foundry-agent.mjs --register` once that script exists — not yet built, see the charter's own Status section) and reviews/commits whatever gets appended here, the same as every other AI-role output in this project. This file is never edited by the reviewer's own hand outside that process; Menno may edit it directly at any time (e.g. to mark a finding Resolved).

**Convention:** append-only, same discipline as `docs/implementation-log.md` and `docs/security/security-register.md`. A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — <one-line summary> — reviewed <material: diff / file / ADR>`, then the reviewer's numbered findings in the charter's own Output format (exposure/regime affected, current treatment, concrete consequence, what closing it would require), then (added later, separately, by Menno or a follow-up review) a Resolution note when a finding is closed.*

1) **Exposure / regime:** GDPR Art. 5(1)(a) fairness/transparency; Art. 6 lawful basis; ePrivacy/US state privacy analogs (CPRA “sharing”/“sale” risk depending on terms).  
   **Current treatment in ADR-0038 (based on what you provided):** **Unaddressed** (the material states the transfer to third-party AI providers, but does not evidence lawful basis selection or notice/opt-out mechanics).  
   **Concrete consequence if unaddressed:** A data subject (or regulator) can credibly allege unlawful disclosure to a third party and insufficient transparency (privacy notice doesn’t clearly disclose categories of recipients/purpose), plus potential “sharing” classification under US state privacy regimes if enrichment provider uses data for its own purposes.  
   **What closing it would require (in prose):** Explicitly pin down controller/processor roles and pick a defensible lawful basis for sending post content off-platform for sentiment enrichment; ensure tenant-level contract terms require tenants to represent they have rights to process/share the content; update customer-facing disclosures so “third-party AI enrichment” is clearly described (categories of providers, purposes, and whether providers can use data for model training), and implement region/tenant-specific opt-outs where required.

2) **Exposure / regime:** GDPR Art. 28 processor requirements; onward-subprocessor controls; auditability and “documented instructions.”  
   **Current treatment:** **Unaddressed** (no mention of DPAs, subprocessor terms, or restrictions on provider re-use).  
   **Concrete consequence:** If SocialEngage is a processor for its tenants, sending content to an enrichment provider without a compliant Art. 28 arrangement (or without tenant authorization for subprocessors) is a direct compliance failure. Tenants can also terminate for breach, and regulators can treat this as uncontrolled onward processing.  
   **What closing would require:** A defensible processor/subprocessor chain: written DPAs with enrichment providers (confidentiality, security measures, deletion/return, assistance with DSARs, audit rights), a published/managed subprocessor list, and tenant contractual controls/consent for subprocessors (including change notification and objection process).

3) **Exposure / regime:** Cross-border transfer risk (GDPR Chapter V) if providers process outside the EEA/UK or involve non-adequate jurisdictions; also data localization expectations from enterprise customers.  
   **Current treatment:** **Unaddressed.**  
   **Concrete consequence:** Transfers to the US or other non-adequate jurisdictions without SCCs + transfer impact assessment (TIA) creates a straightforward Chapter V exposure; enterprise deals can be blocked on this alone.  
   **What closing would require:** Identify processing locations for each provider, execute SCCs (and UK IDTA/addendum where relevant), perform and retain TIAs, and implement technical/organizational supplementary measures where necessary (encryption in transit, strict access controls, minimization, and ideally regional processing options).

4) **Exposure / regime:** GDPR Art. 5(1)(c) data minimization; Art. 25 privacy by design/default; confidentiality/security (Art. 32).  
   **Current treatment:** **Unaddressed** (no indication you’re minimizing what’s sent, or that you’re stripping identifiers/tenant secrets).  
   **Concrete consequence:** You can be faulted for sending full raw post bodies (which may contain usernames, emails, phone numbers, or internal customer identifiers) when sentiment can often be computed on redacted text. This increases breach impact and “unnecessary disclosure” claims.  
   **What closing would require:** A documented minimization strategy: only send the minimum fields needed for sentiment, redact obvious PII and tenant-specific secrets, consider hashing/pseudonymizing IDs, and ensure per-tenant isolation (no accidental commingling) at the integration boundary.

5) **Exposure / regime:** Special category data (GDPR Art. 9) and criminal offense data (Art. 10) potentially present in “post content”; plus children’s data in some contexts.  
   **Current treatment:** **Unaddressed** (ADR statement doesn’t carve out sensitive content or define handling).  
   **Concrete consequence:** If posts include political opinions, health info, religious beliefs, etc., you may be transmitting special category data to a provider without a valid Art. 9 condition and without heightened safeguards—an acute regulatory risk.  
   **What closing would require:** Either (a) implement robust filtering/redaction to avoid transferring special category data where not strictly necessary, or (b) explicitly define conditions and safeguards for processing where it is necessary (which will also require tenant-side representations and stronger contractual controls with providers).

6) **Exposure / regime:** Data subject rights—erasure and portability in particular (GDPR Art. 17/20), plus Art. 19 notification obligations and Art. 30 recordkeeping.  
   **Current treatment:** **Deferred / effectively unaddressed** in the broader project context you’ve already documented: tenant offboarding/erasure has been repeatedly named as out-of-scope in prior ADRs, and this new outbound sharing makes the gap worse.  
   **Concrete consequence:** Even if you delete locally, data may persist at enrichment providers (and/or in their logs/backups). A DSAR/erasure request can fail in practice because you cannot propagate deletion to all recipients—an Art. 17 compliance failure a regulator can understand immediately.  
   **What closing would require:** End-to-end “deletion propagation” capability and evidence: a way to identify what was sent to which provider, mechanisms/contractual rights to delete/return it, and a verifiable process to execute and log those deletions. This ties directly into the still-open tenant offboarding/right-to-erasure gap you’ve already flagged across ADR-0018/0031/0039.

7) **Exposure / regime:** Purpose limitation + secondary use/model training by providers (GDPR Art. 5(1)(b)); trade secret/confidential information leakage.  
   **Current treatment:** **Unaddressed** (no constraints stated on provider training/retention).  
   **Concrete consequence:** If a provider uses content to improve its models, that is a secondary purpose that may be incompatible with the original purpose and could violate both privacy law expectations and tenant confidentiality. It also raises reputational risk (“we sent customer content to train third-party AI”).  
   **What closing would require:** Hard contractual prohibitions or tightly scoped permissions around retention and model training, plus technical controls (don’t send unnecessary context; segregate per-tenant; consider providers that offer “no training, short retention” guarantees). Also ensure tenant-facing disclosures align with the reality.

8) **Exposure / regime:** Profiling/automated processing (GDPR Art. 22) and transparency about “meaningful information about the logic involved” (Arts. 13–15), depending on how sentiment scores are used (ranking, moderation, alerting, customer decisions).  
   **Current treatment:** **Unaddressed** (we only know sentiment enrichment occurs).  
   **Concrete consequence:** If sentiment is used to make or materially influence decisions about individuals (even indirectly, e.g., prioritizing responses, escalation workflows), you can trigger profiling transparency obligations and potential Art. 22 constraints.  
   **What closing would require:** Clarify and document how sentiment outputs are used, ensure human-in-the-loop where appropriate, provide tenant/admin explainability artifacts (at least at a high level), and ensure DSAR responses can describe the existence and purpose of the enrichment.

9) **Exposure / regime:** Impersonation/misinformation amplification risk (platform liability/consumer protection + contractual risk), if enriched sentiment is presented as authoritative truth.  
   **Current treatment:** **Unaddressed.**  
   **Concrete consequence:** If users treat “AI sentiment” as factual and it misclassifies content (e.g., flags legitimate speech as “negative” or “abusive”), you can create downstream harm and disputes (especially for brand monitoring, moderation, or crisis response). This becomes a legal/commercial risk even if not strictly “GDPR.”  
   **What closing would require:** Clear labeling and limitations of AI outputs, and governance around when AI sentiment can trigger actions vs. when it is advisory—plus logging of enrichment provider/version to defend disputes.

**Net compliance posture from the provided material:** ADR-0038 as described creates a *new* outward data disclosure surface area while the project’s already-known deletion/offboarding/right-to-erasure gap remains unresolved. That’s not just “documentation debt”; it is compounding, practical inability to comply with deletion/DSAR obligations once data is replicated into third-party systems.