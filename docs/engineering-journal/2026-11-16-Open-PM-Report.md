# Open PM reporting - November 16, 2026

## Scope and state

Owner confirmed both deployed Work Order reports at ebe6876, then requested Open
PM. Reviewed for owner-authorized commit/local main merge on feat/open-pm-report.
Publication and deployment remain pending. Reuses Work Order report builder,
API, role/Facility boundary, CSV and page; dedicated /reports/open-pm entry starts
in PM mode. No new service/container, schema/index, dependencies, scheduler,
environment or operational database changes. Existing Ubuntu patches untouched.

## Definitions

- Exact Work Order types: Planned Maintenance (current UI/cron creation label),
  Preventive Maintenance (import mapping label), PM (explicit shorthand).
  Other free-text labels are excluded; no description-based inference.
- Current Requested/Open/In Progress only; Completed/Archived/deleted excluded.
  Exact existing selected Facility and assigned-technician claims required.
- Report counts Work Orders, not distinct assets, all scheduled asset obligations,
  completion evidence or a PM compliance denominator. Missing Work Orders cannot
  be reconstructed from asset schedule fields. No schedule generation is triggered.
- Due selection uses Work Order dueDate exclusively: All, Overdue, Next30 days,
  Missing, paired inclusive UTC date range. Missing null/absent dates included in
  All/Missing, excluded from dated views; never presumed overdue. All sorts by
  dueDate then ID (Mongo missing/null dates first). Summary covers captured cohort.
- Generation timestamp captured once before queries and reused for query bounds,
  age, overdue and report metadata. Overdue strictly before generation; next30
  includes generation and excludes exactly30 days later. Elapsed age remains
  whole24-hour periods; unknown/future request age remains unknown.
- PM cannot override type cohort, include archived, or reuse dates without range
  selection. Priority optional. Existing open/closed behavior retained.
- Same5000-row rejection,10-second main/reference query bounds, read-only
  canonical known/unknown costs, owned nondeleted Asset reference resolution,
  no-store response,50-row pages and full captured CSV. Costs are whole-WO
  amounts, not expenses incurred within due-date range.
- UI prevents stale hospital/filter results and clears incompatible date fields
  on due-selection changes. Hospital reset preserves PM mode and clears filters.

## Verification

- Pure Core:12 new PM tests plus16 existing Work Order tests,28/28 PASS.
- Frontend focused UI/API:8/8 PASS; full49 files/472 tests PASS.
- Application/preview TypeScript with established deprecation override PASS.
- Application Vite build PASS to ignored node_modules/.tmp/open-pm-report-build,
  environment-file loading disabled. Existing large-chunk warning unchanged.
- Preview in-memory build guard PASS, live auth/API/context adapters excluded.
  Loopback-only127.0.0.1:5192, synthetic data, no storage/credentials/env/database/
  scheduler. Agent started no server. Owner confirmed sample figures, all four
  due selections and all four empty/error/role/Facility scenarios. Attached CSV
  contents verified55 unique PM WOs9201–9255, known5500 and blank unknown complete
  total. Actual Excel rendering and placeholder record navigation not separately
  established.
- New authenticated endpoint suite prepared and syntax checked:5 grouped tests
  for role/Facility, cohort/read-only, due selection, inclusive range/priority,
  foreign Asset privacy and limit rejection. Existing fail-closed ephemeral Mongo
  harness, runtime downloads disabled. Owner PowerShell receipts establish targeted
  PM/Work Order regression39/39 and full Core40 suites/1865 tests PASS. Agent
  integration execution remains limited by the established tool loopback restriction.
- Final source/scope review found no blocking issues; whitespace checks PASS.
  No production source changed after successful test receipts, only documentation.
  Owner authorized commit/local main merge. Publication and rollout remain pending.
