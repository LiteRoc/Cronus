# Supplier authentication reproduction — Gitea #13

Date: September 16, 2026.

Issue: [#13 — security: Require authentication and authorization for Supplier API](http://192.168.1.185:3000/LiteRoc/cronus/issues/13), OPEN, priority P0 stated in the issue body. The repository had no available labels when the issue was created.

Provenance: Derived from the September 16, 2026 post-#6 P0 Security Stabilization Review.

Base: `main @ c31f309f9747a5959f91e316c275e308d7b7bcc5`.
Reproduction branch: `fix/supplier-auth`; dedicated worktree `/tmp/cronus-supplier-auth`.
No production implementation or prior suite was modified during reproduction. The original evidence was left uncommitted; the September 19 checkpoint below preserves it for publication before remediation.

## Result and classification

**CONFIRMED BUG — P0:** Anonymous `GET /suppliers` discloses all synthetic Supplier records, including contact information. Anonymous `POST /suppliers` creates a record that is independently verified in isolated persistence. Invalid and expired tokens likewise obtain both outcomes. These authentication failures require no Facility-ownership or authenticated-role policy decision.

The missing boundary is reproduced against the real router and Mongoose model, using actual application registration under a controlled startup harness. It is not merely a source hypothesis. No real-data or deployed-runtime verification occurred; external proxy/network protections were not tested.

**P0 SECURITY/OWNERSHIP STABILIZATION GATE: BLOCKED.** Issue #13 remains open; remediation is not part of this task. Opportunity, Interaction frontend, P1 stabilization, S2/S3 and #7 remain paused/unstarted within this task.

## Architecture and reachable surface

- `core-service/src/models/Supplier.js:3`: required unique `name`; optional `contactName`, `contactEmail`, `contactPhone`, `address`, `website`; `status` is Active/Inactive, default Active. Mongoose adds `_id`, `__v`, `createdAt`, `updatedAt`.
- No Facility, tenant, organization, audit-actor or archive ownership fields exist. Source structure and Part references indicate shared master/reference data; this does not establish an approved future ownership policy. No Facility ownership is invented here.
- `core-service/app.js:87` mounts the Supplier router at `/suppliers`. Earlier middleware supplies parsing/static/logging/CORS/layout behavior, with no inherited authentication for this path. Other routers mounted earlier have distinct path prefixes.
- `core-service/src/routers/supplierRouter.js:9` declares `POST /` using `new Supplier(req.body)` and save; line 21 declares `GET /` using unfiltered `Supplier.find()`. Neither operation has authentication or role middleware.
- Only collection GET and POST are declared. No detail GET, update, delete, restore or archive operation exists in this router. The suite inspects the route stack and does not fabricate PUT/DELETE requests.
- Source search of `frontend/src`, `core-service/src`, and `contract-service/src` found no direct frontend or contract-service Supplier API consumer. This is source coverage, not a claim about deployed external clients.
- Active reference consumers: Part `supplierId` and Work Order parts' nested Supplier-name population. No other operational Supplier references were identified in that search.

Comparable conventions are not Supplier policy: Vendor has a router-wide admin/technician gate, differentiated read exposure, admin mutations and disabled creation. Manufacturer authenticates reads, permits admin/canonical technician creation via declaration alias `tech`, and restricts archive to admin. The shared authorization helper canonicalizes declarations, not legacy `tech` token claims. These different conventions require an explicit Supplier decision.

## Authentication and role matrix

Each row used its own requests and fixture reset. GET returned both seeded records, including an Inactive record. Each valid POST returned 201 and increased independently queried document count from two to three.

| Caller | Real authentication control | Supplier GET | Supplier POST valid body | Role interpretation |
| --- | --- | --- | --- | --- |
| Anonymous | 401 | 200, all records | 201, persisted | Confirmed missing authentication |
| Invalid token | 403 | 200, all records | 201, persisted | Confirmed token validation bypass |
| Expired signed token | 403 | 200, all records | 201, persisted | Confirmed expiry validation bypass |
| Admin | Authenticated | 200, all records | 201, persisted | No Supplier role gate is invoked |
| Canonical technician | Authenticated | 200, all records | 201, persisted | Create policy requires decision |
| Customer | Authenticated | 200, all records | 201, persisted | Read/create policy requires decision |
| Viewer | Authenticated | 200, all records | 201, persisted | Read/create policy requires decision |
| Legacy `tech` | Authenticated; role remains `tech` | 200, all records | 201, persisted | Bypasses canonical authorization convention |
| Missing role | Authenticated; role is null | 200, all records | 201, persisted | No role requirement is enforced |
| Unknown role | Authenticated; role remains unknown | 200, all records | 201, persisted | No allowlist is enforced |

Authenticated success here does not establish approved authorization. The suite deliberately does not turn an undecided read/create allowlist into an expected failing assertion. The missing role enforcement is observed; the exact replacement policy is **POLICY DECISION REQUIRED**.

## Disclosure and body behavior

GET exposes these field categories without redaction: record identity/version, Supplier name/status, contact person's name/email/phone, postal address, website, and creation/update timestamps. All two synthetic records were returned. Search, status, page/limit, and supplied Facility/tenant query parameters did not restrict results. Source confirms there is no filtering or pagination implementation; the test does not claim large-dataset load behavior.

POST body tests were performed for all ten caller types:

| Input | Reproduced response/persistence |
| --- | --- |
| Valid name/contact body | 201; persisted with default Active status |
| Missing required name | 500; no new record |
| Unsupported status | 500; no new record |
| Object supplied as name | 500; no new record |
| Supplied `_id`, `createdAt`, `updatedAt`, `__v` | 201; supplied ID and both 2001 timestamps persist; supplied version 99 becomes 0 |
| Undeclared `facilityId`, `tenantId`, `organizationId`, `createdBy`, `updatedBy`, `deletedBy`, `deletedAt` | 201; all undeclared fields stripped from response and raw persisted document |
| Exact duplicate name | 500; real initialized unique index prevents another record |

Additional anonymous controls: malformed JSON returns 400 with no insertion; a lowercase case-variant name is distinct and persists with 201.

**NOT REPRODUCED:** persistence of undeclared ownership/audit fields, bypass of exact-name uniqueness, or insertion from the tested malformed inputs. These negative results are limited to the enumerated inputs. No claim of cross-Facility reassignment is made for a model without such ownership.

**POLICY DECISION REQUIRED:** whether IDs/timestamps must be exclusively generated by the server, acceptable input fields/status control, and case-normalization/duplicate semantics. Acceptance of supplied metadata is reproduced, but its independent severity is not inflated into another P0. Malformed/duplicate 500 handling is a validation-quality observation, not the P0 finding.

## Downstream reference implications — inspection only

`core-service/src/models/Part.js:12` defines `supplierId` as a Supplier ObjectId reference. Mounted Part creation (`partRouter.js:33`) is authenticated and role-gated; its Supplier check validates ObjectId syntax, not provenance. Its update path also accepts body-supplied fields. Thus source supports that an anonymously created, syntactically valid Supplier ID can later be selected by an authorized Part writer.

`workOrderRouter.js:680` retrieves authorized Work Order parts and populates each Part's Supplier `name`. Its part-add operation at line 704 requires authentication, canonical role authorization, parent Work Order ownership, and an existing Part. Supplier linkage is indirect through Part, not a direct Supplier field on a Work Order.

Anonymous creation therefore plausibly poisons shared reference data that can flow into authorized operational workflows. No Part or Work Order request was executed in this reproduction, and downstream adoption remains source-supported rather than runtime-reproduced. The result does not show anonymous updates to existing Suppliers, Parts or Work Orders. No additional issue was created for downstream endpoints.

## Evidence design and execution

Files:

- `core-service/jest.supplier-auth-reproduction.config.cjs` — explicit opt-in config.
- `core-service/src/routers/_tests_/supplierAuth.reproduction.mjs` — controls, current-behavior observations and intentionally failing security assertions.
- This report — durable findings, limitations, policy questions and commands.

The suite evaluates `app.js` registration in a VM with real Express parsing, Supplier router/model and authentication middleware. Application listen, configured DB connection, dotenv loading, cron, unrelated routers/models, logging/CORS/layout and outbound-client setup are disabled/stubbed. No production entry point is loaded normally. Prefix inspection establishes why unrelated router stubs do not supply Supplier authentication. Real deployed CORS/proxy/static behavior is not claimed to be reproduced.

The existing `mongoMemoryHarness.mjs` is unchanged. It creates a new loopback MongoMemoryServer database, replaces the configured URI with a forbidden sentinel, guards `mongoose.connect` against other targets and drops/stops only its own persistence. Fail-closed controls reject both the configured sentinel and an alternate URI. Downloads are disabled; the pre-existing cached MongoDB binary is used. Supplier indexes are initialized before duplicate tests. Only synthetic `.invalid` contact data is seeded, with per-test cleanup. Tokens use a synthetic key and are checked against real authentication middleware; no real credentials or Supplier records are used.

Reproduction command, from `core-service/`:

```sh
env MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.supplier-auth-reproduction.config.cjs --runInBand --silent
```

Result: **81 tests: 75 passed, 6 intentionally failed; exit 1.** Breakdown: 12 controls (including ten token fixtures), 60 per-caller body/list controls and observations, 3 additional query/parser/duplicate observations, 6 security assertions. A test may exercise multiple inputs; 81 is Jest test count, not HTTP-request count.

The six failing expectations preserve the intended boundary:

| Security assertion | Expected | Actual |
| --- | --- | --- |
| Anonymous GET | denied, 0 records disclosed | not denied, 2 records disclosed |
| Invalid-token GET | denied, 0 records disclosed | not denied, 2 records disclosed |
| Expired-token GET | denied, 0 records disclosed | not denied, 2 records disclosed |
| Anonymous POST | denied, 0 inserted | not denied, 1 inserted |
| Invalid-token POST | denied, 0 inserted | not denied, 1 inserted |
| Expired-token POST | denied, 0 inserted | not denied, 1 inserted |

No unexpected reproduction failure or testability blocker occurred. The reproduction filename does not match default safe-suite test discovery; its intentionally red assertions do not change the existing baseline.

## Safe baselines

All ran against the unchanged prior suites in this worktree with the same cached-binary/download-disabled environment:

| Baseline | Result |
| --- | --- |
| Complete safe core, 11 suites | 811/811 |
| Facility #3, two suites | 45/45 |
| Vendor #4 | 90/90 |
| Work Order subresource #5 | 295/295 |
| Ownership #6, including standalone topology | 215/215 |
| Core authentication, hosted in contract-service | 31/31 |

The six stabilization suites were also rerun together: 645/645, exit 0. They are a subset of the 811 core tests, not 645 additional unique tests. Authentication ran separately with 31/31, exit 0. Full core exited 0. Existing experimental Node/Mongoose duplicate-index warnings appeared; no baseline failed.

Commands after the same environment prefix above:

```sh
# core-service/
npm test -- --runInBand --silent
npm test -- --runInBand --silent --runTestsByPath src/routers/_tests_/facilityQueryIsolation.test.mjs src/routers/_tests_/facilityIsolationCompatibility.test.mjs src/routers/_tests_/vendorSecurity.test.mjs src/routers/_tests_/workOrderSubresourceSecurity.test.mjs src/routers/_tests_/operationalOwnership.test.mjs src/routers/_tests_/ticketPromotionStandalone.test.mjs
# contract-service/
npm test -- --runInBand --silent --runTestsByPath src/security/_tests_/coreAuthentication.security.test.js
```

## Historical September 16 policy questions — before remediation

1. Decide Supplier read roles, including customer/viewer access, and whether contact fields require an internal-only projection.
2. Decide whether creation is admin-only, admin plus canonical technician, or temporarily disabled pending a managed master-data workflow. Unknown/missing/legacy token roles must not acquire privileges through fallback.
3. Preserve current shared-reference semantics unless an explicitly approved ownership redesign is requested. Authentication remediation does not require inventing Facility ownership.
4. Proposed minimum boundary: router-wide authentication and explicit per-operation canonical role allowlists, with tests proving anonymous/invalid/expired denial before reads/writes.
5. Proposed input contract: allowlisted Supplier business fields, server-managed ID/timestamps, explicit malformed/duplicate handling, and preserved unique-name enforcement. Confirm the metadata/status policy before implementation.
6. Future update/archive/restore support and lifecycle/reference policy require separate decisions; no such operations should be added as incidental security remediation.

No remediation, commit, push or closure was performed. Only issue #13 was created externally. Temporary dependency symlinks reuse matching existing manifests without dependency changes and are removed at handoff. Main and paused Interaction remain at their starting commits; Supplier evidence remains uncommitted in the dedicated branch/worktree. No real database, Docker container, runtime service or scheduled job was accessed or changed; only isolated test persistence and the explicitly authorized Gitea issue integration were used.


## September 19 resumption — accepted policy and evidence checkpoint

The preceding sections preserve the September 16 reproduction and its then-open
policy questions. The user subsequently accepted the following policy; it
supersedes those questions without changing the historical evidence:

- Supplier remains shared internal reference/master data, without Facility or
  tenant ownership.
- Admin may read and create; canonical technician may read only. Customer,
  viewer, legacy `tech`, missing/unknown roles and anonymous/invalid/expired
  authentication are denied.
- Creation uses an explicit allowlist: `name`, `contactName`, `contactEmail`,
  `contactPhone`, `address`, `website`, `status`. Identity, timestamps, version
  and other server metadata cannot be supplied by the client.
- Preserve exact-name uniqueness and existing case-sensitive behavior; no
  case-insensitive normalization or deduplication workflow.
- Malformed/non-object bodies, schema validation and malformed JSON receive
  safe 400 responses; exact duplicate names receive 409; unexpected errors
  receive generic 500 responses.
- No update, archive, delete, restore, ownership redesign or schema migration.

Read-only reconciliation confirmed local and both live remote main refs at
`c31f309f9747a5959f91e316c275e308d7b7bcc5` and Interaction refs at
`395e39c2ed2f6001db7daa78537b9eb06dd43903`. The local `fix/supplier-auth`
worktree retained exactly the three untracked reproduction files and no
production edits. The branch was not yet published on either remote. Authenticated
Gitea inspection confirmed #13 remains open with the expected P0 scope.
Existing evidence was inspected, not recreated or rerun at this checkpoint.

The user confirms the post-#6 read-only P0 review is complete and its gate is
**BLOCKED**. After #13 is eventually merged and closed, reproduce the
shared-resource ordinary-update archival bypass and test-equipment picker
Facility bypass, then rerun the gate. #7 and P1 work must wait until it passes.
Interaction and all new CRM development remain paused; do not merge Interaction
into main. The authorized next steps are evidence commit/push and an issue
comment, followed by narrow remediation and permanent tests, stopping for final
review before committing remediation.


## September 19 remediation — historical pre-review checkpoint

Evidence checkpoint `c99c91f` was committed and pushed to Gitea and GitHub
before production changes. The authorized evidence/policy comment is
[comment 79](http://192.168.1.185:3000/LiteRoc/cronus/issues/13#issuecomment-79).
The original reproduction suite and opt-in configuration remain unchanged.
The remediation described below is intentionally uncommitted and unpushed.

Implementation is limited to the Supplier router and its application mount.
Existing authentication and canonical role middleware now protect reads and
creation; only admin can create. A seven-field business allowlist discards
identity, timestamps, version and undeclared fields before model construction.
The Supplier schema, exact-name unique index, case/whitespace semantics,
GET array and successful POST response shape are unchanged. No ownership,
new endpoint, migration, dependency or downstream Part/Work Order change occurs.
Validation returns generic 400, exact-name duplicate index failures return 409,
and unexpected read/create errors return generic 500 without logging payloads
or database errors. Malformed JSON receives a Supplier-scoped generic JSON 400.

The initial permanent run passed 52/59: seven parser cases demonstrated that
an error handler inside the router does not catch errors from the preceding
application parser. The fix follows the existing Vendor/Contact mount pattern:
`app.use('/suppliers', supplierRouter.supplierJsonErrorHandler, supplierRouter)`.
The #6 application-registration test double gains only that handler export;
its assertions remain unchanged. This discovery was verified through the real
application registration evaluated with startup effects disabled, not a running
application service.

Final verification:

| Check | Result |
| --- | --- |
| Permanent Supplier suite | 59/59 |
| Original Supplier SECURITY assertions, unchanged | 6/6 (75 historical cases intentionally not selected) |
| Complete safe core, 12 suites | 870/870 = previous 811 + Supplier 59 |
| Core authentication | 31/31 |
| Changed application/router/new-suite JavaScript syntax | PASS |
| Whitespace check | PASS |

The full core run includes Facility 45, Vendor 90, Work Order subresources 295
and ownership 215; no baseline assertion was weakened. The permanent Supplier
suite covers all ten caller types, pre-query/pre-save denial, shared reads,
server metadata protection with independently queried persistence, schema and
parser failures, exact and concurrent duplicate creation, case/whitespace
compatibility, and safe unexpected errors. The six formerly failing frozen
security assertions pass without modification. Remaining frozen observations
record historical behavior and are not the post-policy regression suite.

All persistence was isolated and synthetic through inspected fail-closed
MongoMemoryServer harnesses, with the cached binary and runtime downloads
disabled. Existing matching dependency trees were temporarily symlinked for
testing; those links were removed at handoff. Existing experimental Node and
Mongoose duplicate-index warnings remain deferred. No frontend or TypeScript
checks were rerun because frontend/API-client files and TypeScript contracts
were unchanged and source search found no direct frontend Supplier consumer.
No deployed, real-data or external-client compatibility verification occurred.

Final review must precede any remediation commit. #13 remains open; main and
Interaction were not modified. No merge or issue closure is claimed. The P0 gate
remains BLOCKED, with the two additional P0 reproductions still pending. #7,
P1 and CRM features remain paused. Current Context/Open Threads still describe
an earlier checkpoint; reconcile those documents in an authorized handoff update
using this journal and the user's accepted post-#6 review state.


## Final commit-gate review — September 19 (before publication approval)

**PASS for local #13 remediation review; no remediation commit or publication.**
This review supersedes the preceding handoff's TypeScript verification omission.

One concrete read-projection gap was confirmed: synthetic undeclared stored
`legacySecret`, `tenantId` and `createdBy` fields appeared in both admin and
technician GET responses (57/59 passed, two strengthened cases failed).
The router now uses an explicit MongoDB inclusion projection:
`_id __v name contactName contactEmail contactPhone address website status createdAt updatedAt`.
The same 59-test suite now proves those undeclared fields are excluded and
checks that POST responses equal the independently read stored document, with
server-generated metadata rather than rejected client values. No schema or
Facility-scoping change was made.

The sole Supplier mount authenticates and checks canonical admin/technician
roles before Supplier query or Supplier-specific body processing. POST adds an
admin-only gate. The application JSON parser precedes authentication; malformed
JSON is handled as a safe 400 before Supplier operations. All ten caller types
are exercised. No alternate Supplier API mount was found.

The create allowlist remains `name`, `contactName`, `contactEmail`,
`contactPhone`, `address`, `website`, `status`. Null, arrays, primitive JSON,
empty objects, malformed JSON and schema failures receive safe 400 responses;
exact duplicate names receive 409; unexpected read/write failures receive generic
500. Case variants and surrounding whitespace retain exact-name semantics.

Repeated source inspection found no direct frontend or service HTTP consumer
requiring unauthenticated Supplier access. Part.supplierId remains a Supplier
ObjectId reference; the mounted Work Order parts handler still populates its
name. These files and models are unchanged. This is source compatibility
analysis plus existing regression coverage, not verification of external clients
or a deployed Supplier-to-Part-to-Work-Order end-to-end workflow. No additional
Supplier endpoints were introduced.

Fresh final checks, each requested dedicated group executed separately:

| Check | Result |
| --- | --- |
| Supplier permanent suite | 59/59 |
| Frozen original security assertions | 6/6 unchanged; 75 historical cases not selected |
| Complete safe core | 870/870, 12 suites |
| Facility #3 | 45/45 |
| Vendor #4 | 90/90 |
| Work Order subresources #5 | 295/295 |
| Ownership #6 | 215/215 |
| Authentication | 31/31 |
| Actual application TypeScript | PASS |
| Changed JavaScript syntax | PASS |
| npm ls --depth=0, all three packages | exit 0 |
| Whitespace and focused security/scope review | PASS |

Application TypeScript used `tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 5.0`.
Frontend npm ls reported extraneous entries in the reused dependency tree;
no install, upgrade or cleanup was performed. Manifest/lockfile and downstream
schema/router diffs against c99c91f are empty. Temporary dependency symlinks
were removed after checking. All test persistence was synthetic and isolated,
with downloads disabled; no real databases or runtime services were accessed.

Before remains 75 passing controls/observations and six intentional failures.
After remains all six original security assertions passing without modification.
The frozen reproduction/config are byte-for-byte unchanged from c99c91f; obsolete
historical access expectations are not rewritten. The permanent 59-test Supplier
suite is the authoritative ongoing regression suite.

Only the read projection, strengthened existing assertions and this review record
were added during the final gate. HEAD remains the evidence checkpoint c99c91f;
remediation remains uncommitted. No Gitea update, commit, push, merge or closure
occurred during this review. The overall P0 gate remains blocked and S2/S3/#7,
P1 and CRM work remain paused.


## Approved documentation and publication checkpoint — September 19

The user accepted the final commit-gate review and authorized documentation,
commit and publication as `fix: secure Supplier API access` on `fix/supplier-auth`.
Earlier uncommitted/pre-review statements above describe historical checkpoints.
The commit containing this section is the remediation checkpoint; Git provides
its exact hash, and the post-push Gitea #13 comment records publication results.
No merge or issue closure is authorized. #13 is not resolved on main.

Final accepted policy: Supplier remains shared internal reference/master data,
without Facility or tenant ownership. Admin reads/creates; canonical technician
reads only. Customer, viewer, legacy tech, missing/unknown roles and anonymous,
invalid or expired authentication are denied. No update/archive/delete/restore.

POST accepts only `name`, `contactName`, `contactEmail`, `contactPhone`, `address`,
`website`, `status`. Clients cannot control `_id`, `__v`, timestamps,
ownership/audit metadata or other undeclared/server-managed fields; rejected
metadata is not echoed. GET includes those seven business fields plus `_id`,
`__v`, `createdAt`, `updatedAt`; arbitrary legacy/stored fields are excluded.
Malformed/non-object/schema-invalid bodies return safe 400; exact duplicate name
returns 409; unexpected failures return generic 500; malformed JSON returns safe
400. Existing case-sensitive/exact-name uniqueness is preserved.

Historical evidence remains 81 cases: 75 passing controls/observations and six
intentional failures for anonymous/invalid/expired disclosure and persisted
creation. After remediation all six original assertions pass unchanged. The
frozen suite stays historical; the permanent 59-test suite governs regression.

Current Context and Open Threads now supersede stale branch handoffs: #3–#6
are closed; #13 is verified on its fix branch and awaits merge; the completed
post-#6 review left the P0 gate blocked. S2/S3 await reproduction. #7, P1,
Interaction frontend, Opportunity and new CRM work remain paused.

Fresh pre-publication reruns passed: Supplier 59/59; original security 6/6
unchanged; complete safe core 870/870 (12 suites); separately run Facility 45/45,
Vendor 90/90, subresources 295/295, ownership 215/215 and authentication 31/31.
Application TypeScript, changed-file syntax, whitespace/security scope review
and npm ls for all three packages passed. Frontend npm ls exited 0 with 490
existing extraneous entries and no other reported problems; no remediation of
that dependency tree was attempted. Frozen evidence/config, inspected fail-closed
harnesses, manifests and lockfiles remain unchanged from c99c91f. Downloads were
disabled and only isolated synthetic persistence was used. No real-data or
deployed-runtime verification occurred. Temporary dependency links were removed.
The seven-file scope contains only Supplier remediation/tests and the journal,
Current Context and Open Threads; no S2/S3/#7/CRM or relationship changes.


## Main merge gate — September 19

Pre-merge fix/main/Interaction worktrees were clean. Local and both live remote
refs matched the approved checkpoints. The Supplier-only code/evidence/tests/
documentation scope and unchanged dependency manifests/lockfiles were confirmed.
Both remotes were fetched; main fast-forwarded cleanly from c31f309 to
`e95d22dcd2a67eeef436867170a46ccd882e6a2a`, with no squash, rebase or rewrite.

Fresh merged-main verification passed: Supplier 59/59; original security 6/6
unchanged; Facility 45/45; Vendor 90/90; subresources 295/295; ownership 215/215;
complete safe core 870/870; authentication 31/31; application TypeScript, syntax,
npm ls in all three packages and whitespace/security scope checks. Existing
frontend extraneous-package warnings remain unchanged. Tests used inspected
fail-closed synthetic persistence with downloads disabled. Temporary dependency
links were removed. No real-data/deployed-runtime verification occurred.

The Supplier tests confirm anonymous/invalid/expired GET and POST denial,
admin read/create, technician read with create denied, and denial of customer,
viewer, legacy/missing/unknown roles. Identity/timestamps are server-controlled;
exact duplicates return 409, invalid input safe 400; GET is explicitly projected.
No Facility/tenant ownership or additional lifecycle endpoints were introduced.

Current Context/Open Threads now record #13 as merged and verified on main,
with the issue still open pending Interaction compatibility and final closure.
This documentation-only commit follows the verified fast-forward. #3–#6 remain
resolved. The P0 gate remains blocked by S2/S3 pending reproduction; #7 and CRM
features remain paused. Main must be merged into Interaction, never the reverse.


## Interaction compatibility gate — September 21

Resumed the pending main-to-Interaction merge at Interaction 395e39c with
main 2f7bea8. Three authorized test-only router-mock corrections preserve the
combined Supplier/Interaction error-handler interface: operationalOwnership
preserves both exports; supplierSecurity and supplierAuth.reproduction add
interactionJsonErrorHandler. The frozen reproduction initially failed setup
because that export was absent; work stopped until the user authorized this
third mock-only correction. No production change beyond the incoming Supplier
fix and existing Interaction implementation was made.

Byte-for-byte comparison against preserved evidence c99c91f confirms that
reversing only the one mock-export addition restores the entire reproduction
file exactly. All six original security assertions, expected behavior and
fixtures are unchanged; the reproduction configuration is also unchanged.

Fresh verification passed:

- Original Supplier security assertions: 6/6 (75 historical cases deliberately
  excluded by the SECURITY filter).
- Complete combined safe core: 924/924 across 14 suites = main 870 + Interaction
  54. Component counts: Supplier 59, Interaction 43 endpoint + 11 service,
  Facility 29 + 16, Vendor 90, Work Order subresources 295, ownership 214 + 1
  standalone-topology test, Contact 49 + 7, FollowUp 87 + 20, lifecycle 3.
- Authentication: 31/31; relevant frontend compatibility: 21/21.
- Application TypeScript with the established ignoreDeprecations 5.0 override,
  changed JavaScript syntax, npm ls --depth=0 in all three packages, staged and
  unstaged whitespace checks, and focused security/scope checks passed.
- Existing dependencies in this worktree reported no npm ls problems. No
  dependencies or manifests/lockfiles were changed. Experimental Node/Jest,
  duplicate Mongoose index and React Router future-flag warnings remain.

Tests used inspected fail-closed synthetic MongoMemoryServer persistence with
runtime downloads disabled and the existing local binary. No real databases,
containers, scheduled jobs or application services were touched. Deployed
behavior and real data remain unverified.

The user authorized completion of this merge, both Interaction pushes, remote
ref verification and final Gitea #13 comment/closure after the green gate.
This checkpoint records verified tests; the final issue comment records the
resulting commit and publication outcome. Interaction remains paused and is
not merged into main. S2, S3, #7, Interaction frontend and Opportunity were not
started; P0 remains blocked pending the separate S2/S3 work.
