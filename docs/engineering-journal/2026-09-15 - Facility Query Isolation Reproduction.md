# Gitea #3 — Facility query isolation reproduction

## Scope and status

Reproduction only, completed against local `main` commit `3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4`.
Branch: `fix/facility-query-isolation`; worktree: `/tmp/cronus-facility-query-isolation`.
The original checkout was on `feat/crm-interactions` with user documentation changes; it was not switched or edited.
No remote fetch was performed, so this identifies local main rather than claiming remote synchronization.
No production source, dependencies, application configuration, or existing tests were changed.
During the initial reproduction, no other issue or Opportunity/Interaction frontend work was performed. Gitea was not contacted or updated; issue #3 was not closed.

All four hypotheses are **CONFIRMED BUG** in isolated endpoint execution. These findings establish behavior of the tested commit and synthetic fixtures, not evidence of production exploitation.

## Harness and safety

Minimal Express applications mount the actual `/assets`, `/workorders`, and `/templates` routers, with actual JWT authentication, role authorization, tenant-filter construction, Mongoose queries, and MongoDB aggregation. `app.js`, database configuration, scheduled jobs, and production startup are never imported. Authentication tokens use a synthetic test-only signing key. Two synthetic Facility documents and five Assets/Work Orders are inserted into ephemeral persistence: A has two matching records plus one nonmatching record; B has two matching records.

The existing `src/test/mongoMemoryHarness.mjs` replaces configured `MONGO_URI` with an unusable sentinel and guards `mongoose.connect` against targets not issued by its MongoMemoryServer. Its connection is the sole database connection used by the reproduction graph. The guard rejects both the sentinel and an alternate loopback database target while preserving the active synthetic database. A separate missing-binary probe fails at MongoMemoryServer startup before connection; runtime downloads are disabled. Cleanup drops only the harness database and stops its MongoMemoryServer.

Environment: Node 18.19.1; cached MongoDB binary 8.2.1. MongoMemoryServer warns that Node is below its recommended version; the final endpoint executions nevertheless completed. No dependencies or binaries were downloaded. Existing core/contract dependency directories were temporarily linked into this worktree; those symlinks were removed after verification.

The default Jest configuration cannot load the existing mixed CommonJS/ESM router graph. A dedicated opt-in configuration transforms only four existing ESM helpers (forwardContractHeaders, lifecycleMaintenance, templateLifecycleBenchmarks, lifecycleBenchmark) using already-installed Babel tooling. It does not transform the tested routers or tenant/auth middleware and does not mock persistence, authentication, or queries. The CommonJS transform plugin resolves from the host's `/usr/share/nodejs`; this is a local tooling prerequisite, not a newly declared dependency. The reproduction filename deliberately falls outside the default baseline test match.

## 1. Asset search — CONFIRMED BUG

Endpoint: `GET /assets`, mounted at `core-service/app.js:81`.
Responsible source: `core-service/src/routers/assetsRouter.js:44` copies `buildTenantFilter(req)` into the base query; line 52 assigns search predicates to `query.$or`, replacing the Facility/global-record `$or` produced by `src/middleware/tenantScope.js`. Counts and records use that resulting query at lines 120–121. The optional `facilityId` predicate at line 61 can then target a foreign Facility once search has removed the authorization predicate.

Verified with an A-only technician and selected A:

- Ordinary list returns only A's three records; ordinary pagination and counts remain scoped.
- `search=needle` returns four matches instead of A's two, including both B Asset identifiers.
- `search=needle&manufacturer=Synthetic` still returns B records.
- `search=needle&page=2&limit=1` returns a B record in the synthetic fixture ordering.
- Search count and totalPages (limit 1) are 4 instead of 2.
- `search=needle&facilityId=<B>` returns B Assets instead of an empty authorized intersection.
- An A-only customer also observes foreign Assets through search.

Impact: cross-Facility Asset records, identifiers, identifying fields (including tag and serial number), counts and pagination are exposed. The endpoint returns enriched Asset documents rather than an identifier-only projection. The explicit foreign-Facility case returns those synthetic identifying fields in its failing assertion. Verified roles: technician and customer. Other authenticated roles share the same ungated list handler by source inspection; administrators may already have broad access under current policy, so selected-view drift is distinct from unauthorized administrator access.

Severity assessment: **P0 stabilization priority / high confidentiality impact**, because ordinary authorized users can enumerate foreign operational inventory.

Proposal only: retain the complete tenant predicate as an immutable conjunct, e.g. `$and: [tenantFilter, operationalFilters, searchPredicate]`; compose optional Facility filters as additional restrictions. Reuse exactly the composed predicate for records and counts. Preserve existing intentional global-record and administrator behavior unless separately approved.

## 2. Work Order search — CONFIRMED BUG

Endpoint: `GET /workorders`, mounted at `core-service/app.js:84`.
Responsible source: `core-service/src/routers/workOrderRouter.js:49` obtains the tenant predicate; line 57 spreads it into `query`; line 92 replaces `query.$or` for `q`. Lines 105–107 use that query for count and records.

Verified with A-only technician and selected A:

- Ordinary list, pagination, and counts return only A's three records.
- `q=needle` returns four matches instead of two, including both B Work Order identifiers.
- `q=needle&status=Open` still returns foreign records.
- Search page 2, limit 1 returns a foreign Work Order; counts and totalPages are 4 instead of 2.
- `q=needle&mode=analytics` also includes foreign Work Order identifiers.
- Customer access remains rejected with 403; unauthenticated list access returns 401.

Impact: cross-Facility Work Order list records/identifiers, counts, pagination, and analytics-mode records. Source establishes that normal results include full lean Work Order fields and populated Asset/user metadata; analytics selects asset IDs and operational dates/status/cost-related arrays. Runtime assertions directly establish foreign Work Order IDs in both modes; they do not exhaustively test every optional metadata field or populated user relationship.

Severity assessment: **P0 stabilization priority / high confidentiality impact**. Technician access is runtime verified. The administrator shares the handler but has broader existing policy; customer/legacy-role authorization is not broadened by this finding.

Proposal only: conjunctively compose tenant, operational, and search predicates and use the result for count, paginated list, and analytics. Keep existing status/date/asset filters and current global-record policy.

## 3. Template lifecycle scope — CONFIRMED BUG

Endpoint: `GET /templates/:id/lifecycle`; actual router mounted without startup imports.
Responsible source: `core-service/src/routers/templatesRouter.js:501` reads `req.user.facilityId` rather than selected context; lines 503–504 conditionally add the Asset Facility predicate. Lines 562–567 pass the same default identity (or undefined) to `getTemplateMaintenanceBenchmarks`. In `src/services/templateLifecycleBenchmarks.js`, the tenant facet adds its Facility match only when that argument exists.

Verified scenarios:

- Default A / selected A: summary and tenant benchmark correctly count A's three Assets.
- Technician authorized for A and B, default A / selected B: ordinary Asset list correctly selects B's two Assets, establishing allowed selected-Facility policy. Template summary instead counts A's three, reports average annual maintenance 10 instead of B's 100, puts three Assets in age 0–2 instead of two in age >8, and reports zero replacements instead of two. Tenant benchmark sampleAssets is 3 instead of 2.
- A-only technician, no default Facility claim, explicit selected A: summary and tenant benchmark each count all five Assets instead of A's three. This is an unauthorized cross-Facility aggregate disclosure, not merely a wrong selected view.

Impact: counts and lifecycle/tenant benchmark aggregates; this endpoint's tested summary does not return individual Asset IDs. The dual-authorized case alone demonstrates wrong selected context, not unauthorized access to A. The missing-default case establishes unauthorized aggregate contribution from B. Verified role: technician; the handler has authentication but no role gate in source.

Severity assessment: **P1 / high for missing-default aggregate disclosure**, and operational correctness risk for selected/default disagreement.

Proposal only: resolve and validate selected Facility against current authorized policy, require a usable authorized context for tenant-specific summaries, and consistently pass it to both Asset summary and tenant benchmark queries. Do not allow absent default identity to silently remove scope. The service also explicitly returns a `global` benchmark facet; its intended cross-Facility policy is unresolved and is not independently classified or redesigned here.

## 4. Asset duplicate warning — CONFIRMED BUG

Endpoint: `POST /assets`, `core-service/src/routers/assetsRouter.js:211`.
Responsible source: unscoped `Asset.findOne({ $or: [ctrlNumber match, optional serialNumber match] })` at line 306. Lines 314 and 319 assign/return the matching foreign `_id` as `duplicateOf`.

An A-only technician cannot see the B fixture in ordinary list. Creating an Asset in A with a fresh tag and B's matching serial number returns HTTP 201 and top-level `duplicateOf` equal to B's inaccessible Asset ID. A same-Facility duplicate control also returns its accessible identifier, confirming that duplicate warnings are otherwise working. All created records are synthetic and removed by ephemeral cleanup.

Impact: inaccessible Asset identifier plus existence/linkage confirmation for a submitted tag/serial. The tested warning does not return a separate foreign Asset document or prove additional foreign descriptive metadata exposure. No real-data mutation was performed.

Severity assessment: **P1 / moderate confidentiality impact** (identifier and existence oracle).

Proposal only: compose duplicate candidates with the caller's authorized visibility and validated creation Facility. Return duplicate identifiers only for accessible records; retain legitimate same-Facility warnings. Do not redefine global uniqueness or broaden create permissions in this fix.

## Verification results

Final opt-in reproduction suite: **29 tests: 11 controls passed, 18 security assertions intentionally failed**.

- Asset search: 7 failing assertions (items, count, combined filter, page item, page count, customer context, explicit foreign Facility filter).
- Work Order search: 6 failing assertions (equivalent five search checks plus analytics mode).
- Template lifecycle: 4 failing assertions (selected-B summary/benchmark and missing-default summary/benchmark).
- Duplicate warning: 1 failing privacy assertion.

Existing baselines: **170 passed, 0 failed**.

- `followUp.endpoint.test.mjs`: 87.
- `contact.endpoint.test.mjs`: 49.
- `lifecycle.util.test.mjs`: 3.
- `coreAuthentication.security.test.js`: 31.

No pre-existing dedicated Asset/Work Order endpoint suites were found on this main commit. Their ordinary list, pagination, count, authentication and customer role controls are in the new reproduction suite. Contract financial/lifecycle/job suites were not run because no such behavior changed and they are outside this issue's operational reproduction scope.

All three new JavaScript test/config/helper files pass `node --check`. `git diff --check` passes; new untracked files also receive explicit `git diff --no-index --check /dev/null <file>` checks. Database-target guard controls pass. The deliberate absent-binary probe exits 1 with ENOENT during setup, as required; that infrastructure probe is separate from the 18 reproduced defects.

No production deployment, browser workflow, real database, notification, external service, Docker operation, or scheduled job was exercised. Runtime compatibility outside this test configuration remains unverified.

## Reproduce

Requires the existing dependencies available under each service, locally available `@babel/core` and `@babel/plugin-transform-modules-commonjs`, and an approved cached MongoDB binary. No package installation is part of this task. Temporary dependency symlinks used during verification have been removed; restore access to existing installed dependencies in this worktree before rerunning.

From `core-service/`:

```sh
env MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.facility-reproduction.config.cjs --runInBand
```

Expected exit status: 1, with exactly the security invariants red. To run only the 11 controls, append `-t BASELINE:`. Existing core baselines were run with the default configuration and explicit contact endpoint, follow-up endpoint, and lifecycle utility test paths. The authentication suite was run from `contract-service/` with `src/security/_tests_/coreAuthentication.security.test.js`, using the same MongoMemoryServer environment settings.

Transient detailed results are in `/tmp/cronus-facility-reproduction-results.json`, `/tmp/cronus-facility-core-baseline.json`, `/tmp/cronus-facility-auth-baseline.json`, and `/tmp/cronus-facility-failclosed.json`.

## Initial reproduction handoff

Added only the opt-in reproduction suite, its Jest configuration/module transform, and this report. No remediation was implemented. No merge, commit, push, history rewrite, or issue closure occurred. Git branch/worktree metadata was created as explicitly requested. The original checkout and its user changes were preserved. Databases touched were exclusively disposable MongoMemoryServer test databases; no real database, container, external service, or scheduled job was touched.

Follow-up requires review and explicit remediation authorization. The proposed fixes above are not accepted architectural decisions. AI Memory and unrelated engineering documentation were not edited.

## Evidence preservation checkpoint — September 15, 2026

The user subsequently authorized committing and pushing these reproduction
artifacts separately from the governance documentation checkpoint, followed
by a progress comment on Gitea #3. This authorization does not permit
remediation or issue closure.

The recorded runtime results remain 11 passing controls, 18 intentionally
failing security assertions, and 170 passing existing baseline tests against
local main 3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4. The classifications
remain P0 for Asset and Work Order search and P1 for template lifecycle scope
and duplicate-warning disclosure. Confirmation is limited to synthetic
isolated runtime reproduction, not production exploitation.

This preservation step changes only report wording and records the existing
test/configuration/transform artifacts. The assertions remain unchanged.
Runtime tests are not rerun during preservation; syntax, whitespace, and
documentation-scope checks are performed without accessing databases,
containers, dependencies, runtime services, or scheduled jobs.
