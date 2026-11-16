# Synthetic Asset Inventory browser check

Uses the actual Reports route, page and CSV exporter with synthetic user,
Facility, department and report adapters. No live APIs, environment files,
browser storage, tokens, database or schedulers are used. Asset destinations
are local placeholders. This is browser verification, not deployed end-to-end proof.

From frontend: `node verification/inventory-preview/run.mjs`.
Open http://127.0.0.1:5189. Stop with Ctrl+C. Loopback-only, strict port.

Checklist:

1. Keep Sample inventory, Synthetic Hospital A, Administrator. Generate inventory:
   two assets, SYN-001 and SYN-002; missing serial 1, unassigned Department 1,
   missing next PM 1. SYN-003 is archived and excluded by default.
2. Download CSV: two Asset rows, generation metadata and filters, blank unknown
   dates/serial, missing-data counts, and synthetic report notes.
3. Department Synthetic Imaging -> Generate: SYN-001 only. Unassigned ->
   Generate: SYN-002 only. Reset All departments.
4. Archived only -> Generate: SYN-003 only. Include archived -> Generate:
   three assets. Reset Exclude archived. Search Monitor -> one asset. Clear
   search and verify old results/download hide until regenerated.
5. Follow SYN-001 to the local placeholder and return. Generate again.
6. 60 assets scenario: 50 rows on page 1, ten on page 2; CSV contains all 60.
7. No assets: explicit empty result, zero count and metadata remain exportable.
   Unavailable: error and no download.
8. Technician: Reports works. Viewer: redirected/denied. Restore Administrator
   then Open Reports. Generate and switch hospital: prior results disappear.
   No hospital: Generate disabled. Restore Hospital A.

Fixtures exercise client presentation/filtering; authenticated backend query
semantics were verified by the separate synthetic endpoint suite.
Bundle check: `node verification/inventory-preview/run.mjs --build` (guard checks
production adapters were excluded). This check builds in memory and writes no bundle.
