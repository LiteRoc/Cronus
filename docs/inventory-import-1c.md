# Increment 1C: offline import planning

The accepted mapping decisions are implemented in a pure planner: verified costs
remain unset, templates remain optional, and a separate matching label combines
source Model and Model Number without replacing either source field. If Model
Number already equals or starts with the complete Model,
it is not repeated. Other combinations concatenate Model and Model Number.

## Usage

From `core-service`:

```sh
node scripts/planInventory.cjs /path/to/export.xlsx 000000000000000000000001 /path/to/snapshot.json
node scripts/planInventory.cjs /path/to/export.xlsx 000000000000000000000001 -
node --test src/services/_tests_/inventoryImport.test.cjs src/services/_tests_/inventoryImportPlan.test.cjs
```

The optional final argument selects a worksheet. A dash means no snapshot is
available: reference checks remain pending and every row requires review. Output
goes to stdout and contains source data; no output files are written automatically.
Exit 0 means all rows are proposed creates in this snapshot, 1 means review or
blocking errors, and 2 means input/usage failure. None authorizes persistence.

The programmatic API is `buildImportPlan(parserReport, { facilityId, snapshot })`.
Inputs are not mutated. The facility is explicit; it is never guessed from a tag
or department name. This is an internal offline helper, not an authorized endpoint.

Explicit department renaming can be supplied as `departmentMappings`, an array of
`{ facilityId, sourceName, targetName }`. The CLI accepts the same JSON array through
`--department-mappings /path/to/mappings.json` after the worksheet argument, if any.
Mappings apply only to the selected facility; prefix stripping is never inferred.
The proposed department name uses the target, while `sourceDepartmentName` and
original source cells preserve the exported name. A unique existing target name
resolves normally. When a mapped target does not exist in the snapshot, the plan
adds a deduplicated `departmentProposals` entry with pending status and no ID.
Rows remain in review with `DEPARTMENT_CREATION_PENDING`; no department is created.
Ambiguous existing names still require review. No creation proposal is made
without a snapshot or explicit mapping.

## Snapshot contract

Supply an explicitly authorized, minimal JSON snapshot with this shape (synthetic):

```json
{
  "id": "synthetic-snapshot-1",
  "capturedAt": "2026-11-14T12:00:00Z",
  "assetsScope": "global",
  "assets": [],
  "departments": [],
  "templates": []
}
```

All arrays are required; absent data is not treated as an empty database. The
snapshot producer must supply complete collections for the intended checks.
`assetsScope: global` is an assertion by that producer, not something the planner
can independently verify. Global assets (including archived records) are needed
because `ctrlNumber` uniqueness is global. Do not expose this global snapshot to
an ordinary facility user. No snapshot exporter or database connection is added.

Each record has a lowercase 24-hex string `_id`, unique within its collection:

- Assets: `facilityId`, `ctrlNumber`, `manufacturer`, optional text `serialNumber`.
- Departments: `facilityId`, `name`.
- Templates: `manufacturer`, `model`, optional text `di`, plus all archive metadata
  (`status`, `deletedAt`, `deletedBy`, `archivedAt`, `archivedBy`, `isArchived`) as
  present in the source. Omitting archive state could incorrectly suggest a match.

Snapshot metadata is retained in the plan for provenance; it is not a freshness
guarantee. Snapshot collection, authorization, completeness, and fresh checks at
execution time remain future integration requirements.

## Resolution rules

- Existing trimmed asset tags block creation across all facilities. Conflict
  messages do not return other-facility IDs or record details. Tags retain case.
- Same manufacturer and serial require review. Same serial under another
  manufacturer receives a warning. Matching ignores case and normalizes whitespace
  for names and serial comparisons; originals are retained. No manufacturer aliases
  or fuzzy matching are introduced.
- Departments resolve only to a unique exact normalized name in the selected
  facility. Missing or ambiguous names require review; none are created.
- Parent tags resolve only to existing unique assets in the selected facility.
  Self-parent relationships block. Parents in the incoming workbook are deferred
  for review, including dependency/cycle planning in a future increment.
- Templates are a shared catalog. The existing pure archive-state policy excludes
  archived templates, including uncertain legacy metadata. Manufacturer plus the
  approved matching label must agree. DI evidence that disagrees, or multiple
  candidates, requires review with the template left unset. DI-only evidence is
  insufficient to silently override manufacturer/model disagreement.
- No matching active template is allowed with a warning and `templateId: null`.
  Template prices never populate verified costs. No placeholder template is created.
- Unmapped statuses require review. Risk and maintenance source strings are not
  converted to operational policies. These decisions remain deferred.

Source validation errors block the batch. Rows are labeled `blocked`, `review`, or
`proposed-create`. Deferred parser warnings for departments/templates are replaced
only after snapshot checks run; cost warnings remain. The proposed object is not
an API creation payload. `readyToImport` is always false: this increment has no
executor, database writes, lookup API, ownership-policy change, or deployment.

## Verification and follow-up

Synthetic tests cover preservation, optional templates, archive compatibility,
facility isolation, global tag conflicts, duplicate serials, ambiguity, contradictory
DI evidence, unresolved parents, missing snapshots, and parser integration.
The parser and planner run without models, services, or database connections.

Next work requires an authorized reference snapshot or a separately approved
read-only retrieval path. Review the resulting proposals before designing an
executor. Any later executor must authenticate facility access, refresh duplicate
and reference checks, reuse operational ownership/template lifecycle validation,
handle global uniqueness races, and explicitly address lifecycle field allowlists
and provenance storage. No live import readiness has been established here.
