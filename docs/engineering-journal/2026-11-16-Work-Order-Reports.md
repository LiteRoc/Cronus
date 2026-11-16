# Work Order reports - November 16, 2026

## Scope and state

Owner confirmed deployed Asset Detail/History at a5cddcc and requested the next
reports. Owner authorized commit and local main merge of feat/work-order-reports
after final review. Publication and deployment remain pending. No real
database, container, scheduler, schema, index, dependency or environment changes.
No reporting queue/worker introduced; heavier execution remains a future design
checkpoint before substantial month/year-end or scheduled exports.

## Definitions and implementation

- GET /reports/work-orders: authenticated admin/technician; mandatory existing
  selected Facility via operationalOwnership, with technician claims enforced.
- Open backlog: current Requested/Open/In Progress only. No historical-as-of
  selection. Age is elapsed whole 24-hour periods since request at generation;
  missing/future request dates produce unknown age. Due timestamp earlier than
  generation is overdue; missing due is unknown. Oldest request first, then ID.
- Closed activity: current Completed status and mandatory paired completion-date
  range in inclusive UTC days. Archived records are separately opt-in and must
  also have completion timestamps within the range. Archive status alone does
  not establish service completion. Request dates never substitute for completion.
  Missing completion dates are excluded, not silently assigned synthetic dates.
- Exact optional priority/type filters. Work Order types are free text in schema,
  so type search is exact text, not a guessed enumeration or regular expression.
- Every Work Order query requires exact Facility and deletedAt:null. Limit5001
  rejects results over5000 rather than truncating; main and reference queries
  have 10-second bounds. Current Asset labels are queried only for own Facility
  and nondeleted records. Missing/deleted/foreign references remain unavailable;
  their valid own-Facility Work Orders remain counted. No assignee identity or
  unrestricted population is exposed.
- Canonical Core cost read/combine generates current direct-maintenance costs.
  Known subtotals remain distinct from nullable complete totals. Whole-WO costs
  are not expenses incurred in the completion period. No coverage/PM compliance
  or invented legacy pricing. No cost-cache repair or other persistence writes.
- Protected /reports/work-orders page linked from Reports. Fifty rows per page;
  CSV exports every captured row with generation/filter/basis metadata, dates,
  reference state, age/overdue and known/unknown costs. BOM, quoting and formula
  neutralization; unknowns blank. Identity/filter capture and response sequencing
  prevent old-hospital results from reappearing after selection changes.

## Verification and remaining gates

- Pure Core builder/filter tests:16/16 PASS, no sockets/database.
- Frontend targeted UI/API/CSV:6/6 PASS. Full frontend:49 files/470 tests PASS.
- Application TypeScript with established ignoreDeprecations5.0 override PASS.
- Vite application bundle PASS to ignored node_modules/.tmp/work-order-report-build
  with environment-file loading disabled; existing large-chunk warning remains.
  Syntax and whitespace checks PASS.
- Endpoint suite prepared (6 grouped tests) and syntax checked. Uses existing
  fail-closed ephemeral MongoMemoryServer harness, configured URI blocked and
  runtime downloads disabled. Agent did not run socket-based integration tests
  because the established tool environment cannot connect to test loopback Mongo.
  Owner PowerShell receipts establish targeted22/22 and full Core38 suites,
  1848/1848 tests PASS.
- Synthetic preview prepared at frontend/verification/work-order-preview,
  loopback127.0.0.1:5191, no live APIs, credentials, storage, environment loading,
  database or scheduler. Real page/role gate/CSV with synthetic adapters. In-memory
  build guard verifies live adapters excluded; preview TypeScript PASS. Agent
  started no preview server. Owner confirmed sample open figures, all three
  completion-date/archive checks,55-row pagination and empty/error/role/Facility
  scenarios. Attached CSV contents verified all55 unique WOs9101–9155, known5500
  and blank unknown complete totals. Actual Excel rendering and placeholder
  record navigation were not separately established.
- Final source/scope and whitespace review found no blocking issue. No production
  code changed after the successful test receipts; documentation updated only.
- Owner authorized commit/local main merge; publication/deployment remain pending.
  Existing Ubuntu local patches remain untouched.
