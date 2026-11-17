# Synthetic year-end preview

From frontend: `node verification/year-end-preview/run.mjs`, then open
http://127.0.0.1:5194. Stop with Ctrl+C. Real report page and role gate;
synthetic context/API only, no live credentials, services or database.
Generation fixed at November 17, 2026, 12:00 UTC.

Choose year ending 2025, January, Completed only: 12 completions,
24 internal labor hours, 6 travel hours, known cost 1200, complete cost
unavailable. Each month has 1 completion; 6 Planned and 6 Corrective.
Current backlog is separate: 2 open, PM 1 and corrective 1.
Fiscal year ending 2026, July: July 2025 through June 2026, same totals.
Calendar 2026 is provisional; December is future/unobserved.

Download PDF and CSV: PDF contains summary, colorful charts, monthly totals,
current backlog and report basis. CSV contains all captured individual records.
Check PDF page headers/footers, readable tables and charts, unknown total marked
Unavailable, and provisional/future labels. PDF generation makes no new API call.
The 55-completion scenario has 50 records on page 1 and 5 on page 2;
PDF summary and CSV use all 55 (110 labor, 27.5 travel, known cost 5500).

Check empty results, unavailable results without export, Viewer denied,
Technician allowed, and hospital/filter changes hiding previous exports.
Hospital B is empty. These browser checks do not replace isolated endpoint tests.

Month-end PDF can be checked separately with
`node verification/month-end-preview/run.mjs` at http://127.0.0.1:5193.
