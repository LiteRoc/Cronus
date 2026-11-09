# Cronus Regression & Stabilization Plan

Assessment: September 14, 2026. Saved at the user's explicit request after the read-only assessment.

## Original handoff — September 14, 2026

The user will return tomorrow morning, say "Let's continue with the assessemnt" (or equivalent), and supply their priority order. Resume this assessment using their order. The proposed order below is not an accepted implementation sequence. The resume phrase does not authorize fixes or runtime testing.

New feature development remains paused: no Interaction frontend, Opportunity, other new feature, Interaction merge, or Gitea issue #2 changes. No bugs have been fixed.

Checkpoint: branch `feat/crm-interactions`, HEAD `ce535d39627f7a77f9e342fd9146e8ba361f5899`; local main `3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4`. Working tree was clean at assessment completion. This subsequently authorized documentation save is intentionally uncommitted.

Read AGENTS.md, Current Context, Open Threads and the August authentication/CRM journals alongside this plan. At the September 14 assessment checkpoint, the source findings below were not runtime-confirmed vulnerabilities. No tests, builds, API/browser/database checks or runtime operations were performed during that assessment. Historical passing results were not fresh verification.

## 1. Automated-test inventory

22 test files: seven core-service, seven contract-service, eight frontend. No dedicated browser end-to-end suite found.

| Component | Suites | Coverage / recorded baseline |
| --- | --- | --- |
| Core lifecycle | lifecycle.util.test.mjs | Price fallback, unknown capital, expected-life replacement; 3 passed |
| Contact backend | contact.service, contact.endpoint | Schema, normalization, auth, associations, primary-only mutations, duplicate privacy, archive; 56 passed |
| FollowUp backend | followUp.service, followUp.endpoint | Schema/lifecycle, scope, assignment, Contact validation, dates, filters, archive; endpoint 87 passed including nine assignee cases |
| Interaction backend | interaction.service, interaction.endpoint | Scope, restricted visibility before counts/pages, links, dates, audit/archive; 54 passed |
| Authentication | coreAuthentication.security, contractAuthentication.security | JWT, password handling, roles, selected Contract mutations/tenant cases; core auth 31 passed |
| Contract value | contractValue.service, contractValue.endpoint | Baseline, signed deltas, dates, proration, revenue clipping, scoped endpoint |
| Amendments | amendmentLifecycle.endpoint | Numbering, validation, transitions, audit, submitted-field locks |
| Contract analytics | contractOverview.service | Three unit tests: empty/single/multiple Work Orders and vendor components |
| Contract automation | contractLifecycleJob | Activation/expiry, ordering, repeat application, failure isolation, dry run; 11 passed |
| Contact frontend | ContactsPage, ContactAccess, contactAPI | State, roles, stale responses, warnings, headers; 43 passed |
| FollowUp frontend | FollowUpsPage, FollowUpAccess, dateTime, followUpAPI, ContactFollowUps | Lifecycle UI, roles, DST/timezone, headers, Contact navigation; 71 passed |

Historical aggregates: core-service 220, contract-service 100, frontend 114. Different checkpoints; not a contemporaneous system pass.

CRM endpoint tests integrate real routers/auth/services/Mongoose with MongoMemoryServer. Contract endpoint tests use createApp with isolated persistence, without proving live core-service communication. Core auth tests do not cover every mounted route. Contract analytics mocks core HTTP. Frontend jsdom tests mock APIs/context; Axios adapter tests do not exercise CORS/network. Core app startup is intentionally excluded because import connects to MongoDB, schedules jobs and listens. Inspected harnesses disable downloads and guard connection targets. No overall statement/branch coverage percentage established.

## 2. Coverage gaps by module

| Area | Strength | Missing meaningful regression / real-data differences |
| --- | --- | --- |
| Auth/authorization/isolation | JWT/password/selected role cases | Every route/resource, search/count leakage, customer tenancy, alternate password writes, legacy users |
| Facility/Organization | CRM validation/associations | Picker/login, stale claims, missing metadata, generic filters; no Organization workflow suite |
| Assets/Templates | Lifecycle utility fixtures | CRUD, ownership, parent cycles across update paths, duplicate privacy, archive, defaults, FDA mapping/errors |
| Asset lifecycle | Three utility cases | Real costs aggregation, query updates versus save, freshness, scheduler, missing dates/costs, retirement/archive |
| Forecast | No dedicated suite | Buckets, stale/unknown metrics, cost/life fallbacks, Facility totals, drill-through, large/empty fleet |
| Work Orders | Fabricated analytics inputs | CRUD, assignment/status, costs, procedures/results, parts/travel/equipment, archive, attribution, concurrency |
| Contract creation/lifecycle | Selected security/create/job boundaries | Full manual transition matrix, concurrent numbering, coverage validation, deletion/history, UI/service chain |
| Amendments | Strong isolated transitions/numbering | Actual hydration, preview/apply agreement, concurrent drafts/application, legacy ledgers, browser |
| Value/profitability | Strong value engine; mocked analytics | Full profitability endpoint, real payloads, historical attribution, vendor overlap/leakage, partial failure |
| Vendor links | Mutation role cases, vendor fixtures | Active Vendor CRUD/security, tenant identity, snapshot/link/date/asset validation, browser PATCH |
| Contract automation | Isolated job | Cron wrapper/config/DST, multi-process races, recovery, simultaneous manual actions |
| Contacts | Strong isolated backend/frontend | Real metadata/claims, concurrent edits, archive/association effects on links, sessions |
| FollowUps | Strong lifecycle/scope/date/UI | Changed assignees, Contact archival, concurrent terminal actions, actual browser timezone/switch |
| Interaction backend | Strong scope/visibility/validation | Actual mounting, concurrent visibility changes, changed Contacts, real index/query behavior |
| Frontend/backend | CRM headers | Login/picker/API chain, CORS/URLs, old caches, response shapes, session/history |
| Cross-module | Individual portions | No complete Asset→WO→Contract or Asset→metrics→forecast automated chain found |

Interaction frontend is intentionally absent and paused, not a defect.

## 3. Highest risks and known/suspected bugs

P0=data corruption/security; P1=incorrect business logic; P2=broken workflow/UI; P3=maintainability/deferred cleanup. Priority indicates investigation urgency, not demonstrated exploitation.

### P0 source findings

- Asset search and Work Order q replace the tenant-filter `$or` with search `$or`, removing that scope predicate. Test results/counts across Facilities, with/without other filters. Sources: core-service/src/routers/assetsRouter.js:42, workOrderRouter.js:47, middleware/tenantScope.js.
- Mounted Vendor list/create/update/delete lack route auth; detail uses req.user.tenantId; mount has no enclosing auth. Test anonymous/cross-tenant behavior and resolve policy. Source: vendorRouter.js.
- Work Order parts/equipment use unscoped findById; equipment mutations lack explicit role checks. Test all subresource operations and customer/viewer access. Source: workOrderRouter.js:649 onward.
- WO creation derives Facility from unscoped Asset lookup; Asset creation accepts body Facility; broad updates can affect relationships. Test foreign IDs, ownership changes and audit spoofing.
- Template lifecycle uses token facilityId rather than selected header; missing token Facility leaves asset query unscoped. Source: templatesRouter.js:468.
- Asset duplicate lookup is unscoped and returns duplicateOf, potentially disclosing foreign identifiers. Source: assetsRouter.js:306.

Documented unresolved risks: possible historical plaintext passwords, legacy tech records, customerId persistence/token behavior and password writes bypassing save middleware. No existing-data inspection or normalization authorized. Never expose credential values.

### P1 source findings

- WO costs calculated in pre(save), but multiple mutation routes use findOneAndUpdate; lifecycle consumes stored costs. Source: models/WorkOrder.js:182.
- Real core analytics projection omits vendorService/completionDate supplied by Contract unit fixtures. Source: workOrderRouter.js:112.
- Lifecycle scheduler references mongoose without importing it; likely fails on templated assets. Source: cronJobs/lifecycleScheduler.js.
- Forecast uses stored age/benchmark life/legacy purchaseCost; lifecycle has additional purchase/life fallbacks. Sources: dashboardRouter.js:170, utils/lifecycle.js.
- Contract lookup failure during WO creation continues with null attribution, conflating outage with no coverage.
- Overview selects by contractId; profitability uses current covered Asset IDs/YTD, risking historical population differences.
- Core maintenance generation has no duplicate check in inspected loop and does not explicitly assign Facility/Contract attribution. Source: cronJobs/cronJobs.js.
- Profitability net subtracts vendor payouts and non-vendor internal cost while reporting vendor-covered leakage separately. Confirm business policy before changing it. Source: contract-service/src/controllers/contractController.js:922.

### P2 source findings

- Parent removal spreads tenant-filter object into findById arguments, likely failing. Source: assetsRouter.js:489.
- Contract CORS methods omit PATCH despite Vendor-link PATCH. Source: contract-service/app.js.
- Some Contract/Vendor cache keys lack Facility identity; redirects do not prove session/cache isolation. Source: frontend/src/hooks/useContractOverview.ts and related hooks.
- FacilityContext reads user.role without guarding missing stored user.
- Template archive path is /achive; caller compatibility/visibility need verification.

### P3/deferred and legacy

Wayne financial discrepancy requires authoritative evidence; no normalization. Keep Contract.linkedWorkOrders pending compatibility/migration decision. Contract noOverlap is not distributed locking. Unmounted Customer/Vendor ownership remains unresolved. TypeScript/compiler incompatibility, invalid ESLint severity, Node/tooling warnings, bundle size and dependencies stay separate maintenance. Contact merge and Interaction revision/retention/linkages stay deferred.

Core CommonJS/ESM startup paths are unverified by CRM tests. Later duplicate app Work Order/dashboard handlers and EJS setup require reachability evidence before removal. Core jobs schedule at import; Contract cron flags do not establish core job safety.

## 4. Cross-module invariants

| Workflow | Required invariant |
| --- | --- |
| Asset→WO→Contract | Authorized Asset, inherited ownership, request-date attribution, explicit outage outcome |
| Asset→metrics→forecast | Correct persisted cost/date inputs, known freshness, documented exclusions/fallbacks |
| Contract→amendments→value | Applied financially included signed deltas only; immutable baseline |
| Contract→WO→profitability | Actual fields, explicit dates/populations, no omission/double count |
| Contract→automation | Retry/concurrency preserves audit/sequence/coverage/finance |
| Facility switch→UI | No old data/counts/details/forms/errors/delayed responses |
| Contact→FollowUp | Valid Facility link/assignee; secondary read grants no primary edit |
| Contact→Interaction | Scoped links; restricted records absent from technician totals/data |
| CRM versus generic filters | Never global CRM inclusion; explicit older-resource global policy |

## 5. Layer 1: isolated tests

After authorization: reproduce baseline, including core auth owned by contract-service; add P0 reproductions; integrate WO mutations→costs→lifecycle, actual core analytics payload→Contract calculations, attribution dates/errors and amendment/job concurrency. Add old frontend Facility/session/race/header regressions. Exercise jobs as controlled functions with frozen clocks, synthetic persistence and blocked notifications/scheduler imports. Do not casually import core app.js; review all targets/side effects first.

## 6. Layer 2: API integration cases

Not executed. Requires approved synthetic environment, outbound controls and verified scheduler isolation.

- P0: Asset search/WO q/count/page preserve scope; Vendor CRUD enforces approved auth; WO subresources reject foreign records; ownership cannot move through payloads; template lifecycle respects selected scope; CRM requires explicit Facility.
- P1: WO logs/parts/status reconcile persisted costs/dates after every mutation; active-for-asset/creation before/on/after coverage and overlapping Contracts; full Contract transitions/deletion-history safety; amendment draft/submit/approve/preview/apply/decline/void with numbering, signed value, retries/concurrency.
- P1: Actual overview/value/profitability/vendor payloads reconcile against independent fixtures; lifecycle/template/forecast/Contract intelligence agree on documented populations/freshness; Contact→FollowUp/Interaction respects primary/secondary/archive/inactive rules.
- P2: Browser OPTIONS/PATCH preflight; malformed bodies/IDs/dates and dependency outages yield safe stable errors.

Include empty/multiple pages, legacy missing fields, equal timestamps, leap years and simultaneous different-Facility requests.

## 7. Layer 3: real-data smoke tests

Not executed; explicit database authorization required. Begin read-only, minimum projections/aggregate counts, no customer exports.

1. Missing/invalid Facility references and cross-Facility relationships.
2. Organization references and Contact associations.
3. Aggregate legacy roles/customer links without credentials; password-format checks separately approved and non-disclosing.
4. Approved WO samples: logs/parts versus stored costs/completion dates.
5. Unlinked WOs, dangling Contract IDs and Facility mismatches.
6. Missing/stale metrics.computedAt, templates/capital/life values, archive/retirement differences.
7. Approved Facility forecast versus independent read-only calculation.
8. Approved Contract timelines versus authoritative baselines/ledger; do not normalize Wayne.
9. CRM assignees/associations/links/terminal and archive audit pairs.
10. Eligible automation transitions/possible duplicate PMs without running jobs.

Later mutation smoke tests require designated data, before/after evidence and recovery plan. Local is not disposable.

## 8. Layer 4: manual UI script

Not executed; mutations only in approved synthetic environment.

| Step | Scenario | Expected |
| --- | --- | --- |
| 1 | Each role login/direct protected URL | Correct access; navigation not sole security |
| 2 | Facility A→B→A with delayed requests | Scoped lists/totals/details/pickers/forms/errors |
| 3 | Logout/login different user | No prior-user cache/Facility data |
| 4 | Asset search/filter/page/detail/create/edit from template | Correct records/defaults/private duplicates |
| 5 | Parent attach/tree/self-cycle rejection/remove | Valid relationship and working removal |
| 6 | Template list/detail/edit/lifecycle | Defaults/scoped summary; external sync separately authorized |
| 7 | Asset→create/open WO | Correct Facility/assignee/status/Contract |
| 8 | Edit labor/travel/parts/procedures/results/equipment; complete | Reload persists; costs/dates reconcile |
| 9 | Lifecycle→forecast→year/asset drill-through | Population/freshness/capital assumptions agree |
| 10 | Contract list/detail/value timeline/WO and Asset links | Scope/historical value/totals/navigation correct |
| 11 | Amendment/create/available transitions/preview | Signed delta/sequence/locks/base value correct |
| 12 | Vendor-link add/edit/assets/metrics | Browser requests, valid references, costs correct |
| 13 | Contact create/search/edit/associate/secondary view | Primary-only edit; private advisory duplicates |
| 14 | Contact Open FollowUps→Create/View All | Correct prefill/Facility; five-item preview agrees |
| 15 | FollowUp assign/date/edit/complete/cancel/archive | Timezone/overdue/terminal lock/admin archive |
| 16 | Expired token/stale detail/delayed failure | Safe errors, no stale data/duplicate effects |

Contract actions without UI remain API cases. No Interaction frontend work.

## 9. Security/tenant matrix

Apply to lists/search/count/page/detail/mutations/subresources/exports/aggregates/service calls.

| Boundary | Expected |
| --- | --- |
| Invalid/expired/missing JWT or issuer/audience/signature | Reject |
| Missing/unknown/legacy role | No privilege escalation |
| CRM customer/viewer | Deny |
| CRM admin without selected Facility | Reject |
| Unauthorized technician/sibling Organization Facility | No extra grant |
| Body/query conflicts | Cannot override authority |
| Foreign/archived record | Non-disclosing rejection |
| Generic/global records | Approved resource policy, never implicit CRM inclusion |
| Search/count/page | Same visibility scope |
| Secondary Contact Facility | Associated read; primary-only mutation |
| Technician restricted Interaction | Hidden from details/updates/search/count/page |
| Foreign linked references | Safe rejection |
| Audit/status/archive spoofing | Server invariants preserved |
| Concurrent terminal/archive/visibility actions | No invalid state/silent protected-transition loss |
| Parallel service calls | Request-specific auth/Facility |
| Facility/user switch | No stale response/cache leakage |
| Commercial intelligence | Reconcile legacy Contract policy before CRM reuse |

CRM policy excludes technician margin/leakage. Existing Contract financial reads generally authenticate without corresponding explicit role restrictions. This is a policy-alignment question, not authorization to silently change legacy access.

## 10. Proposed fix order (user will supply priorities)

For each authorized fix: reproduce→narrow fix→targeted regression→workflow verification.

1. P0 search scope loss.
2. P0 Vendor auth/WO subresource ownership.
3. P0 ownership/references/duplicate privacy/template scope.
4. P0 auth/data uncertainties/commercial policy investigation.
5. P1 WO costs and analytics payload.
6. P1 lifecycle freshness/forecast.
7. P1 attribution/profitability/leakage/amendment-job concurrency.
8. P1 PM generation idempotency/provenance.
9. P2 caches/CORS/parent removal/demonstrated UI issues.
10. P3 separately authorized tooling/legacy cleanup.

Financial discrepancies remain evidence-blocked. Tooling fixes do not authorize dependencies/data repair.

## 11. Gate before Opportunity resumes

Fresh main isolated baseline and separate Interaction checkpoint regression (no merge); reproduced P0s resolved/verified and policy questions decided; Asset→WO→Contract attribution/cost reconciliation; Asset→lifecycle→forecast with known freshness; actual amendment/value/profitability endpoint integration; controlled retry/automation tests with concurrency limits understood; real browser Facility/session isolation; Contact/FollowUp API/UI and Interaction scope/visibility passing; authorized real-data checks with anomalies dispositioned; remaining P1/P2 owners/priorities/explicit deferrals; repeatable commands and recorded environment; explicit authorization to resume Opportunity.

## Follow-up — September 15, 2026

The user subsequently authorized reproduction only for Gitea #3.
On local main commit 3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4,
isolated endpoint execution confirmed all four targeted hypotheses:
Asset search scope loss, Work Order search scope loss, template lifecycle
scope errors, and Asset duplicate-warning identifier disclosure.

The reproduction suite recorded 11 passing controls and 18 intentionally
failing security assertions. Existing baselines recorded 170 passing tests.
No remediation was implemented. These findings establish synthetic runtime
behavior at the tested commit, not production exploitation.

The original P0 grouping records investigation priority. The reproduction
report assesses Asset and Work Order search as P0, and template lifecycle
and duplicate-warning findings as P1. Other findings in this assessment
remain source hypotheses unless separately verified.

The reproduction artifacts and detailed report remain uncommitted in
/tmp/cronus-facility-query-isolation on fix/facility-query-isolation.
New feature development remains paused. Remediation requires explicit
authorization.

## Original September 14 save scope

Original assessment modified nothing. User subsequently authorized saving the assessment and handoff. Only this plan and Current Context are intended changes. No code/tests/dependencies/Git history/issues/databases/containers/services/jobs changed or executed.
