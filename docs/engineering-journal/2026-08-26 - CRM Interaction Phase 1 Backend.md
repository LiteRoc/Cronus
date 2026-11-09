# CRM Interaction Phase 1 Backend

## Status

The Interaction Phase 1 backend, the third CRM vertical slice after Contact and FollowUp, is complete and verified on `feat/crm-interactions`. The frontend remains outstanding. Git is authoritative for the exact patch and containing commit.

## Context and accepted decisions

Interaction is a distinct internal CRM entity in `core-service`. It records chronological meetings, calls, emails, site visits, and notes without embedding activity arrays in Facility, Contact, FollowUp, Contract, or future Opportunity records.

The accepted Phase 1 contract is:

- Types are `meeting`, `call`, `email`, `site_visit`, and `note`.
- Directions are `inbound`, `outbound`, and `internal`; direction is required.
- `summary` is required and `body` is optional.
- Visibility is `operational` or `restricted`; omitted visibility defaults to the least-privileged operational value.
- Zero or multiple Contacts may be linked through `contactIds[]`.
- Interactions may be edited; formal revision history is deferred.
- Archive is admin-only.
- There is no hard delete, restore, retention automation, or external synchronization.
- Contract, Vendor, Asset, FollowUp, Opportunity, and signal references are omitted.

## Facility and authorization behavior

Every endpoint requires authentication, canonical `admin` or `technician` authorization, and explicit valid `x-facility-id` through the shared `requireCrmFacilityContext` middleware. Administrator operations cannot be unscoped. Interaction never uses `buildTenantFilter()` and has no global-record behavior.

Every detail, update, and archive lookup includes the Interaction ID, selected `facilityId`, and `archivedAt: null`. Out-of-Facility and archived records return 404.

Admins may create, list, search, read, and edit operational and restricted Interactions. Technicians may perform those operations only for operational Interactions in an authorized selected Facility. Customer, viewer, legacy `tech`, missing, and unknown roles are denied.

Restricted visibility is enforced in persistence queries before list pagination and counting. For technicians:

- Restricted records do not appear in lists or searches.
- Restricted records do not affect counts, totals, or pagination boundaries.
- Restricted detail and update lookups return 404.
- `visibility=restricted` returns a safe empty result.
- Restricted summaries, bodies, identifiers, and existence are not disclosed.
- Creating restricted records or changing operational visibility to restricted is forbidden.

Admins may change operational to restricted or restricted to operational.

## Contact relationships

`contactIds[]` accepts an empty array and supports multiple Contacts. Repeated IDs are deduplicated.

Every linked Contact must:

- Have a valid ObjectId.
- Exist.
- Be active and non-archived.
- Include the selected Facility in `facilityIds`.

A Contact whose primary Facility differs remains valid when the selected Facility is an existing association. Missing, archived, inactive, and inaccessible Contacts receive a common non-disclosing error that does not reveal identity, Facility, or lifecycle state. PATCH replaces the complete Contact set and may clear it.

## Timestamp semantics

`occurredAt`, `occurredFrom`, and `occurredTo` require ISO-8601 timestamp strings with trailing `Z` or an explicit numeric offset. Date-only, timezone-free, non-string, and invalid calendar, time, or offset values are rejected. Valid timestamps are stored as UTC Date instants; numeric-offset normalization is verified.

An Interaction may be at most five minutes ahead of server time. This tolerance accommodates ordinary clock skew. Anything materially later is rejected because scheduled activity belongs in FollowUp. List date bounds are inclusive.

## Editing, audit, and archive integrity

Request bodies use strict mutable-field allowlists. Client-supplied Facility, creator, updater, archive, and timestamp fields cannot control persisted ownership or audit values.

Creation derives `facilityId`, `createdBy`, and `updatedBy` from the selected Facility and authenticated actor. Editing preserves `createdBy` and `createdAt`, records the canonical actor in `updatedBy`, and lets Mongoose update `updatedAt`.

Updates and archive load the scoped document and persist through validated `save()`. The schema uses optimistic concurrency and requires `archivedAt` and `archivedBy` together. Query-mutation APIs that could bypass document validation are blocked:

- `findOneAndUpdate`
- `findOneAndReplace`
- `updateOne`
- `updateMany`
- `replaceOne`
- `bulkWrite`

Archive is exposed only through an admin-authorized endpoint. Archived records disappear from ordinary lists and details. No delete or restore endpoint exists.

## Endpoints and list behavior

- `GET /interactions`
- `GET /interactions/:id`
- `POST /interactions`
- `PATCH /interactions/:id`
- `PATCH /interactions/:id/archive`

Lists default to `occurredAt DESC`, then `_id DESC`. Supported filters are type, direction, visibility, Contact, inclusive occurred-at range, bounded literal text search over summary/body, and bounded page/limit.

Indexes align with:

- Facility, archive state, and reverse chronological ordering.
- Facility, archive state, visibility, and ordering.
- Facility, archive state, Contact, and ordering.

All indexes are non-unique.

## Verification

- Interaction service and endpoint suites: 54/54 passed.
- Complete safe core-service suite: 220/220 passed.
- Core authentication security suite: 31/31 passed.
- Contract lifecycle regression suite: 11/11 passed.
- JavaScript syntax checks passed.
- `npm ls --depth=0` passed.
- `git diff --check` passed.
- New-file whitespace checks passed.
- Facility/visibility/security scan passed.
- Prohibited-coupling scan passed.
- Final integrated read-only review passed.

Tests used the fail-closed loopback-only MongoMemoryServer harness with runtime downloads disabled and did not import stateful `app.js`. No real database, Docker container, scheduled job, or external application service was touched.

System Node continues to emit the known MongoMemoryServer engine warning. Jest also emits the existing experimental VM-module and specifier-resolution warnings. Runtime standardization remains deferred.

## Deferred work

- Interaction frontend workflow.
- Formal Interaction revision history.
- Interaction retention policy and workflow.
- Opportunity linkage and its strict Facility validation.
- Contract linkage through an authenticated strict cross-service validation boundary.
- Vendor linkage until Vendor ownership and Facility scoping are resolved.
- Asset and FollowUp linkage.
- Advanced CRM signals.
- Organization-wide CRM permissions.
- Attachments, delivery state, email/calendar synchronization, external CRM integration, and generalized automation.
