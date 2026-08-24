# CRM / Strategic Account Management Architecture Assessment

Date: 2026-08-24
Status: Proposal for human review; not an accepted architectural decision

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

## 1. Purpose and scope

Cronus is considering a CRM and Strategic Account Management capability specialized for Clinical Engineering and Clinical Asset Management. The assessment evaluated how CRM could build on Facilities, Organizations, Contracts, Assets, Vendors, WorkOrders, lifecycle/replacement intelligence, and Contract profitability/value without becoming a generic Salesforce clone.

This was a read-only static architecture assessment. It did not modify or execute application code, schemas, databases, containers, dependencies, scheduled jobs, or external services. No runtime behavior was verified during the assessment.

## 2. Current architecture established by source inspection

- `core-service` owns the active Facility, Organization, Department, User, Asset, WorkOrder, lifecycle, replacement-forecasting, and operational Vendor implementations.
- `contract-service` owns Contracts, amendments, Contract lifecycle, point-in-time value, profitability, vendor payouts/leakage, and Contract lifecycle intelligence.
- The active contract-service application mounts only Contract routes. Its Customer and Vendor implementations remain unmounted.
- The frontend has separate authenticated clients for core-service and contract-service and forwards selected Facility context to both.
- No Facility/customer strategic-account detail page currently composes the full account view.
- Existing `Task` records define reusable maintenance-procedure checks; they are not CRM follow-up tasks.
- Organization already groups Facilities, but no active Organization management workflow or Organization-level authorization policy was found.

These statements describe current source structure. Runtime topology and behavior may differ where not previously verified.

## 3. Proposed service and account ownership

The preferred proposal is to place CRM initially in `core-service`.

Rationale:

- Contacts, interactions, opportunities, and follow-ups are Facility/account concerns broader than Contract lifecycle.
- Core-service already owns Facilities, Organizations, Users, Assets, WorkOrders, and operational Vendors.
- Contract-service should remain specialized and authoritative for Contract semantics.
- A new CRM microservice would add deployment, authentication, service-call, and consistency complexity before the CRM domain is stable.

Use the existing `Organization` as the health-system grouping and `Facility` as the required operational CRM account/workspace. Do not add a separate Account entity in Phase 1. Continue to use Department beneath Facility. More complex Organization hierarchies should be introduced only when verified requirements justify them.

## 4. Proposed new domain concepts

### Contact

Purpose: represent customer stakeholders independently of authenticated Users and Contracts.

Proposed relationships and boundaries:

- Owned by core-service.
- Required Organization derived or validated through related Facilities.
- One or more Facility relationships within the same Organization.
- Queried through an explicitly authorized Facility.
- Independent of Contract; Opportunities and Interactions reference Contacts.
- Must not contain authentication credentials or copied Contract/asset intelligence.

Likely indexes include Facility/status/name and Organization/normalized-email lookups. Email uniqueness requires a product decision.

### Opportunity

Purpose: represent a strategic or commercial pursuit such as CAM agreement, service expansion, equipment/service, capital replacement, training, vendor transition, or renewal.

Proposed characteristics:

- Required Facility and derived/validated Organization.
- Type, controlled stage, owner, title, estimated value, probability, expected close date, next step, outcome/loss reason, and audit fields.
- Optional references to Contract, Vendor, Contacts, Assets, AssetTemplate, and source signal.
- Stable source identity for idempotent signal conversion.
- Estimated value is a CRM forecast and must not replace authoritative Contract value or realized revenue.
- Closed-won must not bypass Contract draft creation, numbering, audit, tenant, financial, or lifecycle rules.

### Interaction

Purpose: provide one chronological activity stream for meetings, calls, emails, notes, and site visits.

Proposed characteristics:

- Required Facility, type, occurred-at time, summary/body, direction, participants, actor, and audit timestamps.
- Optional references to Contacts, Opportunity, Contract, and Assets.
- Stored independently rather than embedded as arrays in Facility, Contact, Contract, or Opportunity.
- Indexed for Facility, Opportunity, Contact, and Contract timelines.

### FollowUp

Purpose: provide lightweight CRM action tracking.

Proposed characteristics:

- Required Facility, subject, due date, status, priority, assigned User, audit fields, and optional references to Contact, Opportunity, Interaction, or Contract.
- Separate from the existing maintenance `Task` model.
- Recurrence, workflow dependencies, notification rules, and complex automation deferred.

All proposed CRM entities require strict Facility scoping. They should not reuse generic tenant behavior that includes global records.

## 5. Contract renewal proposal

Do not add a specialized Renewal aggregate in Phase 1.

Proposed flow:

1. Calculate a dynamic Contract-expiration/renewal signal from authoritative Contract data.
2. Allow a user to explicitly convert it into an Opportunity with type `renewal`.
3. Store stable provenance such as Contract identity and normalized end date.
4. Enforce a partial unique key over Facility and signal source so repeated evaluation cannot create duplicate Opportunities.

A policy is still needed for Contracts whose end date changes after an Opportunity is created.

## 6. Intelligence and signal proposal

CRM should consume existing authoritative calculations rather than duplicate them.

Immediately supportable dynamic signals include:

- Contract approaching expiration.
- Poor Contract margin.
- Vendor leakage.
- Amendment activity.
- Vendor-link expiration.
- Asset replacement recommendation.
- Replacement capital forecast.
- High projected annual maintenance.
- WorkOrder volume and open/closed trends.
- PM compliance and overdue PMs.
- High service cost among covered assets.

Facility-wide uncovered equipment, rising maintenance cost, repeated failures, and aging concentrations require additional query design and agreed business definitions.

Signals should begin as explainable dynamic read models with stable keys, source identity, observation time, metrics, explanation, and suggested action. They should not automatically become Opportunities. Persistence should wait until acknowledgment, dismissal, snoozing, assignment, or durable history is required.

No event bus or general automation platform is proposed for Phase 1.

## 7. Phase 1 proposal

Build now after architecture acceptance:

- Facility Strategic Account page.
- Read-only Organization identity as the Facility parent.
- Contact management.
- Opportunity pipeline.
- Interaction timeline.
- FollowUps.
- Account composition using existing Contracts, value/profitability, Assets, replacement forecast, recent WorkOrders, Opportunities, Interactions, and FollowUps.
- A small set of dynamic Contract, margin, leakage, replacement, and vendor-expiration signals.
- Explicit idempotent signal-to-Opportunity conversion.
- Tenant-boundary, authorization, and cross-reference tests before user-interface implementation.

## 8. Phase 2 candidates

- Organization-wide portfolio views across authorized Facilities.
- Persisted signal state.
- Account plans and formal risks.
- Stakeholder influence/decision-role metadata.
- Opportunity stage history and forecast reporting.
- Renewal pipeline dashboards.
- Bulk uncovered-equipment analysis.
- Trend-based maintenance and repeated-failure signals.
- Controlled won-Opportunity handoff into Contract draft creation.
- Configurable signal thresholds and intentionally designed reminders.

## 9. Explicitly deferred

- Dedicated CRM microservice.
- Separate Account entity or arbitrary Organization hierarchy.
- Specialized Renewal aggregate.
- Automatic Opportunity creation from every signal.
- Email and calendar synchronization.
- External CRM integrations.
- Distributed event infrastructure.
- General workflow/rules engine.
- AI-generated account recommendations.
- Marketing automation, lead scoring, and generic custom objects.
- CRM-owned copies of Contract value, profitability, lifecycle, or operational data.

## 10. Decisions required before implementation

Human review must decide:

- CRM roles and commercial-data visibility.
- Whether all CRM operations, including administrators, require selected Facility context.
- Organization-wide authorization semantics.
- Multi-Facility Contact and deduplication rules.
- Opportunity value semantics across recurring and one-time pursuits.
- Stage-transition authorization and audit requirements.
- Signal thresholds and explanations.
- Retention/audit treatment for interactions and strategic notes.
- Won-Opportunity handoff behavior.
- Vendor identity and ownership behavior.

## 11. Directly relevant repository risks

- Static inspection found inconsistent authentication and tenant scoping in active core Vendor routes, while the Vendor schema uses `tenantId` that current JWT context does not establish. Runtime verification is required before CRM depends on Vendor relationships.
- Organization has no active management workflow or established authorization policy.
- Generic tenant filters can include global records and are unsuitable for CRM records without a strict Facility-specific policy.
- Unmounted contract-service Customer/Vendor modules remain an ownership ambiguity and must not be revived implicitly.
- Bidirectional service calls already exist; future CRM aggregation must use per-request clients with forwarded authentication and Facility context, never shared mutable request headers.
- Contract financial and lifecycle semantics must remain in contract-service.
- `Contract.linkedWorkOrders` remains historical compatibility state and must not become a CRM integration source.

## 12. Recommended implementation sequence

1. Accept or revise authorization, visibility, strict Facility context, and Organization access rules.
2. Resolve or isolate Vendor ownership and tenant behavior.
3. Accept conceptual contracts and invariants for Contact, Opportunity, Interaction, and FollowUp.
4. Define Opportunity economics, stages, signal thresholds, and stable source keys.
5. Add tenant/authorization tests.
6. Implement Contact and FollowUp foundations.
7. Implement Opportunity and Interaction with cross-reference validation.
8. Build a core-only Facility Strategic Account read model.
9. Add authenticated per-request Contract-service composition.
10. Add dynamic signals and explicit idempotent conversion.
11. Build the frontend Strategic Account experience.
12. Consider Organization portfolio and automation only after Facility-level behavior is verified.

## 13. Preferred architecture for review

Build a Facility-centric CRM module in core-service with Contact, Opportunity, Interaction, and FollowUp entities. Use existing Organization as the health-system grouping and Facility as the required account context. Keep contract-service authoritative for Contracts and all Contract financial/lifecycle semantics. Compose account views through explicit service APIs. Generate explainable signals dynamically and require deliberate, idempotent conversion to Opportunities. Defer additional services, hierarchies, integrations, event infrastructure, and generalized automation.

This preferred architecture remains a proposal until explicitly accepted.
