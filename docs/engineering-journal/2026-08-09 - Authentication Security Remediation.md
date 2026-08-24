# Authentication Security Remediation

Date: 2026-08-09

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

## 1. Initial static security assessment

Source inspection identified suspected problems in public registration, password storage, role naming and defaults, JWT verification, authentication logging, and contract mutation authorization. These were treated as hypotheses until exercised by tests. No operational database inspection was used to establish the findings.

## 2. Isolated security test suite

An authentication/security suite was added to turn the suspected behaviors into executable expectations. It covers core registration and login, core role authorization, JWT validation in both services, sensitive authentication logging, tenant behavior relevant to the exercised contract routes, and contract mutation authorization.

The suite was intentionally written to retain failing expectations for confirmed defects rather than weaken tests to match insecure behavior.

## 3. Disposable verification environment

The suite was executed in an isolated Node 20 Bookworm container. It used MongoMemoryServer only, with a cached MongoDB binary. The harness supplied a deliberately unusable configured database URI, permitted only loopback MongoMemoryServer URIs, and guarded both Mongoose clients against other connection targets.

This environment allowed runtime verification without starting Cronus services, connecting to a configured MongoDB instance, or contacting external services.

## 4. Initial verified baseline

The initial isolated run executed 51 tests:

- 20 passed.
- 31 failed.

This was the pre-remediation baseline.

## 5. Runtime-confirmed findings

The initial suite confirmed the following exercised behaviors:

- An unauthenticated caller could create an administrator through public registration.
- Successful customer registration stored its password in plaintext.
- Registration role validation/defaults disagreed with the `User` model's canonical roles.
- Core authorization treated `tech` and `technician` inconsistently.
- Missing JWT roles defaulted to `admin` in both services.
- Expected JWT issuer and audience claims were not enforced in either service.
- Core login logging exposed the retrieved user's stored password field/hash.
- Contract mutation routes lacked effective role authorization in the tested paths.

These findings are limited to the behaviors and paths exercised by the suite. They do not establish the state of operational data or every deployment component.

## 6. Registration and password remediation

The first approved remediation was deliberately limited to registration and password handling.

The resulting behavior is:

- An omitted public registration role uses the model default, `viewer`.
- `viewer`, `technician`, and `customer` are accepted canonical public registration roles.
- `customer` registration continues to require a syntactically valid `customerId`.
- Public `admin` registration is rejected with HTTP 403.
- The legacy `tech` spelling is rejected with HTTP 400.
- Passwords written through ordinary `User` save operations are bcrypt-hashed with cost factor 10 when new or modified.

JWT claims, broader role normalization, sensitive logging, contract authorization, existing data, and other findings were intentionally left outside this remediation.

## 7. Files changed and why

- `core-service/src/models/User.js`: added password hashing at the Mongoose save boundary and reused the model-level bcrypt dependency for password comparison.
- `core-service/src/routers/authRouter.js`: aligned public registration validation with canonical model roles, removed the invalid `tech` default, and rejected public administrator registration.
- `contract-service/src/security/_tests_/coreAuthentication.security.test.js`: changed the logging-test fixture to pass plaintext through the new persistence-boundary hashing behavior instead of pre-hashing and causing a double hash.

No other source or test files were changed as part of this remediation.

## 8. Post-remediation verification

The same isolated suite executed 51 tests:

- 27 passed.
- 24 failed.
- All 7 registration/password failures from the initial baseline were resolved.

The passing registration coverage verified canonical outcomes, rejection of unauthenticated administrator creation, bcrypt storage with a cost of at least 10, and successful login using the original password. The remaining failures stayed visible and were not modified to conceal unresolved behavior.

## 9. Remaining remediation areas

- Canonical role authorization and missing-role default behavior.
- JWT issuer and audience validation in both services.
- Sensitive authentication logging.
- Effective role authorization for contract mutations.

These areas should be remediated separately with narrow changes and targeted verification so results remain attributable.

## 10. Important uncertainties

- Whether operational databases contain legacy `tech` role values was not investigated.
- Whether operational databases contain passwords created by the former plaintext path was not investigated.
- Registration accepts `customerId`, but the current `User` schema and login token do not establish effective persistence or propagation of that value; tenant consequences require investigation.
- Mongoose save middleware does not cover every update, bulk, import, seed, or direct collection operation. The full set of password-writing paths has not been runtime-verified.
- Expected JWT issuers and audiences and compatibility with all token producers and consumers remain to be confirmed before claim enforcement changes.

No operational database, external service, or scheduled job was used during this work. Git remains the authority for the exact patches and commit chronology.

## 11. Core-service authentication hardening completion

Core-service authentication hardening is complete. The completed behavior is:

- Missing JWT roles no longer default to administrator.
- JWT issuer and audience are enforced.
- Legacy route declarations using `tech` are canonicalized to `technician`.
- Tokens claiming the legacy `tech` role are rejected.
- Sensitive authentication, user, and password-hash logging was removed.
- `/auth/profile` uses the canonical hardened authentication middleware.

This intentionally tightens token compatibility. Existing tokens without valid issuer/audience claims or claiming the legacy `tech` role may require users to authenticate again.

## 12. Completion verification

- Authentication baseline before this remediation: 22/31 passed.
- Authentication suite after remediation: 31/31 passed.
- Full contract-service suite: 7/7 suites and 100/100 tests passed.
- Core-service suite: 1/1 suite and 3/3 tests passed.
- Syntax checks and `git diff --check` passed.

The completion verification ran under system Node 18 and used isolated MongoMemoryServer databases. No real database was modified. Test tooling recommends Node `>=20.19`; previous Cronus verification successfully used Node 22. Node runtime standardization and dependency ownership cleanup remain future environment-maintenance work.

## 13. Deferred work and next product direction

- Wayne Healthcare `WHC-CAM-2024-001` financial normalization remains blocked pending authoritative resolution of its `$0.01` discrepancy.
- Dependency vulnerability remediation remains deferred and must not use `npm audit fix` automatically.
- `Contract.linkedWorkOrders` remains retained for historical compatibility.
- Unmounted Customer/Vendor ownership remains a future cleanup question.

CRM functionality is now the leading candidate for the next major Cronus feature. The next development session should perform a CRM architecture/design assessment before editing code and must not begin implementation as part of that assessment. It should explore how facilities/customers, Contracts, assets, vendors, WorkOrders, lifecycle intelligence, and profitability/value intelligence can support contacts, customer interactions, opportunities, service/CAM opportunities, renewal opportunities and pipeline, follow-up tasks, and strategic account management. The goal is CRM tailored to Clinical Asset Management and Clinical Engineering workflows, not a generic Salesforce clone.
