# Synthetic Work Order preview

Run `node verification/work-order-preview/run.mjs` from frontend. Loopback only:
http://127.0.0.1:5191. Stop with Ctrl+C. No real API, database, credentials, storage,
environment files or scheduler. Real report page, role gate and CSV exporter with
synthetic adapters. Record links are placeholders. Build guard:
`node verification/work-order-preview/run.mjs --build` (in memory).

Expected checks:

- Sample open: 3 WOs (Requested/Open/In Progress), 1 overdue, 2 missing due dates,
  1 unavailable asset, age 15 days; known direct subtotal 300, complete unavailable.
- High priority: 1 WO, known/complete 100. Exact type Preventive Maintenance: 2 WOs.
- Closed: November 1–30, 2026: 2 Completed WOs, known 200, complete unavailable.
  Include archived: 3 WOs, 1 archived, known 300. November 16 alone: zero.
- 55-row scenario open: 50 on first page, 5 on next; CSV all 55, known 5500 and
  complete unavailable. Sample CSV unknown totals blank, not zero.
- Empty shows no rows; Unavailable shows error and no export; Viewer is denied;
  changing hospital hides captured results, Hospital B generates an empty report.

These mocks verify browser presentation, not backend security or cohort semantics;
the isolated authenticated endpoint suite verifies those separately.
