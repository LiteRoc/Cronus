# Work Order Cost Model Approved Decisions

Status: **APPROVED — authoritative policy record**.

Recorded 2026-09-25 from the user's explicit approved Decisions 1–9 and rate-schedule scope correction. These decisions governed the approved Gitea #7 implementation merged at `168af0134155060cfeb9bfcbffa202562d876eb1`.

This record supersedes the proposed/unapproved policy status of the frozen investigation decision packet. It does not rewrite that historical evidence or authorize deployment, real-data access, repair, rate publication, historical recovery, or CRM development.

## Decision 1 — Labor rate basis — APPROVED

Work Order labor uses an approved **organization/network-wide blended internal cost rate**.

It is distinct from:

- billing rates
- vendor rates
- technician wages/payroll
- customer charge rates

No technician-specific costing in #7.

No silent fallback to the historical `135` code value.

## Decision 2 — Labor snapshot timing — APPROVED

Snapshot the approved blended internal cost rate when the labor entry is created, using the rate applicable to the work date.

- later rate changes do not reprice existing labor
- completion/reopening do not silently reprice existing labor
- new labor uses the then-applicable approved rate
- backdated/imported labor uses authoritative historical rate only when available
- missing historical authority remains unknown

## Decision 3 — Part cost authority — APPROVED

`Part.price` is the default prospective internal unit-cost source for new Work Order Part usage.

At usage:

`unitCost = Part.price`

`extendedCost = quantity × unitCost`

- preserve historical snapshots
- later catalog changes do not reprice history
- future overrides require controlled evidence-backed audited handling
- current Part.price is never unsupported historical evidence

## Decision 4 — Zero versus unknown — APPROVED

- `null` = unknown / not authoritatively priced
- numeric `0` = explicitly known zero organizational cost
- blended/estimated values remain numeric with explicit valuation basis
- actual/documented values retain provenance
- partial economics expose known subtotal
- complete total remains null until required components for the scope are known
- vendor coverage, warranty, or waived billing do not automatically mean zero internal cost

## Decision 5 — Timestamp semantics — APPROVED

`costs.calculatedAt` means only:

> Last time the stored aggregate was recomputed from recorded economic inputs.

It does not prove complete or authoritative pricing.

Economic revision, completeness, and provenance remain separate concepts.

## Decision 6 — Work Order cost scopes — APPROVED

Use separate named economic scopes:

`internal labor + internal travel + internal parts = internal cost`

`authoritative attributable vendor expense = vendor-direct cost`

`internal cost + vendor-direct cost = direct-maintenance cost`

Each scope carries:

- known subtotal
- nullable complete total
- completeness
- applicable provenance/valuation basis

Keep outside Work Order direct cost:

- revenue
- annual vendor payouts
- depreciation
- capital cost
- test-equipment allocations

Travel remains unpriced until separately approved.

Vendor totals/components must be reconciled without double counting.

## Decision 7 — Historical repair/backfill — APPROVED

Allowed:

- recompute stale aggregates from trustworthy historical snapshots
- recover missing historical values only from authoritative historical evidence
- correct proven errors only through audited correction

Forbidden:

- current Part prices as historical backfill
- current labor rates as historical backfill
- fallback constants as historical truth
- unsupported estimates as historical snapshots

Unsupported historical economics remain unknown.

## Decision 8 — Import policy — APPROVED

All future Work Order imports must use canonical snapshot, provenance, completeness, and aggregation rules.

- preserve authoritative historical values where available
- unsupported economics remain unknown
- source zero is not known organizational zero without evidence
- importers do not directly author canonical aggregate `costs.*`
- preserve source identity, work/effective dates, provenance, and evidence classification
- unreviewed legacy importers remain blocked from reuse

## Decision 9 — Downstream source of truth — APPROVED

Historical entry-level economic snapshots are the canonical economic record.

`WorkOrder.costs` is a versioned reproducible cache derived from those snapshots.

- canonical cost responsibility belongs in core-service
- downstream consumers use approved named scopes
- consumers do not independently reprice historical Work Orders
- cache validity requires supported calculation version, matching economic/input revision, and valid completeness metadata
- a current cache does not imply fully priced
- stale/mismatched caches must not silently appear as complete current economics

## Approved rate-schedule scope correction

The blended labor-rate schedule is:

> **organization/network-wide by default**

Not facility-scoped.

Requirements:

- effective-dated
- versioned
- auditable/governed
- no silent fallback
- gaps resolve to unknown
- no facility-specific overrides in initial #7

Facility timezone may determine work-date boundaries only.

## Implementation conformance review

Read-only comparison against `168af0134155060cfeb9bfcbffa202562d876eb1` found no material contradiction with Decisions 1–9 or the scope correction. This is a source-and-existing-regression review, not verification of deployment or real historical data.

| Policy | Implementation evidence (paths relative to repository root) |
| --- | --- |
| 1–2; rate-schedule correction | `core-service/src/models/InternalCostRateSchedule.js`, `src/services/internalCostRates.js`, `src/routers/internalCostRateRouter.js`, and `src/services/workOrderCosts/mutate.js`: Organization-keyed, versioned publications with approval metadata; effective work-date resolution; gaps return unknown; entry-time rate/provenance capture. Facility supplies Organization context and timezone, not a rate override. |
| 3–4 | `core-service/src/services/workOrderCosts/mutate.js` and `calculate.js`: prospective catalog capture, preserved usage snapshots, nullable unknowns, evidence requirements for zero, valuation bases, known subtotals and nullable complete totals. Catalog zero remains unverified unless evidence establishes known organizational zero; this applies Decision 4 to Decision 3. |
| 5 | `core-service/src/services/workOrderCosts/mutate.js`, `calculate.js`, and `repair.js`: stored recalculation timestamp is separate from economic revision and completeness. Non-economic edits preserve economics; read-derived stale results are explicitly marked and do not write the cache. |
| 6 | `core-service/src/services/workOrderCosts/calculate.js`: separate internal, vendor-direct and direct-maintenance scopes; unpriced travel; vendor invoice/component reconciliation without double counting. Revenue and annual vendor payouts remain separate in Contract profitability. Narrow compatibility aliases do not redefine the named scopes. |
| 7 | `core-service/src/services/workOrderCosts/repair.js` and `src/scripts/repairWorkOrderCostAggregates.js`: preview-first aggregate repair, explicit apply approval, scoped reviewed plans, concurrency checks and audit history; ambiguous legacy economics are not automatically repaired or repriced. General historical evidence recovery/correction is separately governed work, not automatic backfill. |
| 8 | `core-service/src/services/workOrderCosts/import.js` and `src/models/WorkOrder.js`: protected aggregate fields, source identity/provenance, historical-rate resolution, evidence-qualified historical amounts/zero, completeness declarations and duplicate protection. Inventoried legacy economic importer entry points are blocked; the legacy direct loader is disabled. |
| 9 | `core-service/src/services/workOrderCosts/calculate.js`, `src/services/lifecycleMaintenance.js`, `src/services/templateLifecycleBenchmarks.js`, and `contract-service/src/services/workOrderCostAdapter.js`: canonical core calculation, validated version/revision/fingerprint/completeness, explicit cache state, and downstream canonical scope consumption without historical repricing. |

Permanent coverage includes `core-service/src/routers/_tests_/workOrderCosts.test.mjs` (21 tests), Contract canonical-adapter and profitability-safety tests, and existing ownership, facility, authentication and frontend compatibility suites.

Previously completed fresh merged-main verification: core **940/940**, Contract **113/113**, frontend **154/154**; TypeScript app check with the documented `--ignoreDeprecations 5.0` override, independent Vite build, changed JavaScript syntax, whitespace and dependency inventory passed. No dependency/lockfile drift was reported. These are prior verified results, not a new regression run for this documentation record.

## Evidence checkpoints and closure boundary

- Merged implementation: `168af0134155060cfeb9bfcbffa202562d876eb1`.
- Frozen reproduction: `cae8e991137fdbf5ebfe52658512b03a4085aa17`; preserved unchanged as historical evidence, including its then-unapproved proposal.
- Interaction compatibility: `807bc38122e771dacccbc23fca4a66363dd58d55`; tested, separate, paused and intentionally unmerged into main.

With the approved policy now explicit, the comparison identifies no software closure blocker. Recommendation: **CLOSE #7 as a completed software-remediation issue**, subject to the separately authorized issue action. This document does not close the issue.

Deployment, governed labor-rate publication, real-data previews, eligible aggregate repair and historical reconciliation remain separate operational/migration work. Travel policy, broader profitability attribution, importer rewrites and CRM remain separate future work. No real database migration, deployment, runtime/Docker operation, operational scheduled-job execution, rate publication or historical recovery is established or authorized by this record.
