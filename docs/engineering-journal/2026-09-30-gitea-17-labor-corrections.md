# Work Order labor corrections — Gitea #17

## Baseline and reproduced defect

Baseline main: `bcab77b153c243f782009cc4854ea4c7af889c49`, including completed
#18; local main and freshly fetched Gitea/GitHub main agreed. Initial checkout was
clean with nothing staged. CRM remains separate and paused at
`807bc38122e771dacccbc23fca4a66363dd58d55`. Dedicated branch:
`fix/gitea-17-workorder-labor-edit`; worktree `/tmp/cronus-gitea-17`.
Gitea inspection confirmed #17 open, #18 closed and #19 open/BLOCKED.

Pre-change WorkOrder cost baseline passed **52/52**, including all #18 cases.
The opt-in frozen reproduction passed **3/3** before implementation: frontend
`updateTimeLog` sent PATCH; the authorized request returned 404 without modifying
the entry; delete/re-add resolved the newer synthetic schedule and changed rate
and entry identity. This established why delete/re-add cannot substitute for editing.

Frozen artifacts (excluded from permanent default gates):

- `core-service/evidence/gitea-17/reproduction.mjs`, SHA-256
  `3bd35e9339df813257174ce76bed1211160e2000eedf806a9759eba668cb304a`.
- `core-service/evidence/gitea-17/jest.config.cjs`, SHA-256
  `0cffc297ac78509983659ff1744d42d58c28eb7c858c8781e2e2597caad191db`.

The frozen assertions characterize the defective baseline and intentionally do
not expect the corrected source. Git preserves the baseline and patch; test JSON
and build artifacts in `/tmp/cronus-gitea-17-evidence` are disposable local evidence.

## Approved correction semantics and implementation

The user's explicit #17 policy extends approved #7 Decisions 1–9 without changing
rate publication or cost-model shape. Captured labor authority is preserved until
an explicit work-date correction requests different effective-dated authority.

`PATCH /workorders/:id/time-logs/:logId` delegates to canonical `updateLabor` in
`workOrderCosts/mutate.js`; the router performs no economic writes. Only
`timeSpent`, `description` and `workDate` are accepted. Rates, costs, provenance,
revision, aggregates, identity, timestamps, nested paths and arbitrary fields are
rejected. Existing authenticated admin/technician role and parent Facility scope
checks apply. IDs address exactly one embedded `_id`: invalid IDs return 400,
missing entries 404, ambiguous identities 409. The write rechecks scoped parent
ownership and original economic roots, so concurrent changes return 409 without
partially writing a snapshot or aggregate.

- **Description only:** preserve minutes, date, rate, cost and pricing exactly;
  no lookup, economic revision increment or aggregate timestamp change.
- **Minutes, date unchanged:** authoritative captured rate and entire pricing
  provenance remain unchanged; only cost is recomputed using deterministic
  `amount(minutes, capturedRate, 60)`. Known approved zero remains known.
  No schedule lookup, including when the caller supplies the unchanged date.
- **Unknown/legacy minutes:** rate and cost stay/become null; no numeric legacy
  claim is certified and no current rate is recovered. Incomplete/absent provenance
  stays incomplete/absent. Legacy description corrections preserve raw economics.
- **Changed work date:** require a valid calendar date in `YYYY-MM-DD` form;
  null, empty or impossible dates are rejected. Resolve the corrected date through
  #18's resolver, then capture a new pricing snapshot and compute current/corrected
  minutes against that authority. Same-period date corrections also resolve anew.
  Missing authority yields null rate/cost and `no_applicable_rate`; ambiguous or
  corrupt history yields null with `ambiguous_rate_schedule`/`invalid_rate_schedule`.
  Old rate-period provenance is replaced, never reused as a fallback.
- **Combined fields:** changed date wins for economics; otherwise changed minutes
  retain authority, with description updated independently.
- **No effective change, including empty PATCH:** canonical no-op returns the
  unchanged record. It does not resolve, increment revision or write timestamps.
- **Legacy date corrections:** a governed match may establish the corrected
  entry's snapshot only because the user explicitly changed its date. Whole-record
  legacy scope can remain incomplete. This is neither background recovery nor
  bulk historical repair.
- **Publication/status:** later publications never passively change edited
  snapshots. Completing, reopening or archiving does not resolve labor again.
- **Delete/re-add:** deletion remains deletion; add remains a new economic event
  with fresh creation-time lookup and a new identity.

Economic corrections use the existing fingerprint/revision/calculation version
and atomic compare-and-set path. Entry snapshot, `economics.revision`, fingerprint
and aggregate cache are persisted together; no manually authored `costs.*` fields
or new service boundary are introduced.

The frontend's existing PATCH contract now accepts a narrow `TimeLogCorrection`
and reads the WorkOrder response envelope. The small labor row editor drafts
approved fields and submits changed fields on Save, by embedded identity. It does
not delete/re-add or expose rate/cost/provenance controls. Canonical entry and costs
are installed together after server success; revalidation retains populated
operational fields. Failed corrections leave cached economics unchanged and show
an error. Gap responses remain unknown through the existing cost summary.

## Auditability and compatibility limits

Existing `updatedBy`/`updatedAt` record every actual correction; economic inputs
also advance `economics.revision` and its `changedBy`/`changedAt`. Pricing captures
authority and capture actor/time. Description-only edits preserve economic metadata.
These fields support current correction attribution and conflict protection,
**not a complete append-only before/after correction history**: earlier revisions
and descriptions are not retained as individual audit records. No existing labor
edit-history subsystem was found. #17 deliberately introduces no broad audit schema.
A retained correction ledger would require separate design/authorization if needed.

No schema, migration, index, dependency, lockfile or rate-publication change is
required. Old frontend callers editing minutes/description use the same URL;
frontend and backend should be rolled out together for the response contract and
explicit Save/date workflow. Deployment is a separate operational decision.

## Branch verification

Focused core **423/423**: costs **84/84** (all 52 #7/#18 cases plus 32 #17 cases),
subresource security **339/339** (295 existing plus 44 #17 cases).
Focused frontend **10/10**: labor API/editor/hook **8/8**, cost summary **2/2**.
Initial core #18 compatibility **680/680**, before the final two completed/reopened regressions: costs 82, subresource security 339,
operational ownership 214, Facility queries 29, Facility compatibility 16.
The final broad gate covers this same core compatibility subset **682/682** (costs 84).
Contract/authentication compatibility **60/60**: core authentication 31, Contract
authentication 23, cost adapter 3, profitability 3.

Full default broad gate: **1,414/1,414 core**, **116/116 Contract**,
**256/256 frontend**. Exact per-suite counts follow below.

Tests use fail-closed ephemeral Mongo persistence and synthetic fixtures only;
configured targets are blocked, cached Mongo binary downloads disabled, providers
mocked, `CRON_ENABLED=false`. Lifecycle compatibility tests call controlled functions
with synthetic persistence; no runtime scheduler is enabled or manually triggered.
Dependencies are temporary links to existing installations whose six manifests/
lockfiles match baseline byte-for-byte, with no install/update performed.

TypeScript app check passes with established `--ignoreDeprecations 5.0` override;
unmodified main and #17 both reproduce TS5103 with the checked-in `6.0` value and
existing TypeScript installation. This baseline configuration mismatch is outside
#17 and remains unchanged. Independent Vite build passes (3,552 modules; existing
large-chunk warning). Changed JavaScript syntax and `git diff --check` pass.
No dependency/lockfile drift. No economic test failure was ignored or weakened.

Authenticated production paths, real schedules and deployed behavior were not
tested: #17 is software-only and deployment/real-data verification is not authorized.

### branch-core-broad: 1414/1414

| Suite | Passed |
| --- | ---: |
| `core-service/src/cronJobs/_tests_/schedulerRegistration.test.mjs` | 3 |
| `core-service/src/routers/_tests_/contact.endpoint.test.mjs` | 49 |
| `core-service/src/routers/_tests_/facilityIsolationCompatibility.test.mjs` | 16 |
| `core-service/src/routers/_tests_/facilityQueryIsolation.test.mjs` | 29 |
| `core-service/src/routers/_tests_/followUp.endpoint.test.mjs` | 87 |
| `core-service/src/routers/_tests_/operationalOwnership.test.mjs` | 214 |
| `core-service/src/routers/_tests_/procedureMeasurements.test.mjs` | 78 |
| `core-service/src/routers/_tests_/referenceLifecycle.test.mjs` | 103 |
| `core-service/src/routers/_tests_/referenceLifecycleStandalone.test.mjs` | 31 |
| `core-service/src/routers/_tests_/supplierSecurity.test.mjs` | 59 |
| `core-service/src/routers/_tests_/templateLifecycle.test.mjs` | 152 |
| `core-service/src/routers/_tests_/testEquipmentPickerSecurity.test.mjs` | 49 |
| `core-service/src/routers/_tests_/ticketPromotionStandalone.test.mjs` | 1 |
| `core-service/src/routers/_tests_/vendorSecurity.test.mjs` | 90 |
| `core-service/src/routers/_tests_/workOrderCosts.test.mjs` | 84 |
| `core-service/src/routers/_tests_/workOrderSubresourceSecurity.test.mjs` | 339 |
| `core-service/src/services/_tests_/contact.service.test.mjs` | 7 |
| `core-service/src/services/_tests_/followUp.service.test.mjs` | 20 |
| `core-service/src/utils/_tests_/lifecycle.util.test.mjs` | 3 |

### branch-contract-broad: 116/116

| Suite | Passed |
| --- | ---: |
| `contract-service/config/_tests_/dbLogging.test.js` | 3 |
| `contract-service/src/controllers/_tests_/costProfitability.test.js` | 3 |
| `contract-service/src/jobs/_tests_/contractLifecycleJob.test.js` | 11 |
| `contract-service/src/routes/_tests_/amendmentLifecycle.endpoint.test.js` | 13 |
| `contract-service/src/routes/_tests_/contractValue.endpoint.test.js` | 3 |
| `contract-service/src/security/_tests_/contractAuthentication.security.test.js` | 23 |
| `contract-service/src/security/_tests_/coreAuthentication.security.test.js` | 31 |
| `contract-service/src/security/_tests_/vendorHistory.security.test.js` | 6 |
| `contract-service/src/services/_tests_/contractOverview.service.test.js` | 4 |
| `contract-service/src/services/_tests_/contractValue.service.test.js` | 16 |
| `contract-service/src/services/_tests_/workOrderCostAdapter.test.js` | 3 |

### branch-frontend-broad: 256/256

| Suite | Passed |
| --- | ---: |
| `frontend/src/pages/AddAsset/ownershipCompatibility.test.tsx` | 7 |
| `frontend/src/pages/Contacts/ContactAccess.test.tsx` | 7 |
| `frontend/src/pages/Contacts/ContactFollowUps.test.tsx` | 6 |
| `frontend/src/pages/Contacts/ContactsPage.test.tsx` | 31 |
| `frontend/src/pages/EditTemplates/templateLifecycle.test.tsx` | 13 |
| `frontend/src/pages/EditWorkOrder/components/WorkOrderCostSummary.test.tsx` | 2 |
| `frontend/src/pages/EditWorkOrder/hooks/useTestEquipment.test.tsx` | 5 |
| `frontend/src/pages/EditWorkOrder/modals/AddTestEquipmentModal.test.tsx` | 1 |
| `frontend/src/pages/EditWorkOrder/modals/procedureMeasurements.test.tsx` | 32 |
| `frontend/src/pages/FollowUps/FollowUpAccess.test.tsx` | 7 |
| `frontend/src/pages/FollowUps/FollowUpsPage.test.tsx` | 45 |
| `frontend/src/pages/FollowUps/dateTime.test.ts` | 5 |
| `frontend/src/services/assetOwnership.test.ts` | 5 |
| `frontend/src/services/contactAPI.test.ts` | 5 |
| `frontend/src/services/followUpAPI.test.ts` | 8 |
| `frontend/src/services/ownershipCreateAPI.test.ts` | 4 |
| `frontend/src/services/procedureMeasurements.test.ts` | 1 |
| `frontend/src/services/templateLifecycle.test.ts` | 48 |
| `frontend/src/services/testEquipmentPickerAPI.test.ts` | 5 |
| `frontend/src/services/vendorAPI.test.ts` | 5 |
| `frontend/src/services/workOrderEquipmentAPI.test.ts` | 6 |
| `frontend/src/services/workOrderLaborAPI.test.tsx` | 8 |

## Operational boundary

No real rate publication of any amount (including either previously discussed
unapproved candidate), real WorkOrder modification, production/business Mongo
change, historical bulk repair/backfill, scheduler change, runtime/container change,
deployment or CRM change. Only isolated test persistence is used. #19 remains
BLOCKED on external governance and separate explicit publication authorization.
Software merge and issue closure are recorded after merged-main verification;
this branch verification alone does not establish deployment or closure.
