# Gitea #22 — Bounded Lifecycle Cache Refresh

Baseline main/Gitea/GitHub: `cf0fbfd89f8bf427e1402f38007b6c8a6306be1d`.
Task branch: `fix/gitea-22-bounded-lifecycle-refresh`, isolated worktree
`/tmp/cronus-gitea-22`. The original clean checkout remains on paused CRM at
`807bc38122e771dacccbc23fca4a66363dd58d55`. #8/#11/#20/#21 were verified closed;
#22 open; #23 open with native dependency on #22; #19 open and blocked.
Final commit/main refs, merged verification and closure are recorded in the
[#22 delivery comment](http://192.168.1.185:3000/LiteRoc/cronus/issues/22).

## Confirmed projection defect and correction

Frozen database-free source/VM evidence in `core-service/evidence/gitea-22/`
establishes semantic divergence for identical Asset, Template, Facility, economic
responses, Organization policies, asOf and calculation/policy versions. Refresh
projected `_id benchmark lifecycleDefaults eolYears`, while batch assessment
recognized population only through `manufacturer !== undefined`. Losing recognized
Template evidence also lost Template-ID Organization policy matching.

Observed baseline: live provisional expected life **8 years** and estimated
replacement **5,000**, refresh unknown life and null replacement. An approved
Template-specific Organization policy resolved **6 years** live but was absent on
refresh. Service age remained equal; policy-dependent replacement review differed.
Full before/after assessments preserve states, values, currency, provenance,
quality, depreciation and replacement-review rules, rather than only field counts.

The shared `lifecycleTemplateShape` contract contains every current canonical
Template dependency: `_id`, `manufacturer`, `benchmark`, `lifecycleDefaults`,
`eolYears`. Manufacturer is identity evidence; canonical formulas consume the other
evidence fields and Organization matching uses Template ID. Model/category are not
matching keys in current canonical implementation. Projection and population
recognition now share this explicit contract. Recognition requires a valid Template
ID plus actual projected identity/lifecycle evidence; an ObjectId or ID-only object
is not a populated Template. Partial lifecycle evidence is recognized even without
manufacturer, eliminating that accidental sentinel dependency.

No formulas or #20 policy were changed. The real materializer still uses `assessAssets`
and the pure canonical builder. Permanent tests exercise actual live population and
actual cache dependency projection at identical asOf, including defaults, eolYears,
benchmark, approved Organization policy, full canonical equality, envelope integrity,
fingerprint invalidation and freshness. Future omitted dependencies fail regressions.
Adding manufacturer to source fingerprints makes older incompatible materializations
stale naturally; no cache schema change, migration or real refresh is needed.

## Operator design and safety

A single offline CLI, `core-service/src/scripts/refreshLifecycleCache.js`, follows
the existing offline recovery convention. OS/explicit database access authenticates
the privileged caller; an existing admin actor and currently assigned selected
Facility are required in both modes. The tool deliberately narrows global-admin
reads to that assigned Facility. It imports no application startup, dotenv or cron,
and disables index/collection auto-creation. No public refresh endpoint was added.
The [runbook](<../operations/lifecycle-cache-refresh.md>) documents synthetic commands
and the separate real-data authorization boundary.

Preview is default and performs zero database writes. It reads exact selection and
source fingerprints, including WorkOrder evidence, but does not calculate lifecycle.
Per-member output reports ID/Facility, eligibility, fresh/stale/missing/unsupported
state, expiry reason, would-attempt and skip reason. Cache expiry remains stale with
reason expired; no freshness-policy redesign occurred.

Explicit IDs are strictly validated, lowercased, deduplicated and sorted. Every ID
must exist, belong to Facility, and satisfy unchanged #8 non-archived/non-deleted
eligibility. The entire explicit cohort is preflighted before any write; invalid,
missing, foreign or ineligible selections reject the invocation. IDs cannot widen
to a neighboring Asset and cannot combine with a cursor. Facility-only traversal
requires the same explicit maximum, with ascending ID cursor/resume. Budgets count
considered records, including fresh skips. Maximum is 1–10,000, page size 1–250
(default 100). There is no all-fleet default. The output file is exclusive/new and
private mode 0600. Apply additionally requires the explicit approval environment
gate; that gate does not itself authorize any production invocation.

Apply selects its bounded cohort and passes those exact IDs/Facility to the #8
engine. `materializePage` remains the only writer, setting only `Asset.lifecycleCache`.
Source lifecycle/purchase/service/status facts, metrics, policies, Templates,
WorkOrders, Contracts and links are not edited. Fresh caches skip; missing/stale/
unsupported caches are attempted. The summary reports selected, considered,
refreshed, skippedFresh, failed, conflicted, expired, cursor and per-member outcomes.
Successful consideration reconciles all outcome counts. Failures/conflicts/expiry,
overlap, invalid selection or DB failure return nonzero CLI status. Error messages
do not expose underlying database/credential content.

Preview does not lock/reserve results. Changed dependencies, Facility moves and
CAS failures remain conflicts. Records lost after preflight are selection_changed
failures. Query failure retains completed-page outcomes and reports remaining exact
members failed. Cursors are traversal positions, not retry queues; reconcile and
retry failed IDs explicitly. Same-process overlap protection is unchanged; the
unscoped scheduler engine retains its prior behavior and defaults.

One additional confirmed concurrency gap emerged from the required older-result
regression: a caller that already read a newer cache could request a slightly older
asOf and replace it because CAS only protected edits after its initial read. Frozen
failure shows refreshed instead of conflict. A newer-supported-envelope asOf guard
now refuses that write. Concurrent newer envelopes still use existing CAS and
source rechecks. This tightens ordering without changing formulas/expiry. There is
still no distributed lease or globally atomic cross-document source fence;
read-time fingerprints protect changes after the final recheck.

## Verification and synthetic pilot

Initial #8 cache baseline: **54 tests / 2 suites**, passed. Sandbox denied ephemeral
port binding on the first attempt; rerun outside that execution boundary used only
the inspected fail-closed MongoMemoryServer harness and cached binary. No download
or real database fallback occurred. Final focused cache/operator gate: **92 tests /
2 suites**, including 54 operator/parity tests at that checkpoint. The final broad gate
includes **55 new operator/parity tests**, covering correction of unsupported
future metadata as well as newer-cache protection. Final branch compatibility:
**1,501 core tests / 22 suites**, **205 Contract tests / 13 suites**, all passed.
CRM test suites were deliberately excluded; no CRM implementation was touched.

Core gate covers canonical assessment/batch, cache freshness/filter/forecast,
#11 aggregation, Template/reference lifecycle, WorkOrder economics, ownership,
Facility isolation/compatibility, scheduler registration and native loading.
Contract covers lifecycle job, #21 coverage, overview/profitability, amendments/value,
authentication (including core), vendor history and canonical economics adapters.
External providers are mocked. Cron registration tests capture callbacks without
operational scheduling; no real scheduler was enabled or invoked.

The isolated synthetic pilot selects exactly five IDs in one Facility. Preview
returns five with **zero writes**. Apply considers five: **3 refreshed, 2 skippedFresh,
0 failed, 0 conflicted, 0 expired**. Per-member counts reconcile. A sixth eligible
Asset is unchanged, and Asset source facts, WorkOrders, Templates, Organization
policy and synthetic Contracts remain semantically identical. Proof is frozen in
`five-asset-pilot.json`. No production Assets were read or refreshed.

Original frozen projection probe is rerun after correction and full canonical
objects match for both Template and approved-policy cases. Frozen checksums,
before/after stdout comparison, changed JS/test syntax, `git diff --check`, six
package/lockfile byte comparisons and installed core/Contract dependency checks pass.
Frontend source/types/contracts are unchanged; TypeScript/Vite/frontend regression
were not needed or run. No dependency installation or upgrade occurred. Existing
Node experimental/older-runtime and duplicate schema-index warnings remain.

## Operational boundary and remaining work

No production Mongo connection/write, real preview/apply/cache refresh, production
smoke, container/runtime change, deployment, cron enablement, migration/backfill,
rate publication or external accounting work occurred. No #19 or CRM work occurred.
No #20 policy, #21 Contract semantics, #11 aggregation redesign or replacement
threshold was introduced. Scheduler code/configuration is unchanged; operational
schedulers remain disabled, not re-inspected for this software task.

#22 closure satisfies #23's verified native dependency; #23 remains the separate
deployment and first-cache-validation operational issue requiring explicit later
authorization. Production-scale performance remains unmeasured. Stop after #22
delivery and dependency verification; do not begin #23.
