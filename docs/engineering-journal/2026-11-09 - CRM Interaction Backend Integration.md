# CRM Interaction Backend Integration

**Date:** November 9, 2026
**Status:** Verified; Git merge pending completion
**Integration branch:** `feat/crm-interactions-integration`
**Source branch:** `feat/crm-interactions`
**Source commit:** `807bc38122e771dacccbc23fca4a66363dd58d55`

## Purpose

Integrate the previously completed CRM Interaction Phase 1 backend
with the newer Cronus main branch without changing established
lifecycle, contract, financial, or security behavior.

The original CRM branch remains preserved.

## Functional scope

The integration adds Interaction functionality to core-service:

- Interaction model
- Interaction service
- Interaction router
- Application route registration
- Interaction endpoint and service tests

Interaction supports Facility-scoped meeting, call, email,
site-visit, and note records.

Accepted authorization, restricted visibility, Contact validation,
audit, optimistic concurrency, and archive behavior remain governed
by the original Interaction Phase 1 backend journal.

This integration does not implement the Interaction frontend,
Opportunity, external CRM integrations, or additional relationships.

## Integration compatibility corrections

Three additional test-only corrections were required.

### 1. Template lifecycle test harness

Added `interactionJsonErrorHandler` to the synthetic router mock
used when evaluating the merged application startup.

No lifecycle production behavior was changed.

### 2. Reference lifecycle test harness

Added the same Interaction error-handler export to the synthetic
router mock.

No reference lifecycle production behavior was changed.

### 3. Vendor Coverage JWT assertion

The Vendor Coverage test independently generated JWTs for the
request and expected forwarded headers.

Because JWT `iat` and `exp` claims depend on the issuance second,
the two tokens could differ despite correct forwarding.

The test now retains the original request headers and compares
forwarded headers against those exact values.

No production authentication or Contract behavior was changed.

## Verification evidence

### Core-service

- 32/32 suites passed.
- 1,762/1,762 tests passed.
- Includes 54 Interaction tests.
- The two lifecycle harness corrections passed their targeted
  258-test verification before the full regression.

### Contract-service

- 13/13 suites passed.
- 205/205 tests passed.
- Vendor Coverage targeted regression: 62/62 passed.
- Financial, lifecycle, security, coverage, and amendment tests passed.

### Frontend

- 31/31 test files passed.
- 313/313 tests passed.
- TypeScript compilation and Vite production build passed with
  a temporary TypeScript compatibility adjustment.
- The original configuration was restored.
- No tracked frontend source or configuration changes remain.

### Combined regression

**2,280/2,280 tests passed across 76 suites/test files.**

Production JavaScript syntax checks passed for the inspected Core
and Contract files.

Staged and unstaged Git whitespace checks passed.

No unresolved Git merge conflicts remain.

## Test isolation

The regression used isolated MongoMemoryServer persistence.

Configured operational MongoDB access was replaced by a deliberately
invalid URI. The test harnesses enforced loopback-only connections.

Runtime MongoDB binary downloading was disabled. Tests used the
cached MongoDB 8.0.28 binary.

No operational database access, data migration, cache refresh,
deployment, or scheduled-job execution was performed by this work.

## Deferred technical observations

### TypeScript configuration

The existing frontend configuration specifies:

`ignoreDeprecations: "6.0"`

The installed TypeScript compiler is 5.6.3 and rejects this value.

The integration and main versions of the configuration and package
files were confirmed identical.

A temporary change to `"5.0"` allowed the production build to pass.
The original file was restored.

The standard build remains blocked until the inherited mismatch
is separately addressed.

### Node.js compatibility

Verification ran under Node 18.19.1.

MongoMemoryServer 11 and selected frontend dependencies report
Node >=20.19 compatibility requirements.

Dependency/runtime standardization remains deferred.

### Mongoose index warning

A duplicate `workOrderId` schema index warning remains.

No index or production schema changes were made to address it.

### Frontend bundle size

Vite reported a chunk-size warning. Bundle optimization remains
separate maintenance work.

## Operational and Git boundaries

At this checkpoint:

- The CRM merge is still uncommitted.
- No merge into main has occurred.
- No remote push has occurred.
- No deployment has been performed.
- No operational database modifications have been performed.
- No scheduled jobs or runtime infrastructure were changed.

Existing deployed-runtime documentation remains historical evidence;
this integration did not independently verify the current deployed
runtime revision.

## Next steps

1. Review documentation and final Git diff.
2. Stage the three test-only compatibility corrections.
3. Commit the integration merge with explicit authorization.
4. Separately determine main-branch integration and remote publication.
5. Preserve deployment as an independent approval boundary.
6. Begin Interaction frontend development under a new scoped task.
7. Follow with the Opportunity vertical slice.

## References

- `docs/engineering-journal/2026-08-26 - CRM Interaction Phase 1 Backend.md`
- `docs/ai-memory/Current Context.md`
- `docs/ai-memory/Open Threads.md`
- `AGENTS.md`
