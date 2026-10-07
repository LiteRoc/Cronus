# #22 synthetic evidence

Baseline: `cf0fbfd89f8bf427e1402f38007b6c8a6306be1d`.
`baseline-batch.cjs` and `baseline-cache.cjs` are exact frozen baseline sources,
never application imports. `reproduction.cjs` runs the real batch orchestration
in a VM with synthetic Facility, Organization and economic responses, without a
database. Canonical formulas remain unchanged. For fixed mode it reads the current
shared Template contract and batch source.

From repository root:

```bash
node core-service/evidence/gitea-22/reproduction.cjs
node core-service/evidence/gitea-22/reproduction.cjs --fixed
```

`before.json` preserves full assessments: refresh loses eight-year provisional
Template life and the 5,000 replacement estimate while live resolves them; approved
six-year Organization policy is also lost by the refresh shape. Service age is
unchanged. `after.json` proves full object equality, including provenance, quality,
capital currency/state and policy-dependent replacement review. Both probes assert
the expected mismatch/parity, not just presence of a field.

`older-asOf-before.txt` freezes the failed new concurrency regression before adding
the newer-envelope guard: older evaluation returned refreshed rather than conflict.
The permanent suite verifies refusal after the fix.

`five-asset-pilot.json` comes from the permanent isolated operator test: exact
synthetic IDs in one Facility, zero preview writes, three refreshes, two fresh skips,
all five considered, no sixth/source changes. WorkOrders, Templates, Organizations
and synthetic Contracts are semantically fingerprinted before/after. No customer
or production records are present.

`verification.json` records the final branch gates. SHA256SUMS freezes artifacts.
Permanent tests are in `src/services/_tests_/lifecycleCacheOperator.test.mjs` and
existing #8/cache suites. They use the fail-closed MongoMemoryServer harness with
downloads disabled and the existing cached binary. No configured real URI can be
used. Offline CLI connection boundaries are mocked in its orchestration test;
connection/preflight data still comes solely from issued isolated persistence.

This evidence grants no real-data preview/apply or deployment permission. #23 is
the separate operational issue. No scheduler or real cache was invoked.
