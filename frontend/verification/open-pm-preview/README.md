# Synthetic Open PM browser preview

From frontend: `node verification/open-pm-preview/run.mjs`.
Open http://127.0.0.1:5192. Stop with Ctrl+C. Real report page/role gate/CSV;
synthetic adapters only, no live APIs, credentials, browser storage, environment
files, database, scheduler or container. Record links are placeholders. Keep
Open PM selected. In-memory guard: `node verification/open-pm-preview/run.mjs --build`.

Fixed generation: November16,2026 at12:00UTC. Sample expectations:

| Selection | Rows | Known subtotal | Complete total |
| --- | ---: | ---: | --- |
| All | 6 | 600 | Unavailable |
| Overdue | 1 | 100 | 100 |
| Next30 days | 2 | 200 | Unavailable |
| Missing due | 2 | 200 | 200 |
| Due range November16 only | 1 | 100 | Unavailable |
| High priority, All | 1 | 100 | 100 |

All summary:1 overdue,2 missing due,1 unavailable asset,15-day ages.
Next30 includes exactly generation but excludes December16 at12:00UTC.
Missing due never classified overdue. Date-range changes hide captured export.

55-row scenario:50/page then5; all55 exported; known5500, complete unavailable.
Check Empty, Unavailable with no export, Viewer denied, Hospital change hides old
results and HospitalB generates empty; Technician may view. Browser mocks do not
verify backend boundaries; authenticated isolated endpoint tests do that.
