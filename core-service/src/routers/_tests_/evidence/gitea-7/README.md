# Gitea #7: frozen A/B reproduction evidence

Verified 2026-09-22 against main `40fd8de41169cb3b6daa231cd4dff031b3e8e34e`,
in branch `repro/gitea-7-cost-snapshots`. No production source changes.

## Method and result

The opt-in `workOrderCostSnapshots.reproduction.mjs` mounts the actual Work Order
router at `/workorders`, uses actual JWT/role/facility middleware and actual
Mongoose models, and inspects raw stored documents through the collection API.
It does not load app.js, dotenv, scheduled jobs, or external service clients.
Only the Date clock is faked; database and HTTP scheduling remain real.
Parent fixtures are created through model save with zero snapshots, synthetic
references, fixed IDs and dates. Server-generated time-log IDs are deliberately
not mocked; their exact values are preserved per run.

The established MongoMemoryServer harness supplies the sole database target,
disables runtime binary downloads, guards mongoose.connect, and drops/stops its
temporary database on teardown. A control verifies rejection of configured and
non-issued database URIs. No real database was used.

Final verification: **3/3 tests passed, 1 suite passed**, Node v18.19.1,
cached MongoDB 8.2.1. Existing Node support/experimental-module and duplicate
schema-index warnings were emitted; no changes were made for these warnings.
The first development run failed before either HTTP mutation because the test
fixture parsed a hexadecimal ID suffix as decimal. Correcting only that fixture
yielded 3/3 passing observations. Root A/B JSON files preserve that first passing
run; `final/` preserves the final passing run after explicitly fixing requestDate
in the fixture (the schema had captured the real Date.now before fake clocks).

## Observations and classification

Both Work Orders initially contain empty labor/parts arrays, costs labor/parts/
total all 0, and calculatedAt `2026-01-01T00:00:00.000Z`. Mutation clock:
`2026-01-02T00:00:00.000Z`.

- **A, HTTP 200:** new time log has timeSpent 60, laborRate 0, laborCost 0.
  Aggregate labor/parts/total remain 0; calculatedAt remains January 1 even
  though the log and Work Order updatedAt are January 2. Confirmed current
  behavior: the query mutation does not refresh the snapshot timestamp. No
  nonzero monetary inconsistency is demonstrated: 60/60 * 0 is still 0. The
  route takes no rate in this request and supplies none itself. Rate sourcing
  and whether every mutation must refresh calculatedAt remain policy questions.
- **B, HTTP 201:** Part `000000000000000000000004` has price 40; added quantity
  is 2, but stored unitCost and extendedCost are both 0. Costs parts and total
  remain 0; calculatedAt advances to January 2. Confirmed price-snapshot
  omission / defect relative to the supplied $80 economic reference. The save
  hook computes consistently from zero unitCost; this is not a skipped-save
  aggregate calculation. The Part itself is unchanged. Selecting the approved
  historical price source and capture/override rules still requires policy.

**#7 is credibly reproduced in this bounded scope.** These observations do not
prove every mutation is affected, that labor addition loses a nonzero cost,
or that downstream lifecycle and Contract results actually diverge. No desired
future cost model is asserted by these frozen tests.

## Re-run

From core-service, with the existing dependency link available:

```sh
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.workorder-cost-snapshots-reproduction.config.cjs --runInBand
```

To capture another run, set GITEA7_EVIDENCE_DIR to a new directory. Evidence
writes use exclusive creation and will refuse to overwrite existing snapshots.
The local node_modules link reuses the original checkout's installed dependencies;
no dependencies were installed or changed. Do not include that link in a commit.

## Next reproduction cases (not executed in this pass)

1. Delete a labor log from a model-saved nonzero snapshot and compare remaining
   logs, aggregates and calculatedAt. This can establish monetary staleness
   without choosing a new labor-rate policy.
2. Update quantity and remove parts with existing nonzero historical unitCost;
   change catalog price separately to observe historical-price preservation.
3. Trace later save-triggering mutations after a stale query mutation to detect
   delayed recalculation; inventory other creation/update/import/bulk paths
   before exercising them with isolated fixtures and no jobs or real imports.
4. After cost-policy agreement, compare the same synthetic Work Order through
   lifecycle and Contract consumers; characterize travel/vendor inclusion
   without redesigning either consumer or their filters.

No fix is proposed or implemented here. Labor-rate source, part-price capture,
historical correction semantics, calculatedAt meaning, and travel/vendor scope
remain explicit decisions before remediation. No #9, CRM, or profitability
redesign work was performed. No commits, pushes, merges, real database access,
Docker/runtime infrastructure changes, or external mutations occurred. Only the
authorized worktree/branch and temporary test processes were created.
