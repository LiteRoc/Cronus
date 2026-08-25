# CRM FollowUp Phase 1 Backend

## Status

Backend complete and verified on `feat/crm-followups`. Git remains authoritative for the exact patch and containing commit. Frontend work is not part of this slice.

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

## Verification

- FollowUp service tests: 20/20 passed.
- FollowUp endpoint tests: 78/78 passed.
- Total FollowUp tests: 98/98 passed.
- Complete safe core-service suite: 157/157 passed.
- Core authentication security: 31/31 passed.
- Lifecycle regression: 11/11 passed.
- JavaScript syntax checks passed.
- `npm ls --depth=0` passed.
- `git diff --check` passed.
- New-file whitespace checks passed.
- Focused Facility/tenant/security scan passed.
- Final read-only diff review passed.

Tests used the existing fail-closed, loopback-only MongoMemoryServer harness with runtime downloads disabled and did not import stateful `app.js`. No real database, container, scheduled job, or external service was touched.

System Node 18 continues to emit the known MongoMemoryServer engine warning. Runtime standardization remains deferred environment maintenance.

## Deferred work

FollowUp frontend work remains unimplemented. Contract linkage remains deferred until contract-service provides a strict Facility-scoped validation boundary. Vendor ownership/scoping, Interaction, Opportunity, signals, recurrence, notifications, email/calendar integration, and generalized workflow automation remain outside this slice.
