# Year-end reporting and operations PDF exports

Implemented on feat/year-end-report from 50960f1 after owner confirmed month-end
deployment. Owner requested PDF export for both month-end and year-end reports.

Core adds GET /reports/year-end for existing administrator/technician roles and
the exact selected authorized facility. Calendar or fiscal years use year-ending
and start-month filters. UTC completion-date cohorts reuse established whole-WO
hours and canonical cost semantics. Two bounded queries select completions and
current backlog; 5000 records per cohort, query timeouts, no partial export.
Future completions are excluded. Twelve monthly summaries reconcile to the annual
cohort; future months are unobserved. Annual hours are rounded once from raw time,
not obtained by summing rounded monthly values. Current backlog is explicitly
not historical year-end backlog. Archived completions remain opt-in.

Frontend adds the protected year-end page, calendar/fiscal filters, colorful
charts, accessible counts, monthly table, paginated completion records and CSV.
Selected user/role/facility/filter capture guards hide stale results/exports.
Both operations pages provide PDF download using captured report data and existing
jsPDF/AutoTable dependencies. Native vector charts require no screenshot, remote
font/image, additional service query or server-side reporting process. PDF is a
management summary with charts, totals, separate current backlog and limitations;
CSV retains all individual completion/backlog records. Incomplete costs remain
Unavailable, and provisional years/future months are labeled.

Verification: frontend 54 files/489 tests pass, including actual generated PDF
byte/pagination/immutability checks, export errors and captured-data behavior.
Application TypeScript and synthetic preview in-memory build pass. Pure annual
Core suite passes 13 tests. Endpoint tests use the fail-closed ephemeral Mongo
harness; owner reports targeted 19/19 and full Core 44 suites/1903 tests PASS.
Owner confirmed calendar/fiscal preview, provisional/future-month labels and
empty/error/role/facility behaviors. Owner approved both PDF layouts; extracted
PDF totals matched sample data. Fiscal 2025 July-start CSV reviewed: all 55 WOs,
110 labor/27.5 travel hours, known 5500 with unknown complete total, monthly
counts reconciled, 28 Planned/27 Corrective and separate 2-record current backlog.
Final source review found no blocking issues. Owner authorized commit and local
main merge; publication and deployment are pending.

No dependency changes, real database access, containers or scheduled jobs touched.
Synthetic preview instructions:
frontend/verification/year-end-preview/README.md.
