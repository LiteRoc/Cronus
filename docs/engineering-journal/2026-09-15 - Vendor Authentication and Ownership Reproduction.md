# Vendor Authentication and Ownership Reproduction — 2026-09-15

## Status and scope

**Reproduction and policy-boundary assessment only. No production remediation.**

- Gitea #4: `security: Enforce Vendor authentication and tenant ownership`.
- Tested main/base: `4771555ed50044bedaa464127a2fe68e6f32c769`.
- Evidence branch: `fix/vendor-auth-ownership`.
- Worktree: `/tmp/cronus-vendor-auth-ownership`.
- Paused Interaction remains preserved at `98dff68aa52d4ff237fd50186481ce1da8a8b97d`; it was not used as the base.
- Gitea #4 acceptance criteria were read through the authorized integration. The issue explicitly leaves Vendor ownership, role policy and authenticated tenant mapping unresolved. No issue was changed.
- Runtime evidence means synthetic, isolated endpoint execution. It does **not** establish production exploitation, deployed reachability through a proxy, or the existence of legacy Vendor records in real data.

## Architecture and existing policy boundary

The active owner in executable code is core-service. `core-service/src/models/Vendor.js` defines required/indexed ObjectId `tenantId`, with the comment “organization Id”. It defines name, category enum, contact information, services, territories, preferredVendor, notes and timestamps. There is no `facilityId`, Organization reference validator, creator/updater identity, archive state, or uniqueness constraint on name. The tenant field is not a Mongoose `ref`; a syntactically valid nonexistent Organization ID is accepted.

Facility has required `organizationId` referencing Organization. This suggests a possible Organization mapping but does not establish an approved Vendor authorization policy. Vendor's schema and detail filter suggest tenant ownership; its unfiltered list behaves as a shared directory. Neither fact authorizes inventing Facility-exclusive Vendors or treating all authenticated cross-Facility visibility as illicit.

Current Context and Open Threads describe Vendor ownership as unresolved and forbid implicit revival of unmounted contract-service Vendor code. The accepted CRM policy also defers Vendor dependencies. Main's AGENTS.md was read; the requested Routine Development Authorization section is not present at this base, but this task explicitly authorizes the scoped work. The September 14 stabilization journal is not present on this main checkout; no historical document was copied from Interaction. Issue #4 and existing memory supply the assessment provenance.

`authenticateToken` verifies signature, issuer and audience, then exposes role, Facility identity and allowed Facilities. It does not propagate `tenantId`, even when a signed token includes it. `authorizeRoles` is a separate middleware: legacy `tech` declarations normalize to technician, but Vendor never calls this role gate. Thus a validly signed `tech`, unknown or missing-role token still reaches Vendor detail. This is different from rejection at a role-gated endpoint in the authentication baseline.

The generic `buildTenantFilter` targets `facilityId` and includes generic/global records. Vendor does not use it or `requireTenantOwnership`. Simply adding that generic helper would not implement Vendor tenant ownership: Vendor records lack the Facility field and could enter its global-record branch.

## Mounted endpoints and middleware

Static mount authority: `core-service/app.js:93`, `app.use('/vendors', vendorRouter)`. There is no global authentication gate before this mount. CORS is not authentication. The isolated app mounts the unchanged router at exactly that prefix with JSON parsing. Application startup is deliberately not imported because it connects a database and imports jobs.

| Endpoint | Router line | Authentication | Role gate | Effective ownership predicate |
| --- | --- | --- | --- | --- |
| GET /vendors | 8 | None | None | `Vendor.find().lean()` |
| GET /vendors/:id | 18 | `authenticateToken` | None | `{ _id: req.params.id, tenantId: req.user.tenantId }` |
| POST /vendors | 34 | None | None | `new Vendor(req.body)` |
| PUT /vendors/:id | 45 | None | None | `findByIdAndUpdate(id, req.body, { new: true })` |
| DELETE /vendors/:id | 56 | None | None | `findByIdAndDelete(id)` |

No PATCH, archive or singular `/vendor` create endpoint is mounted in this router; the minimal application returns 404 for these paths. Contract-service's separate Vendor model/controllers/routes are unmounted; they were inspected but not executed or revived.

## Synthetic fixtures and method

Each case receives new Organizations A/B, Facilities A/B linked to their respective Organizations, and Vendors A/B with distinct IDs, tenantIds, names, contact emails and notes. Signed identities have default/allowed Facility A only. Context variants omit the selected Facility, conflict with allowed Facilities by selecting B, use malformed selection, or omit the token default. Deliberate legacy fixtures lacking ownership are clearly separate from ordinary schema-created Vendors. One synthetic WorkOrder references Vendor B to test deletion effects.

The suite uses the established `mongoMemoryHarness.mjs`: configured MONGO_URI is replaced with an unusable sentinel, `mongoose.connect` accepts only this MongoMemoryServer's issued loopback target, downloads are disabled, and teardown drops only the ephemeral database. An executable control rejects both configured and alternate connection targets while retaining two synthetic Vendors. The router/model graph uses the guarded connection and imports no alternate database client, configuration, external integration or startup. Authentication fixtures use a synthetic signing key set before middleware import; detail logging is suppressed within tests.

Existing installed dependencies were reused through temporary worktree-local node_modules symlinks; no packages or lockfiles were changed. The symlinks are removed after verification. No full application, Docker, scheduled job, real database or external Vendor API was run.

## Authentication and role matrix — observed results

Every role row below is directly exercised for every mounted operation. “Detail” covers both tenant-bearing Vendors and a random absent ID. Mutation results were checked in synthetic persistence, not only HTTP responses.

| Caller | List | Detail | Create with body tenant B | Update B/reassign to A | Hard-delete B |
| --- | --- | --- | --- | --- | --- |
| Anonymous | 200, all records | 401 | 201 | 200 | 200 |
| Invalid bearer | 200, all records | 403 | 201 | 200 | 200 |
| Admin | 200, all records | 404 | 201 | 200 | 200 |
| Technician | 200, all records | 404 | 201 | 200 | 200 |
| Customer | 200, all records | 404 | 201 | 200 | 200 |
| Viewer | 200, all records | 404 | 201 | 200 | 200 |
| Signed legacy tech | 200, all records | 404 | 201 | 200 | 200 |
| Signed unknown role | 200, all records | 404 | 201 | 200 | 200 |
| Signed missing role | 200, all records | 404 | 201 | 200 | 200 |

A synthetic Vendor missing tenantId returns 200 detail with its notes to all seven signed role contexts. Even a matching signed tenantId claim yields 404 for an ordinary tenant-bearing Vendor because authentication discards that claim. Anonymous detail access is **NOT REPRODUCED**; anonymous disclosure is instead confirmed through the list.

## Facility/tenant, query and identity observations

- A-only contexts list both Organization Vendors, including contact information, notes and tenant identifiers. Missing, conflicting, malformed and missing-default Facility context does not constrain list/create/update/delete. **POLICY DECISION REQUIRED** for legitimate authenticated sharing; anonymous access is independently a confirmed defect.
- Ordinary detail returns the same 404 body for A, B and absent IDs with signed contexts. Foreign tenant-bearing detail disclosure and existence distinction through that detail response are **NOT REPRODUCED**. List and mutation routes independently reveal existence; no confidentiality claim is made for the API as a whole.
- `search`, `q`, category, tenantId, facilityId, page and limit are ignored, including combined query parameters. List returns the complete array; array length reveals its size. There is no supported count envelope, pagination or search predicate to overwrite. Predicate-overwrite and separate count/page leakage are **NOT REPRODUCED**; unbounded list disclosure is confirmed.
- Create accepts an arbitrary body tenantId, supplied `_id` and backdated `createdAt`. Unknown-schema `facilityId`, `organizationId`, `createdBy` and `updatedBy` are stripped. Facility/audit-actor field persistence spoofing is **NOT REPRODUCED**; ownership selection and creation timestamp spoofing are reproduced. There is no trustworthy actor audit field to spoof.
- Create without tenantId returns 400 and persists nothing. Same-name creates within and across tenants return 201 with a new ID, without a foreign `duplicateOf`. Duplicate-warning disclosure is **NOT REPRODUCED**; duplicate-management policy remains open.
- PUT accepts body tenant reassignment and MongoDB update operators. `$unset` removes required tenantId and `$set` writes an invalid category because update validators are absent. Removing ownership also makes the record reachable through signed detail lookup. This is reproduced schema/ownership integrity loss, not a proposed new tenant model.
- Missing PUT/DELETE IDs return 404 whereas existing IDs mutate successfully, exposing existence without authentication. Malformed detail IDs return 500; malformed PUT IDs return 400 with Mongoose casting details. No real identifiers or secrets were involved.
- DELETE physically removes the Vendor and leaves the synthetic WorkOrder's vendorId and vendorName behind. **CONFIRMED BUG** for anonymous destruction; the choice of archive, reference blocking or permitted hard-delete is **POLICY DECISION REQUIRED**.

## Confirmed findings and severity

| Finding | Classification / severity | Evidence and impact | Smallest remediation option — proposal only |
| --- | --- | --- | --- |
| Unauthenticated Vendor directory disclosure | CONFIRMED BUG / P0 | GET /vendors line 10 returns all stored fields from both synthetic tenants with anonymous/invalid bearer requests, including IDs, contact details, notes and directory size | Require valid authentication; apply the approved visibility predicate and response field policy |
| Unauthenticated Vendor creation and body-controlled placement | CONFIRMED BUG / P0 | POST line 36 persists attacker-selected tenantId, including a nonexistent Organization, without identity | Authenticate; gate approved roles; derive owner from authorized context and allowlist business fields |
| Unauthenticated cross-record mutation/ownership reassignment | CONFIRMED BUG / P0 | PUT line 47 modifies B from A-only or anonymous context, reassigns tenant and returns full Vendor | Authenticate; combine authorized ownership with ID; disallow protected fields/operators and validate updates |
| Unauthenticated hard deletion | CONFIRMED BUG / P0 | DELETE line 58 removes B for anonymous/invalid/A-only callers; WorkOrder reference remains | Authenticate and enforce approved mutation policy; decide reference protection/archive behavior before changing lifecycle |
| Required ownership and enum bypass on update | CONFIRMED BUG / P1 | PUT does not use update validators; tenantId disappears and category leaves declared enum | Allowlist updates, reject protected operators and validate against existing schema; owner reassignment needs explicit policy |
| Detail uses an unavailable identity field | CONFIRMED BUG / P1 correctness; disclosure authorization POLICY | Detail's undefined tenant predicate produces 404 for normal records and 200 for synthetic ownership-free records across all signed roles | Establish authoritative tenant mapping; fail closed on unavailable required identity; define global/admin exceptions explicitly |
| Creation provenance/error weaknesses | CONFIRMED BUG / P2 | Body-createdAt is accepted; malformed update ID exposes casting detail and detail returns 500 | Generate protected provenance server-side, validate IDs and normalize error responses |

P0 does not depend on deciding whether authenticated users may share Vendors: valid authentication is absent entirely. Role outcomes alone do not prove that every customer/viewer/technician action violates an approved Vendor role policy. Those role decisions remain unresolved. A legacy ownership-free record's global visibility is not independently labeled unauthorized without policy or evidence of real legacy records.

## Cross-reference implications — read-only inspection

- **Assets:** no direct Vendor reference was found in the current Asset schema/router. Manufacturer is a string. Contract-covered Asset relationships are indirect; no Asset ownership model is changed here.
- **WorkOrders:** `vendorService.vendorId` references Vendor and carries name, invoice/cost fields. WorkOrder queries/analytics use this subdocument. A deletion leaves the direct reference dangling in the isolated test; preserving stored names/costs matters for history.
- **Contracts:** Contract stores linkedVendor, serviceProviderId, and vendorLinks (Vendor IDs, name snapshots and covered Asset IDs). Vendor-link mutations are admin-protected in contract-service. `addVendorLink` calls core `/vendors/:id` to validate/snapshot Vendor identity; overview/lookup code also requests detail with fallbacks. They inherit the reproduced detail mapping problem, but a full cross-service workflow was not mounted or claimed reproduced. Historical snapshots may preserve names even when live lookup fails.
- **Service authentication:** `forwardCoreHeaders.js` forwards per-request Authorization and selected Facility to core. Adding core authentication is compatible with that mechanism; exact Vendor scope compatibility depends on the chosen policy. No cross-service collection writes are proposed.
- **Frontend:** vendorAPI uses the authenticated core client, which attaches selected Facility. `useVendors` caches under the constant `vendors` key; detail cache is Vendor ID based, without Facility. Contract detail uses the shared list for picker choices/name display. This is evidence that callers consume a shared-looking directory, not proof of intentional cross-tenant authorization. Restricting visibility would require validating pickers and Facility-change cache handling; no frontend changes were made.
- **Existing frontend create mismatch:** createVendor posts `/vendor` singular and its type omits tenantId; active create is `/vendors` plural and requires tenantId. This is a source compatibility observation, not a tested frontend workflow and not authorization to fix it.
- **Unmounted contract-service Vendor:** has no tenant field and separate CommonJS code in an ESM service. It is not a safe substitute for the active model and was not executed.

## Human decisions required before remediation

1. Is a Vendor an Organization-owned operational record, Facility-owned record, or global directory entity with separately scoped commercial/private details? May the same Vendor serve multiple Facilities or Organizations?
2. If Organization-owned, is authorized selected Facility -> Facility.organizationId the canonical mapping? Define multiple-Facility membership, admin cross-Organization access, missing context and legacy ownership-free records. Do not use body tenantId or merely add an unverified JWT claim.
3. Specify list/detail/create/update/delete permissions for admin, technician, customer and viewer. Define rejection of missing/unknown/legacy roles. Do not infer technician create rights from currently unguarded code.
4. Define visibility for contacts, notes, preferred status and commercial information; directory sharing need not imply sharing every field.
5. Decide hard-delete versus archive/reference blocking, preservation of WorkOrder/Contract history, duplicate semantics and mutation provenance.
6. Establish a separately authorized migration/legacy-data assessment if ownership backfill is needed. No real-data inventory occurred in this task.

A narrow authentication-only gate could address the anonymous paths first if explicitly authorized, but it would not finish #4. The coherent remediation requires the decisions above, scoped queries for every endpoint, field validation, and caller compatibility tests. Do not mark #4 complete based on adding authentication alone.

## Evidence artifacts and verification

Added only:

- `core-service/jest.vendor-reproduction.config.cjs` — opt-in selection; no production module transform or mocks needed.
- `core-service/src/routers/_tests_/vendorAuthOwnership.reproduction.mjs` — unchanged real router/model/authentication, synthetic fixtures.
- This report.

| Run | Result |
| --- | --- |
| Opt-in Vendor evidence | 70 total: 60 controls/observations passed; 10 intentionally failing SECURITY cases; zero skipped |
| Full safe core suite | 211/211, seven suites |
| Facility regression within full core | 45/45: 29 isolation + 16 compatibility |
| Authentication security | 31/31 |
| Contract overview with mocked core client, including Vendor-service components | 3/3 |
| New-file JavaScript syntax / diff whitespace / focused scope review | Passed |

No pre-existing direct Vendor endpoint suite was found. Absence of tests is not evidence of a defect. The 60 green observations deliberately describe current behavior and are not permanent authorization specifications. Later remediation should preserve the ten SECURITY assertions; observational characterization cases may need clearly explained updates when approved behavior changes. No assertion was weakened to hide a failure.

The eight authentication failures cover anonymous and invalid bearer GET/POST/PUT/DELETE. The two schema failures cover required tenantId and category integrity. Baselines are green separately from this intentional red suite. Warnings concern existing experimental Node test flags and duplicate WorkOrder indexes; no environment or dependency repair was attempted.

Reproduction command from core-service (requires existing installed dependencies and cached binary):

```sh
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 \
MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false \
npm test -- --config jest.vendor-reproduction.config.cjs --runInBand --silent
```

Expected current exit status: 1, with exactly 60 passed / 10 failed. Normal `npm test -- --runInBand --silent` excludes `.reproduction.mjs` and passes 211 tests. Authentication ran from contract-service with `--runTestsByPath src/security/_tests_/coreAuthentication.security.test.js` and the same MongoMemoryServer environment. Contract overview ran with `--runTestsByPath src/services/_tests_/contractOverview.service.test.js` and a mocked core client.

## Final boundary and Git state

No investigated Vendor endpoint required uncontrolled startup: **TESTABILITY BLOCKED** does not apply to the five isolated endpoints. Deployment/proxy behavior, real legacy records and full frontend/cross-service workflows were not exercised; their behavior remains unverified.

No tracked production, dependency, lockfile, Interaction, existing baseline test or persistent-memory file was changed. The dedicated branch remains at the specified main base with three untracked reproduction artifacts. Main and Interaction worktrees remain clean at their supplied commits. No commit, push, merge, Gitea mutation, real-data access, Docker/runtime operation or scheduled job was performed. Await human policy and evidence review before remediation.

## Accepted human Vendor policy — 2026-09-15 follow-up

The user accepted the reproduction findings and subsequently made the following
policy decision. The earlier ambiguity, observations, proposed options and Git
state above describe the original reproduction checkpoint; this follow-up is
authoritative for future remediation. **Remediation has not begun.** This
checkpoint preserves the original security assertions unchanged.

### Shared identity and relationships

Vendor is shared master/reference data, not a Facility-owned CRM entity. Do not
add facilityId as a security fix or duplicate a real-world Vendor master for each
Facility. Facility-specific relationships belong in VendorLink, Contract,
coverage/service relationships or other explicitly Facility-scoped records.

### Authentication and roles

No anonymous Vendor API access; reject invalid and expired authentication.

| Role | Accepted Vendor-management API access |
| --- | --- |
| admin | Read, create, update, archive |
| technician | Read only |
| customer / viewer | None |
| legacy tech / missing role / unknown role | None |

Technician mutations remain deferred and are not authorized in Phase 1
stabilization. Role access must not depend on an identity claim authentication
does not provide.

### Archival and historical compatibility

Remove or disable hard delete. Archival is admin-only and soft; no restore
workflow is authorized in this slice. Archived Vendors remain valid historical
references but are excluded from normal active lists/pickers. Existing Contract,
VendorLink and history references must continue to work.

### Shared-field visibility

Only fields appropriate for authenticated internal shared reference use belong
in Vendor master data. Do not add or expose Facility-specific pricing, contract
economics, strategic notes, leakage/margin information or Facility-specific
commercial intelligence through this master. Inventory and report ambiguous
existing fields before changing or removing them; this policy does not authorize
assuming existing free text is safe to share.

### Existing tenantId compatibility boundary

Do not remove, repurpose or reinterpret tenantId yet. Investigate its writers,
readers, intended semantics and possible existing-record dependencies read-only.
Distinguish Organization identity, legacy tenancy, Facility identity and unknown
semantics. No real database access is authorized. Retaining the field does not
make it a valid authentication/authorization identity.

### Validation, audit and next gate

Create/update must use explicit mutable-field allowlists. Clients cannot control
timestamps, archive audit or other server-owned ownership/audit fields. Preserve
current schema validation on updates, including required tenantId and the category
enum (category itself is currently optional). Return stable safe errors for
malformed IDs and bodies.

The approved next steps are evidence/policy commit and push, a progress comment
on open Gitea #4, and then read-only tenantId compatibility assessment. They do
not authorize production remediation, migration, real-data inspection, CRM work,
or starting another stabilization issue. Remaining compatibility and ambiguous
field decisions must be reported before implementing the fix.
