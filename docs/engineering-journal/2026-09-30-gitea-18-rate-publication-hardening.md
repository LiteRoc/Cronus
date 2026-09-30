# Internal cost rate publication hardening — Gitea #18

## Scope and frozen baseline

Baseline: `efa7a6189aeed3bbc402746fed7e2fafa501f21e`. Dedicated branch:
`test/gitea-18-rate-publication-hardening`. This software-hardening work preserves
[approved #7 Decisions 1–9](<2026-09-25 - Work Order Cost Model Approved Decisions.md>).
It does not authorize an operational rate, deployment, historical recovery or CRM work.

Pre-change permanent WorkOrder cost tests passed **21/21**. Adding #18 regressions
before changing production code produced **45 passing / 7 failing / 52 total**:
overlapping periods and duplicate current publications could select a rate;
malformed period data could certify invalid authority or fail entry creation.
The same regressions pass after the localized safeguard. These are isolated
synthetic results, not claims about real stored history.

Baseline source hashes and test JSON/logs are preserved outside Git in
`/tmp/cronus-gitea-18-evidence/`. Git's baseline and final patch are the durable
source authority; disposable local evidence is not required to run permanent tests.
Initial root-directory/core and Contract authentication invocations could not locate
a cached Mongo binary and failed closed before test assertions. Core was rerun from
its service directory; Contract was rerun with process-only
`MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1` and
`MONGOMS_VERSION=8.2.1`. Both use existing binaries; no download or runtime
configuration change occurred.

## Publication semantics and governance

One `InternalCostRateSchedule` document belongs to one **Organization**, enforced
by the unique `organizationId` index. Facility selects Organization context and
supplies timezone for an omitted work date; the rate is not Facility-specific.

The current schedule `revision` selects one complete `publishedRevisions` period
set. **Every subsequent publication must supply the full intended active period
set, not an append-only delta.** Prior revisions remain evidence but are not merged
into current lookup. Omit a historical period and future backdated entries in that
period become unknown; existing entry snapshots remain unchanged.

- `effectiveFrom` is **inclusive**.
- `effectiveTo` is **exclusive**.
- `effectiveTo: null` is open-ended.
- Adjacent periods are allowed when the preceding end equals the successor start.
- Publication rejects overlaps and invalid/empty intervals.
- Gaps intentionally return no rate. There is no current, future, latest or constant fallback.

Synthetic boundary example only: H at **40 USD/hour** from `2026-07-01` to exclusive
`2026-10-01`; A at **60 USD/hour** from `2026-10-01` onward. September 30 resolves H;
October 1 resolves A. To supersede A on January 1, publish both A ending exclusively
`2027-01-01` and synthetic B at **90 USD/hour** beginning that day. These numbers
are test examples and confer no rate authority.

`POST /internal-cost-rates/publish` accepts only `expectedRevision`, `periods` and
`reason`. Each period accepts `effectiveFrom`, `effectiveTo`, numeric `rate` and
`evidenceRef`. The authenticated admin's selected existing Facility determines
Organization; client Organization/approval fields are rejected. Admin
`GET /internal-cost-rates` reads that Organization's schedule.

`expectedRevision=0` creates an initial schedule; subsequent publications compare
against the current revision and atomically append history/increment revision.
Competing publications with the same later revision have one winner; the stale
attempt returns conflict. Read/review the existing schedule immediately before any
separately authorized publication. There is no draft/review queue or edit/delete API.

The server's `approvedBy`/`approvedAt` identify the **publishing admin and publication
time**, not necessarily an independent Finance approver or prior approval date.
`evidenceRef` must identify versioned approved evidence; `reason` must preserve the
publication justification. Methodology, historical applicability, source period,
precision, independent approvals and accounting inclusions/exclusions are external
governance inputs. Keep sensitive payroll/source datasets outside rate metadata.

An evidence-backed admin-published zero rate is a known zero; missing authority is
null. Rates are numeric USD/hour; each entry cost is deterministically rounded to
cents by the canonical calculator. This hardening introduces no precision policy.

## WorkOrder boundary

New labor resolves its supplied work date. An omitted date uses today in the
Facility timezone; an unknown date or missing applicable authority remains unknown.
Entry creation captures rate, cost and schedule/revision/evidence provenance.

**Publishing a schedule writes only the schedule; it never implies historical
WorkOrder repair.** Prospective publication, replacement revision and historical
coverage leave existing raw WorkOrder records unchanged, including authoritative
labor, unknown legacy labor, stale aggregates, completed and reopened records.

Once captured, entry economic snapshots are authoritative. Canonical `wo-cost-v1`
reads use those snapshots without querying today's schedule. Completing/reopening
does not resolve labor again. Adding historical coverage does not backfill legacy
entries. Any evidence recovery/correction is separately governed work; aggregate
repair cannot invent historical authority from a current rate.

## Minimal corrupt-history safeguard

`internalCostRates.resolve` retains its rate-or-null return contract. A per-call
optional diagnostics object communicates a non-sensitive unknown reason to new
labor construction; no shared mutable state or source identifiers are leaked.

- Zero matching valid periods: null, normal `no_applicable_rate` entry reason.
- Exactly one matching valid period: existing rate/provenance result.
- Multiple matching periods or duplicate current publication revisions: null,
  `ambiguous_rate_schedule`.
- Missing/malformed current periods, invalid dates/intervals/rates or absent evidence:
  null, `invalid_rate_schedule`.

Malformed current history is not trusted even if one other period could match.
No first/last/latest/highest selection, history repair or automatic repricing occurs.
New labor under unavailable authority has `laborRate=null`, `laborCost=null`, unknown
pricing basis and incomplete canonical internal labor. Valid publication behavior,
named scopes, API shapes and historical snapshots are preserved.

## Permanent coverage and verification

`core-service/src/routers/_tests_/workOrderCosts.test.mjs` retains all 21 original
tests and adds **31** permanent cases: adjacent/open boundaries; complete-set
replacement and correct supersession; later-publication concurrency; raw-record
non-mutation; backdated gaps; snapshot/provenance and no-lookup reads; completion/
reopen; endpoint role/Organization/audit matrix; corrupt periods and duplicate
revisions; and materially missing invalid-publication cases.

Existing overlap and known-zero tests remain intact. New validation cases reject
empty periods, invalid/impossible dates, nonpositive intervals, negative/nonnumeric
rates, missing/blank reason, missing evidence, unexpected fields and invalid
expected revisions without writing a synthetic schedule.

Branch focused verification: **52/52**. Branch core compatibility: **606/606** across
WorkOrder costs (52), operational ownership (214), subresource security (295),
Facility query isolation (29), and Facility compatibility (16). Branch Contract gate:
**60/60** across core authentication (31), Contract authentication (23), canonical
cost adapter (3), and profitability safety (3). Merged-main verification is pending
at this branch checkpoint and will be recorded only after execution.

Tests use fail-closed ephemeral Mongo harnesses, synthetic fixtures, mocked external
providers and `CRON_ENABLED=false`. No configured real Mongo target is used.
Frontend files and contracts are unchanged; frontend verification is not required
for this backend/test/documentation slice. Syntax and `git diff --check` pass;
package/lockfile changes are absent. Existing installed dependencies are reused.

## Operational boundary and remaining work

No real rate publication, business-data mutation, historical repair/backfill,
scheduler/runtime/container/configuration change, deployment or CRM development.
No schema, dependency, index or service-ownership change is introduced.

Deployment is not required or performed for this software-hardening task. The safeguard is not
claimed active in deployed runtime until a separately authorized future rollout.
#17 labor-entry correction semantics remain separate and untouched. #19 operational
publication remains **BLOCKED** on external governance and explicit authorization.
