# Sigma internal Contract report — November 15, 2026

## Scope and implementation

The owner selected an internal Sigma report, then agreed to start with one
hospital/customer Contract and a selected reporting period. Implementation is
local and uncommitted on the existing main checkout. Initial status was clean.
No branch, commit, push, deployment, database access, or dependency installation
was performed.

The Contract detail page now contains an administrator-only report panel with
inclusive UTC date inputs, preview, supporting Work Order links, and a CSV
download that opens in Excel. This is CSV, not an XLSX workbook or PDF.
The API is GET `/contracts/:id/sigma-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
It requires authentication, admin role, and a selected Facility. The Contract
query uses exact Facility equality, excluding global records. Only active,
expired, terminated, or superseded customer Contracts are supported.

Contract-service retains ownership of financial reporting. It calls the existing
per-request Core client and `/workorders/by-contract/:contractId` route. That
route's projection additively includes `facilityId` and `contractId` so the report
can verify every row against the selected Contract and Facility. Core's existing
canonical cost serializer remains unchanged. There are no new collection writes,
schema changes, migrations, rate policies, or service ownership changes.

## Financial and population definitions

- Prorated Contract value reuses `proratedValueBetween`, including its applied
  amendment timeline, Contract-term clipping, and 365-day convention. It is not
  invoiced/collected revenue or an accounting recognition statement.
- Population is explicitly linked, non-archived Work Orders requested within the
  selected UTC period, clipped to the Contract term. Current asset membership is
  not used to reconstruct historical coverage. Unlinked and archived records are
  excluded; this report cannot certify completeness of operational recording.
- Direct costs and labor/travel hours are **current whole-Work-Order totals** for
  that population. Entries can fall outside the reporting period. Current open
  and closed counts are not historical backlog snapshots or completion counts
  within the reporting period. Preventive count is not PM compliance.
- Known subtotals and nullable complete totals reuse the canonical cost adapter.
  Missing/legacy costs remain unknown. Missing rates are not invented.
- Recurring vendor agreement payouts are excluded from direct Work Order costs;
  overlap with direct vendor expenses remains unresolved. Period contribution
  and margin are always unavailable, even when Work Order pricing is complete,
  because period expense attribution is not established. Overhead is excluded.
- Monetary values retain the source Contract currency basis without inventing a
  currency code, converting currencies, or adding a currency symbol.

Malformed dates, reversed/over-five-year periods, and invalid Contract/Facility
IDs are rejected. Duplicate, mismatched, out-of-period, or malformed upstream
rows fail closed. Upstream failure is unavailable, never an empty-success report.
The endpoint sends no-store on successful responses. The frontend clears/hides
reports when Facility, Contract, role, or date inputs change and guards stale
responses. CSV cells are quoted and formula prefixes neutralized.

## Verification and limitations

Verified with Node 24.22.1 and isolated synthetic records only:

```powershell
& $env:CODEX_TASK_WORKSPACE_NODE --experimental-test-module-mocks --test contract-service/src/services/_tests_/sigmaReport.native.test.mjs contract-service/src/controllers/_tests_/sigmaReport.native.test.mjs frontend/verification/sigmaReportCsv.native.check.mjs
```

17/17 focused native tests passed: calendar/inclusive-end boundaries, amendment
proration, costs/activity reconciliation, unknown costs, empty/outside-term
population, upstream failures, scope verification, controller role/input/query
checks, vendor exclusions, CSV escaping/formula safety, and blank unknown totals.
JavaScript syntax checks and `git diff --check` passed. Controller tests stub the
Contract model and call the controller directly; they do not establish HTTP/JWT
middleware integration. Native tests are separate from the existing Jest suite.

Application node_modules are absent in this checkout. Full regression suites,
TypeScript/Vite build, React/browser behavior, live API/Excel behavior, and
operational data were not verified. No dependencies were installed. These checks
remain required before calling this release-ready or deploying. The pre-existing
TypeScript deprecation-setting mismatch remains outside this task.

Both Core's additive projection and the Contract endpoint are needed for report
generation. An older Core response without scope identifiers is rejected as
unavailable. Runtime rollout remains separately authorized; no deployment occurred.

## Follow-up

### Commit preparation — November 16, 2026

Owner completed final code review and requested preparation of the Git commit.
Final supplied regression receipts: Core 32 suites/1762 tests; Contract 14
suites/229 tests including the 24 authenticated report cases; frontend 40
files/423 tests. Separate native checks remain 17/17. Frontend TypeScript and
bundle plus preview bundle/TypeScript passed as recorded below.

Owner started the loopback synthetic preview and confirmed partial-cost output,
complete-cost output, and all four requested scenarios (empty, unavailable,
viewer hiding, Facility-change clearing). Attached CSV contents were read and
verified: selected November 1-16 dates, synthetic value 160, known direct costs
150 with blank unknown total, two supporting Work Orders and limitations.
That is CSV content verification, not an independently observed Excel rendering
or deployed browser test. Placeholder Work Order navigation was not separately
confirmed. Owner was instructed to stop preview with Ctrl+C; shutdown was not
independently observed. No production runtime, operational rate or real database
change occurred. Commit preparation does not create a commit, push or deploy.

### Temporary browser preview — November 16, 2026

Owner verified the corrected report HTTP suite 24/24 and the combined Contract
suite 14/14 suites, 229/229 tests. Core remains verified at 1762/1762 and frontend
at 423/423. These receipts supersede earlier pending HTTP/regression wording.

Owner has no isolated browser test environment and requested step-by-step setup.
Prepared `frontend/verification/sigma-preview/`: actual report panel/CSV exporter,
synthetic context and report fixtures, local placeholder Work Order navigation,
scenario/role/Facility controls, and a dedicated Vite runner. Config/env loading
is disabled; no proxies or live clients, sign-in, browser storage, database or
schedulers are used. Runner binds only 127.0.0.1:5188 with strictPort; Ctrl+C
closes it. Preview startup is left to the owner; no runtime was started by agent.
The accompanying README records exact expected figures and a manual CSV checklist.

Synthetic bundle build PASS, including the guard verifying production API/context
adapters are excluded. Preview TypeScript check uses the existing deprecation
override. Browser rendering/download and actual Excel opening still require owner
verification; compilation alone is not a browser pass. No production source,
dependency versions, schema, real data or Git history changed for this preview.

### Backend verification environment follow-up

**Latest owner results:** Contract 13/13 suites, 205/205 tests PASS; Core 32/32
suites, 1762/1762 tests PASS. Core additionally needed its own cached MongoDB 8.2.6
binary (Contract uses 8.2.1). Existing duplicate-index warnings remain outside scope.
These results supersede the earlier failing regression checkpoint below.

Prepared `contract-service/src/routes/_tests_/sigmaReport.endpoint.test.js` as the
next authenticated integration gate. Uses security-test mode to avoid Contract's
NODE_ENV=test auth bypass, real JWT middleware, real Contract and Core WorkOrder
routers, the existing isolated dual-database harness, and a Supertest-only Axios
bridge with no external-network fallback. Covers access denial, exact selected
Facility, global/cross-Facility rejection, input validation, actual Core projection
and canonical serialization, read-only snapshots, period/term boundaries, excluded
records, partial/legacy costs, unavailable upstream data, and per-request headers.
Uses synthetic fixtures only. JS syntax, Jest discovery and whitespace checks
PASS; this new suite has not been executed. Owner should run the file directly
with the established PowerShell Jest invocation before rerunning the whole suite.

Owner's first new-endpoint run: 22/23 PASS. The failing legacy fixture expected
a 100 known subtotal, but the established Contract adapter deliberately returns
canonical_cost_unavailable (knownSubtotal 0, total null) without a versioned
economics envelope. Corrected that test expectation after inspecting `scopeOf`;
production behavior is unchanged. Added a separate versioned native partial-cost
case to verify 100 priced labor is retained while unapproved travel keeps the
complete total unknown. Syntax/whitespace PASS; the resulting 24-case endpoint
suite awaits owner rerun. This is not a claim of integration success.

Owner installed both backend dependency sets with install scripts disabled and
separately cached the MongoDB 8.2.1 test executable. The existing shared Babel
bridge required an undeclared CommonJS transform plugin. Owner added pinned
`@babel/plugin-transform-modules-commonjs` 7.29.14 to Core devDependencies.
Lockfile review shows the plugin addition and six Babel tooling packages moving
from 7.29.7 to 7.29.14; no production dependency declarations changed.

Owner's Contract run: 12/13 suites and 143/205 tests passed; all 62 failures were
in Vendor Coverage with an untransformed ESM helper. Core and Contract Jest
transform patterns used forward-slash-only paths. Updated those two patterns to
match Windows and POSIX separators; no test assertions or application modules
changed. Direct path-matching and actual Babel helper conversion checks PASS.
The agent's targeted integration attempt failed at temporary loopback Mongo
connection with EACCES under its execution restrictions; it did not establish
suite success. Owner must rerun Jest in PowerShell. No real database or deployed
service was accessed. Backend HTTP report integration remains pending.

### Frontend verification follow-up, same day

The owner installed frontend dependencies with `npm ci --ignore-scripts` and
supplied the test output. TypeScript passed with the compatibility override, but
four existing Contract coverage tests failed because the newly mounted report
requires User/Facility providers. Vitest also collected the Node-native CSV test
and rejected it as an empty Vitest suite.

Corrected the existing coverage-test harness by stubbing the independent report
panel, consistent with its existing child-panel stubs; all four existing test
assertions are unchanged. Renamed the CSV check to `sigmaReportCsv.native.check.mjs`
so it stays explicitly runnable under Node without Vitest collecting it. Added
nine dedicated report-panel tests using mocked context and API: role restrictions,
missing Facility, selected period/scope, incomplete costs, Work Order links,
date-change hiding, errors, and stale Facility/Contract responses.

Verified locally after corrections:

- Frontend Vitest: 40 files, 423/423 tests PASS.
- TypeScript: `tsc -p tsconfig.app.json --noEmit --ignoreDeprecations 5.0` PASS.
- Vite production bundle: PASS, output confined to ignored
  `frontend/node_modules/.tmp/sigma-report-build`; existing chunk-size warning.
- Separate native report tests: 17/17 PASS after rename.
- Git whitespace check: PASS.

This supersedes the earlier dependency-absence/frontend-verification limitation.
The default build's pre-existing deprecation setting was not changed. Backend
full regression, authenticated HTTP integration, browser and actual Excel checks
remain pending. No dependency versions/lockfiles, production source, real database,
running service, scheduler or Git history changed in this follow-up.

Verify backend regression plus authenticated synthetic HTTP integration for the new route and
Core projection. Then review the diff before separately authorized Git delivery
and rollout. Future period profitability needs an accepted expense-date and
vendor-payout attribution model. All-hospital rollups, fiscal-YTD policy, XLSX,
PDF, and historical snapshots remain future scope.
