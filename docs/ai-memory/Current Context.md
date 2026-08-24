# Current Context

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

## Checkpoint

- Commit: `f041bb6ab53093793f96a7f7ffde173ea30769e5`
- Message: `chore(contract): remove superseded legacy code`
- Gitea `main` and GitHub `main` were verified at this commit.
- The working tree was clean at the checkpoint.

## Current engineering priority

The six-step Contract stabilization effort and core-service authentication hardening are complete and runtime-verified. **CRM architecture/design assessment** is the leading candidate for the next major product-development session. Do not begin CRM implementation during the assessment.

At the start of the next session:

1. Read this file and [AGENTS.md](../../AGENTS.md).
2. Confirm the working tree and checkpoint commit.
3. Assess how existing facilities/customers, Contracts, assets, vendors, WorkOrders, lifecycle intelligence, and profitability/value intelligence can support contacts, customer interactions, opportunities, service/CAM opportunities, renewal opportunities and pipeline, follow-up tasks, and strategic account management.
4. Define Clinical Asset Management and Clinical Engineering workflows, ownership boundaries, data relationships, authorization/tenant requirements, and integration points before editing code.
5. Produce a focused architecture/design proposal rather than a generic Salesforce clone.

Do not combine that assessment with CRM implementation, dependency upgrades, audit fixes, data repair, migrations, or unrelated refactors.

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
- [Historical product context](<../../Project Cronus.md>) — useful but known to have drifted.
