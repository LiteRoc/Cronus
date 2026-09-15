# Asset and Work Order Ownership — Isolated Reproduction

Date: 2026-09-15
Tracking: Gitea #6 — security: Validate Asset and Work Order ownership on create/update
Status: **Reproduction and authorization-boundary assessment only. No remediation. Awaiting human review.**

## 1. Checkpoint and scope

- Tested base and worktree HEAD: `1122219e401d272377bdb93daf98bb8fb5ec8554` (main).
- Dedicated branch: `fix/asset-workorder-ownership`.
- Worktree: `/tmp/cronus-asset-workorder-ownership`.
- Paused Interaction checkpoint preserved: `c11307bc53e8bc18de435d8d7f0d39abbbf469c5`.
- No production implementation, prior regression tests, dependencies, lockfiles, or persistent Current Context/Open Threads changed.
- No commit, push, merge, Gitea mutation, real database, deployed application, Docker, scheduled job, or external-service call.
- #3, #4 and #5 remain merged. These findings identify create/update boundaries not secured by their narrower query, Vendor, and subresource changes. #7 has not been started.

All confirmations below mean **synthetic isolated runtime reproduction at the tested base**, not production exploitation or a claim about customer records.

## 2. Harness and interpretation

Artifacts:

- `core-service/jest.asset-workorder-ownership-reproduction.config.cjs`
- `core-service/src/routers/_tests_/assetWorkOrderOwnership.reproduction.mjs`
- This report.

The minimal Express application mounts the actual `/assets` and `/workorders` routers, in the import order used by `core-service/app.js:81–84`. It uses their actual JWT verification, role middleware, Mongoose models, tenant helper, and route handlers. It does **not** import `app.js`, database startup, cron, or a deployed server. Supertest uses only its local test listener.

Persistence uses the established `mongoMemoryHarness.mjs`: it replaces configured `MONGO_URI` with a forbidden sentinel, accepts only a URI issued by its own ephemeral MongoMemoryServer, and drops/stops that isolated database. Explicit tests reject both the configured sentinel and an arbitrary loopback MongoDB URI. The pre-existing binary `/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1` is used with downloads disabled. No fallback database is permitted.

Work Order creation uses the actual `attachContractClient`. A test-only Axios adapter intercepts the inherited per-request client. It accepts only the synthetic base and expected `GET /contracts/active-for-asset/:id` shape; all other requests throw before any native HTTP adapter. Tests verify header forwarding and adapter rejection. Responses are synthetic null/valid/invalid Contract IDs or an unavailable-service error. **Actual contract-service runtime authorization is not claimed.**

Fixtures include two Facilities, their Departments and Assets, two Work Orders, a shared EquipmentTemplate, valid Tickets, A-only and B-only technician identities, and all requested role/token variants. Legacy/missing/unknown User rows use explicit synthetic collection inserts to assess compatibility; no password or real identity is involved. Console output from exercised handlers is suppressed.

Test labels are intentional:

- `CONTROL`: existing allowed/denied behavior that works at this base.
- `OBSERVATION`: current behavior, including vulnerable or policy-ambiguous behavior; passing does not approve that behavior for remediation.
- `SECURITY`: required protection. Failing assertions remain red and are not skipped/inverted. One security assertion already passes: WO creation does not accept an independently supplied old `updatedAt`.

This is an **opt-in historical evidence suite**, excluded from the normal `.test.mjs` regression discovery. After a future fix, observation expectations describing removed behavior may become obsolete; do not treat them as authorization to retain a vulnerability.

## 3. Ownership and reference map — Asset

Sources: `src/models/Asset.js`; `src/routers/assetsRouter.js`; `src/middleware/tenantScope.js`; `src/middleware/authMiddleware.js` (paths in core-service).

| Field/group | Schema semantics | POST /assets | PUT /assets/:id / dedicated mutation |
|---|---|---|---|
| `_id` | Mongoose identity | Not copied by route | Broad body sent to query update; normal Mongoose immutable-ID rules still apply; no ID-replacement exploit claimed |
| `facilityId` | Required Facility reference | Client-supplied; syntax checked, existence/authorization not checked | Target Asset is scoped **before** update; replacement Facility is not validated for authorization/existence |
| `departmentId` | Department reference; Department has required `facilityId` | Syntax only | Cast/shape validators only; no existence/same-Facility validation |
| `templateId` | EquipmentTemplate reference; Template model has no Facility/Organization/tenant ownership | Syntax and existence checked; descriptive fields may derive from Template | Cast only; nonexistent Template accepted; no ownership rule invented |
| `parentAsset`, `relationToParent` | Asset reference and enum relation | ID syntax; save hook checks self/cycles using unscoped lookups, not Facility/existence | Broad PUT bypasses save hook and parent scope. Dedicated PATCH validates/scopes child and parent. Dedicated DELETE has an independent implementation error |
| `assignedTo` | User reference, optional | Not copied | Broad PUT accepts arbitrary/nonexistent User ID. Eligibility semantics unresolved |
| `contractId` | Cross-service Contract reference | Not copied | Broad PUT accepts arbitrary/nonexistent ID. Contract attribution policy/validation requires a service-boundary decision |
| `workOrders` | WorkOrder references | Not copied | Broad PUT accepts foreign IDs. Asset detail populates referenced descriptions/status/dates without checking each referenced WO's Facility |
| `maintenanceSchedule.procedure` | Procedure reference; no authoritative Facility owner in current Procedure model | Whole maintenanceSchedule object accepted, no Procedure existence lookup | Same reference accepted through PUT; malformed creation reveals cast details |
| `maintenanceSchedule` dates/frequency/interval | Operational scheduling fields | Client supplied, schema validation | Client supplied; distinction between editable schedule and system-maintained last-maintenance history needs policy |
| `createdBy`, `updatedBy` | User audit references | Route writes `req.user._id`, but auth supplies `req.user.id`: both persist null | Client-controlled through PUT; no canonical updater stamping |
| `createdAt`, `updatedAt` | Mongoose timestamps | Input not copied; spoofing not reproduced | Ordinary timestamp spoofing rejected/overwritten by Mongoose in tested cases |
| `deletedAt`, `deletedBy`, `isArchived` | Archive metadata/state | Not copied | Broad PUT surface includes archive fields; deletedAt/By spoofing reproduced. Separate PATCH archive is admin-only |
| `metrics.*` | Stored calculated lifecycle metrics (`computedAt`, costs, book value, depreciation, recommendations) | Not copied | Object replacement and dotted `metrics.totalMaintenanceCost` accepted |
| `duplicateOf` | Schema declares EquipmentTemplate ref, but duplicate creation records an Asset ID | Server duplicate lookup uses authorized dataset after #3; body ignored | Arbitrary ID accepted through broad PUT; schema/ref mismatch remains pre-existing debt |
| ctrlNumber, descriptive/serial/FDA fields | Identity/description; ctrlNumber globally unique | Explicit selection; descriptive/FDA values can derive from Template | Broad editable schema fields; legitimate edits exist; do not indiscriminately prohibit them |
| purchase, financial, acquisition/installation/retirement, compliance, documents/images, attributes | Data fields, not an established new ownership boundary | Only fields explicitly destructured/copied are accepted | Broad schema update surface. Existing frontend edits financial/compliance/location fields; no new policy inferred |

Asset creation has an explicit field selection but omits authorization of the selected references. Asset PUT has **no explicit mutable-field allowlist**: it passes `req.body` into `findOneAndUpdate` with `runValidators:true`. Schema validators do not establish referenced-record authorization.

The generic helper includes legacy records with absent `facilityId`; admin without a selected Facility has global visibility. These existing rules were not changed. New ordinary Assets require a Facility: omission/null cannot create an unowned Asset in this test.

## 4. Ownership and reference map — Work Order

Sources: `src/models/WorkOrder.js`; `src/routers/workOrderRouter.js`; `src/middleware/forwardContractHeaders.js`.

| Field/group | Creation behavior | Updates/current boundary |
|---|---|---|
| `assetId` | Required; ID syntax validated; unscoped `Asset.findById` in `deriveFacilityIdFromAsset` | Ordinary PUT rejects; no mounted dedicated Asset-rebind route found |
| `facilityId` | **Derived from the referenced Asset**, overwriting body, but Asset authorization is never proved | Ordinary PUT rejects; dedicated assign/status/schedule do not copy it |
| `departmentId` | Body spread, no existence or Facility validation | Ordinary PUT rejects; no dedicated Department-rebind route found |
| `assignedTo` | Body ID or object `_id`, default canonical caller; no User lookup | Dedicated PATCH assign validates ID syntax, not existence/eligibility; scopes parent first; populates username/role |
| `contractId` | Body overwritten by per-request contract lookup result or null, valid ObjectId shape required | Ordinary PUT rejects; no dedicated rebind route found |
| `ticketId` | Body spread; no existence/Facility validation | Ordinary PUT rejects; alternate from-ticket path discussed below |
| `vendorService.*` | Body spread; accepts arbitrary Vendor ID/name and service fields | Ordinary PUT rejects nested Vendor data. Shared Vendor policy from #4 is not redesigned |
| `createdBy`, `updatedBy` | Both overwritten with canonical `req.user.id` | PUT and assign/status/schedule stamp server updater |
| `createdAt`, `updatedAt` | Old createdAt accepted; independently supplied old updatedAt is overwritten | Ordinary PUT rejects both |
| `deletedAt`, `deletedBy` | Body spread; spoofing accepted | Ordinary PUT rejects; dedicated archive admin-only |
| `workOrderNumber` | Body accepted; nonzero supplied number bypasses sequence hook | Ordinary PUT rejects |
| `createdFrom`, `requestedBy` | Body accepted; can claim automation or another User | Ordinary PUT rejects. Delegation/manual provenance policy unresolved; do not invent it |
| `timeLogs`, `travelLogs`, `partsUsed`, `testEquipmentUsed`, `procedures/taskResults` | Body spread accepts nested structures, caller-chosen actor IDs/timestamps; foreign equipment accepted | Ordinary PUT correctly rejects after #5; dedicated routes retain #5 authorization |
| `costs` | Save hook recalculates from supplied nested entries; direct total replacement did not persist | Ordinary PUT rejects. Cost semantics are #7, not remediated here |
| description, type, priority, status, request/schedule/due/completion dates | Caller values, normalization/schema rules apply | PUT only allows description, workOrderType, priority, status, scheduledDate, dueDate, completionDate. Dedicated status/schedule paths exist |

Asset-derived Facility is current implementation, not a new policy chosen by this assessment. An authorized Asset lookup must precede that derivation; the choice between selected-context ownership and Asset-derived ownership when they disagree still needs an explicit remediation policy, particularly for admins/multi-Facility users.

## 5. Mounted mutation surface and role matrix

`app.js` mounts the Asset and Work Order routers directly without an outer authorization layer. All listed mutations use their own `authenticateToken`. `authorizeRoles('admin','tech')` canonicalizes the **allowed-role declaration** to technician; it does not admit a legacy `tech` token.

| Endpoint | Role gate | Target lookup / authorization | Mutation/reference mechanism |
|---|---|---|---|
| POST `/assets` | admin, technician | No target yet; tenant helper only scopes duplicate lookup | Selected fields into Asset.create; Facility/Department/parent not authorized |
| PUT `/assets/:id` | admin, technician | `_id` + buildTenantFilter | Unrestricted req.body query update, validators on |
| PATCH `/assets/:id/archive` | admin | Scoped Asset | Dedicated archive metadata |
| PATCH `/assets/:childId/parent` | admin, technician | Scoped child and parent | Document save; self/cycle save guard |
| DELETE `/assets/:childId/parent` | admin, technician | Incorrect `findById(childId, ...buildTenantFilter(req))` | Throws on spread before mutation; raw error returned |
| POST `/workorders` | admin, technician | Unscoped Asset lookup; no selected-scope proof | Broad body spread with some server overrides |
| PUT `/workorders/:id` | admin, technician | ensureTenantOwnsWorkOrder + scoped update | #5 allowlist; protected/operator/dotted keys rejected |
| PATCH `/workorders/:id/assign` | admin, technician | Scoped parent | User ID syntax only; query update; populated username/role |
| PATCH `/workorders/:id/status` | admin, technician | Scoped parent | Truthy status accepted without update validators; completion date server-set when Completed |
| PATCH `/workorders/:id/schedule` | admin, technician | Scoped parent | scheduledDate/dueDate only, server updater |
| PATCH `/workorders/:id/archive` | admin | Scoped parent | Dedicated archival |
| POST `/workorders/from-ticket/:ticketId` | admin, technician | Ticket lookup uses `ticketId`, which is not a Ticket schema field | Normal valid Ticket test returns 404; success-path testability limit below |
| POST `/workorders/request` | customer only | Legacy replacement notice | Returns 410 directing callers to Tickets; not ordinary WO creation |

Internal Parts/equipment/labor/travel/procedure endpoints already inventoried and secured in #5 were not rewritten. Their permanent 295-case suite passes unchanged. No alternative mounted singular `/asset` or `/workorder` creation alias was found in app.js. `ticketRouter.js` contains another conversion handler but is not mounted by app.js; it is not represented as an active bypass.

Direct role exercise covers Asset POST/PUT/parent PATCH and Work Order POST/PUT/assign/schedule/status:

| Caller | Asset/WO create | Asset/WO ordinary update, parent/assign/schedule/status |
|---|---|---|
| admin | 201 with valid own payload | 200 with valid own payload |
| canonical technician | 201 with valid own payload | 200 with valid own payload |
| customer, viewer, legacy tech, missing role, unknown role | 403 | 403 |
| anonymous | 401 | 401 |
| invalid/expired token | 403 | 403 |

Classification: **NOT REPRODUCED** for anonymous/invalid-role bypass of these gates. Role safety does not make the accepted references safe. Technician archive bypass through status/create is a separate confirmed defect.

## 6. Confirmed runtime findings

### F1 — P0: Asset unauthorized creation and movement — CONFIRMED BUG

- `POST /assets` (`assetsRouter.js:214` onward) copies client `facilityId` into payload. The scoped duplicate query is not authorization for the proposed new record.
- A-only technician, selected A, body Facility B: **201**, stored Facility B Asset. Body omission/null returns 400; malformed ID returns 400; valid nonexistent Facility ID is accepted (related referential defect).
- `PUT /assets/:id` (`:409`) checks the old record's Facility, then applies arbitrary `req.body`. A-only technician moves Asset A to B with plain body or `$set`.
- After movement the A caller receives 404 for its old Asset ID, while a B-only caller can retrieve it. This is persisted movement, not just an echoed body.
- Admin creation across selected Facilities also succeeds, but **admin transfer rules are POLICY**, not counted as proof of unauthorized cross-tenant access.

### F2 — P0: unauthorized Asset references and foreign WO disclosure — CONFIRMED BUG

- Asset POST and PUT accept B's Department and parent Asset on an A Asset. Department has an explicit Facility owner; dedicated parent PATCH already refuses B's Asset with 404.
- PUT accepts `workOrders:[foreignWoId]`. Subsequent scoped `GET /assets/:id` populates the foreign WO's **description** (synthetic marker `PRIVATE-B-WO-DESCRIPTION`). The configured projection also includes identifier/status/scheduled/completion dates; the description and ID are directly exercised.
- Root cause: initial document scope does not authorize replacement references; unscoped populate trusts client-replaceable links.
- Foreign Department/parent **names** were not observed in these mutation responses; the unauthorized binding itself is confirmed. Do not overstate identifier echoes as newly discovered secrets.

### F3 — P0: Work Order creation trusts foreign Asset; selected context unchecked — CONFIRMED BUG

- `deriveFacilityIdFromAsset` performs `Asset.findById(assetId).select('facilityId')` without scope. POST `/workorders` uses that Facility and creates the WO.
- A-only technician selected A supplies Asset B: **201**, WO belongs to B; response includes B's Facility ID and new WO ID. This remains true if body `facilityId` claims A.
- Own Asset A + body B/malformed/nonexistent/null/omitted Facility still produces Facility A: direct body Facility spoofing is **NOT REPRODUCED**, but deriving from an unauthorized Asset is not safe.
- Foreign/malformed selected header is ignored by the local WO creation path. Own Asset + unauthorized selected B also succeeds. Contract lookup returning null or failing does not prevent creation.
- Missing/malformed/nonexistent Asset rejected with 400; legacy Asset without Facility rejected with 400. Unowned/global WO creation was **NOT REPRODUCED**.

### F4 — P0: Work Order cross-Facility references / create-time #5 bypass — CONFIRMED BUG

- POST broad body spread accepts B's Department and a schema-valid B Ticket on a WO whose Asset/Facility is A.
- It accepts `testEquipmentUsed` referencing Asset B, with client-chosen actor and date. #5 dedicated equipment route would reject that reference.
- Work Order creation therefore bypasses dedicated nested validation without using ordinary PUT. No new Part/Procedure ownership rule is needed to demonstrate the foreign equipment defect.

### F5 — P1: Asset audit and calculated-field mutation — CONFIRMED BUG

- POST createdBy/updatedBy persist null because route reads `req.user._id`; auth provides `id`. Client attempts to override create audit are ignored, but canonical provenance is lost.
- PUT persists spoofed createdBy, updatedBy, deletedBy, deletedAt and calculated `metrics.totalMaintenanceCost` (both nested object and dotted path).
- Separate archive route is admin-only. Broad ordinary update defeats that separation for archive metadata.
- Asset timestamps themselves were protected in tested POST/PUT cases; no general timestamp bypass is claimed.

### F6 — P1: Work Order create audit/nested identity spoofing — CONFIRMED BUG

- Old createdAt, arbitrary deletedAt/deletedBy, and a supplied workOrderNumber persist.
- Nested labor/travel userId, Part usedBy, equipment usedBy/usedAt, Procedure task-result submittedBy/submittedAt are supplied directly via creation. Tests retain actor assertions; observation bodies include synthetic historical timestamps.
- createdBy/updatedBy are correctly overwritten from authenticated actor; independently supplied old updatedAt is overwritten. Those hypotheses are **NOT REPRODUCED**.
- `createdFrom:'automation'` and requestedBy another User are accepted, but delegation/provenance rules require a human decision before calling every such value unauthorized.

### F7 — P1: nonexistent references accepted — CONFIRMED BUG

- Asset POST accepts nonexistent Facility/Department/parent IDs. PUT accepts nonexistent Facility/Department/parent/Template IDs.
- WO POST accepts nonexistent Department/User/Ticket IDs. Dedicated assignment also accepts nonexistent User, with null populated assignee.
- These are existence/validity defects distinct from inventing new Facility ownership for globally modeled references. Valid Template shared use remains allowed in controls.

### F8 — P1: technician archive bypass — CONFIRMED BUG

- PATCH `/workorders/:id/status` accepts `Archived` from a technician and persists it without archive metadata.
- POST `/workorders` accepts normalized `status:'archived'` with deletedAt/deletedBy null.
- Dedicated archive endpoint refuses technician (403), as does Asset's dedicated archive endpoint. Ordinary #5 PUT rejects the protected archive status. The alternate create/status path defeats that existing role separation.

### F9 — P2: error disclosure and inconsistent invalid-input responses — CONFIRMED BUG

- DELETE `/assets/:childId/parent` spreads a tenant-filter object as function arguments and returns `Found non-callable @@iterator` for both own and foreign IDs. No unlink or foreign data mutation occurred; this is workflow/internal-error disclosure, not successful foreign access.
- Asset create invalid `maintenanceSchedule.procedure` returns 400 with raw `Cast to ObjectId`/schema details.
- Asset invalid Department PUT, numeric ctrlNumber POST, WO invalid assignee/Department POST return generic **500**, not safe 400-class validation responses. No stack was observed in those generic 500 bodies.
- Asset conflicting selected Facility is blocked by tenant helper during duplicate lookup but surfaces as generic 500. WO conflicting selected Facility is accepted (F3).
- Dedicated status accepts an arbitrary non-enum status because query update omits validators: related P2 validity observation, not cost/procedure work.

## 7. Controls and policy boundaries

### NOT REPRODUCED

- Anonymous, invalid/expired token, customer/viewer/legacy/missing/unknown role primary mutation access.
- Asset PUT targeting an already-foreign Asset, even with body Facility A: 404 and unchanged foreign record.
- Foreign Work Order ordinary PUT, assignment, scheduling, status: denied through parent scope; malformed/nonexistent targets return safe 400/404-class responses.
- #5 ordinary PUT ownership/nested/cost/audit/operator/dotted bypass: all sampled cases rejected without mutation; complete #5 suite also green.
- Dedicated assign/schedule/status copying body Facility/Asset/Department/Contract/Ticket/createdBy: ignored; canonical updatedBy retained.
- Direct WO body Facility override with own Asset; unowned WO creation; create actor spoofing of top-level createdBy/updatedBy.
- Direct WO calculated total override: save hook recalculates; this does not approve nested input rates or costs.
- #3 duplicate identifier disclosure: foreign serial match yields no duplicateOf/foreign Asset ID, visible serial duplicate advisory still works; duplicate-like serial PUT emits no foreign duplicate identifier.
- Normal Asset timestamp spoofing and create duplicateOf input spoofing.

### POLICY DECISION REQUIRED

1. **Transfers:** which roles may transfer an Asset between two authorized Facilities? Is selected Facility always authoritative for admins, or may admin explicitly target another Facility? Existing UI has a Facility selector. This report proves A-only technician cannot safely be trusted with body B; it does not invent an admin transfer prohibition.
2. **WO Facility derivation:** retain Asset-derived Facility after an authorized Asset lookup, require selected context equality, and define admin/multi-Facility behavior explicitly. Never derive authority from the raw Asset ID.
3. **Assignees:** User has `facilities[]`, legacy/default facilityId, departmentId and role. Current create/assign accepts B-only technician, customer, viewer, legacy/missing/unknown-role users. PATCH response exposes that assignee's username/role. Existing source does not establish complete eligibility/delegation/privacy rules. Existence validation is needed regardless; scope/role eligibility needs an accepted rule.
4. **Shared references:** EquipmentTemplate, Procedure and Task do not establish Facility ownership in their schemas. Shared Template works from both Facilities. No failure is based on invented Template/Procedure/Task tenancy. Maintenance Procedure existence/validity and editable maintenance-history fields need clarification.
5. **Contract/Vendor:** Asset contractId is client-mutable without validation; WO vendorService accepts unvalidated Vendor ID/name. Neither is permission to redesign cross-service Contract economics or shared Vendor master policy. Decide legitimate create/edit surface and reference validation; no foreign Contract economic disclosure was reproduced.
6. **Provenance:** manual createdFrom/requestedBy, status-at-create/completion provenance, and delegated logs require explicit rules. Canonical actor/audit protection and existing admin-only archival are not ambiguous.
7. **Duplicate/identity:** global ctrlNumber uniqueness returns 409 revealing collision (but not foreign ID). Keep this distinct from the fixed #3 duplicateOf leak; global uniqueness policy and the duplicateOf schema ref mismatch are pre-existing questions.
8. **Legacy global records:** the tenant helper includes absent-Facility records. Preserve existing generic/global rules until explicitly changed; do not silently turn this task into a tenancy migration.

### TESTABILITY BLOCKED / limited branch

`POST /workorders/from-ticket/:ticketId` is mounted. A schema-valid Ticket addressed by `_id` returns 404 because the query uses an absent `ticketId` field. This is the tested result, not a claim that no legacy data could reach later code.

Source inspection of later branches finds `WorkOrder.create` treated as an array, lowercase converted status mismatching schema enum, and an undefined `session` in the error handler. Forcing legacy-shaped raw data through that path risks an unhandled asynchronous failure after persistence. No production startup was imported and no handler was monkey-patched to conceal this. **Successful legacy ticket promotion authorization is TESTABILITY BLOCKED in this minimal in-process harness.** A separately controlled process-level reproduction can be considered after review. The unscoped existing-WO lookup in that legacy branch remains a hypothesis, not a confirmed exploit.

## 8. Active caller compatibility implications

- `frontend/src/pages/AddAsset/modals/CreateAssetModal.tsx` and `CreateAssetFromUdiModal.tsx` send selected Facility and Department. Server validation must preserve legitimate own-Facility creation.
- `frontend/src/pages/EditAsset/components/AssetFormFields.tsx` exposes Facility and Department edits, resets Department on Facility change, edits parentAsset, and includes legitimate financial/compliance/descriptive fields. `useFacilityDepartmentData` uses the scoped Facility context and Department service. A blanket immutability rule would change a real workflow; transfer semantics need approval.
- Asset client `updateAsset` sends the supplied partial Asset through ordinary PUT. Do not simply reuse the narrow Work Order allowlist for Asset.
- `CreateWorkOrderModal.tsx` sends Asset ID and current User assignee; `AssetWorkOrderTable.tsx` defaults assignee to current user. Same-scope default assignment and ordinary scheduling must keep working.
- Work Order dedicated assignment currently exposes populated User username/role; tightening eligibility/projection could affect clients and needs focused review.
- Contract-service active-for-asset source calls `resolveAuthorizedFacilityId`, then filters Contract by Facility, Asset, status and date. This static inspection is not an end-to-end runtime result. Core must independently authorize the Asset before calling that service; its error is currently swallowed into null contract.
- No Contract, Vendor, CRM, Interaction, Opportunity, economic calculation, or frontend implementation was changed.

## 9. Minimal remediation options — proposal only

1. Establish authorized selected context before creating records. Validate Facility existence and caller membership; define explicit admin/transfer exception policy first. Scope the Asset lookup used by WO creation, then derive Facility consistently.
2. For Asset create/update validate Department in the target Facility, parent Asset through the same authorized scope, and reference existence. Protect the old target and the proposed replacement boundary; an initial scoped query alone is insufficient.
3. Replace Asset broad PUT and WO broad create body spreads with explicit allowed fields. Preserve documented legitimate editing; server-own identity/audit/archive/calculated fields. Reject operator/dotted bypasses. For WO nested initialization, prefer dedicated validated endpoints or equivalent explicit validation; do not silently retain the creation bypass.
4. Protect Asset workOrders from client replacement. Validate/filter populated references where historical inconsistent records could still exist; no automatic data migration is proposed.
5. Use canonical req.user.id for audit; preserve existing timestamp behavior and generate archive/sequence metadata on the server. Restrict Archived transition to the authorized archive path; validate status enum on dedicated updates.
6. Validate User existence now, and apply role/Facility eligibility once the human assignment policy is accepted. Do not infer that allowing an assignee to be selected gives that user mutation permission.
7. Normalize malformed/reference failures to safe 400/404 responses; foreign references should not disclose details. Correct parent-unlink argument handling only after remediation authorization.
8. Keep #7 cost semantics, #9 Procedure units, cross-service Contract ownership and global reference redesign separate. Stored computed-field write protection is distinct from changing calculation formulas.
9. Add permanent targeted regression coverage while retaining the frozen reproduction evidence. No production change is authorized by this report.

Human review is needed for transfer/admin selected-context rules, assignee eligibility, provenance/delegation, maintenance-history mutability, and permitted Contract/Vendor reference editing. Cross-Facility A-only mutation and spoofed server audit do not require inventing new ownership semantics to recognize the defect.

## 10. Verification

Final results are inserted below from the completed isolated runs. Red evidence is deliberate; baseline tests remain separate.

| Verification | Result |
|---|---|
| #6 opt-in reproduction | 318 total; 269 pass; **49 intentionally fail** |
| Controls | 142 pass |
| Observations | 126 pass |
| Security assertions | 1 pass, 49 fail |
| Complete safe core-service | **596/596**, 9 suites |
| Facility isolation (included in core) | **45/45** (29 + 16) |
| Vendor security (included in core) | **90/90** |
| Work Order subresource (included in core) | **295/295** |
| Core authentication security (contract-service harness) | **31/31** |
| New JavaScript/Jest configuration syntax | **PASS** |
| Tracked diff check and untracked-file whitespace checks | **PASS** |
| Production/prior-test scope and main/Interaction state review | **PASS**, no changes |


The unchanged core suite comprises 166 existing shared cases + 45 Facility + 90 Vendor + 295 Work Order subresource cases = 596. No Interaction backend is present on this main-derived branch, and no count-equalizing change was made.

During harness development a model filename and authentication-status expectation were corrected before freezing evidence. An initial auth invocation lacking a cached binary path failed closed (downloads disabled); supplying the existing approved binary produced 31/31. No real database fallback or dependency install was used. No failure was converted into a passing security expectation. Admin cross-selected behavior was deliberately left as policy observation, not an invented security prohibition.

Re-run from `core-service/`, with existing dependencies available (do not install or start runtime services):

```sh
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 \
MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false \
npm test -- --config jest.asset-workorder-ownership-reproduction.config.cjs --runInBand --silent
```

Expected at this base: nonzero exit due to the preserved security failures. For controls/observations alone use `--testNamePattern='^(CONTROL|OBSERVATION):'`. To inspect only the security boundary assertions use `--testNamePattern='^SECURITY:'`; one already passes and the remainder intentionally fail. Do not turn off failed assertions to obtain a green suite.

Baseline command uses the same MongoMemoryServer environment and `npm test -- --runInBand --silent` in core-service. Authentication runs in contract-service with the same environment and `--runTestsByPath src/security/_tests_/coreAuthentication.security.test.js`.

Reproduction suite SHA-256 at handoff: `a1a41c8144dae10771e76de9bdcb1590687547febad30b146fac67465b5f9115`.

## 11. Final state and remaining limits

- Only the three reproduction artifacts are intended as uncommitted changes; no production or previous test diff.
- Branch remains at the stated main base; nothing committed/pushed; no Gitea update.
- Main and paused Interaction worktrees remain unchanged and clean.
- Reused dependency symlinks created for testing are removed before handoff; existing dependency installations are untouched.
- Syntax checks and whitespace/diff checks cover the new files as well as tracked diff.
- No actual Contract service, real data, deployed runtime, customer record, migration, or background job was exercised.
- No fix is claimed. Await human review and remediation policy/authorization.

## Appendix — preserved failing security assertions

These names identify the individual failing evidence cases; they are not a count of independent vulnerabilities. Several exercise the same defect through different fields or endpoints.

- Asset create cannot cross selected Facility (technician)
- Asset create rejects nonexistent Facility
- Asset create refuses foreign departmentId
- Asset create refuses foreign parentAsset
- Asset update refuses foreign departmentId
- Asset update refuses foreign parentAsset
- Asset parent unlink own safe error
- Asset parent unlink foreign safe error
- Asset create stamps canonical actor
- Asset PUT protects facilityId
- Asset PUT protects $set facilityId
- Asset PUT protects createdBy
- Asset PUT protects updatedBy
- Asset PUT protects deletedBy
- Asset PUT protects deletedAt
- Asset PUT protects metrics
- Asset PUT protects dotted metrics
- Asset PUT protects foreign workOrders
- Asset detail must not disclose foreign WO after client reference injection
- WO create requires Asset in selected Facility (technician)
- WO create rejects foreign departmentId
- WO create rejects foreign ticketId
- WO create protects createdAt
- WO create protects deletedAt
- WO create protects deletedBy
- WO create protects workOrderNumber
- WO create protects labor actor
- WO create protects travel actor
- WO create protects foreign equipment
- WO create protects parts actor
- WO create protects procedure result actor
- WO create rejects unauthorized selected Facility even with own Asset
- asset create conflicting context fails safely
- WO create conflicting context fails safely
- Asset invalid department update is safe 4xx
- Asset numeric ctrlNumber is safe 4xx
- WO invalid assignee create is safe 4xx
- WO invalid department create is safe 4xx
- Asset PUT requires destination Facility existence
- Asset update rejects missing departmentId reference
- Asset update rejects missing templateId reference
- Asset update rejects missing parentAsset reference
- WO create rejects nonexistent departmentId
- WO create rejects nonexistent assignedTo
- WO create rejects nonexistent ticketId
- WO assignment requires referenced user existence
- technician cannot bypass admin archive through status endpoint
- technician cannot bypass admin archive through WO create
- Asset create malformed maintenance Procedure must not expose cast internals

## Accepted human ownership policy follow-up - 2026-09-15

The user accepted the findings and authorized an evidence/policy checkpoint only. **Remediation has not begun.** Earlier policy ambiguities, proposals, testability limits and stopping-state statements remain historical evidence; these decisions supersede the corresponding policy questions for future remediation.

Preserved evidence: 318 total cases, 269 passing controls/observations (including one already-passing security assertion), 49 intentional security failures, P0/P1/P2 findings, NOT REPRODUCED findings, original policy ambiguities, and the testability-blocked Ticket promotion path. The reproduction assertions remain unchanged.

### Asset

- Explicit selected/authorized Facility context is authoritative for creation; derive Facility ownership from it. Client facilityId cannot override or broaden ownership. Missing, malformed, nonexistent, conflicting or unauthorized Facility context must fail safely under established CRM/core Facility policy.
- Ordinary update cannot change facilityId, for either administrators or technicians. No admin bypass. Transfers are deferred to a future explicit audited workflow with reference-integrity rules.
- Department must exist and belong to the authoritative Asset Facility. Foreign Department references are prohibited and must be non-disclosing.
- Preserve Template/shared-reference semantics unless an authoritative ownership model exists; do not invent Template Facility ownership.
- Explicit mutable-field allowlisting must protect server-owned audit, lifecycle, duplicate, deletion and calculated fields from client control.
- Related Work Orders returned through Asset detail must obey the same authorized Facility boundary. Do not expose foreign identities, descriptions, counts or other data.

### Work Order

- Referenced Asset is authoritative for Facility ownership. Required invariant: selected authorized Facility == Asset Facility == Work Order Facility. The body cannot independently choose another Facility. Reject foreign/inaccessible Assets without disclosing protected identity.
- Department must exist and belong to the Work Order/Asset Facility.
- If assigned, the User must exist, have canonical admin or technician role, and have explicit authorization to the Work Order Facility. Customer/viewer/legacy tech/missing/unknown roles are ineligible. Organization membership alone is insufficient.
- Preserve #5: test-equipment Assets must be authorized in the same Facility as the parent Work Order.
- Archive/deletion remains admin-only. Technician archive bypass is a confirmed defect. No hard delete.
- Creation and applicable mutations must prevent injection/spoofing of labor/time actors, travel actors, parts/equipment nested provenance, procedures/results, createdBy/updatedBy, deletion audit, calculated costs, lifecycle/calculated fields and other server-owned fields. Preserve #5 ordinary PUT protections.
- No implicit Asset or Work Order Facility transfer through ordinary create/update, even for administrators; use a future explicit transfer workflow.

### Remaining read-only inspection

Do not invent semantics for createdFrom, requestedBy or related provenance. Inspect current active writers/readers before deciding client mutability. After this checkpoint, inspect Ticket schema/Facility ownership, create/read/update authorization, Ticket-to-WO paths, safe ticketId validation, and alternate mounted ownership mutation paths. Report any additional human decisions required.

This records policy; it does not authorize remediation, real-data access, #7 work, or closing Gitea #6. The evidence checkpoint is intended for both configured remotes and an evidence-only comment on #6, which remains open.
