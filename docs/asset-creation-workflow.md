# Asset creation: prepared and tested offline, not executed

## Scope

The workflow prepares reviewed proposals for existing `/assets` APIs. It does not
create a new import endpoint, change schemas or creation/edit allowlists, or bypass
authentication, selected-facility checks, department references, template archive
reservation, or asset validation. No live API client, execution CLI, deployment,
database connection, or operational import is added by the preparation command.

From `core-service`:

```sh
node scripts/prepareAssetCreation.cjs /path/to/import-plan.json
node --test src/services/_tests_/assetCreation.test.cjs
```

The input must be a snapshot-backed offline inventory plan with all rows marked
`proposed-create`, resolved department IDs, and no review/error issues or pending
department proposals. Warnings about unverified zero source costs and optional
unmatched templates are allowed. The command prints `{ plan, preview }` containing
customer source data: save only outside Git. It accepts no execution flag, loads
no credentials, and performs no network operations. Exit 0 means preparation
succeeded, not import approval or live readiness; failures exit 2.

## Preservation and field behavior

Each creation request has `attributes.truAssetImport`, using the existing Map of
mixed attributes. That namespace contains all original source cells, including
header, column, value, type, original number format, and original formula metadata;
the original worksheet name/row; the original department name; both original
model fields; the separate matching label; reported purchase cost; an explicitly
null verified-price marker; snapshot provenance; and a deterministic source key.
The source key is for reconciliation, not a database uniqueness guarantee or an
authorization mechanism. No customer values are hardcoded in executable code or
synthetic tests.

The operational `model` remains the source Model. The matching label is used only
for template checks. Model Number, FDA identifiers, risk labels, source maintenance
strings, and other fields without an agreed top-level destination remain preserved
in the source namespace. Text identifiers retain leading zeros and long digits.
Original source department names remain available even though actual department
IDs reference the approved shorter names.

No `purchase`, `purchaseCost`, verified price, purchase date, service-start date,
installation date, or operational risk field is sent. A reported source zero is
stored only as source information. Template prices are not adopted. Both missing
and null purchase prices are treated as blank; a returned price of zero triggers
reconciliation because it is not a blank verified cost.

Template association is explicit or null. An empty maintenance-schedule object is
sent intentionally: the current creation route otherwise inherits a PM interval
from a matched template. No maintenance schedule is inferred from source strings
or template timing in this workflow.

## Three stages per asset

1. `POST /assets`: send only currently permitted creation fields plus the source
   namespace. References and audit attribution remain owned by existing APIs.
2. `PUT /assets/<returned-id>`: set source-reported acquisition date, status, and
   equipment class when present. These fields are edit-allowed but not accepted
   during initial creation. Acquisition date remains distinct from installation
   and confirmed service start. No financial fields are included.
3. `GET /assets/<returned-id>`: verify the persisted identity, facility, department,
   optional template, source cells, blank purchase values, and follow-up fields.
   Populated template references are supported. Stop before the next asset if
   any expected value is missing or changed.

The workflow is sequential and **not atomic**. A successful creation followed by
a failed update leaves a partially completed asset. Each result records its known
asset ID and failure stage. No automatic retry, delete, rollback, reuse, or batch
continuation occurs after an uncertain write or verification failure. A duplicate
advisory from the existing creation API is also a reconciliation stop, even though
that API may already have created the record. Asset tags remain protected by the
existing global unique constraint; this workflow does not replace that constraint.

## Future execution contract

`prepareAssetCreation(importPlan)` returns the portable plan.
`runAssetCreation(plan)` defaults to a preview, even if an adapter is supplied.
Future programmatic execution requires `execute: true`, an exact matching
`confirmFacilityId`, and an explicit authenticated API adapter implementing:

- `getReferenceSnapshot()`: obtain a new complete authorized snapshot for the
  execution preflight, never substitute the stored planning snapshot silently.
- `createAsset(facilityId, body)`: call `POST /assets`, returning its JSON body.
- `updateAsset(facilityId, assetId, body)`: call `PUT /assets/:id`.
- `getAsset(facilityId, assetId)`: call `GET /assets/:id` for read-back verification.

The adapter must use the existing signed-in account and selected facility, reject
unsuccessful HTTP responses, avoid logging credentials/source payloads, and not
retry writes. No real adapter is wired in this increment. A complete reference
snapshot is needed for global duplicate checks; ordinary facility asset listing
is insufficient. The snapshot producer is responsible for actual freshness and
completeness; metadata supplied to a pure planner cannot establish that by itself.

Preflight reruns inventory validation against that supplied snapshot before any
creation requests. Global existing tags, same-manufacturer/serial duplicates,
unresolved departments, or changed department/template matches stop for review.
Serial matches under another manufacturer retain the existing warning policy.
Existing records are never updated as a substitute for creation, and repeating a
completed batch is blocked by its now-existing tags rather than silently replacing
assets. Reconciliation after partial creation requires a separately reviewed plan.

## Focused existing-route changes

The detail response previously spread `asset.toObject()` into its JSON response.
An offline schema test confirmed that Map attributes were then serialized as `{}`.
It now uses `asset.toObject({ flattenMaps: true })` so source provenance is visible
and verifiable. No stored schema or ownership behavior changes.

Creation-path logging of request bodies, attributes, and final payloads was removed
so preserved customer source data is not copied into application logs. No unrelated
logging or router logic was changed. Both changes are local; they require separate
review and deployment before any operational use of this workflow.

## Verification and remaining limits

Synthetic tests use the actual parser/planner, existing field allowlists, actual
Mongoose document schemas without persistence, the existing POST/detail handlers
with all database reads/writes replaced, and injected in-memory API adapters.
They test all source cells, cost blanks, model separation, templates, template
defaults, dates/classification follow-up, read-back serialization, fresh duplicate
and reference rejection, tampered plans, source preservation, and uncertain results.
Direct handler tests substitute read/reference dependencies and bypass middleware;
they do not claim a new authentication or real-database integration verification.
Existing authorization/ownership logic was not expanded or bypassed in production.

No `Asset.create`, `save`, model initialization/index build, application startup,
MongoDB connection, or real API call is executed by these tests. Construction and
schema validation are local operations. Database persistence, operational read-back,
network behavior, concurrent imports, and deployment remain untested. No asset has
been imported by preparing or testing this workflow.

Next: review the actual three-asset preview. Deployment and creation each require
separate approval. Keep execution one asset at a time with read-back verification.
