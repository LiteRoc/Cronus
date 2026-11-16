# Month-end operations - November 16, 2026

## Scope and definitions

Owner confirmed deployed Open PM, requested month-end implementation and explicitly
requested graphs/colors. Reviewed for owner-authorized commit and local main merge
on feat/month-end-report from f8e02f1. Publication/deployment remain pending.
No real database, containers, scheduler, dependencies, schema/index or environment
changes. Reports remain Core-owned. No reporting worker/queue introduced: this
slice is on demand, single hospital, bounded to5000 activity and5000 backlog rows.
No production load test or capacity guarantee; heavier scheduled/multi-hospital
exports still require the previously discussed worker/load assessment.

- GET /reports/month-end requires authenticated admin/technician, exact existing
  selected Facility and technician claims. Valid UTC month1900 through current
  month; future/invalid/array/extra filters rejected. Current month provisional.
- Activity is current Completed status with completionDate >= month start and
  < next UTC month start. Optional Archived also needs completionDate. Missing
  completion dates are excluded, not substituted. This is not historical status
  reconstruction, immutable month close or completeness certification.
- Internal labor/travel and canonical costs are current whole-WO totals from that
  completion cohort, not actual time worked/expenses incurred within the month.
  Round once after summing raw minutes. Invalid internal entries disclosed;
  vendor known labor/travel summed separately with missing-hour counts. Never
  combine vendor and internal hours into one presumed productive total.
- Current Requested/Open/In Progress backlog queried independently, explicitly
  labeled at generation, not reconstructed month-end backlog. No combined expense
  total across cohorts. Same generatedAt timestamp used for metadata/age/overdue.
  Queries do not establish an atomic snapshot; concurrent edits can affect reads.
- Both cohorts exclude deleted/foreign/unscoped records. Assets resolved via own
  Facility and nondeleted references only.5001 limit rejects whole report for
  either oversized cohort;10-second main/reference bounds. Canonical engine reads
  costs with unknown complete totals, no cache repair or persistence writes.
- Reuses Work Order report builder for safe rows/costs/backlog. New protected
  /reports/month-end page with blue/teal/purple summary cards and Recharts
  plots: completed by exact recorded type, daily UTC completions, current backlog
  by recorded priority. Unknown category labeled Not recorded. Zero dates included.
  Explicit backlog PM/corrective/other chart added below. No compliance/margin.
- Count tables/lists accompany charts; graph colors are not sole identifiers.
  CSV exports chart counts, summary, all completion rows and separately titled
  full current backlog. Unknown values blank, quoted/formula-neutralized cells,
  BOM. Completion preview50/page. Identity/filter capture and sequencing hide
  stale results/download after hospital/month/archive changes.

## Verification and remaining gates

- Pure builder/filter tests13/13 PASS. Includes invalid/future filters, leap/year
  boundaries, cohorts, chart reconciliation, aggregate time rounding, vendor-hour
  separation, canonical cost evidence, immutability, empty/current-month states.
- Focused frontend UI/API/CSV7/7 PASS; application and preview TypeScript PASS
  using established ignoreDeprecations5.0 override.
- Synthetic preview in-memory build guard PASS (live adapters excluded). Port5193,
  real report page and CSV, mock contexts/API; no auth/storage/env/database/jobs.
  Agent started no preview server. Owner confirmed sample graphs, archived/current
  month behavior, updated backlog categories and all four empty/error/role/Facility
  scenarios. Attached CSV verified55 unique completions9301–9355,28 Planned/27
  Corrective, matching daily chart counts,110 labor/27.5 travel,known5500 and blank
  complete total. Separate current backlog2:PM1/corrective1/other0. Actual Excel
  rendering and placeholder record navigation were not separately established.
- Authenticated endpoint suite prepared and syntax checked:6 cases including
  two cohort-limit variants. Uses existing fail-closed ephemeral Mongo harness;
  configured URI blocked and runtime downloads disabled. Owner final PowerShell
  receipts establish targeted19/19 and full Core42 suites/1884 tests PASS.
- Full frontend regression51 files/479 tests PASS. Application Vite bundle PASS
  to ignored node_modules/.tmp/month-end-report-build with envDir:false. Existing
  large-chunk warning remains. Syntax/whitespace checks PASS.
- Final source/scope review found no blocking issue. Owner authorized commit/local
  main merge. Publication/deployment remain pending. Ubuntu patches untouched.

## Backlog clarification and report reference

Owner clarified backlog should split Open PM/Open corrective/Other open work.
Added mutually exclusive categories, per-category overdue/missing-date counts,
chart, cards and CSV summary. Exact PM labels match Open PM report; corrective
uses Corrective Maintenance/CM; unknown/missing labels remain Other. All categories
sum to captured current backlog. No completion cohort or historical-as-of change.

Owner supplied EOM_2026_October_MaryRutanHospital.pdf as layout reference. Read
summary/department/close-code/detail extracts from pages1–6 of262; no operational
records copied into fixtures or repository. Use Sigma/hospital/month header and
clearly separated summary sections plus requested charts. Example generated-period
completion percentages, prior-period pending, critical/noncritical PM, department
service-code matrix and procedure appendices have different denominators/data
requirements; they are reference scope, not implemented or inferred metrics.
This does not establish pixel-for-pixel PDF fidelity or a PDF export capability.

Owner pre-refinement receipts: targeted18/18, full Core42/1883. Superseded by final
targeted19/full Core1884 receipts and browser/CSV evidence above after refinements.
Post-refinement full frontend51 files/479 tests, application/preview builds and
TypeScript PASS. Existing large-chunk warning remains; whitespace PASS.
