# Gitea #15 — pre-commit review handoff

Implemented against authoritative main `d721ddb6840bc58d92986cd80889edfac2c5ffee`.
**Ready for pre-commit review; not committed, pushed, merged or deployed.**

The assigned directory is the original isolated source snapshot, not a Git worktree.
`review.patch` contains the complete 16-file source/test change and passes
`git apply --check --whitespace=error-all` against the clean main worktree.
Original CRM and main worktrees remain clean. Live Gitea main still matches the
baseline. No branch or Git history was changed.

## Behavior and compatibility

- Manual creation stays admin-only. Active ordinary edits, DI/UDI and provider sync
  stay admin/technician. All Template reads, distincts and lifecycle subroutes now
  enforce that same canonical read role boundary. Shared Template semantics and
  existing Facility-scoped Asset/summary behavior remain intact.
- Explicit ordinary business payloads reject protected fields, arrays, update
  operators, dotted paths and nested unknown fields. Updates validate against the
  schema and use a version comparison to reject stale writes. Identity, status,
  duplicate links, timestamps and audit/verification attribution are server-owned.
- Only the server/provider path grants verification. An ordinary change to provider
  data clears verification and its attribution; benchmark/operational edits do not
  erase verification of unchanged provider data. `verifiedBy` identifies the
  authenticated requester; `verificationSource` identifies AccessGUDID.
- Effective archive includes legacy `status: Archived`, deletion/archive timestamps
  or actors, and any non-null `isArchived` value. New canonical archives atomically set Archived,
  deletedAt, deletedBy and updatedBy. Repeated archive returns existing state without
  rewriting provenance, timestamps or version. Legacy audit gaps are not fabricated
  or backfilled. Other/missing legacy status labels alone do not mean archive.
- Archived Templates are read-only for ordinary and provider writes. They are
  excluded from list/count/distinct selection data and cannot gain new Asset or
  duplicate references. DI/UDI lookup explicitly finds archived DI records and
  rejects them instead of upserting a fresh active state.
- New references reserve their source Template through the dependent write, so an
  archive cannot race the reference creation. Conditional writes protect ordinary
  edits and unchanged historical links against concurrent archive/unlink changes.
  This is a separate Template mechanism; #14 implementation is unchanged.
- Historical detail, population, batch and lifecycle calculations remain available.
  Existing test-equipment Assets linked to archived Templates remain selectable and
  usable on work orders. Linking an Asset (including test equipment) to an archived
  Template is blocked. Work-order equipment attachment uses an established Asset
  relationship and does not create a new Template reference.
- **API decision:** canonical `PATCH /templates/:id/archive`; retain
  `PATCH /templates/:id/achive` as the same admin-only, idempotent handler. Caller
  inspection found no in-repository `/achive` caller. Frontend Archive now uses the
  canonical PATCH instead of unsupported DELETE. The exported `deleteTemplate`
  helper remains an alias to archive for caller compatibility. No hard-delete or
  restore endpoint was introduced.
- `/from-di` and `/from-di-or-udi` share the repaired implementation while preserving
  their role/Asset-creation boundaries. Frontend creation and sync consume the actual
  Template response envelope. Full fetched DTOs are narrowed to business fields.
  Archive controls are admin-only; archived editors are read-only; unauthorized
  Template pages do not fetch or display Template data.

## Exact source/test files

| File | Change |
| --- | --- |
| `core-service/src/models/Asset.js` | Parent preflight and deterministic pre-save no-write rejection. |
| `core-service/src/services/templateArchiveState.js` | Exact BSON predicates and pre-cast hydrated-state protection. |
| `core-service/src/models/EquipmentTemplate.js` | Add optional audit, verification, legacy archive compatibility and private reservation metadata. |
| `core-service/src/services/templateLifecycle.js` | New validated lifecycle, provider, duplicate and reference-write boundary. |
| `core-service/src/routers/templatesRouter.js` | Authorized active reads; protected create/update/provider paths; archive API/alias; repaired DI entry point. |
| `core-service/src/services/operationalOwnership.js` | Reject new archived Template references while preserving unchanged historical IDs. |
| `core-service/src/routers/assetsRouter.js` | Reserve new references and reject stale reference replacement; no picker/history filtering changes. |
| `core-service/src/routers/_tests_/templateLifecycle.test.mjs` | New 152-test mounted-route/synthetic-persistence regression suite. |
| `frontend/src/services/templatePolicy.ts` | New role/archive predicates and business payload projection. |
| `frontend/src/services/templateAPI.ts` | Canonical archive request, legacy helper alias, explicit payloads and response types. |
| `frontend/src/types/EquipmentTemplate.ts` | Add returned audit/archive/verification/lifecycle-default types. |
| `frontend/src/pages/EditTemplates/TemplateEditPage.tsx` | Role/state controls, read-only archives, supported Archive action and sync envelope. |
| `frontend/src/pages/AddTemplate/TemplateCreatePage.tsx` | Preserve mutation roles, remove client verification, correct business flag name and response navigation. |
| `frontend/src/pages/ListTemplates/TemplateListPage.tsx` | Canonical read role gating. |
| `frontend/src/services/templateLifecycle.test.ts` | New 48-test API/payload/archive regression suite. |
| `frontend/src/pages/EditTemplates/templateLifecycle.test.tsx` | New 13-test page role/archive/create/sync regression suite. |

Ten existing files modified, six new source/test files. `changed-files.txt` and
`source.sha256` identify the exact review set. The patch includes the two pre-commit findings corrected below.
Verification logs, this report and the patch are additional review artifacts only.
No dependency manifest, lockfile, application/compiler configuration, #14 code,
#7 code, CRM, scheduler or rate implementation was changed.

## Verification

Focused #15 ran first; additional provider/duplicate race cases were then added
and the focused suite rerun before broader compatibility.

| Suite | Passed |
| --- | ---: |
| New Template lifecycle backend | 152 |
| Operational ownership | 214 |
| Work-order subresource security | 295 |
| Test-equipment picker security | 49 |
| Facility query/Template summary isolation | 29 |
| #14 reference lifecycle | 103 |
| #14 standalone reference lifecycle | 31 |
| #7 work-order pricing/snapshots | 21 |
| Existing lifecycle utility | 3 |
| Core authentication security | 31 |
| **Backend total (10 suites)** | **928** |
| New Template frontend API/page tests | 61 |
| Existing Asset frontend API/creation compatibility | 12 |
| **Frontend total (4 suites)** | **73** |
| **Total unique tests** | **1,001** |

All final tests passed. JavaScript syntax checks passed for all eight backend files.
Patch application/whitespace check passed against untouched main. Byte comparison
verified that all #14/#7 baseline files and the frozen #15 reproduction remain
unchanged; every frozen #15 evidence file matches the first-pass tar bundle.

Normal application TypeScript reports pre-existing TS5103 for
`ignoreDeprecations: "6.0"`; reproduced on untouched main with the same compiler.
Application TypeScript passes using the command-line-only
`--ignoreDeprecations 5.0 --noEmit --incremental false` override. Configuration was
not changed. No browser end-to-end run, production build, deployed integration,
provider-network test or real-data verification was performed. Those would add
runtime/external scope or hit the known compiler configuration blocker.

Tests use guarded ephemeral MongoMemoryServer persistence and synthetic actors,
records and provider responses, with downloads disabled and existing dependencies
reused. No real database, deployed application, container, scheduler, real rate
schedule, external provider or credentials were accessed. Existing #7 tests use
their own synthetic pricing/rate fixtures only. Known Node 18/VM and schema-index
warnings are retained in the logs.

## Schema, operational limits and review notes

- **No remaining policy question blocks review.** The compatibility interpretation
  is explicit above: missing legacy audit information stays unknown, and existing
  archived operational relationships remain usable. New archives have paired actor
  and timestamp; repeated legacy archives do not invent historical provenance.
- New fields are additive/optional; no data migration/backfill is needed to enforce
  the legacy status/archive boundary. Existing documents are not rewritten just by
  reading them. Do not backfill missing archive actors/dates from current users or
  request time. Any later real-data normalization requires its own approved plan.
- The reservation is deliberately **non-expiring**. Lost acquisition, dependent
  commit or cleanup acknowledgements/process interruption can retain it and block
  archive, edits and new references. There is no automatic or public release/replay
  path. A retained reservation requires a separately authorized investigation and
  controlled recovery after proving the writer is stopped and its database work
  has finished. No recovery tooling or real recovery was introduced/run in #15.
  #14 recovery tooling does not apply to this different metadata.
- Old application versions do not enforce these boundaries. Mixed-version writers
  or rollback to the old unprotected routes would not preserve this security fix.
  A later rollout must coordinate writers; retain metadata during rollback and
  forward-repair rather than deleting reservations or audit evidence. No rollout
  or infrastructure change was performed here.
- The existing Template partial index using `di: {$exists: false}` still fails fresh
  index creation on the cached MongoDB 8.2.1 binary. It remains outside this fix.
  The focused harness disables automatic index building and explicitly installs
  the declared supported unique DI index. Tests do not establish deployed index
  state or repair it. Full index readiness needs separate approved investigation.
- API authorization, archive races and reference history were reviewed locally;
  pre-commit review remains the requested stopping point. This report does not claim
  production readiness or close #14's separate authenticated first-use item.

The accepted policy, archive compatibility and reservation failure behavior are
worth preserving in an Engineering Journal entry after review. No AI-memory or
durable engineering-history files were edited during this implementation pass.

## Pre-commit findings corrected (2026-09-29)

Both findings are resolved locally; ready for checkpoint commit/push after review.
No commit or deployment was performed.

P1: Asset edits validate schema and parent relationships before reservation. The
save hook checks again; a deterministic parent rejection is a typed validation
error with an explicit no-write signal. Tests prove early rejection has no write
or reservation, late pre-save rejection releases its own reservation, a different
token cannot be cleared, and uncertain post-write outcomes retain reservations.

P2: a shared backend policy uses aggregation $type tests for missing/exact-null
metadata and captures raw archive state before hydration. Arrays, objects, invalid
scalars and malformed status cannot become active through casting/null matching.
Every non-null marker is protected, including isArchived: false, under the approved
null-only policy. Missing/exact-null records remain active. Historical references
resolve; archive never rewrites legacy provenance. Frontend state agrees. No
stored values are normalized or backfilled.

Added 50 backend and 37 frontend regressions. Rerun: 152 focused + 745 backend
compatibility (including #14/#7) + 31 authentication + 73 frontend = 1,001 passing.
Frozen evidence matches the original tar; #14/#7 baseline files are unchanged.
All eight backend syntax checks, git diff --no-index --check, patch application,
and TypeScript with the documented command-line-only baseline workaround pass.

Exact follow-up source/test files:
- core-service/src/models/Asset.js
- core-service/src/models/EquipmentTemplate.js
- core-service/src/routers/assetsRouter.js
- core-service/src/services/templateLifecycle.js
- core-service/src/services/templateArchiveState.js (new)
- core-service/src/routers/_tests_/templateLifecycle.test.mjs
- frontend/src/services/templatePolicy.ts
- frontend/src/services/templateLifecycle.test.ts

Review artifacts/logs were refreshed separately. No new migration, index, topology,
scheduler or configuration requirement. Existing uncertain-outcome recovery and
coordinated-writer rollout limits remain as documented above. No real database,
runtime, external service, scheduler or Git history was changed.
