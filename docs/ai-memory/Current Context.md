# Current Context

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

## Checkpoint

- Contact frontend branch base: `950a6a1befcd2c5bd80187fa5e6e0d28a33b288d`
- Base message: `feat: add CRM contact management`
- Active implementation branch: `feat/crm-contacts`.
- The Contact implementation and verification state below is recorded by the commit containing this file; use Git for its exact commit identifier and remote state.

## Current engineering priority

CRM / Strategic Account Management Phase 1 architecture and policies are accepted. The Phase 1A Contact vertical slice—backend in `core-service` and frontend in `frontend`—is complete and verified on `feat/crm-contacts`. The remaining CRM entities are not implemented.

At the start of the next session:

1. Read this file, [AGENTS.md](../../AGENTS.md), [Open Threads](<Open Threads.md>), the [CRM architecture assessment journal](<../engineering-journal/2026-08-24 - CRM Strategic Account Architecture Assessment.md>), and the [CRM policy decisions for review](<../engineering-journal/2026-08-25 - CRM Policy Decisions for Review.md>).
2. Confirm the working tree and checkpoint commit.
3. Treat the accepted CRM policy document as authoritative for Phase 1.
4. Treat the complete Phase 1A Contact vertical slice and its Facility, tenant, authorization, state-isolation, and duplicate-disclosure invariants as the implementation baseline for subsequent CRM work.
5. Keep Contact implementation independent of Vendor references; Vendor ownership and scoping remain unresolved and require runtime verification.

Do not begin additional CRM implementation merely because Phase 1A is complete. Do not combine future CRM work with dependency upgrades, audit fixes, data repair, migrations, or unrelated refactors.

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
- [CRM Contact Phase 1A journal](<../engineering-journal/2026-08-25 - CRM Contact Phase 1A.md>) — verified Contact backend implementation and tenant/security baseline.
- [Historical product context](<../../Project Cronus.md>) — useful but known to have drifted.
