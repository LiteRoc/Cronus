# 2026-11-14: inventory import preparation and initial operator verification

## Scope and current state

Work began from `1185854` on the isolated `feat/inventory-import` worktree.
The increment adds offline TruAsset XLSX parsing, snapshot-based planning,
read-only reference export, and guarded department/asset workflow preparation.
It does not add an automatic batch-import endpoint or a live execution CLI.
The original preparation documents describe the pre-execution stage; this entry
records the subsequent operator-reported deployment and verification.

Source changes remain subject to final Ubuntu verification and Git review before
commit. No commit, merge, or push is claimed by this entry. Operational datasets,
snapshots, request packets, record IDs, and customer-specific status plans stay
outside version control.

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

The full local synthetic suite passed 70 tests: parser, planner, reference exporter,
department workflow, and asset workflow. Tests use synthetic data, in-memory
adapters, local schema validation, and temporary loopback HTTP listeners. No real
database is accessed by those tests. Direct asset-handler tests replace reference
and persistence dependencies; they are not real-database integration tests.

The operator separately reported 17 department tests and 41 asset/parser/planner
tests passing on Ubuntu. The exporter tests are included in the final handoff for
a complete final Ubuntu run; that final combined result is not yet asserted here.

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
