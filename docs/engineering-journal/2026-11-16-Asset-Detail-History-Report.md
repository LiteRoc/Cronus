# Asset Detail and Service History — November 16, 2026

## Scope and state

Owner requested the next report after deploying Asset Inventory at `774a50a` and
created `feat/asset-detail-history-report` from that clean Windows checkpoint.
Owner authorized commit and local main merge after verification. Publication and
deployment remain pending. No dependencies,
schemas/indexes, real databases, deployed containers, environment files or
schedulers were changed. Existing Ubuntu local patches are untouched.

## Implementation and definitions

- Core GET `/reports/asset-history`: authenticated administrators/technicians,
  mandatory existing selected Facility using operational ownership checks.
  Exactly one Asset ID or exact control number; optional paired UTC request-date
  boundaries with inclusive end day. Invalid/unknown/non-scalar filters reject.
- Asset lookup uses exact Facility and excludes deleted records. Archived Assets
  remain available for recorded history. Ambiguous identity returns 409. Department
  names resolve only within the selected Facility; foreign, missing or malformed
  references stay unavailable. Asset notes, attachments, pricing/audit provenance
  and other unrequested fields are not returned.
- Work Orders use direct `assetId`, exact Facility and `deletedAt:null`, independent
  of the legacy embedded Asset.workOrders array. Archived Work Orders are included
  explicitly. Newest request date first, ID tie-breaker; missing request dates last
  when unfiltered, excluded by request-date ranges. Completion dates are displayed
  but never substituted as selection dates.
- Query limit1001 rejects over1000 WOs; no silently truncated report. Asset/WO/Part
  queries have10-second bounds; over5000 distinct Part references rejects. No
  historical coverage reconstruction, compliance calculation or lifecycle change.
- Core canonical `workOrderCosts.read`/`combine` own cost assessment. Known subtotals
  are separate from nullable complete totals. Internal labor/travel/parts and direct
  vendor scopes are shown. Legacy/unsupported/incomplete evidence remains unknown;
  no labor rates or catalog prices are substituted for historical costs.
- Internal labor/travel hours come from recorded log minutes. Invalid entries are
  counted separately. Aggregate time rounds once after summation, not per Work Order.
  Vendor-reported hours remain separate and missing vendor hours remain null.
- Service narrative uses Work Order descriptions and recorded labor-log notes.
  Schema does not establish separate findings/resolution fields; none are invented.
  Parts show recorded quantity/note/ID plus current shared catalog labels where
  available, explicitly not historical label snapshots. Deleted/missing catalog
  references are unavailable. Current Part price is never returned or used as cost.
- Asset summary includes identity/location/status/archive, equipment class,
  acquisition/install/service-start/retirement dates and current recorded PM schedule.
  PM schedule is not verified service completion. Dates are UTC; missing fields
  remain unknown, not inferred.
- Frontend `/reports/asset-history`, protected by existing Reports role gate.
  General Reports link and per-inventory-row history deep links. Asset ID prefill
  or exact control-number form, paired optional dates, report preview,25 WOs/page,
  and CSV for all captured results. Raw narrative is rendered as escaped text.
  Captured results/export hide on identity/hospital/selector/date changes; stale
  response guards apply. CSV includes summary/filters/basis, costs, service notes,
  parts and vendor hours with quoted/formula-neutralized cells and blank nulls.
- This is current recorded history, not an immutable as-of snapshot, certified
  complete maintenance record, period expense ledger or vendor agreement payout
  reconciliation. Contract coverage, formal procedure result reports, lifecycle
  recommendations, PDF/print layout and overhead are not added in this slice.

## Verification

- Core pure report builder tests:15/15 PASS, no sockets/DB. Filter validation,
  canonical costing, legacy/partial evidence, recorded notes, current/missing Part
  labels, unknown dates/department, invalid/internal/vendor time, input immutability,
  empty records, and rounding after summation.
- Frontend targeted:12/12 new UI/API/CSV tests PASS. Complete frontend regression:
  47 files,464/464 tests PASS. TypeScript with established deprecation override PASS.
- Production Vite bundle PASS to ignored node_modules/.tmp/asset-history-build;
  existing large-bundle warning unchanged. JS syntax and whitespace PASS.
- Owner PowerShell receipts: new Core suites 33/33; full Core 36 suites,
  1826/1826 tests PASS using cached binary and fail-closed ephemeral Mongo harness.
- Synthetic loopback preview used the real report page/role gate/CSV exporter with
  substituted adapters and no live APIs, credentials, browser storage or database.
  In-memory bundle guard and preview TypeScript checks PASS.
- Owner confirmed sample summary, request-date selection, service notes/parts and
  separate vendor hours; 30-row pagination; empty history, unavailable report,
  denied role and Facility-change behavior. Attached CSV contents verified all
  30 unique WOs 9001 through 9030, newest first, 60 internal labor hours and
  3000 complete direct cost. Actual Excel rendering and placeholder record-link
  navigation were not separately established.
- Final source/scope review found no blocking issue; whitespace check PASS.

## Delivery and follow-up

Owner authorized commit and local main merge. Publication and controlled runtime
rollout remain separate, preserving Ubuntu local patches. Synthetic verification
does not establish deployed behavior.

Discussed future reporting load: retain current bounded reports in owning services;
assess a queued worker with limited concurrency before heavier month/year-end or
scheduled exports. Container isolation does not remove shared database load. No
queue, worker, service-boundary or infrastructure change was made.
