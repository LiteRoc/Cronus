# Synthetic Asset History browser check

From frontend: `node verification/asset-history-preview/run.mjs`.
Open http://127.0.0.1:5190; keep the terminal open and stop with Ctrl+C.
Loopback-only, strict port. Uses actual Reports role gate, history page and CSV
exporter, with synthetic context/API adapters. No environment files, browser
storage, sign-in, live API, database or scheduler. Links open local placeholders.

Checklist:

1. Keep Sample service history, Hospital A, Administrator. Asset ID is prefilled;
   Generate asset history with date inputs blank. Expect SYN-HIST-001, two WOs,
   one archived,3 internal labor hours,0.5 internal travel hours, one fully priced,
   known direct cost150, complete direct cost Unavailable. Newest request first:
   WO9002 February28, then WO9001 February1. Both completion dates March2.
2. Expand Recorded service notes and parts: see narrative and unavailable Part
   label on9002. Vendor labor4 remains separate; vendor travel Unknown.
3. Download history CSV: equipment summary, filter/basis metadata, cost components/
   scopes, two WOs with notes/parts/vendor hours. Complete unknown total is blank.
4. Dates February28 through February28 -> only9002, known direct50, complete
   Unavailable. Its March2 completion stays visible. Clear both dates.
5. Change Find asset by to Exact control number; enter SYN-HIST-001 and generate.
   A wrong control number produces an explicit not-found error.
6. 30 WOs scenario -> generate:25 entries on page1,5 on page2. CSV includes all30
   regardless of visible page. Internal labor60, known/complete direct3000.
7. No recorded history -> explicit empty history. Unavailable -> error/no export.
8. Technician access works; Viewer denied. Restore Admin and Open history report.
   Generate and switch hospitals -> old output disappears; Hospital B generation
   is not-found. No hospital disables generation.
9. Open Asset and Work Order links -> local placeholders, return and regenerate.

Fixture amounts/narratives are invented, not approved rates or backend proof.
Bundle guard: `node verification/asset-history-preview/run.mjs --build` (in-memory,
live-adapter exclusion check). Preview TypeScript uses the established override:
`tsc -p verification/asset-history-preview/tsconfig.json --noEmit --ignoreDeprecations 5.0`.
