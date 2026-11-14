# Department creation: prepared, not executed

The workflow prepares facility-scoped creation requests from the offline inventory
plan's explicit pending department proposals. It preserves source names and rows
for provenance. No customer-specific department names or facility IDs are embedded
in executable source or synthetic tests.

## Offline preparation

From `core-service`:

```sh
node scripts/prepareDepartmentCreation.cjs /path/to/import-plan.json
```

The command prints a creation plan plus a request preview. It has no live API
adapter, reads no credentials, connects to no database, and accepts no execution
flag. The preview contains the selected facility header and each requested name;
it does not contain a token. Handle it as customer data outside Git.

## Prepared application behavior

The existing department router only had listing support. This change adds
`POST /departments` locally, with the existing authentication middleware and an
admin-only role gate. No deployment has occurred. The live application will not
have this route until a separately approved deployment.

The route requires `x-facility-id`, uses the existing `selectedFacility` existence
check and body-facility agreement policy, and strictly permits only `name` and an
optional matching `facilityId` in the body. Missing, invalid, non-existent, and
conflicting facility context is rejected. Names must be nonempty literal strings,
at most 120 trimmed characters, without control characters. Other fields and
client-supplied IDs are rejected.

Existing names are compared within that facility only, ignoring case and repeated
whitespace. A unique match returns HTTP 200 with `{ created: false, department }`.
A new department returns HTTP 201 with `{ created: true, department }`. Responses
contain only `_id`, `facilityId`, and `name`. Ambiguous matches return 409 without
creating anything. Existing GET behavior is retained. No schema, indexes, asset
creation allowlists, or operational ownership rules were changed.

## Workflow orchestration

`prepareDepartmentCreation(importPlan)` creates the portable plan.
`runDepartmentCreation(plan)` defaults to a preview and does not touch even a
supplied adapter. Programmatic execution requires all of the following:

- `execute: true`;
- `confirmFacilityId` exactly matching the plan;
- An explicit authenticated API adapter implementing `listDepartments(facilityId)`
  and `createDepartment(facilityId, { name })` using the routes above.

No real HTTP adapter or apply command is wired in this increment. The injected
API adapter in tests calls only an ephemeral local Express test app backed by
synthetic in-memory records. Do not create departments by direct database scripts.

Execution first lists departments and checks every requested name before any
creation. Ambiguous or foreign-facility results stop without writes. A unique
existing name is reused. Missing names are requested sequentially; only actual
returned department IDs are recorded. The workflow never fabricates IDs, changes
source names, imports assets, or silently assigns departments to asset records.

On any failed or unexpected creation response, the workflow stops. The affected
name becomes `reconciliation-required`, later names become `not-attempted`, and
earlier successes remain recorded. No retry or automatic delete/rollback occurs:
a response can be lost after a successful write. A fresh authorized list must
reconcile the actual state before continuing. Repeated sequential runs reuse
names already present.

## Concurrency and live-use requirements

The existing Department `{ facilityId, name }` index is **not unique**. A lookup
followed by creation does not prevent simultaneous writers or multiple replicas
from creating duplicate normalized names. No concurrency-safe idempotency is
claimed. Live use requires either a controlled single-operator creation window
without other department creators or a separately designed uniqueness/locking
mechanism. No index migration is authorized or performed here.

Before execution: review these changes, separately approve any deployment and
operational API calls, confirm the facility, and refresh department checks. After
creation: review the returned IDs and refresh the reference snapshot, then rerun
the inventory plan. No operational asset is ready merely because this workflow
has been prepared.

## Verification

```sh
node --test src/services/_tests_/departmentCreation.test.cjs
```

Tests exercise actual JWT middleware, actual selected-facility ownership code,
and the department router with only database models replaced by synthetic memory
adapters. They cover role denial, invalid and conflicting facility IDs, strict
body validation, reuse, ambiguous matches, safe errors, complete three-department
orchestration, repeated runs, uncertain outcomes, and offline CLI safeguards.
Test HTTP listeners are temporary loopback-only listeners, not Cronus services.
No MongoDB instance, application server, real credentials, or external API is used.
Actual database persistence and deployed behavior remain untested.
