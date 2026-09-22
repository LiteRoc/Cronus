# Work Order Cost Model Decision Packet

Status: **proposed, not approved**. Recorded at the investigation-only checkpoint
on 2026-09-22. Human approval of the checkpoint does not approve the economic
model, answer the six questions below, or authorize remediation.

Code baseline: `40fd8de41169cb3b6daa231cd4dff031b3e8e34e`.
This preserves the completed read-only assessment. No production code changes,
new runtime claims, or accepted architectural decisions are introduced here.

The existing architecture supports historical pricing at entry level with
reproducible cached aggregates. It does not establish an authoritative internal
labor rate or define what Part.price economically represents. Those require
business decisions before remediation.

## 1. Current-state architecture

- Work Order labor and part entries contain historical-looking price fields.
  The save hook recomputes entry amounts and aggregate internal labor/parts,
  but does not obtain missing prices. Query mutations bypass that hook.
- Travel contains minutes but no monetary snapshot.
- vendorService contains hours, component costs, shipping and a total; these
  are excluded from WorkOrder.costs.
- Lifecycle consumes persisted aggregates. Contract analytics independently
  values operational entries.

WorkOrder.js calls the labor fields cost snapshots but establishes no rate
provenance, billing-versus-cost semantics, completeness, currency or correction
rules. Source anchors below are relative to the repository root.

## 2. Confirmed defects

Only reproduced defects are classified as implementation defects:

1. Part-add snapshot omission: quantity 2 of a $40 Part persists unit, extended
   and aggregate cost $0.
2. Labor-delete aggregate staleness: deleting the only $75 labor entry leaves
   aggregate labor and total at $75.

Historical part-price preservation and timestamp refresh without rate recovery
are confirmed behavior, not additional monetary defects. Phase 1 and Phase 2
frozen records remain authoritative for their exact test observations.

## 3. Unresolved decisions

### Decision 1 — Authoritative labor rate

Current: no canonical per-technician rate, employee-cost model, facility rate
setting or effective-dated rate history was found in inspected models/services.
User, Facility and Organization contain no rate fields. Contract analytics reads
BLENDED_LABOR_RATE with a code fallback of 135 and BLENDED_TRAVEL_RATE falling
back to labor rate. Environment values were not accessed. These are used as
estimated cost-to-serve; source does not establish wages, burdened internal
cost, billing, or another business convention.

Options and tradeoffs:

- Technician-specific internal rates improve attribution but require governed,
  effective-dated records and restricted access.
- Approved blended internal rates are simpler and less sensitive, but approximate.
- Unknown until priced is honest but produces incomplete totals.
- Billing rates belong to separate revenue analysis, not incurred/internal cost.

Recommendation: do not promote the existing fallback into historical truth.
Define the cost basis and approved source; retain unknown where no authority
exists. Architecture cannot select technician-specific versus blended rates.
**Approval required: yes.**

### Decision 2 — Labor snapshot timing

| Option | Benefit | Consequence |
| --- | --- | --- |
| A: capture on entry creation | Reproducible history | Needs source/effective dates |
| B: current technician rate dynamically | Current-price scenarios are simple | Changes historical economics when rates change |
| C: capture at completion | Closing workflow | Delayed completion/reopening can change pricing; interim data incomplete |
| D: blended rate | Simple planning/standard costing | Still needs timing; dynamic use also rewrites history |

Recommendation: A with an approved rate effective for the work represented.
Contemporaneous entries capture immediately. Backdated/imported work requires a
matching historical source or remains unknown. D may be the approved rate basis
within A; B belongs in separately labelled planning. Completion validates
completeness rather than repricing. Reopening preserves old pricing and prices
new work separately. This supports reproducible Contract/lifecycle history and
prevents later wage changes from altering prior periods.
**Approval required: yes.**

### Decision 3 — Part price authority

Current: Part.price is the only catalog price field found and is mutable through
Part update. A supplier reference is present, but no supplier-specific price
schedules, purchase lots, historical prices or alternative acquisition/sales/list
prices are modeled. Generic naming/UI/API usage does not resolve its meaning.
No Part-price import mapping was found that establishes consistent semantics;
operational datasets were not inspected.

Options: designate price as approved internal unit cost; add a distinct cost
source if price means selling/list/replacement price; allow documented
transaction-specific costs where catalog pricing is inappropriate.

Recommendation: capture the approved unit cost when usage is recorded, preserving
it through later catalog changes and quantity edits. D/G support this architecture.
Overrides may cover documented purchase/invoice cost, historical imports,
consigned/donated stock or corrections. Require authorization, reason, evidence
and audit history, not arbitrary silent request values.
**Approval required: yes, especially the meaning of price.**

### Decision 4 — Zero versus unknown

Current: numeric defaults and Number(value) || 0 conflate absent prices with
genuine zero. Waived charges, vendor coverage and unavailable history have no
structured distinction.

| Option | Tradeoff |
| --- | --- |
| A: zero is zero and unknown | Compatibility, but permanent ambiguity |
| B: null means unknown | Clear semantics, but arithmetic/clients must change |
| C: numeric values with metadata | Easier transition, but clients may ignore metadata |

Recommendation: B plus C: nullable unknown entry amounts, explicit pricing
status/provenance and aggregate completeness. Keep completeness separate from
valuation basis: a complete blended estimate is not necessarily actual incurred
cost. Distinguish documented/actual, standard/blended and estimated pricing.
Expose known subtotal and missing components without calling it a complete total.
No applicable events may legitimately total zero; an unpriced event cannot.
Waived customer charges do not erase internal costs; coverage needs payer
attribution. **Approval required: yes.**

### Decision 5 — Meaning of calculatedAt

Current: a save-hook calculation timestamp, even for unrelated saves; not proof
of completeness. A (last calculation) matches current behavior. B (fully priced)
conflates execution/completeness and becomes misleading with new unknown entries.
C (economic change) is useful but different. D (separate fields) is clearest but
requires schema/API transition.

Recommendation: D: recalculatedAt, completeness/missing components and an economic
revision/change timestamp. If pricedAt exists, tie it to the current revision
being fully priced and invalidate it when that ceases to hold. Temporarily retain
calculatedAt as a documented compatibility alias for recalculation time only.
**Approval required: yes.**

### Decision 6 — Components and totals

| Component | Current representation |
| --- | --- |
| Internal labor | Minutes, rate and computed cost |
| Internal travel | Minutes only |
| Internal parts | Quantity, unit and extended cost |
| Vendor labor/travel | Hours and explicit amounts |
| Vendor parts/shipping | Explicit amounts |
| Vendor total | Separately supplied totalCost |
| Test equipment | Usage/reference only; no WO charge |
| Other direct WO costs | No additional structured field found |

A preserves today's labor-plus-parts scope. B adds travel. C broadens direct cost
but can mix perspectives/double count. D preserves components and named totals.

Recommendation: D, separating internal operational, vendor direct and combined
direct maintenance costs. Count vendor invoice totals/breakdowns once; do not
also turn vendor hours into internal labor via a blended rate. Coverage, billing,
vendor contract payouts and direct service costs are distinct concepts. Do not
automatically absorb annual vendor allocations or imply full lifecycle ownership
cost. Lifecycle/benchmarking select consistent maintenance scope; profitability
separates revenue/payouts; vendor analysis retains internal effort. Do not silently
redefine costs.total during rollout. **Approval required: yes**, including cost
perspective, travel valuation and vendor-total authority.

### Decision 7 — Historical corrections

Current: entries can be edited/removed and save recalculates from stored rates;
there is no economic revision trail preserving previous amounts/justification.
Options include current-price backfill, controlled migration, audited correction,
no rewriting, and evidence-only partial backfill.

Recommendation: never automatically substitute current prices for historical
ones. Permit audited, evidence-backed corrections and separately approved
migrations, preserving old/new values, actor, reason, source and effective/recorded
dates. Aggregate repair from trustworthy entries differs from inventing prices.
Do not price 2024 work using 2026 rates merely because those are available.
**Approval required: yes.**

### Decision 8 — Imported historical Work Orders

Source inspection only; no imports executed:

| Writer group | Behavior | Classification |
| --- | --- | --- |
| Historical text import | Labor minutes without rates; create computes default zero | Unknown without historical pricing evidence |
| DSD import | Operational fields, no structured economics; save | Compatible persistence mechanism; economics unknown |
| Core CT vendor import | Source-item vendor parts/total; save | Potentially recoverable vendor costs; verify source completeness |
| Other inventoried vendor imports | Vendor hours with explicit zero amounts; save | Unknown without source evidence; zero does not prove free service |
| Legacy workOrders loader | Direct insertMany, no model hooks/validation | Structurally unsafe for canonical snapshots; distinct collection name |
| Contract-side duplicate import | Missing WorkOrder model | Broken source candidate, not established runtime writer |
| Contract-link backfill | Changes contractId only | Does not price or repair snapshots |

Recommendation: classify each component by evidence, not script name or numeric
zero. Irrecoverability cannot be established without determining availability
of authoritative sources. Future imports should share interactive pricing and
provenance rules. **Approval required: yes for policy; no for source observations.**
See gitea-7-phase2/README.md for every identified writer and operation.

### Decision 9 — Downstream source of truth

| Consumer | Current source | Implication |
| --- | --- | --- |
| Asset lifecycle | Persisted costs; missing becomes zero | Staleness/unknowns affect maintenance totals |
| Template benchmarks | Persisted total; missing becomes zero | Incomplete pricing can depress statistics |
| Replacement/forecast | Lifecycle totals; recent maintenance projected annually | Costs influence replacement recommendations |
| Contract overview | Hours × current blended rates; extendedPrice; varying vendor logic | May differ from snapshots and other Contract views |
| Profitability/vendor-link analytics | extendedCost fallback to extendedPrice; internal/vendor hours × blended rates; vendor parts/shipping | Ignores historical labor rates; differs from invoice-total interpretation |
| WO editing UI | Operational time/quantity; inspected types omit costs | No completeness-aware historical display found |

These source differences are not additional runtime-reproduced defects.
Model A (aggregate canonical) weakens traceability. Model B (raw derivation) is
historical only if entries retain historical pricing; current-catalog lookups
are not historical accounting. Model C combines historical entries with cached
reproducible aggregates.

Recommendation: C. Consumers share definitions and use versioned aggregates or
equivalent derivation from the same entries. Reporting period/scope differences
may legitimately differ but must be explicit. **Approval required: yes.**

## 4. Proposed canonical economic model

```text
Authorized operational mutation
  -> Historical entry + pricing source/status + effective date
  -> Versioned, reproducible WorkOrder aggregate
  -> Lifecycle/Contract consumers select explicit cost scope
```

Immutable means no silent repricing, not uncorrectable mistakes. Preserve original
pricing evidence; quantity changes, deletions and corrections create auditable
revisions/reversals. Authorized quantity corrections may change derived amounts
without changing captured unit price. This model is not approved.

## 5. Conceptual data-model/API implications

- Approved rate source with effective dates/access controls.
- Entry identity, occurrence/capture dates, pricing basis/source, unknown status
  and correction history.
- Travel pricing if included; vendor invoice/breakdown reconciliation.
- Named totals, known subtotal, completeness, aggregate revision/calculation version.
- Currency and rounding rules; existing code rounds lines/aggregates to two decimals.
- Server-controlled capture, separately authorized override/correction APIs.
- Completeness-aware frontend types and downstream response contracts.

These are implications, not implementation commitments.

## 6. Migration implications

Preserve legacy values/provenance. Do not classify all existing zeros as genuine
zero or indiscriminately replace them with null; mark ambiguous entries unverified
until evidence resolves them. Recompute from justified entries. Recover missing
prices only from authoritative historical sources, otherwise retain unknown.
Stage/version rollout because current consumers coerce missing values to zero.
Real-data migration needs separate approval, preview, recovery planning and
mixed-version compatibility checks.

## 7. Remediation boundary

After policy approval and implementation authorization, #7 can address capture,
synchronized aggregates, unknown pricing, audit semantics and targeted regressions.
Later reconciliation aligns Contract formulas, lifecycle/benchmarks, completeness
UI, imports and legacy data. Policy approval alone does not authorize real-data
repair, job execution or silently expanding costs.total. No remediation is begun.

## Source anchors

- core-service/src/models/WorkOrder.js:8,182; User.js:6; Facility.js:5;
  Organization.js:5; Part.js:4; Supplier.js:3.
- core-service/src/routers/partRouter.js:59.
- core-service/src/services/lifecycleMaintenance.js:43;
  templateLifecycleBenchmarks.js:61; core-service/src/utils/lifecycle.js:60.
- contract-service/src/services/contractOverviewService.js:96,275,350,574;
  contract-service/src/controllers/contractController.js:934.
- frontend/src/types/WorkOrder.ts; frontend/src/pages/EditWorkOrder/components/PartsUsedSection.tsx.
- Frozen Phase 1/2 evidence and Phase 2 direct-writer inventory.

## 8. Questions requiring explicit human decision

1. Should internal labor use approved technician-specific rates, blended rates,
   or remain unknown pending a rate source? Are these burdened internal costs,
   separate from billing?
2. Approve capture at entry creation using the rate applicable to the work date,
   with no repricing on completion/reopening and unknown pricing when historical
   authority is unavailable?
3. Does Part.price represent the approved internal unit cost? Approve capture-on-use,
   historical preservation and evidence-backed authorized overrides?
4. Approve nullable unknown prices plus completeness/provenance metadata and
   separate recalculation versus fully-priced semantics?
5. Approve separate internal/vendor/combined totals? Specify the cost-bearing
   perspective, travel basis and whether documented invoice total controls over
   its breakdown.
6. Approve Model C, audited revisions/corrections and evidence-only historical
   recovery, with no automatic backfill from current prices?
