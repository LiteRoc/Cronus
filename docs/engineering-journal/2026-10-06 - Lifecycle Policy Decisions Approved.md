# Lifecycle Policy Decisions Approved — October 6, 2026

## Status, authority and evidence

**Owner-approved policy for subsequent scoped implementation; not implemented.**
This record captures explicit owner approval after the read-only lifecycle/Contract
decision packet. The approval distinguishes intended semantics from current behavior.

Authoritative source baseline: `5a0d5ec3b4473f1b76f07ea3eadf0f289365ae02`.
Local main and cached Gitea/GitHub main matched before this documentation checkpoint.
The existing main worktree `/tmp/cronus-facility-query-isolation` and deliberate CRM
checkout were clean. All assessment source reads used frozen main, not CRM source.
Authenticated Gitea reads confirmed #17/#18 closed and #19 open with explicit BLOCKED
status. No live application or database verification was performed.

The preceding source assessment confirmed the mechanisms behind prior reproductions:
missing/invalid/future dates become zero; quoted-price fallback supplies depreciation
basis; missing capital sums toward zero; narrow and direct maintenance scopes differ;
live endpoints and stored filters use separate read paths; scheduler references
mongoose without importing it; vendor-link union expands Contract population. These
are source observations, not new runtime tests or proof of deployed behavior.

## Approved policy and rationale

### Service date and expected life

Service age resolves confirmed service/in-service start first, then valid
installation/commissioning date. Acquisition, then purchase date may be used only as
explicitly identified estimated proxies; otherwise age is unknown. Manufacture date
is equipment age, not service age. Missing, invalid and future/not-started dates must
not silently become zero. Nullable values retain explicit status and provenance.
This prevents missing history from being represented as new equipment.

Expected life resolves approved Asset override, organization-approved policy,
specifically adopted applicable benchmark, validated provisional/legacy value, then
unknown. AHA, ECRI and OEM evidence remains reference-only until explicitly adopted;
a reference does not automatically mandate replacement. Numeric zero is invalid
expected life; intentionally disabled age rules require explicit policy state.
No copyrighted benchmark tables or AHA PDF are copied into this record or source.

### Capital boundaries and salvage

Keep four meanings separate:

- Historical acquisition basis: documented historical acquisition amount.
- Estimated depreciated value: lifecycle/planning calculation from appropriate
  acquisition basis and approved, declared assumptions.
- Accounting book value: supported accounting evidence/policy, separate from planning.
- Replacement value: current capital requirement for an appropriate equivalent,
  with provenance.

Replacement/quoted-price benchmarks must not automatically become acquisition basis.
Unknown capital stays null, with no truthiness-to-zero substitution. Replacement
estimates need currency, source/date, estimate scope, confidence and calculation
provenance; final data-field/API design belongs to scoped implementation.

Recorded salvage may be unknown. Policy-permitted zero planning salvage must be
identified as an assumption, not documented known zero. Legacy zero without provenance
must not automatically be promoted to factual evidence. These distinctions prevent
market estimates and defaults from masquerading as historical financial facts.

### Replacement review

Use `recommended`, `not_recommended`, `insufficient_data`, with structured reason/rule
codes and display text. Meaning is recommended for replacement review, not mandatory
replacement. An adopted expected-life threshold may trigger review. Retire the default
low-book-value-versus-maintenance heuristic. No replacement-economic threshold is
invented or approved here; missing evidence must not become an evaluated negative.

### Coverage and populations

Vendor responsibility is contained within resolved Contract coverage; the subset is
non-strict and may equal all Contract Assets. Vendor links never expand membership.
Complementary service scopes may overlap; do not impose one-vendor-per-Asset exclusivity.
Invalid/out-of-coverage additions should be rejected by scoped implementation. Existing
anomalies require audit before correction; no automatic pruning or coverage expansion.
Preserve historical responsibility records when handling coverage removal.

Template current operational fleet is Active + Inactive within the authorized selected
Facility. Pending is a separate commissioning cohort; Retired is historical;
Archived/deleted are excluded from the current fleet. Align operational summaries and
local benchmark predicates. Cross-tenant/global operational aggregation requires
separate authorization/policy, not inference from a global code-path name.

### Accepted engineering consequences

Preserve Work Order Cost Model #7 unchanged: entry snapshots are canonical,
`WorkOrder.costs` is a reproducible/versioned cache, null is unknown, zero is explicitly
known zero, and historical economics never use silent repricing or current-rate/price
fallback. Keep internal labor, travel, parts and vendor direct named scopes distinct.

Capital aggregates expose knownSubtotal, nullable complete total, isComplete,
population/valued/missing counts and missing reasons. Missing hydration must remain
visible; incompatible currencies cannot produce an apparently complete combined total.

Use canonical directMaintenance for complete lifecycle direct-maintenance economics.
Simple trailing observations are labeled **Direct Maintenance Cost — Last 365 Days**,
not projected. Do not silently redefine narrow projectedAnnualMaintenance aliases.
Incomplete scopes show known subtotal and missing economics. Complete-record sample
statistics must not be presented as complete-fleet metrics.

Core owns canonical Asset lifecycle assessments; Template and Contract consume them
rather than resolving capital independently. Contract retains coverage ownership through
explicit per-request service APIs; introduce no new cross-service collection writes.

Asset.metrics is a versioned derived cache/materialization, not source truth. Live
detail calculation is independent of cache freshness and does not require persistence.
Caches disclose lifecycle/economic versions, source/time validity and freshness;
filters disclose stale/missing coverage. Scheduler refresh maintains cache/search
fields, not source facts. Scheduler enablement and real-fleet refresh remain separate.

Lifecycle completion-based maintenance history and Contract profitability/cost-to-serve
may use different windows/populations when clearly disclosed. Do not force numerical
agreement between measures with different scope, attribution or reporting dates.
Prefer additive/versioned APIs, nullable new fields and explicit compatibility aliases;
no destructive rewrite or real-data migration is bundled.

## Explicit unresolved policy

1. Future/backdated Contract amendment effective-date behavior and historical coverage
   evidence design remain unresolved. Current coverage snapshot can be supported first;
   historical/as-of coverage remains blocked on separate effective-date policy and
   evidence design. Do not promise historical reconstruction.
2. Any new maintenance-cost/replacement-economic recommendation threshold requires
   separate explicit policy approval. No new threshold is approved here.

## Implementation trackers and dependencies

Open issues were inspected before mutation. Existing #11 and #8 clearly covered the
aggregation and refresh scopes and were reused, with previous tracker context retained.
Only #20 and #21 were created. No labels were assigned: only P0/P1 existed and no
priority was selected for this policy implementation plan.

| Work | Tracker | Dependencies and acceptance themes |
|---|---|---|
| Canonical Asset assessment and capital provenance | [#20](http://192.168.1.185:3000/LiteRoc/cronus/issues/20) — new | Approved policy; synthetic date/provenance/capital/salvage/tri-state tests; additive API and Asset UI; no real-data migration |
| Contract coverage and vendor responsibility | [#21](http://192.168.1.185:3000/LiteRoc/cronus/issues/21) — new | Current snapshot; containment, per-request existence/Facility validation, complementary overlap, preserved history and surfaced anomalies; historical coverage blocked |
| Template/Contract aggregation alignment | [#11](http://192.168.1.185:3000/LiteRoc/cronus/issues/11) — reused | #20 and #21 coverage contract; completeness, hydration/currency, cohort/window labels, tri-state denominators, UI/types |
| Cache/refresh/filter consistency | [#8](http://192.168.1.185:3000/LiteRoc/cronus/issues/8) — reused | #20/#11 contracts; version/source/time validity, invalidation, freshness coverage, forecast alignment, synthetic scheduler/module hardening |

Recommended order: #20 and #21 can proceed largely in parallel; #11 follows their
contracts; #8 follows canonical assessment and aggregation/filter-population contracts.
#10 retains numeric lifecycle-filter/URL work and coordinates with #8 cache freshness.
#12 retains profitability presentation ownership. Neither is silently folded into a
new duplicate tracker. Earlier #8 preservation of old depreciation/recommendation
semantics is superseded by approved policy, not by an implemented change.

## Verification and stopping boundary

This checkpoint changes three documentation files and four issue trackers only.
Issue readback verified titles, open state, unset labels, dependencies and both
unresolved policy blockers; #17/#18/#19 status readback also passed. Exact staged
documentation diff was displayed and reviewed; git diff --check and staged whitespace
checks passed, with only these three documentation paths changed. Both live remote
main refs still matched the baseline before commit. Documentation commit/push will be
verified against both live remote refs at final handoff. No application tests are
added, changed or run because no executable behavior changes.

No lifecycle code implementation, real Mongo/business-data operation, Asset metric
refresh, repair/migration, scheduler enablement, runtime/container change, deployment
or labor-rate publication occurs. #17/#18 software remains closed and undeployed.
#19 remains unrelated/open/BLOCKED; no rate is approved and no #19 work begins.
CRM remains paused at `807bc38122e771dacccbc23fca4a66363dd58d55`; its worktree is untouched.
Documentation and issue creation do not assign implementation or authorize operational
execution. Stop after documentation commit/push and verification.
