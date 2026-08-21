# Spark Capture: AI Provider/Model Agnosticism, Bring-Your-Own-Key, and Task-Based Routing

**Captured Date:** 12 August 2026
**Originator:** Menno, prompted by a live question while testing Story 6.16 ("both AI connectors are active, which one enriches?")
**Status:** Brainstorm — raw material for an ADR, not a decision yet. Intentionally loose; the practical design and the ADR itself get worked out together, in place, the same way ADR-0051 went through seven live revisions before acceptance.

---

## 0. This isn't a new idea — it's the original one, made concrete

The very first [Spark Capture](Spark-Capture.md) (31 July 2026) already named this directly, in the second sentence of the Big Idea: *"Every AI enrichment provider (sentiment, entities) is swappable too."* What's captured below is what actually implementing that promise requires, now that there are two real `AIProviderConnector`s built and Menno has hit the real, concrete question — *which one runs, and why don't I get to decide?* — that the original one-line aspiration never had to answer.

## 1. What prompted this, stated plainly

Today (`enrichPost.ts`):
- `PROVIDERS = [azureAiLanguageConnector, azureOpenAiConnector]` is a **fixed array in code**. Whichever provider has a credential *and* is active wins, in that literal order — Azure AI Language always beats Azure OpenAI if both are connected. Confirmed directly this session: no ADR or story ever actually decided this as policy; it's an artifact of which connector got built first.
- There is exactly **one task** ("enrich this post's text") and **one model per provider** — Azure AI Language has no model concept at all (one fixed capability set, versioned only by a hardcoded API date); Azure OpenAI's model *is* already tenant-configurable (the `deployment` field in the tenant's own stored credential), just never surfaced as a real "choose your model" experience anywhere.
- Bring-your-own-key **already exists as a real, Accepted principle** — ADR-0027/ADR-0028 already established "tenant holds their own account/credential, SocialEngage is a technical intermediary only," and it already applies to AI providers exactly like any other connector. What's missing isn't BYOK itself — it's everything *around* it: model selection, task-level preference, fallback ordering, and any way to verify a configured key/model actually works before it's relied on.

## 2. The dream Menno described, unpacked into distinct threads

Menno's own framing, taken apart into what look like five separable capabilities — separable because each is a real, distinct design question with its own open questions, not because they need to ship independently:

### Thread A — A real AI provider *registry*, not a fixed array
Today: `PROVIDERS` is a TypeScript array, one entry per provider, edited by a developer. Tomorrow: some real, queryable list of "AI providers this system knows how to talk to" — plausibly still code-defined (a provider is a real integration, not user-authorable), but no longer hardcoding *priority* alongside *existence*.

**Open questions:** Does "provider" stay a build-time concept (a new provider still means writing a new `AIProviderConnector`, per ADR-0038 Decision §2's own precedent) — almost certainly yes, since Azure AI Language and Azure OpenAI both required real per-provider integration code, not configuration. What's new is *tenant-facing visibility and choice* over an already-fixed set of providers, not tenants somehow registering arbitrary new providers.

### Thread B — Per-provider *model* configuration
Azure OpenAI already has this (a tenant's `deployment` name). Azure AI Language structurally doesn't — it has no interchangeable models to choose between, only capability endpoints. A future third provider (a direct OpenAI/Anthropic API, say) would have its own real model list.

**Open questions:** Is "model" even the right unit for every provider, or does the system need to accept that some providers (Azure AI Language-shaped ones) simply don't have this axis? Forcing a fake "model" concept onto a provider that doesn't have one is exactly the kind of speculative generalization this project's own conventions warn against.

### Thread C — Task-based preferred-model selection
Right now there is exactly one task. Menno's phrasing ("whenever the ai models are required we call the ai provider and the preferred model selection for the task") implies either (a) forward-looking design for future task types beyond post enrichment, or (b) splitting today's single enrichment call into sub-tasks (sentiment vs. entities vs. key phrases) that could each prefer a different provider/model.

**Open question, genuinely unresolved:** which of (a) or (b) is meant? They lead to materially different designs — (a) is "a routing table keyed by task type," cheap to build now and easy to extend later; (b) is "decompose enrichment itself into independently-routable sub-calls," a much bigger change to `enrichPost()`'s own shape and cost profile (more API calls, not fewer).

### Thread D — BYOK with real model selection and configuration, tenant-facing
The credential storage mechanism already exists (ADR-0014 envelope encryption, ADR-0027/0028's ownership tiers). What doesn't exist: an actual UI/flow for a tenant to say "here's my key, here's my endpoint, here's which model of theirs I want to use, and here's my fallback order if my first choice fails." Story 6.3's own connect flow today is a single opaque credential string per provider — no model-selection field, no ordering/preference concept at all.

### Thread E — A real verification/test capability, and fallback/parallel execution
Two genuinely different things bundled in Menno's own description, worth pulling apart explicitly:
- **"Test suite for models and verification"** — most likely a tenant-facing "verify this key/model actually works" action (a real API call proving the configured credential+model combination is live and correctly scoped), distinct from this project's own internal Jest contract suite. ADR-0051 Open Question 2 ("live credential validation") already named exactly this gap for connectors generally and explicitly deferred it pending its own cost/value tradeoff — this spark reopens that question specifically for AI providers, where every verification call has real, metered cost (Azure OpenAI's own per-token billing, named directly in this project's own Amendment Log after a real €306 surprise-charge incident).
- **Fallback vs. real parallel/async multi-provider execution** — sequential fallback (try provider A, then B, on failure) is *already partially built* (`enrichPost()`'s own `tryProvider()` loop does exactly this, just not tenant-configurable). Running several providers **concurrently on the same task** and comparing/merging results is a materially different, more expensive, more complex feature — every parallel call is billed separately, and "merge the results" is itself an undesigned question (whose sentiment wins if two providers disagree?). Worth being honest that these are two different features at two different cost/complexity tiers, not one feature with two names.

## 3. What already exists and should not be rebuilt

Named explicitly so the eventual ADR doesn't rediscover ground already covered:
- **BYOK itself** — ADR-0027 (technical-intermediary-only, no pooled billing), ADR-0028 (ownership tiers), ADR-0014 (envelope-encrypted credential storage). All Accepted, all provider-agnostic already.
- **The connector abstraction** — `AIProviderConnector` (`src/connectors/types.ts`, ADR-0002/ADR-0038) already defines `providerId`, `authMode`, `listModels()`, `getModelRateLimit()`, `getModelCapabilities()`, `analyze()`. Two real implementations already prove the interface holds across a structured-NLP provider and an LLM provider.
- **Activation gating** — Story 1.11/ADR-0051, extended to AI providers earlier today, already gives a real per-tenant on/off switch independent of credential presence.
- **Fallback-on-failure (sequential, unordered)** — already real, in `enrichPost()`'s own retry/skip loop, just not tenant-configurable and not proven for more than two providers.

## 4. Rough shape of the practical design questions an ADR would need to resolve

Not a decision — a list of what the ADR's own Decision section would actually have to answer, once the threads above are pulled apart and prioritized:

1. Does "preferred model per task" mean a routing table for *future* task types, or decomposing today's single enrichment call? (Thread C's own open fork.)
2. Does per-tenant provider *priority* become configurable data (a new column/table) or stay code, with only *activation* remaining the tenant's real lever?
3. Is "verify this configuration" a real, metered API call a tenant can trigger (cost-bearing, needs its own rate-limiting thought given ADR-0020's existing deferred distributed-rate-limit caution), or a cheaper structural check (credential shape/reachability only, no real model invocation)?
4. Is concurrent multi-provider execution in scope at all right now, or named and explicitly deferred (mirroring how ADR-0051 itself named and deferred live validation and auto-deactivation as real future work, not built speculatively)?
5. What's the minimum viable "model selection" UI, given Azure AI Language genuinely has none and forcing one would be fake?

## 5. Deliberately not decided here

Everything in §4. This document's job is to make sure the eventual ADR starts from an accurate map of what's already real, what's genuinely new, and which of Menno's own bundled ideas are actually separable decisions — not to make those decisions itself.
