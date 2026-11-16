# Asset Inventory report — November 16, 2026

## Scope

Owner selected Asset Inventory as the first report in a general Reports area.
Windows source was fast-forwarded by owner to `aeb65e0`, then owner created
`feat/asset-inventory-report`. Initial worktree was clean. Implementation remains
uncommitted; no branch/merge/commit/push, deployment, dependency installation,
real database access, runtime service or scheduled-job operation was performed
by this implementation task.

## Behavior

- Added authenticated `/reports` frontend route and Reports sidebar entry for
  administrators and technicians. Customers/viewers are denied by route and API.
  Sidebar canonical technician recognition was corrected so Reports is visible
  for that existing role. Existing common navigation otherwise remains intact.
- Added Core `/reports/inventory` and `/reports/inventory/options` beneath the
  existing report router; legacy report routes/exports are unchanged. Core owns
  this read-only inventory projection; no cross-service coupling was added.
- Exact selected Facility is required and must exist. Technician scope uses the
  existing operational ownership helper and normalized Facility claims. Global
  and foreign Assets are excluded. Filter Department must belong to the Facility.
  Department names are resolved only from that Facility; dangling/foreign
  references are marked unavailable rather than exposing another Facility's name.
- Filters: Department (including unassigned), Asset status, archived include/
  exclude/only, exact recorded equipment class, and literal equipment search
  across control number, manufacturer, model, serial, and description. Objects,
  arrays, unknown filters, invalid enums/IDs and strings over 120 characters fail.
- Deleted Assets are always excluded. Default archive selection excludes archived
  Assets. Retired is an independent status and remains unless status-filtered.
- Rows include identity, manufacturer/model, description, serial, equipment class,
  Department resolution, location note, status/archive, recorded PM frequency and
  last/next dates. No notes, financial fields, documents or user details are sent.
- 5,000-Asset limit and 10-second Asset query bound; limit+1 rejects oversized
  reports with 413, never silently truncates. Department choices load separately
  so large inventories can be filtered before any inventory generation.
- Generated-time label, filters, row count, missing-data counts and report-basis
  notes accompany results. This is current inventory, not historical/as-of
  reconstruction, verified PM completion, compliance or overdue analysis.
  Missing PM dates do not imply overdue. No contract coverage/history is claimed.
- Client renders 50 captured rows per page. CSV contains the entire captured
  result set with metadata/filters/limitations; it does not refetch or export only
  the visible page. Unknown dates remain blank and spreadsheet formulas are
  neutralized. There is no XLSX/PDF output in this slice.
- Report/export hides when filters or identity/Facility change; async results
  from previous identities cannot be shown. Explicit request Facility overrides
  stale browser storage through the existing Core-client interceptor behavior.
- No schema/index/migration, rate or lifecycle-policy change.

## Verification

- Frontend full Vitest after UI changes: 44 files, 449/449 tests PASS, including
  12 new report/UI/CSV tests. Three subsequently added API adapter tests PASS in
  a targeted run (not claimed as part of that earlier full-run total).
- Application TypeScript with established `--ignoreDeprecations 5.0`: PASS,
  including the new adapter tests. Original tsconfig remains unchanged.
- Vite bundle PASS to ignored `frontend/node_modules/.tmp/inventory-report-build`;
  existing large-bundle warning remains.
- 11 isolated Core handler unit tests PASS with mocked models and no sockets/DB.
  Cover query scope, bounds, mapping, missing references, literal search, validation,
  foreign Department rejection and oversized/unavailable response handling.
- New authenticated `inventoryReport.endpoint.test.mjs` prepared, syntax checked
  and discovered by Jest. Uses existing fail-closed MongoMemoryServer harness and
  synthetic data only. Covers both APIs, denied roles, Technician scope, Facility
  and Department isolation, defaults/exclusions, read-only records, filter
  combinations, empty responses and >5,000 rejection. Not executed by agent:
  prior integration attempts established loopback EACCES in this tool environment.
- Source syntax and `git diff --check`: PASS.

## Next gate

### Final review and commit authorization

Owner confirmed all four Department/archive combinations and empty/unavailable/
viewer/Facility-change behavior. Screenshot verifies two default rows and the
expected missing-data counts. The attached synthetic CSV was read: all60 unique
control numbers SYN-001 through SYN-060, no missing IDs, correct Hospital/count/
generation/filter/report-basis metadata. This proves the export includes the full
captured population; actual Excel rendering and placeholder Asset navigation
were not independently observed. Preview shutdown was requested but not observed.

Owner authorized final review and commit. Review found no blocking findings in
scope/access controls, query validation/bounds, missing-reference handling, stale
UI suppression, field allowlisting, CSV escaping or integration placement. Final
frontend regression 45 files/452 tests PASS; TypeScript compatibility check PASS;
whitespace check PASS. Existing Core owner receipts remain 34 suites/1793 tests
including31 inventory cases. No production source changed during final review.

Recommend delivering this report separately rather than waiting for the entire
report catalog. Publication/merge/deployment and authenticated production smoke
remain subsequent steps; no such runtime action has occurred in this checkpoint.
No dependency/schema changes. Ubuntu runtime local patches are not part of this
Windows commit. This section supersedes earlier pending-verification wording.

### Owner backend verification and preview preparation

Owner supplied PASS receipts: both inventory suites 31/31 tests, then full Core
34/34 suites, 1793/1793 tests. These supersede the earlier pending Core gate.
Prepared `frontend/verification/inventory-preview/` for manual checking of the
actual Reports route/page/CSV exporter with synthetic adapters. Loopback-only
127.0.0.1:5189, strict port, config/env loading disabled, no sign-in/storage/live
API/database/scheduler. Local Asset links are placeholders. Includes default
inventory, filters/archive, 60-row pagination, empty/error and role/Facility
controls. README records expected counts and CSV checks. Build includes a guard
excluding live context/API modules. In-memory bundle and preview TypeScript checks
PASS; in-memory mode avoids a tool-environment bundle-directory write restriction.
No server was started by agent. Manual browser
and actual CSV/Excel verification remain pending; build is not browser proof.

Owner runs the two new Core suites in the existing Windows dependency-equipped
checkout, with runtime downloads disabled:

```powershell
cd C:\Users\jason\Documents\ChatGPT\Cronus\repository\core-service
$env:NODE_ENV = "test"
$env:MONGOMS_RUNTIME_DOWNLOAD = "false"
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath src/routers/_tests_/inventoryReport.unit.test.mjs src/routers/_tests_/inventoryReport.endpoint.test.mjs
```

Then complete appropriate regression and synthetic browser/CSV verification,
review final diff, and obtain separate Git delivery/deployment authorization.
No production smoke or performance claim is established here. Existing Ubuntu
local changes and production source are untouched by Windows implementation.
