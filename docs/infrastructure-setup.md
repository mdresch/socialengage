# Infrastructure Setup — Azure Subscription Migration (2026-08-17)

**Status:** Complete. All 5 resources created and verified working (full contract suite: 59/59 suites, 454/454 tests). This is an internal engineering runbook, not an ADR and not one of the end-user manuals under `docs/manuals/` — it documents *how* the real Azure infrastructure this project depends on was set up, for whoever needs to repeat, extend, or debug it later.

## Why this exists

On 2026-08-17, `social-listening-core`'s real Azure Key Vault (`social-listening-dev-kv`, subscription `social-engage`) started failing every credential-storage contract test with `RestError: The subscription associated with this vault has been disabled.` Investigated directly, not assumed:

- `az account list --all` showed **both** subscriptions reachable from the original Azure CLI login (`social-engage`, `ecdd0d74-a46e-477c-8c84-a0f9d37310ff`, and `Azure CBA ADPA`, `f4ec6366-721c-43d9-a28f-a5098c72f112`) in **`Warned`** state — a real, distinct Azure subscription state (a billing grace period before full disablement: an expired trial credit, a spending limit, or a failed payment), not a timeout or a code regression.
- Both `Warned` subscriptions share the same billing tenant (`dda83c9b-606f-4bd8-9fa4-8d6a50812dc4`, "Menno Drescher Outlook Standaardmap") — fixing billing there would likely unblock both, but wasn't the path chosen.
- A third subscription, **`MCPP`** (`abe03a53-362d-4ab9-b1f6-8dd5997d7586`), under a **different** Azure AD tenant (`cbadmin.onmicrosoft.com`, "CBA") entirely, confirmed genuinely `Active` via the Portal and via `az account show` after signing in to it directly. Menno decided to fully migrate this project's Azure footprint here rather than wait on the billing fix.

## What actually needs to move (verified directly, not assumed)

Grepped every `process.env.*` reference in `social-listening-core/src` that resolves an Azure resource identifier, with its literal default:

| Resource | Env var | Old default (social-engage) | Needs migrating? |
|---|---|---|---|
| Key Vault | `KEY_VAULT_URI` | `https://social-listening-dev-kv.vault.azure.net/` | Yes |
| Service Bus | `SERVICE_BUS_NAMESPACE` | `social-listening-dev.servicebus.windows.net` | Yes |
| Blob Storage (archival) | `ARCHIVE_STORAGE_ACCOUNT` | `sociallisteningdev` | Yes |
| Azure AI Language | `AZURE_AI_LANGUAGE_ENDPOINT` | `socialengage-dev.cognitiveservices.azure.com` | Yes |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT` | `socialengage-openai.openai.azure.com` | Yes |
| Postgres (dev) | `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` | `localhost:5432` (default) | **No** — already local/Docker, not Azure-hosted at all for local dev (ADR-0025). Nothing to migrate here; if a real Azure Postgres is ever wanted, that's new scope, not a migration. |
| Entra External ID (auth) | `ENTRA_TENANT_ID` etc. | `getsocialengage.onmicrosoft.com` (a separate Entra tenant, `68ae3657-...`) | **No** — this is its own Entra tenant, independent of which Azure *subscription* hosts compute/storage. Sign-in is unaffected by this migration. |

## Resource group

- **Name:** `rg-social-listening`
- **Subscription:** `MCPP` (`abe03a53-362d-4ab9-b1f6-8dd5997d7586`)
- **Region:** West Europe (matches the original resources' region, for consistency/latency)

## Resources created

| Resource | Name | Notes |
|---|---|---|
| Key Vault | `sociallistening-kv` | Standard tier, RBAC-authorization mode (`enableRbacAuthorization: true`) — no legacy access policies. URI: `https://sociallistening-kv.vault.azure.net/` |
| Storage account | `sociallisteningmcpp` | `Standard_LRS`, `StorageV2`. `sociallistening` alone was already taken globally. Container `social-listening-archive` created manually — the app never auto-creates it. |
| Service Bus namespace | `sociallistening-bus` | Standard tier. **`sociallistening-sb` was rejected** — Azure reserves the `-sb` suffix (`InvalidSuffix`). Topic `social-listening-events` created manually — the app publishes to it but never creates it. |
| Azure AI Language | `sociallistening-ai-language` | Cognitive Services, `TextAnalytics` kind, S tier. Real endpoint got an Azure-appended disambiguation suffix: `sociallistening-ai-language-80695.cognitiveservices.azure.com` — do not assume the endpoint matches the resource name literally. |
| Azure OpenAI | `sociallistening-openai` | Cognitive Services, `OpenAI` kind, S0. Endpoint: `sociallistening-openai-27349.openai.azure.com` (same appended-suffix behavior). Deployment `gpt-5-mini` created separately — the account alone ships with no deployments. Real model version is `2025-08-07`; `az cognitiveservices account deployment create --model-version 1` fails with `DeploymentModelNotSupported` — the version string must match what `list-models` actually reports. No separate access approval was needed on this subscription — it went straight through. |

## RBAC — the real gotcha, twice

**`Owner` at the subscription level does not grant data-plane access to Storage blobs or Service Bus.** It covers control-plane operations (create/delete/configure the resource itself) but Storage and Service Bus each gate their actual read/write operations behind a *separate* data-plane RBAC role. Discovered live, not assumed, by two real contract-suite failures after Owner-level access was already confirmed:

- **Blob upload** (`uploadArchiveBlob()`) failed with `AuthorizationPermissionMismatch` ("This request is not authorized to perform this operation using this permission") until **`Storage Blob Data Contributor`** was granted at the storage-account scope.
- **Service Bus subscription management** (`ServiceBusAdministrationClient.createSubscription()`) failed with a confusingly-worded `RestError` — *"The incoming request is not recognized as a namespace policy put request"* — which does not mention authorization at all and was initially mis-diagnosed as a missing-topic problem, until **`Azure Service Bus Data Owner`** was granted at the namespace scope. (The topic itself, `social-listening-events`, also genuinely didn't exist yet and needed creating separately — both things were true at once.)

**Every `az role assignment create` attempt for any role, on any of these resources, failed identically with `MissingSubscription`** ("The request did not have a subscription or a valid tenant level resource provider"), reproduced across scope formats (vault resource ID, resource-group ID), assignee-resolution methods (`--assignee` vs `--assignee-object-id`/`--assignee-principal-type`), and even a *read-only* `az role assignment list --scope <resource-id>` call — while `az role assignment list --subscription <id> --all` (no `--scope`) worked fine and correctly showed grants made through the Portal. Never root-caused as a specific CLI/token bug; not a permissions problem (Owner was already confirmed via the working list call) and not resolved by waiting. **Workaround: grant each role directly in the Azure Portal** (resource → Access control (IAM) → Add role assignment), then confirm via `az role assignment list --subscription <id> --all` (never `--scope`).

## Status log

- 2026-08-17: Root cause diagnosed (Warned subscription state). `az login --use-device-code` completed against `cbadmin.onmicrosoft.com`; `MCPP` confirmed `Enabled` and set as the active CLI subscription.
- 2026-08-17: Resource group `rg-social-listening` and Key Vault `sociallistening-kv` created via CLI. `Key Vault Administrator` role granted via Portal (CLI blocked, see RBAC section above); confirmed active.
- 2026-08-17: Remaining 4 resources created via CLI — Storage (`sociallisteningmcpp`), Service Bus namespace (`sociallistening-bus`, after the `-sb` naming rejection), Azure AI Language (`sociallistening-ai-language`), Azure OpenAI (`sociallistening-openai` + `gpt-5-mini` deployment). `social-listening-core/.env` updated: `KEY_VAULT_URI`/`SERVICE_BUS_NAMESPACE`/`ARCHIVE_STORAGE_ACCOUNT` (RBAC-based, no keys) and `AZURE_AI_LANGUAGE_ENDPOINT`/`_KEY`, `AZURE_OPENAI_ENDPOINT`/`_KEY` (real keys, written directly to the file, never printed to the session transcript).
- 2026-08-17: Full contract suite run against the new infrastructure surfaced the RBAC data-plane gap (Storage, then Service Bus) and two missing entities (the archive blob container, the events topic) — all four fixed (Portal role grants + `az storage container create` + `az servicebus topic create`). Full suite confirmed green: **59/59 suites, 454/454 tests.**
- 2026-08-17: Verified `getsocialengage.onmicrosoft.com` (Entra External ID, the separate tenant handling sign-in) is unaffected and still fully active — its OIDC discovery endpoint returns 200, and the real-Entra Story 6.1 contract test passed in the full-suite run above. Not part of this migration and was never going to be: Entra External ID is its own Azure AD tenant, independent of which Azure subscription hosts compute/storage.
