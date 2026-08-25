# CRM FollowUp Phase 1

## Status

The end-to-end FollowUp vertical slice is complete and verified on `feat/crm-followups`. Git remains authoritative for the exact patch and containing commit.

## Context and decisions

FollowUp is a distinct CRM entity in `core-service`; the existing `Task` model remains maintenance-procedure oriented and is not reused. Each FollowUp belongs to one required Facility. Organization is not an authorization grant, and FollowUp has no Organization-wide or global-record behavior.

The accepted Phase 1 lifecycle is intentionally small:

- `dueAt` and `assignedTo` are required.
- Status is `open`, `completed`, or `cancelled`.
- New FollowUps always start open.
- Only open FollowUps may be ordinarily edited.
- Completed and cancelled are terminal.
- Archive is admin-only and may apply to any lifecycle status.
- There is no reopen, restore, hard delete, recurrence, notification, workflow engine, or automatic reassignment.
- Interaction, Opportunity, Contract, Vendor, and signal references are omitted from this phase.

## Facility and authorization behavior

Every endpoint requires an explicit valid `x-facility-id`, including administrator requests. The shared `requireCrmFacilityContext` middleware validates the selected Facility and technician authority. Every individual-record query includes `_id`, selected `facilityId`, and `archivedAt: null`; out-of-scope and archived records return 404 without disclosing whether another Facility owns them. List queries always include the selected Facility and exclude archived records. FollowUp does not use `buildTenantFilter()`.

Canonical `admin` and `technician` roles may create, read, update open FollowUps, complete, and cancel. Only `admin` may archive. Customer, viewer, legacy `tech`, missing, and unknown roles are denied. Audit actors use `req.user.id`.

Facility ownership is derived from request context. Client-supplied ownership, status, lifecycle, archive, and audit fields cannot replace server values. Request bodies are plain-object validated and mutable fields are allowlisted.

An assignee must exist, have canonical `admin` or `technician` role, and be explicitly authorized for the selected Facility through the existing User Facility fields. Organization membership is not used for assignment authority. Optional Contact linkage requires a non-archived Contact whose `facilityIds` contains the selected Facility; missing and inaccessible Contacts share a non-disclosing validation response.

## Endpoints

- `GET /followups`
- `GET /followups/assignees`
- `GET /followups/:id`
- `POST /followups`
- `PATCH /followups/:id`
- `PATCH /followups/:id/complete`
- `PATCH /followups/:id/cancel`
- `PATCH /followups/:id/archive`

List behavior supports bounded status, assignee, Contact, due-range, overdue, text-search, and pagination filters. Default ordering is `dueAt`, then `_id`.

## Lifecycle integrity

Completion, cancellation, and archive load the scoped Mongoose document, re-check lifecycle state, mutate the lifecycle and audit fields together, and persist through `save()`. Schema document validation rejects contradictory completion, cancellation, and archive states. Optimistic concurrency prevents simultaneous document saves from silently overwriting one another.

FollowUp query-mutation APIs are intentionally blocked because query updates bypass document validation middleware. The model rejects:

- `findOneAndUpdate`
- `findOneAndReplace`
- `updateOne`
- `updateMany`
- `replaceOne`
- `bulkWrite`

This restriction is specific to FollowUp and is not a repository-wide Mongoose policy. Direct-query regression tests verify that attempted contradictory changes fail and leave persisted lifecycle/archive state unchanged.

## Date and overdue semantics

API values for `dueAt`, `dueFrom`, and `dueTo` must be ISO-8601 timestamp strings with either trailing `Z` or an explicit numeric timezone offset. Ambiguous local-time strings and values relying on JavaScript Date coercion are rejected. Valid values are stored as Date instants.

`dueFrom` and `dueTo` are inclusive. `overdue` is derived and never persisted:

```text
overdue = status == open AND dueAt < evaluation time
```

A FollowUp due exactly at the evaluation instant is not overdue. `status=open&overdue=true` composes normally. Terminal status combined with `overdue=true` returns 400 instead of silently replacing the requested status.

Indexes align with the default Facility/due-date list and the status, assignee, and Contact filters. All are non-unique.

## Frontend workflow

The React frontend provides a standalone Facility-scoped Follow Ups page with list, detail, search, bounded filters, pagination, create, and open-only edit behavior. Admins and technicians may complete or cancel open records; only admins see archive controls. Completed and cancelled records are read-only, and no reopen control exists.

The assignee picker uses only the narrow Facility-scoped `GET /followups/assignees` endpoint. The optional Contact picker uses the Facility-scoped Contact API and supports unlinking. Backend authorization and validation remain authoritative.

Due dates are entered and displayed using a valid selected-Facility IANA timezone. Missing or invalid metadata falls back to the browser IANA timezone with an explicit local label; no default timezone is hardcoded. Values serialize as timezone-explicit instants, and ambiguous or nonexistent DST wall times fail safely.

Facility changes synchronously clear lists, counts, detail, search, filters, pagination, forms, picker options, confirmation state, errors, loading/mutation state, and Contact prefill/query state. Facility-generation guards ignore stale successes and failures for list, detail, mutation, picker, and Contact-detail requests. Safe contextual messages handle 400, 401, 403, 404, and generic 500 responses without exposing backend internals.

Contact detail includes a read-only Open FollowUps section using `contactId`, `status=open`, and `limit=5`, plus View All and Create FollowUp navigation. Lifecycle actions remain exclusively on the standalone page.

## Phase 1 exclusions

Phase 1 does not include reopen, restore, hard delete, recurrence, notifications, calendar/email integration, Contract linkage, Vendor linkage, Interaction linkage, Opportunity linkage, signals, or Organization-wide CRM browsing.

## Verification

- FollowUp endpoint suite: 87/87 passed.
- Assignee endpoint additions: 9/9 passed.
- Complete safe core-service suite: 166/166 passed.
- FollowUp frontend page/state: 45/45 passed.
- FollowUp role/navigation: 7/7 passed.
- FollowUp API headers: 8/8 passed.
- Date/time: 5/5 passed.
- Contact-detail integration: 6/6 passed.
- FollowUp-focused frontend total: 71/71 passed.
- Contact regression: 43/43 passed.
- Total scoped frontend: 114/114 passed.
- Baseline-compatible TypeScript no-emit passed.
- Vite production build passed with the existing deferred bundle-size warning.
- Frontend and core-service `npm ls --depth=0` passed.
- JavaScript syntax checks passed.
- `git diff --check` passed.
- New-file whitespace checks passed.
- Facility/role/prohibited-coupling scan passed.
- Dependency and lockfile comparison against `3ea60fad` found no drift.
- Final integrated read-only review passed.

Tests used the fail-closed, loopback-only MongoMemoryServer harness with runtime downloads disabled and did not import stateful `app.js`. No real database, container, scheduled job, or external service was touched.

System Node 18 continues to emit the known MongoMemoryServer engine warning, and the cached system binary emits a version warning. Runtime standardization remains deferred. Existing TypeScript/ESLint maintenance and Vite bundle-size work remain separate.

## Deferred work

Vendor ownership/scoping, granular CRM permissions, Organization-wide grants, Contact merge, retention workflow, advanced signals, and automatic Opportunity-to-Contract handoff remain deferred. Contract linkage awaits a strict Facility-scoped validation boundary. Interaction, Opportunity, signals, recurrence, notifications, email/calendar integration, and generalized workflow automation remain outside this slice.
