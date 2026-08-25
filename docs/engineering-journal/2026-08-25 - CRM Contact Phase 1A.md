# CRM Contact Phase 1A

## Status

Complete and verified on `feat/crm-contacts`. Git remains authoritative for the exact patch and containing commit.

## Scope and implementation

Phase 1A adds Contact management to `core-service` through:

- `GET /contacts`
- `GET /contacts/:id`
- `POST /contacts`
- `PATCH /contacts/:id`
- `PATCH /contacts/:id/archive`

Every request requires an explicit, valid `x-facility-id`. Administrators may operate only within an explicitly selected existing Facility. Technicians must be authorized for the selected Facility; customer, viewer, missing, legacy `tech`, and unknown roles have no Contact access. Archive is admin-only.

Contact ownership is derived by the service: the selected Facility becomes the immutable `primaryFacilityId`, its Organization becomes `organizationId`, and it remains present in `facilityIds`. Additional associations must exist, belong to that Organization, and be authorized for technicians when newly associated. Reads are scoped through an associated Facility; updates and archive require primary-Facility context. Out-of-scope records return 404.

Duplicate detection remains advisory and never blocks creation. Email, name, and phone comparisons ignore empty normalized values. Visible matches may return matching Contact information and matched fields. Inaccessible matches in the same Organization return only a generic restricted-match warning; they disclose no identity, Facility, count, or triggering-field information. Other Organizations are excluded from duplicate detection.

Archive is soft and schema invariants prevent contradictory archive status/audit combinations. Phase 1A intentionally provides no hard delete, restore, merge, primary-Facility reassignment, Vendor coupling, Contract coupling, or frontend implementation.

## Test isolation and dependencies

Core-service now owns a fail-closed MongoMemoryServer harness. It disables runtime MongoDB downloads, accepts only loopback URIs issued by its in-memory server, replaces the configured MongoDB URI with a deliberately unusable value, guards Mongoose connection targets, and does not import stateful `app.js` in Contact tests.

Only `supertest` and `mongodb-memory-server` were added as direct development dependencies. Lockfile comparison against `4d4d00ce27f55755930ef5e45701573250f20059` verified that all 719 pre-existing package paths retained their versions, resolved URLs, and integrity values; no existing production dependency resolution drifted.

## Verification

- Contact tests: 56/56 passed.
- Complete safe core-service suite: 59/59 passed.
- Core authentication security: 31/31 passed.
- Lifecycle tests: 3/3 passed.
- JavaScript syntax checks, `npm ls --depth=0`, `git diff --check`, new-file whitespace inspection, and focused tenant/security scans passed.
- Test databases were isolated and loopback-only; no real database was contacted or modified.

System Node 18 continues to emit the known `mongodb-memory-server` engine warning. Tests still pass safely with the cached system MongoDB binary and runtime downloads disabled. Node runtime standardization remains deferred environment maintenance.

## Deferred work

Vendor ownership/scoping, granular CRM permissions, separate Organization-wide grants, Contact merge workflow, formal retention workflow, advanced signals, and automatic Opportunity-to-Contract handoff remain deferred. The Phase 1A Contact implementation does not depend on any of them.
