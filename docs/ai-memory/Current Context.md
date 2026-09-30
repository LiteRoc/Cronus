# Current Context

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

## Labor correction implementation — September 30, 2026

#17 is implemented and verified on its dedicated branch from main `bcab77b`;
merge/closure verification follows separately. Broad gates passed 1,414 core,
116 Contract and 256 frontend tests. Description edits preserve economics;
minute corrections retain captured authority; corrected work dates resolve only
that date, with missing/ambiguous authority unknown. Legacy minutes never recover
pricing; publication and status changes never reprice. See the
[#17 correction and verification record](<../engineering-journal/2026-09-30-gitea-17-labor-corrections.md>).
No deployment, real-rate publication, business-data action or CRM change.
#19 remains **BLOCKED**; CRM remains paused at `807bc38122e771dacccbc23fca4a66363dd58d55`.

## Rate publication hardening — September 30, 2026

#18 software is merged and verified (606 core and 60 Contract/authentication tests).
It adds permanent publication/snapshot regressions and a minimal corrupt-history
guard: ambiguous or invalid current rate history leaves new labor unknown. Valid
#7 rate and snapshot semantics remain unchanged. Each publication supplies the full
period set; starts are inclusive and ends exclusive. See the
[#18 verification and publication record](<../engineering-journal/2026-09-30-gitea-18-rate-publication-hardening.md>).
No operational rate or historical recovery is authorized. #19 remains **BLOCKED**;
CRM remains separate. Runtime stays at the prior deployment; #18 introduces
no deployment, scheduler or real-data action. Lifecycle/Contract reconciliation
remains the broader planned phase, not implementation authorized by this checkpoint.

## Post-deployment handoff — September 29, 2026

**#9 deployed successfully; controlled stop/update/start and startup/runtime verification passed. Authenticated #9 production smoke remains pending because no approved session/safe record scope was available. Next planned phase: Lifecycle/Contract reconciliation. This documentation-only handoff starts no development, runtime or data action.**

Authoritative state at this documentation-only handoff:

- Repository main before this documentation checkpoint and current deployed runtime: `41c470914b209925aad944e747d9939de3add801` (#9). This handoff changes documentation only; it does not advance the runtime checkout.
- The stable checkout `/home/thecapt/apps/cronus-main` was clean at deployment verification. Core, Contract and frontend source mounts all match the deployed SHA.
- #7 is closed as a completed software-remediation issue and deployed. Approved Decisions 1–9 remain authoritative.
- Mary Rutan aggregate-repair preview: **91 assessed, 91 legacy-ambiguous, 0 repairable, 0 unchanged, 0 unsupported, 0 conflicts**. No apply is recommended. No database writes occurred during preview. Historical evidence review is separate follow-up work requiring authorization.
- Labor-rate publication remains deferred because no authoritative organization/network-wide blended internal cost rate or effective date is approved. Do not infer approval from constants, planning/billing rates or historical data.
- Core and Contract schedulers remain disabled (`CRON_ENABLED=false`); re-enablement requires separate authorization.
- Authenticated #14 operational smoke was not performed because no approved admin session/credential source was available. No production lifecycle/reference writes were performed for smoke testing. `referenceoperations` first-use creation/use remains unverified in production.
- Frozen reproduction remains unchanged at `cae8e991137fdbf5ebfe52658512b03a4085aa17`.
- Interaction remains separate, paused and unmerged at `807bc38122e771dacccbc23fca4a66363dd58d55`; #7 compatibility passed at that checkpoint. CRM remains paused.

### #9 deployment verification

All three application containers stopped before the shared checkout advanced. Old Node/watch processes exited and two drain samples found zero old-backend connections/operations. Core, Contract and frontend started in order. Mongo remained continuously running; both schedulers remain disabled (`CRON_ENABLED=false`). Compose overrides were preserved.

- Source fingerprints and startup/runtime checks passed: both backends connected to Mongo; 12 protected-route probes returned 401; frontend shell and five affected modules returned 200. No new startup/index errors or Mongo structural events were detected.
- **Browser reload is required after rollout.** Stale tabs may submit obsolete result payloads; backend validation remains authoritative. Normal access may resume after reload.
- Authenticated #9 production smoke remains pending because no approved session/safe record scope was available. No authenticated production measurement writes were performed. #14 and #15 authenticated first-use smoke also remain open operational verification items.
- No migration, backfill, new collection/index, topology, dependency or configuration change was required; no new transaction/replica-set requirement exists.
- WorkOrder embedded procedure results are canonical. Current TaskResult responses derive from WorkOrder; legacy TaskResult documents remain untouched. Execution snapshots preserve units/custom labels, bounds and required state independently of source Task edits; no automatic unit conversion or legacy inference/backfill occurs.
- **After #9-aware writes begin, prefer roll-forward.** Fence old writers; they can omit/drop snapshots and resume conflicting TaskResult writes. Never reconstruct current results from legacy TaskResult documents. Preserve measurement snapshots and #14/#15 lifecycle/reservation metadata.
- Fresh-main verification passed 927 tests, including #14/#15 and #7 compatibility, plus syntax, whitespace and TypeScript with `--ignoreDeprecations 5.0`. Exact-lock verification remained valid. Deployed database-free #7 pricing/snapshot and #9 measurement checks passed; these do not replace authenticated production smoke. All 276 frozen evidence checksums and the archive remained unchanged.

### Planned continuation — Lifecycle/Contract reconciliation

This phase is planned, not started by this handoff:

1. Reconcile Asset/Template lifecycle calculations with Contract lifecycle intelligence.
2. Confirm Work Order cost flow into lifecycle and Contract analytics uses the approved #7 canonical cost model.
3. Identify remaining duplicated or inconsistent lifecycle/economic calculations.
4. Then evaluate **AHA 2023 Estimated Useful Lives of Depreciable Hospital Assets** as a benchmark/reference source for lifecycle defaults and source attribution.

Do not commit the AHA PDF to Git. Treat useful lives as benchmark/reference values, not automatic replacement mandates. Do not bulk-copy copyrighted tables into source code without confirming permitted use. No AHA suitability/mapping evaluation or reconciliation implementation occurred in this handoff.

Prior P0 security/ownership stabilization passed; #3, #4, #5, #6, #13 and #16 were closed. Preserve their authorization/ownership invariants during future work.

Continuation records:

- [#9 deployment and operational handoff](<../engineering-journal/2026-09-29-gitea-9-procedure-measurement-deployment.md>).

- [#15 deployment and operational handoff](<../engineering-journal/2026-09-29-gitea-15-template-lifecycle-deployment.md>).

- [#14 reservation/recovery runbook](<../engineering-journal/2026-09-28-gitea-14-reference-reservations.md>).

- [#7 deployment and operational preview](<../engineering-journal/2026-09-25 - Work Order Cost Model Deployment.md>).
- [Approved economic Decisions 1–9](<../engineering-journal/2026-09-25 - Work Order Cost Model Approved Decisions.md>).
- [Prior P0 gate](<../engineering-journal/2026-09-21 - Final P0 Security Ownership Gate.md>).
- [Open Threads](<Open Threads.md>) for unresolved and separately gated work.

## CRM Phase 1A Contact vertical slice — complete

- Contact is implemented in `core-service` with strict, explicit `x-facility-id` context on every request; administrators cannot perform unscoped Contact operations.
- Canonical `admin` and `technician` roles may create, read, and update Contacts within their Facility authority. Archive is admin-only. Customer, viewer, missing, legacy `tech`, and unknown roles are denied.
- Contacts derive `organizationId` and immutable `primaryFacilityId` from the selected Facility. Same-Organization multi-Facility association is supported, with technician authorization required for newly associated Facilities.
- Reads are scoped through `facilityIds`; updates and archive require primary-Facility context. Out-of-scope records return 404.
- Duplicate warnings are advisory only. Visible matches may identify matching fields and Contacts; inaccessible same-Organization matches produce only a generic restricted warning with no identity, Facility, count, or matched-field disclosure. Cross-Organization matches produce no warning.
- Endpoints: `GET /contacts`, `GET /contacts/:id`, `POST /contacts`, `PATCH /contacts/:id`, and `PATCH /contacts/:id/archive`.
- The frontend provides Facility-scoped list, search, pagination, detail, create, edit, and admin-only archive behavior. Secondary-Facility Contact views are read-only.
- Facility switching synchronously clears Contact lists, counts, detail, warnings, errors, search, pagination, and open forms. Request-generation guards ignore stale list, detail, mutation, warning, and error responses.
- New multi-Facility associations are offered only when matching Organization identity is known. Existing associations remain understandable, and missing Organization metadata fails closed rather than relying on backend rejection.
- Contact API calls preserve their explicit `x-facility-id` through the shared Axios interceptor. Create/edit forms safely present 400, 401, 403, 404, and generic 500 errors without exposing server internals.
- Phase 1A does not implement hard delete, restore, merge, primary-Facility reassignment, Organization-wide browsing, Vendor coupling, Contract coupling, or other CRM entities.
- Verification passed: Contact 56/56; complete safe core-service suite 59/59; core authentication security 31/31; lifecycle 3/3; syntax and whitespace checks; and a fail-closed loopback-only MongoMemoryServer harness with runtime downloads disabled.
- Lockfile comparison against `4d4d00ce27f55755930ef5e45701573250f20059` found no version, resolution, or integrity drift in the 719 pre-existing package paths. Only the two test dependencies and their required transitive packages were added.
- System Node 18 still produces the allowed `mongodb-memory-server` engine warning; runtime standardization remains deferred environment work.
- Frontend verification passed: Contact state/UI 31/31, real Contact API header behavior 5/5, and route/navigation roles 7/7, for 43/43 Contact frontend tests total. Baseline-compatible TypeScript no-emit, Vite production build, `npm ls --depth=0`, `git diff --check`, lockfile drift comparison, and focused Facility/role leakage review also passed.
- Existing frontend `ignoreDeprecations: "6.0"`, invalid ESLint `"ignore"` severity, Vite large-bundle warning, and Node engine warning remain deferred maintenance and were not changed.

See the [CRM Contact Phase 1A journal](<../engineering-journal/2026-08-25 - CRM Contact Phase 1A.md>) for implementation and verification detail.

## CRM FollowUp Phase 1 vertical slice — complete

- FollowUp is implemented in `core-service` as a single-Facility CRM record. Every operation requires explicit `x-facility-id`; no permissive tenant filter or global CRM behavior is used.
- Canonical `admin` and `technician` roles may create, read, update open records, complete, and cancel. Archive is admin-only; customer, viewer, legacy `tech`, missing, and unknown roles are denied.
- `dueAt` and a Facility-authorized canonical admin/technician assignee are required. Optional Contact linkage accepts only non-archived Contacts associated with the selected Facility.
- Status is `open`, `completed`, or `cancelled`. Only open records accept ordinary edits; terminal records may only be archived by an administrator. Overdue is derived and never persisted.
- Lifecycle mutations load the scoped document, re-check state, update lifecycle/audit fields together, and use validated `save()` with optimistic concurrency. Schema protections and blocked query-mutation APIs prevent lifecycle/archive invariant bypass.
- `dueAt`, `dueFrom`, and `dueTo` require timezone-explicit ISO timestamps. Range bounds are inclusive; due exactly now is not overdue, and terminal status with `overdue=true` returns 400.
- Endpoints: `GET /followups`, `GET /followups/assignees`, `GET /followups/:id`, `POST /followups`, `PATCH /followups/:id`, `PATCH /followups/:id/complete`, `PATCH /followups/:id/cancel`, and `PATCH /followups/:id/archive`. The assignee endpoint returns only minimal display data for eligible Users in the selected Facility.
- The frontend provides Facility-scoped list, detail, search, filters, pagination, create, open-only edit, complete/cancel, and admin-only archive. It uses only the narrow assignee endpoint and supports optional Facility-scoped Contact selection and unlinking.
- Date entry/display use a valid Facility IANA timezone when available, otherwise the browser IANA timezone with an explicit local label. Ambiguous or nonexistent DST wall times fail safely.
- Facility changes synchronously clear FollowUp data, filters, forms, picker choices, dialogs, errors, loading state, and Contact prefill/query state. Generation guards ignore stale successes and failures.
- Contact detail includes a read-only five-item Open FollowUps section with View All and Create FollowUp navigation, but no duplicate lifecycle controls. Safe contextual error handling covers 400, 401, 403, 404, and generic 500 responses.
- Phase 1 includes no reopen, restore, hard delete, recurrence, notifications, calendar/email integration, Contract, Vendor, Interaction, Opportunity, signal linkage, or Organization-wide CRM browsing.
- Backend verification passed: FollowUp endpoint suite 87/87, including 9/9 assignee additions, and complete safe core-service suite 166/166.
- Frontend verification passed: FollowUp page/state 45/45, role/navigation 7/7, API headers 8/8, date/time 5/5, Contact-detail integration 6/6, FollowUp-focused total 71/71, Contact regression 43/43, and total scoped frontend 114/114.
- Baseline-compatible TypeScript no-emit, Vite production build, frontend/core-service `npm ls --depth=0`, JavaScript syntax, `git diff --check`, whitespace, Facility/role/prohibited-coupling, and dependency/lockfile checks passed. Comparison against `3ea60fad` found no dependency or lockfile drift.
- The Node 18/MongoMemoryServer engine and system-binary warnings remain deferred environment issues.

See the [CRM FollowUp Phase 1 journal](<../engineering-journal/2026-08-25 - CRM FollowUp Phase 1 Backend.md>) for implementation and verification detail.

## CRM / Strategic Account Management — accepted Phase 1 architecture

The accepted Phase 1 direction is:

- Build CRM initially in `core-service`; do not create a CRM microservice yet.
- Use existing `Organization` as the health-system grouping and `Facility` as the required operational CRM account context; do not add a separate Account entity in Phase 1.
- Add focused Contact, Opportunity, Interaction, and FollowUp concepts with strict Facility scoping. The existing maintenance `Task` model is not a CRM follow-up task.
- Keep contract-service authoritative for Contracts, amendments, value, profitability, vendor leakage, and Contract lifecycle intelligence.
- Keep core-service authoritative for Facilities, Organizations, Users, Assets, WorkOrders, lifecycle metrics, replacement forecasting, operational Vendors, and proposed CRM records.
- Compose strategic-account views through authenticated, per-request service APIs; do not copy Contract financial or lifecycle calculations into CRM.
- Calculate explainable CRM signals dynamically first. Users may explicitly convert a signal into an Opportunity using a stable source key to prevent duplicates.
- Treat Contract renewal as a generated signal that can create a renewal-type Opportunity; do not introduce a specialized Renewal aggregate in Phase 1.
- Phase 1 should establish a Facility Strategic Account view, Contacts, Opportunities, Interactions, FollowUps, selected dynamic signals, and tenant/authorization tests.
- Explicitly defer a dedicated CRM service, arbitrary organization hierarchies, email/calendar sync, external CRM integrations, event infrastructure, generic workflow automation, and AI-generated recommendations.

These Phase 1 architecture and policy decisions are accepted. The preceding architecture assessment was based on static source inspection; accepted policy does not convert unverified runtime assumptions into facts. See Open Threads for deferred work and unresolved technical prerequisites.

## Contract stabilization — complete

### Security and tenant invariants

- Existing admin policy explicitly protects Contract, amendment, and vendor-link mutations.
- Contract creation derives `facilityId` only from authorized facility context; client input cannot create an unscoped Contract.
- Active-for-asset lookup is facility-scoped.
- `req.user.id` is the canonical Contract audit actor, with required audit schema fields.
- Contract-service no longer promotes a missing JWT role to admin and validates JWT issuer/audience.

### Analytics correctness

- Asset analytics process every WorkOrder before returning and return a valid zero-value object for no WorkOrders.
- Multi-asset WorkOrder counts, labor, travel, parts, vendor service, PM metrics, open/closed counts, and `costToServeYTD` reconciliation are covered by passing tests.

### Amendment lifecycle and numbering

- A successful draft assigns `${contract.contractNumber}.${sequence}` after validation.
- `amendmentSeq` increments once; application does not increment it; the returned index identifies the new amendment.
- Centralized transitions and post-submission business-field locking are enforced.
- Item asset IDs and numeric signed deltas are validated, `totalDelta` is derived, and lifecycle audit fields persist canonical actors/timestamps.

### Lifecycle automation

- `contractLifecycleJob.js` is authoritative business logic; `contractLifecycleCron.js` schedules it; `src/cron.js` remains a compatibility alias.
- Production cadence remains 03:10 daily in `America/New_York`; `CRON_ENABLED` and `CRON_DRY_RUN` remain supported.
- Approved Contracts activate, active Contracts expire, and due approved amendments apply through `amendmentLifecycleService` with a null system actor.
- Processing is deterministic, failure-isolated, and idempotent. `noOverlap` prevents same-process overlap but is not a distributed lock; externally scaled replicas could still race. Compose declares no replicas.

### Financial/value semantics

- `Contract.totalValue` is the immutable original/base annual value.
- Amendment `deltaValue` is signed: positive increases value and negative decreases it. `changeType` controls coverage only and never changes the financial sign.
- Only applied, financially included amendments affect point-in-time value; application never rewrites `totalValue`.
- `excludeFromFinancials` retains operational/history behavior while excluding financial effect. `setsBase` remains legacy metadata and does not replace the baseline.
- Profitability uses the shared value/proration engine. `revenue.annual` is effective value at `asOf`; `revenue.ytd` is calendar-year YTD clipped to the Contract term.
- Verified representative timeline: `$100,000 -> $110,000 -> $90,000` for `+$10,000` then `-$20,000` amendments at their effective dates.

### Legacy data compatibility

Mary Rutan `MRH-CAM-2024-001` was normalized in local development data only:

- `totalValue = 77068.00`.
- Amendments `.1`, `.2`, and `.4` have `excludeFromFinancials=true`; `.3` remains included.
- `setsBase` metadata and exactly 29 covered assets were preserved.
- Timeline: `$77,068.00` at 2024-09-16, then `.3` produces `$136,383.54` at 2026-01-01.
- No coverage, items, numbering, dates, or lifecycle statuses changed.

Do **not** repair Wayne Healthcare `WHC-CAM-2024-001` yet:

- Candidate baseline: `$94,881.90`.
- Amendment ledger and standard currency rounding produce `$383,524.75`.
- Stored legacy `totalValue` is `$383,524.74`.
- Repository source, scripts, fixtures, workbook, BSON history, documentation, and Git history do not authoritatively explain the `$0.01` discrepancy.
- External executed commercial/addendum or finance evidence must establish the correct value; do not guess or round it away.

### Legacy cleanup

- Removed the unmounted ContractAnalysis implementation, duplicate value router, unused heartbeat, unreachable deprecated amendment code, obsolete route/preview blocks, unused model import, dead frontend wrappers, and dead WorkOrder-to-Contract callback.
- `WorkOrder.contractId` is the active authoritative relationship.
- `Contract.linkedWorkOrders` remains for compatibility: a local read-only check found 1 of 2 Contracts containing 36 historical references. Do not remove it without a deliberate data/migration decision.
- Unmounted Customer/Vendor modules remain because external compatibility and historical ownership are not sufficiently proven.

## Core-service authentication hardening — complete

- Missing JWT roles no longer default to administrator.
- JWT issuer and audience are enforced.
- Legacy route declarations using `tech` are canonicalized to `technician`.
- Tokens claiming the legacy `tech` role are rejected.
- Sensitive authentication, user, and password-hash logging was removed.
- `/auth/profile` now uses the canonical hardened authentication middleware.
- Existing tokens without valid issuer/audience claims or using the legacy `tech` role may require users to authenticate again.

### Verification

- Authentication baseline before remediation: 22/31 passed.
- Authentication suite after remediation: 31/31 passed.
- Full contract-service suite: 7/7 suites and 100/100 tests passed.
- Core-service suite: 1/1 suite and 3/3 tests passed.
- Syntax checks and `git diff --check` passed.
- Tests used isolated MongoMemoryServer databases; no real database was modified.

## Environment and deferred product notes

- This verification ran under system Node 18. Test tooling recommends Node `>=20.19`; previous Cronus verification succeeded under Node 22. Runtime standardization remains future environment maintenance.
- MongoDB 8.2.1 test binary cache: `/tmp/cronus-mongodb-cache` (temporary and not repository state).
- Dependency vulnerability remediation remains deferred. Do not run `npm audit fix` automatically.
- Node runtime and dependency ownership cleanup remain environment-maintenance work.
- Wayne financial normalization, historical `Contract.linkedWorkOrders`, and unmounted Customer/Vendor ownership remain deferred as described above and in Open Threads.

## Repository context

- [Open Threads](<Open Threads.md>)
- [Lessons Learned](<Lessons Learned.md>)
- [Authentication remediation journal](<../engineering-journal/2026-08-09 - Authentication Security Remediation.md>)
- [CRM architecture assessment journal](<../engineering-journal/2026-08-24 - CRM Strategic Account Architecture Assessment.md>) — assessment and proposal that informed the accepted Phase 1 decisions.
- [CRM Phase 1 policy decisions](<../engineering-journal/2026-08-25 - CRM Policy Decisions for Review.md>) — accepted and authoritative for Phase 1.
- [CRM Contact Phase 1A journal](<../engineering-journal/2026-08-25 - CRM Contact Phase 1A.md>) — verified Contact vertical slice and tenant/security baseline.
- [CRM FollowUp Phase 1 journal](<../engineering-journal/2026-08-25 - CRM FollowUp Phase 1 Backend.md>) — verified end-to-end FollowUp workflow, lifecycle integrity, and Facility-scoping baseline.
- [Historical product context](<../../Project Cronus.md>) — useful but known to have drifted.
