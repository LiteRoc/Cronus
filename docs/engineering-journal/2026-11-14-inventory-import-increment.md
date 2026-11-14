# 2026-11-14: inventory import preparation and initial operator verification

## Scope and current state

Work began from `1185854` on the isolated `feat/inventory-import` worktree.
The increment adds offline TruAsset XLSX parsing, snapshot-based planning,
read-only reference export, and guarded department/asset workflow preparation.
It does not add an automatic batch-import endpoint or a live execution CLI.
The original preparation documents describe the pre-execution stage; this entry
records the subsequent operator-reported deployment and verification.

The operator reported saving the baseline increment as local commit `a33d081` on
`feat/inventory-import`, with a clean Ubuntu worktree after commit. No merge or
push was reported. The review corrections described below have been applied to the
isolated Ubuntu feature worktree and tested there; they are not committed or deployed. Operational
datasets, snapshots, request packets, record IDs, and customer-specific status
plans stay outside version control.

## Accepted data-handling decisions

- Preserve all 21 original export columns and cell metadata, including text
  identifiers, source calendar dates, model and model number, and department names.
- Use a separate matching label without replacing either original model field.
- Keep reported source cost distinct from verified purchase price. Reported zero
  costs do not populate operational purchase fields or adopt template prices.
- Allow assets without templates. Do not create placeholder templates.
- Resolve shorter approved department names within an explicit facility while
  retaining the original source names in provenance.
- Do not infer maintenance timing, operational risk, installation date, or confirmed
  service start from source strings, acquisition date, or template defaults.

## Implementation and reasoning

The parser and planner load no models or application entry points. Snapshot
planning requires globally scoped assets because asset tags are globally unique;
department and parent references remain facility-scoped. Shared templates retain
their existing archive-state policy. Incomplete or ambiguous evidence stops for
review. A snapshot is evidence of a past read, not an execution authorization.

The standalone reference exporter uses projected native-driver reads rather than
Mongoose models, avoiding application startup and model/index initialization.
It preserves archive metadata, rejects missing collections and malformed required
values, bounds output, protects existing files, and withholds connection details
from errors. Reads are sequential, not a point-in-time cross-collection backup.
Its canonical repository path is now
`core-service/scripts/exportInventorySnapshot.cjs`; the temporary root-level copy
used during operator handoff was relocated within the feature worktree.

Department creation adds an admin-only POST to the existing router and reuses
selected-facility validation. Sequential repeats reuse an existing normalized
name; ambiguous matches stop. No uniqueness/index migration was introduced.

Asset preparation reuses current creation and edit allowlists. The first request
stores original cells under `attributes.truAssetImport`. Acquisition date, status,
and source equipment class require a subsequent update because they are edit-only
fields. A read-back then checks identity, references, source preservation, blank
verified costs, and the expected follow-up. This is not an atomic transaction.
Failed or uncertain writes stop without automatic retry, rollback, or continuation.

The asset-detail handler now uses `toObject({ flattenMaps: true })`: offline
schema and handler tests demonstrated that spreading the prior `toObject()` value
into JSON otherwise hid Map attributes. Creation-path request/payload logging was
removed to prevent preserved source data from being copied into logs. No schema,
ownership allowlist, authentication policy, or asset-creation authorization was
expanded by those router changes.

## Verification evidence

Before the review corrections, the full local synthetic suite passed 70 tests: parser, planner, reference exporter,
department workflow, and asset workflow. Tests use synthetic data, in-memory
adapters, local schema validation, and temporary loopback HTTP listeners. No real
database is accessed by those tests. Direct asset-handler tests replace reference
and persistence dependencies; they are not real-database integration tests.

The operator first reported 17 department tests and 41 asset/parser/planner tests
passing on Ubuntu, then reported all 70 tests passing in the complete combined
Ubuntu run, including the exporter tests. Those results belong to the baseline
increment; the follow-up Ubuntu results are recorded below.

Following separate approvals, the operator reported deploying the department
runtime changes and the focused asset-router changes. Checks included backups,
file comparisons, container state, unauthenticated 401 responses, syntax checks,
and normal signed-in inventory access. The live service uses a source bind mount
and a development watcher, so copying runtime files can trigger a restart. Future
deployment still needs explicit approval and preservation of existing live changes.

The operator then separately approved and executed creation of three departments
and three initial assets through authenticated APIs. Each asset was handled one
at a time: preflight, creation, follow-up, and read-back. The operator supplied
successful read-back results for all three assets with every check true: identity,
assignment, template choice, description/location, source data, follow-up values,
blank verified costs, no inferred maintenance or service dates, and no duplicate
flag. Two assets intentionally have no template. These are operator-reported live
results; the assistant did not independently query the operational database.
Private local status artifacts mark all three complete and prevent preparation
from those completion records. No further database work is part of wrap-up.

## Review corrections verified on Ubuntu

Review of `a33d081` found two gaps in the generic asset verifier. It validated
response IDs as well-formed but did not require update/read-back IDs to equal the
ID returned by creation. It also omitted explicit rejection of unexpected
installation and service-start dates in API responses. The operator's earlier
one-asset browser checks included the expected ID and unset-service-date checks;
these findings do not contradict those reported successful live verifications.

The local verifier now compares update and read-back IDs to the captured creation
ID. It rejects non-null installation or service-start dates in creation, update,
and read-back responses. Missing and explicitly null dates remain acceptable.
Failures retain the original created ID and affected stage, stop before later
assets, and do not trigger retry, deletion, or automatic rollback. No API payload,
schema, endpoint, or authorization policy was changed by these corrections.

Eight new negative regression cases reproduced the original gaps before the fix:
wrong IDs in two response stages and each unexpected date in three stages. A
ninth new case confirms that null dates remain acceptable. After the corrections,
all 24 asset-workflow tests and all 79 tests in the full local synthetic suite
passed. The operator subsequently reported all 24 asset-workflow tests and all
79 tests in the complete synthetic suite passing on Ubuntu. No real database was
accessed by these tests. Review and a separate follow-up commit remain pending;
no new push, deployment, or operational database action was performed.

## Remaining constraints

- The department-name index is not unique. Lookup then create is not safe against
  simultaneous creators; controlled operation or a separate concurrency design is
  required. Sequential reuse is not distributed idempotency.
- The ordinary asset creation API retains its existing duplicate-advisory behavior,
  which may create a record before reporting a possible serial duplicate. Preflight
  and reconciliation remain necessary, along with the global tag unique constraint.
- An asset created before a failed follow-up is partial state. Reconcile by its
  known ID rather than rerunning creation or deleting automatically.
- The generic runners still need explicitly supplied authenticated API adapters
  for future execution. The reported live run used reviewed one-asset browser API
  requests, not a newly wired automatic importer.
- Original source fields in attributes are retained provenance, not an approved
  operational mapping for every source risk, FDA, maintenance, or lifecycle field.
- Public upload hardening, durable resumability, concurrency guarantees, and a
  repeatable production deployment process remain future work.

For the mechanisms and usage, see `inventory-import-1b.md`,
`inventory-import-1c.md`, `inventory-snapshot-export.md`,
`department-creation-workflow.md`, and `asset-creation-workflow.md` in `docs/`.
