# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Completed baseline: core-service authentication hardening

Core-service authentication hardening is complete. The authentication baseline improved from 22/31 passing tests before remediation to 31/31 afterward.

- Missing roles no longer default to administrator; issuer and audience are enforced.
- Route declarations using legacy `tech` are canonicalized to `technician`, while tokens claiming `tech` are rejected.
- Sensitive authentication/user/password-hash logging was removed, and `/auth/profile` uses the canonical hardened middleware.
- Existing tokens lacking valid issuer/audience claims or claiming `tech` may require reauthentication.
- Verification also passed the full contract-service suite (7/7 suites, 100/100 tests), the core-service suite (1/1 suite, 3/3 tests), syntax checks, and `git diff --check` under system Node 18 using isolated MongoMemoryServer databases. No real database was modified.

## Contract and data compatibility

### Wayne Healthcare financial discrepancy

- `WHC-CAM-2024-001` has candidate baseline `$94,881.90`, ledger result `$383,524.75`, and stored `totalValue` `$383,524.74`.
- No authoritative repository source explains the penny difference.
- Do not repair until external commercial evidence resolves it; do not guess or round it away.

### Historical `linkedWorkOrders`

- `WorkOrder.contractId` is authoritative for active behavior.
- `Contract.linkedWorkOrders` remains because local read-only inspection found 36 references on one historical Contract.
- Removing it requires an explicit compatibility and migration decision.

### Multi-replica lifecycle execution

- Contract lifecycle operations are idempotent and same-process overlap is prevented.
- `noOverlap` is not a distributed lock; multiple replicas could race. Current Compose does not declare replicas.
- Do not add distributed infrastructure without explicit deployment evidence and authorization.

### Unmounted Customer/Vendor modules

- Contract-service Customer/Vendor implementations remain unmounted.
- Core-service appears to own active Vendor/Customer behavior, but external compatibility and historical ownership are not sufficiently proven for deletion.

## Other unresolved security/data risks

### Existing legacy `tech` records

Whether operational data contains legacy `tech` user records, and which callers depend on that value, remains unknown. Any assessment or normalization requires explicit database authorization.

### Possible existing plaintext-password records

The historical registration path could store plaintext passwords. Model middleware protects ordinary future `save` operations, but existing data was not inspected or migrated.

### `customerId` registration and tenant behavior

Registration requires `customerId` for customers, while static inspection previously found no corresponding current `User` schema/token field. Persistence and tenant behavior require a separate tenant-sensitive investigation.

### Password writes bypassing Mongoose save middleware

The hashing invariant applies to ordinary `save`; update, bulk, import, or direct-collection paths may bypass it and require deliberate review.

## Environment and dependency maintenance

- Authentication verification ran under system Node 18; test tooling recommends Node `>=20.19`, and previous Cronus verification succeeded under Node 22. Runtime standardization remains future environment maintenance.
- Dependency vulnerability remediation remains deferred. Do not run `npm audit fix` automatically.
- Node runtime and dependency-directory ownership cleanup remain environment maintenance, separate from product/security commits.

## CRM / Strategic Account Management decisions

The architecture assessment is complete, but its recommendations remain a proposal for human review. Do not begin implementation until the following decisions are made:

- Which roles may view or modify Contacts, Opportunities, Interactions, FollowUps, margins, vendor leakage, internal notes, and account risks?
- Must all CRM reads and mutations require an explicitly selected Facility, including administrators?
- How should Organization-wide access be represented when current JWT and tenant conventions are Facility-oriented?
- Can a Contact belong to several Facilities within one Organization, and what is the Contact deduplication boundary?
- What does Opportunity estimated value mean for recurring CAM/service revenue versus one-time capital or training opportunities?
- Which opportunity stage transitions require audit history or elevated authorization?
- What thresholds define approaching expiration, poor margin, high service cost, rising maintenance cost, and repeated failure?
- What retention and audit requirements apply to commercially sensitive interactions and strategic notes?
- How should won Opportunities hand off to Contract draft creation without bypassing Contract numbering, audit, tenant, financial, or lifecycle rules?

### Proposed direction awaiting acceptance

- CRM lives initially in `core-service`.
- Existing Organization groups Facilities; Facility is the Phase 1 CRM account/workspace; no separate Account model yet.
- New focused entities are Contact, Opportunity, Interaction, and FollowUp.
- Contract-service remains authoritative for Contract financial and lifecycle semantics.
- Strategic-account signals are dynamic read models first, with explicit idempotent conversion to Opportunities.
- Renewal is initially a Contract-expiration signal plus renewal-type Opportunity, not a separate Renewal aggregate.
- Phase 1 is a Facility Strategic Account view and core CRM workflow; integrations, event infrastructure, complex hierarchy, workflow automation, and AI recommendations are deferred.

### Directly relevant repository risks requiring resolution

- Static inspection found core Vendor routes with inconsistent authentication/tenant scoping, while the Vendor schema uses `tenantId` that current JWT context does not establish. Runtime verification is needed before CRM relies on Vendor relationships.
- Organization has a schema and Facility reference but no active management workflow or established authorization policy.
- Generic tenant filters can include global records. Proposed CRM entities require strict Facility filters without global-record behavior.
- Unmounted contract-service Customer/Vendor modules must not be revived without an explicit ownership decision.
- Facility-wide uncovered-equipment, rising-cost, and repeated-failure signals need efficient queries and agreed business definitions before they can be claimed as supported behavior.

See [CRM architecture assessment journal](<../engineering-journal/2026-08-24 - CRM Strategic Account Architecture Assessment.md>) for evidence, domain recommendations, MVP scope, and implementation sequence.
