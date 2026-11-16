# Synthetic Sigma browser preview

Uses the actual SigmaContractReport component and CSV exporter with synthetic
User/Facility hooks and report transport. No sign-in, browser storage, live API,
database, or scheduler is used. The Work Order destination is a local placeholder.
This validates presentation and downloads, not the full deployed application.

From PowerShell:

```powershell
cd C:\Users\jason\Documents\ChatGPT\Cronus\repository\frontend
node verification/sigma-preview/run.mjs
```

Open http://127.0.0.1:5188 in a browser. Leave PowerShell open while testing.
Stop with Ctrl+C. The port is loopback-only and strict: an occupied port causes
startup to fail instead of choosing another port. No normal Vite config or
environment files are loaded. Runtime adapters are replaced only in this preview.

1. Keep Administrator, Synthetic Hospital A, Incomplete travel costs selected.
2. Choose 2026-02-01 through 2026-02-28, then Generate report.
3. Expect contract value 280, known direct costs 150, 1 of 2 Work Orders fully
   priced, complete direct total Unavailable, and contribution Unavailable.
4. Download CSV for Excel. Open the downloaded synthetic CSV and check dates,
   280 contract value, 150 direct known subtotal, blank unknown complete total,
   two Work Orders, and the report limitations. Do not treat subtotals as totals.
5. Open SYNTHETIC-WO-1; expect the local placeholder. Return to the report and
   regenerate (the panel remounts on navigation).
6. Choose Complete work-order costs and generate again. Expect known and complete
   direct costs 170; contribution/margin remain Unavailable.
7. Choose No work orders and generate: zero records and an explicit empty message.
8. Choose Report unavailable and generate: error, no download button.
9. Choose Viewer: report hidden. Restore Administrator, generate a report, and
   change hospitals: previous report disappears. No hospital selected disables
   Generate report.
10. Change a report date after generation: old results/download disappear until
    regeneration. Close the browser tab and stop PowerShell with Ctrl+C.

Preview fixtures use 10 per selected day; backend business rules are covered by
the separate authenticated integration suite. Styling comes from the existing
frontend CSS. No dependencies need to be installed beyond the existing frontend.

Verification commands from frontend:

```powershell
node verification/sigma-preview/run.mjs --build
.\node_modules\.bin\tsc.cmd -p verification/sigma-preview/tsconfig.json --noEmit --ignoreDeprecations 5.0
```

Build output is confined to ignored node_modules/.tmp/sigma-synthetic-preview.
The build checks that all three live adapters are replaced and rejects a bundle
containing production context/API adapter modules.
