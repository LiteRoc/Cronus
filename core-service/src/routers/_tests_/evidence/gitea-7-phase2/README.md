# Gitea #7 Phase 2 — frozen observations and writer inventory

Verified 2026-09-22 on main `40fd8de41169cb3b6daa231cd4dff031b3e8e34e`,
branch `repro/gitea-7-cost-snapshots`, worktree `/tmp/cronus-gitea-7`.
Phase 1 files and interpretation are unchanged. No production code was modified.

## Verification and evidence

`workOrderCostSnapshots.phase2.reproduction.mjs` and the separate opt-in
`jest.workorder-cost-snapshots-phase2-reproduction.config.cjs` exercise the real
router mounted at `/workorders`, real authentication/facility middleware, and
real models with the established isolated MongoMemoryServer harness. No app
entry point, jobs, imports, external APIs, or configured databases are loaded.
The harness blocks configured/non-issued mongoose.connect targets; its control
passed. Runtime downloads are disabled; cached MongoDB 8.2.1 is used.

**6 tests passed / 1 suite passed**, including C–G and the isolation control.
Node v18.19.1 emitted existing support/experimental-module warnings; Mongoose
emitted an existing duplicate-index warning. An earlier runner invocation had
no config because sandbox setup had prevented file creation; no case executed
in that attempt. The first executed Phase 2 suite passed.

Fixtures are saved through the real model with explicit historical rates,
prices, IDs and dates. D/E/G retain $75 labor alongside $80 parts to verify
totals and preservation of the other cost category. The same-facility synthetic
test equipment is a separate Asset. F/G use the existing mounted equipment-add
route, not an invented test route. Date alone is faked; HTTP and database timers
remain real. Generated subdocument IDs are not mocked and are preserved exactly.

Each JSON file contains full raw collection snapshots plus method, URL, payload
and HTTP status. F preserves all three Work Order states; G also preserves both
catalog states and the Work Order before the later save. Credentials are omitted.
All evidence writes are exclusive and refuse to overwrite existing JSON files.
Assertions describe observed behavior, not an approved future policy.

## C–G results

All dates below are midnight UTC in January 2026. Baseline is January 1;
C/D/E mutations are January 2. F labor addition is January 2, then its equipment
save is January 3. G catalog change is January 2, then equipment save January 3.

| Case / route | HTTP | Stored entries after mutation | costs.labor | costs.parts | costs.total | calculatedAt |
| --- | --- | --- | ---: | ---: | ---: | --- |
| C DELETE `/:id/time-logs/:logId` | 200 | timeLogs becomes empty | 75 (unchanged) | 0 | 75 (unchanged) | January 1 (unchanged) |
| D PUT `/:id/parts/:partId`, quantity 2 → 3 | 200 | unitCost 40 retained; extendedCost 80 → 120 | 75 | 120 | 155 → 195 | January 2 |
| E DELETE `/:id/parts/:partId` | 200 | partsUsed becomes empty | 75 | 80 → 0 | 155 → 75 | January 2 |
| F POST time-log, then POST `/:id/test-equipment` | 200 / 200 | 60-minute log, rate 0 and cost 0 unchanged by later save | 0 | 0 | 0 | January 1 after log; January 3 after equipment |
| G Part catalog 40 → 60, then POST `/:id/test-equipment` | 200 for WO save | quantity 2, unitCost 40, extendedCost 80 retained | 75 | 80 | 155 | January 3 |

C is a **confirmed implementation defect** under the existing internal-labor
formula: no labor remains, but the persisted labor aggregate still contains $75.
This conclusion needs no choice of rate source or travel/vendor policy.
D/E are **confirmed current consistent behavior** for already-priced snapshots.
F confirms that a later unrelated save refreshes calculatedAt while retaining
zero-rate labor. Source establishes recalculation from that zero rate; unchanged
arithmetic alone cannot distinguish recalculation from no-op. The timestamp is
not proof of complete historical pricing. G confirms **current historical-price
preservation**, not a newly approved policy. No repricing/corruption was observed
in these F/G saves. Whether a later save repairs C's stale total is suggested by
the hook but was not separately exercised in C–G.

## Mutation-path matrix

All paths in this table are relative to `/workorders`. R = reproduced (A/B use
unchanged Phase 1 evidence); S = source inspection only. Hook results for S rows
describe successful writes, not verification that those paths ran.

| Mutation path | Operation / save hook? | Rate or cost source | Snapshot refreshed? | Classification / evidence |
| --- | --- | --- | --- | --- |
| POST `/:id/time-logs` | findOneAndUpdate push / no | No rate supplied; schema defaults 0 | No, including timestamp | Current behavior; monetary conclusion incomplete (A/F, R) |
| DELETE `/:id/time-logs/:logId` | helper findByIdAndUpdate / no | Previously captured labor 75 removed | No; deleted cost retained | Confirmed monetary defect (C, R) |
| POST `/:id/parts` | scoped document save / yes | Available Part.price not copied; unitCost defaults 0 | Yes, from zero unitCost | Confirmed snapshot omission (B, R) |
| PUT `/:id/parts/:partId` | scoped document save / yes | Existing usage.unitCost | Yes; quantity × historical cost | Consistent current behavior (D, R) |
| DELETE `/:id/parts/:partId` | scoped document save / yes | Remaining historical entries | Yes | Consistent current behavior (E, R) |
| POST `/:id/test-equipment` | scoped document save / yes | Existing rates/unit costs; no catalog lookup | Yes, all internal costs and timestamp | Zero rate remains zero; historical price retained (F/G, R) |
| DELETE `/:id/test-equipment/:equipmentId` | scoped document save / yes | Existing rates/unit costs | Yes by hook | Same recalculation mechanism, unexecuted (S) |
| POST `/:id/travel-logs` | findOneAndUpdate push / no | travelTime only, no monetary snapshot | No | Current source behavior; travel valuation is policy (S) |
| DELETE `/:id/travel-logs/:logId` | helper findByIdAndUpdate / no | Removes travel log | No | Travel not part of current internal-cost hook; policy (S) |
| PUT `/:id`; PATCH assign/status/schedule/archive | findOneAndUpdate / no | None; ordinary PUT rejects economic arrays/costs | No | Non-economic query updates cannot repair stale aggregates (S) |
| PATCH attach procedure / submit task results; DELETE procedure | findOneAndUpdate / no | None | No | Non-economic query updates; no repricing (S) |
| POST `/` | create / yes | Vendor fields accepted; timeLogs/travelLogs/partsUsed/costs protected | Internal costs initialized by hook | Vendor amounts excluded from costs.total by current model; policy (S) |
| POST `/from-ticket/:ticketId` | create array with session / yes | No economic entries supplied | Zero internal snapshot initialized | Current creation behavior (S) |
| POST `/request` | Returns 410; no writer | None | N/A | Deprecated route (S) |

Source anchors: `core-service/src/routers/workOrderRouter.js` lines 67, 245,
335, 376, 400, 421, 443, 460, 478, 487, 505, 514, 559, 624, 639, 704, 740,
770, 794, 828; `core-service/src/helpers/workOrderHelpers.js:76`;
`core-service/src/models/WorkOrder.js:182` (cost hook).

## Direct-writer inventory outside normal Work Order routes

Inventory scope: repository JavaScript/TypeScript/module and script source,
searching WorkOrder imports/aliases, collection names, economic field writes,
save/create/update/replace/bulk/insert operations and callers. Tests, generated
frontend output and dependencies excluded. Embedded operational rows, datasets,
environment files and credentials were not used as fixtures. No scripts/jobs
below were executed. Source mount/import status is not deployed runtime status.

In the table, 'yes if valid' means save middleware is registered on that model
and executes on successful save/create after validation. It does not mean a
potentially invalid legacy writer can reach the hook. All successful core-model
saves recalculate internal labor/parts and calculatedAt; they do not fetch prices
or include travel/vendorService in costs.total.

| Writer / source anchor | Write API / save hook | Supplied economic fields / source | Refresh and possible historical inconsistency |
| --- | --- | --- | --- |
| `core-service/src/services/maintenanceService.js:19` performPlannedMaintenance | new WorkOrder + save / yes if valid | No logs, parts, vendor or cost amounts; defaults | Zero internal snapshot if successful. Omits required facilityId: schema validation is an apparent blocker, not a reproduced cost defect. Called by maintenanceScheduler.js:9; that scheduler is not imported by current cron index. |
| `core-service/src/cronJobs/cronJobs.js:85` scheduleMaintenanceJobs | new WorkOrder + save / yes if valid | No economic entries or rates | Same zero defaults and missing facilityId caveat. Scheduled in this file and imported through cronJobs/index.js and app.js; no runtime/job execution verified. |
| `core-service/src/routers/portalRouter.js:158` service requests | WorkOrder.create / yes if valid | No economic entries or rates | Zero defaults if successful; omits facilityId. Portal mount commented in app.js. |
| `core-service/src/routers/ticketRouter.js:112` legacy convert | WorkOrder.create / yes if valid | No economic entries or rates | Zero defaults if successful; omits facilityId. No mount/import found in current app.js. Distinct from mounted from-ticket route above. |
| `core-service/src/scripts/importMaryRutanWorkOrdersFromText.js:254` through :283 | WorkOrder.create / yes if valid | Parsed service hours converted to timeSpent; no laborRate/laborCost; travelLogs/partsUsed empty | Hook computes zero-rate labor and fresh zero aggregates. Missing rate provenance / zero-versus-unknown policy risk; not executed. |
| `core-service/src/scripts/importDSDWOs.js:200` | new WorkOrder + save at :212 / yes if valid | No structured logs, parts, vendorService or cost snapshots | Fresh zero internal costs; cannot infer missing economic amounts from descriptions. Not executed. |
| `core-service/src/scripts/importWayneCTBlockWorkOrders.js:219` | new WorkOrder + save at :243 / yes if valid | vendorService hours from item; partsCost=item.parts, totalCost=item.total; labor/travel/shipping costs explicit 0 | Fresh internal costs remain zero with no internal entries. Vendor-versus-internal scope is policy; not an established arithmetic defect. |
| `core-service/src/scripts/importWayneLuminosBlockWorkOrders.js:146` | new WorkOrder + save at :170 / yes if valid | vendorService hours from item; all five monetary fields 0 | Internal costs fresh zero. Zero/unknown vendor values and scope remain policy/provenance questions. |
| `core-service/src/scripts/importWayneEcamBlockWorkOrders.js:119` | new WorkOrder + save at :143 / yes if valid | vendorService hours from item; all five monetary fields 0 | Same scope/provenance caveat; no internal rate snapshots. |
| `core-service/src/scripts/importWayneMobilettBlockWorkOrder.js:65` | new WorkOrder + save at :89 / yes if valid | vendorService hours from item; all five monetary fields 0 | Same scope/provenance caveat; no internal rate snapshots. |
| `core-service/src/scripts/importWayneYsioBlockWorkOrders.js:185` | new WorkOrder + save at :209 / yes if valid | vendorService hours from item; all five monetary fields 0 | Same scope/provenance caveat; no internal rate snapshots. |
| `core-service/src/scripts/importWayneDexaBlockWorkOrders.js:101` | new WorkOrder + save at :125 / yes if valid | vendorService hours from item; all five monetary fields 0 | Same scope/provenance caveat; no internal rate snapshots. |
| `contract-service/src/scripts/importWayneCTBlockWorkOrders.js:219` | new WorkOrder + save at :243 / hook unavailable as checked in | Same vendor mappings as core CT copy | Imports missing contract-service models/WorkOrder; no executable model/hook established. Dormant/broken source candidate, not proven runtime writer. |
| `core-service/src/routers/adminRouter.js:23` legacy loader | MongoClient collection('workOrders').insertMany / no model hook | Passes imported JSON unchanged; contents intentionally not inspected | No validation/recalculation guarantee; arbitrary missing/inconsistent snapshots possible if input has them. Uppercase-O collection differs from core model's workorders. No current app mount found; do not equate these collections. |
| `contract-service/src/scripts/backfillWorkOrdersToContracts.js:77` | WorkOrder.updateMany using local minimal schema / no core hook | contractId only; no economic field supplied | Existing snapshots untouched and not repaired; no new arithmetic inconsistency implied. Included as a direct Work Order writer, not an economic writer. |

The core imports also perform direct collection writes to Asset/Contract link
arrays; those are not writes to WorkOrder economics and were not executed.
`contract-service/src/scripts/backfillContractWOs.js` reads Work Orders and writes
Contract links only (and also references a missing WorkOrder model).
Notification/overdue code reads Work Orders and sends notifications, but no
WorkOrder economic persistence was found. Lifecycle scheduler bulk writes are
to Assets, not Work Orders. Lifecycle services, reports, dashboards, contract
analytics, procedure lookup and app.js's legacy view read Work Orders. Part
router writes the catalog, not WorkOrder snapshots. No additional WorkOrder
bulkWrite/replace/direct lowercase-workorders insert writer was found in the
searched source. No writer deployment, successful import, or database contents
are inferred from source presence.

## Defects versus decisions, and stopping point

- Confirmed implementation defects: B's available-price snapshot omission
  (unchanged Phase 1 classification) and C's retained deleted-labor cost.
- Confirmed current behavior: D/E correctly update priced snapshots; F refreshes
  timestamp without recovering a missing rate; G preserves historical price.
  A still has an incomplete monetary conclusion. A/F are not retroactively
  declared nonzero monetary defects.
- Required policy decisions: authoritative labor-rate and Part-price sources,
  capture time, zero versus unknown, authorized overrides/corrections, meaning
  of calculatedAt, historical mutability on later saves, and travel/vendor scope.
  VendorService amounts are not recomputed/validated for arithmetic consistency
  by the internal-cost save hook. Do not declare their exclusion a defect yet.
- Source-only risk: every successful document save overwrites line arithmetic
  from stored quantity/rate and recalculates totals, even for non-economic edits.
  Inconsistent imported/manual line costs may therefore be replaced later.
  No such corruption or C-after-save repair was reproduced by these cases.
- No Contract/lifecycle comparison, concurrency test, import, job, legacy route,
  travel-cost policy or real-data repair was executed. Their behavior remains
  unverified beyond the source distinctions above.

Define the authoritative historical cost model next. No remediation, redesign,
production edits, dependency installation, CRM change, real database access,
Docker/runtime infrastructure change, external mutation, commit or push occurred.
Only reproduction/config/evidence files were added in the existing #7 worktree;
temporary MongoMemoryServer and HTTP test processes were torn down.

## Re-run

From core-service with the existing dependency link:

```sh
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.workorder-cost-snapshots-phase2-reproduction.config.cjs --runInBand
```

Set GITEA7_PHASE2_EVIDENCE_DIR to a **new directory** only when capturing another
run. The existing Phase 1 config/file/evidence hashes are preserved separately
in `../../phase1-preservation.json` for a byte-for-byte preservation check.
