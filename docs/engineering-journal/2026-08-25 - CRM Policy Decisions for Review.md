# CRM Phase 1 Policy Decisions

Date: 2026-08-25

Status: Accepted Phase 1 architecture and policy

Implementation status: Not started; this decision record does not authorize application implementation

## Purpose and Phase 1 boundary

This document records the accepted CRM / Strategic Account Management Phase 1 architecture and policies. It supersedes the proposal status of the recommendations previously recorded here while preserving the architecture assessment as the evidence and rationale behind the decision.

Phase 1 CRM belongs in `core-service`. Facility is the required operational account context, and Organization is the parent grouping of Facilities. Contact, Opportunity, Interaction, and FollowUp are distinct CRM entities. `contract-service` remains authoritative for Contracts, amendments, Contract value, profitability, vendor leakage, and Contract lifecycle. CRM may reference or display those results through authenticated, per-request service APIs, but must not recalculate or persist competing financial or lifecycle truth.

Phase 1 implementation will begin with Contact in `core-service`. Vendor ownership and tenant behavior remain an unresolved technical prerequisite for Vendor-dependent CRM behavior, but do not block Contact implementation.

## 1. Authorization

Phase 1 uses the existing canonical roles. Backend authorization is authoritative; frontend visibility is not authorization.

| Role | Phase 1 CRM access |
| --- | --- |
| `admin` | Full CRM access and full commercial-intelligence access, constrained to explicit authorized Facility context |
| `technician` | Contact, Interaction, and FollowUp access; no margin, leakage, Opportunity economics, restricted strategic notes, or other commercial intelligence |
| `customer` | No internal CRM access |
| `viewer` | No CRM access initially |

A granular CRM capability or role system is deferred until actual usage demonstrates that the canonical roles are insufficient.

## 2. Facility scoping

- Every CRM record and every CRM read or mutation requires explicit Facility context, including administrator operations.
- Scope is derived from authenticated request context; a body or query `facilityId` never grants access.
- Missing, conflicting, or unauthorized Facility context is rejected rather than defaulted.
- CRM has no global-record behavior. Generic tenant filters that include global records must not be used for CRM.
- Cross-references must be validated against the selected Facility and, where applicable, its Organization.

## 3. Organization access

- Organization is a grouping concept, not an authorization grant.
- Organization-wide views may aggregate only Facilities already authorized to the user.
- Aggregated results preserve Facility identity and scoping.
- Organization membership alone never grants access to all child Facilities.
- Separate Organization-wide authorization grants are deferred.

## 4. Contact rules

- Contact has one `primaryFacilityId` and a `facilityIds[]` association set that includes the primary Facility.
- Every associated Facility must belong to the same Organization.
- A user authorized to any associated Facility may view the Contact through that explicit Facility context.
- Phase 1 Contact creation and editing require authorization to `primaryFacilityId`.
- Normalized email, name, and phone produce duplicate warnings only. Email is not unique.
- Contacts are never merged automatically.
- A Contact merge workflow is deferred. Until it exists, duplicates remain separate records.
- Normalization used for comparison must preserve user-entered display values.

## 5. Opportunity value semantics

- `estimatedValue` is CRM forecast data, not authoritative Contract value, realized revenue, or profitability.
- Store currency and one of these value bases: `one_time`, `annual_recurring`, or `total_contract`.
- Probability is separate from value and may be explicitly overridden.
- Weighted pipeline is derived from estimated value and probability; it is not stored as authoritative revenue.
- Once a Contract is linked, authoritative value, profitability, and lifecycle information continue to come from `contract-service` without rewriting the historical Opportunity estimate.

## 6. Opportunity stage semantics

The accepted stages and default probabilities are:

| Stage | Default probability |
| --- | ---: |
| Identified | 10% |
| Qualification | 20% |
| Evaluation | 40% |
| Proposal | 60% |
| Negotiation | 80% |
| Closed Won | 100% |
| Closed Lost | 0% |

- An authorized user may explicitly override the default probability.
- Every stage change records actor, timestamp, previous stage, and new stage.
- Closed Lost requires a loss reason.
- No additional approval beyond ordinary Opportunity authorization is required to close an Opportunity in Phase 1.
- Closed Won records commercial outcome only; it does not create, mutate, or activate a Contract.

## 7. Interactions and notes

- CRM Interactions are internal records.
- Interaction and note visibility is either operational or restricted.
- Restricted strategic notes are visible only to `admin`.
- Records retain creator, updater, creation timestamp, and update timestamp.
- A formal retention policy and retention workflow are deferred.

## 8. Signals

Signals are dynamic and explainable. They never create Opportunities automatically.

| Signal | Accepted Phase 1 rule | Authority/source |
| --- | --- | --- |
| Contract renewal | 180 days before expiration | Contract lifecycle data from `contract-service` |
| Vendor-link expiration | 180 days before expiration | Authoritative Contract/vendor-link data |
| Replacement | Reuse the existing lifecycle engine result | Existing core-service lifecycle result |
| Poor margin | YTD margin below 15%, only where meaningful YTD revenue and cost data exists | Profitability from `contract-service` |
| Vendor leakage | Greater than $1,000 YTD and greater than 5% of YTD revenue | Contract intelligence from `contract-service` |

Each signal exposes its observation time, evaluated period, threshold or source rule, measured value, source identity, and explanation. Percentile/high-service-cost and trend signals are deferred until production history supports meaningful thresholds.

Explicit Signal-to-Opportunity conversion requires an authorized actor, the selected Facility, source type, source service, source entity identity, and a stable source key. Conversion is idempotent: repeated conversion of the same stable source key within the Facility returns or links to the existing Opportunity rather than creating a duplicate.

## 9. Opportunity-to-Contract behavior

- Automatic Opportunity-to-Contract draft handoff is deferred from Phase 1.
- Closed Won does not create, mutate, or activate a Contract.
- A Contract created through the existing authorized Contract workflow may later be linked to the Opportunity.
- Linking does not transfer CRM estimates, probability, or CRM-calculated values into authoritative Contract financial fields.
- Opportunity history remains independent and is not rewritten by later Contract changes.

## 10. Vendor prerequisite

Vendor ownership and tenant behavior remain unresolved. Static inspection found inconsistent authentication and Facility/tenant scoping in active core-service Vendor routes, a Vendor `tenantId` not established by current JWT context, and unmounted contract-service Vendor code.

Phase 1 CRM functionality must avoid depending on Vendor references until ownership and scoping are explicitly resolved and runtime verified. This prerequisite does not block Contact implementation. No unmounted Vendor implementation may be revived and no new cross-service Vendor writes may be introduced implicitly.

## Deferred decisions and capabilities

- Granular CRM capabilities or roles beyond the canonical Phase 1 roles.
- Separate Organization-wide authorization grants.
- Contact merge workflow.
- Formal Interaction and strategic-note retention policy and workflow.
- Percentile/high-service-cost and trend signals.
- Automatic Opportunity-to-Contract draft handoff.
- Vendor-dependent CRM behavior until Vendor ownership and scoping are resolved.

Related evidence: [CRM / Strategic Account Management Architecture Assessment](<2026-08-24 - CRM Strategic Account Architecture Assessment.md>) and [Open Threads](<../ai-memory/Open Threads.md>).
