# CRM Contact Phase 1A

## Status

Backend and frontend vertical slice complete and verified on `feat/crm-contacts`. Git remains authoritative for the exact patches and containing commits.

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

Archive is soft and schema invariants prevent contradictory archive status/audit combinations.

## Frontend implementation

The Contact interface uses existing Cronus routing, sidebar, FacilityContext, UserContext, Axios, Tailwind component, loading/error, modal, and pagination patterns. It provides Facility-scoped list, search, pagination, detail, create, edit, and admin-only archive behavior. Canonical `admin` and `technician` roles receive Contact navigation and route access; customer, viewer, legacy `tech`, missing, and unknown roles do not. Secondary-Facility Contact views are read-only.

Every Contact service call supplies the selected `x-facility-id`, and the shared Axios interceptor preserves an explicit header rather than replacing it with potentially stale local storage. Facility changes synchronously clear list, totals, pagination, detail, duplicate warnings, page/form errors, search, and open forms before the new Facility renders. Separate request generations suppress stale list, detail, save, archive, warning, and error responses, including Facility A to B to A transitions.

The Facility association picker fails closed. A new association is selectable only when both Organization identities are present and equal; existing associations remain visible where Facility metadata is available. Missing Organization metadata does not cause the UI to offer an unverified new association.

Duplicate warnings remain advisory and support visible-match and restricted-only response variants without exposing restricted identity or match metadata. Create/edit validation, authentication, authorization, scoped-not-found, and generic server failures are displayed safely inside the open form.

The full Phase 1A slice intentionally provides no hard delete, restore, merge, primary-Facility reassignment, Organization-wide browsing, Vendor integration, Contract integration, or other CRM entities.

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

Frontend verification:

- Contact frontend/state tests: 31/31 passed.
- Real Contact API header tests: 5/5 passed for list, detail, create, update, and archive through the final Axios adapter path.
- Route/navigation canonical-role tests: 7/7 passed.
- Total Contact frontend tests: 43/43 passed.
- Baseline-compatible TypeScript no-emit, Vite production build, `npm ls --depth=0`, `git diff --check`, new-file whitespace checks, and focused Facility/role leakage review passed.
- Frontend lockfile comparison against `950a6a1befcd2c5bd80187fa5e6e0d28a33b288d` found no existing dependency resolution drift, production dependency changes, or existing development dependency changes. Added development dependencies are limited to the requested frontend test tooling and required transitives.

System Node 18 continues to emit the known `mongodb-memory-server` engine warning. Tests still pass safely with the cached system MongoDB binary and runtime downloads disabled. Node runtime standardization remains deferred environment maintenance.

Existing frontend maintenance remains deferred: TypeScript `ignoreDeprecations: "6.0"`, invalid ESLint `"ignore"` severity, Vite large-bundle warning, and Node engine warning. These were not repaired in the Contact feature slice.

## Deferred work

Vendor ownership/scoping, granular CRM permissions, separate Organization-wide grants, Contact merge workflow, formal retention workflow, advanced signals, and automatic Opportunity-to-Contract handoff remain deferred. The Phase 1A Contact implementation does not depend on any of them.
