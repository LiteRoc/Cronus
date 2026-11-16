# Synthetic Month-end browser preview

From frontend run `node verification/month-end-preview/run.mjs` and open
http://127.0.0.1:5193. Stop with Ctrl+C. Real report page/role gate/CSV; synthetic
adapters only. No live APIs/auth, storage, environment loading, database or
scheduler. In-memory guard: `node verification/month-end-preview/run.mjs --build`.
Record links are local placeholders. Mock dates accept January–November2026.

Sample October2026 Completed only:2 completions,4 internal labor hours,1 internal
travel hour, known200/complete unavailable. Vendor labor4 separate, missing vendor
travel1. Type bars:1 Planned Maintenance and1 Corrective Maintenance. Daily line:
1 on October1 and1 on October2. Current backlog2, overdue1, missing due1; priority
bars High1 and Normal1. Chart counts accessible in text; CSV includes chart data.
Current backlog work-category chart/cards: Open PM1 (overdue1), Open corrective1
(missing due1), Other open work0. These categories sum to the same2-record backlog.

Include archived:3 completions,6 labor,1.5 travel, known300/complete unavailable;
type bars Planned2/Corrective1, day3 adds1. November is provisional.
55 completions scenario Completed only:50/page then5, known5500,110 labor,
27.5 travel, CSV all55 completions plus separate2-row backlog.

Empty, unavailable/no export, Viewer denied, Technician allowed, hospital change
hides prior results; HospitalB empty. Browser mocks test presentation, not backend
selection/security, which use separate isolated endpoint tests.
