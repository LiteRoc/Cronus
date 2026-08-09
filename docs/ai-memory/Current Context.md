# Current Context

> Memory tells us where we are. Engineering history tells us how we got here. Git tells us exactly what changed.

Cronus is an asset and maintenance operations platform focused on healthcare and biomedical equipment management. It covers equipment inventory, maintenance, work orders, technician workflows, reporting, lifecycle analysis, multi-facility operations, and service-contract management.

## Major components

- `frontend/`: React and TypeScript single-page application built with Vite.
- `core-service/`: Node.js/Express and Mongoose service for assets, work orders, users, facilities, operational maintenance data, reporting, dashboards, and lifecycle calculations.
- `contract-service/`: Node.js/Express and Mongoose service for contracts, amendments, contract lifecycle, value, and profitability calculations.
- MongoDB: persistence used by both backend services. Static inspection suggests shared identifiers and database coupling; the deployed topology has not been verified.

## Current engineering priority

The current priority is staged authentication and authorization hardening. An isolated authentication/security suite provides executable evidence before each narrowly scoped remediation.

The first remediation, secure registration and password handling, is complete and verified. Public administrator registration is rejected, public registration uses canonical model roles, and password hashing is enforced for ordinary Mongoose `save` operations at the `User` model boundary.

## Verified security-test baseline

The isolated Node 20 and MongoMemoryServer suite currently executes 51 tests:

- 27 passed.
- 24 failed.
- All 7 registration/password failures from the initial baseline are resolved.

The remaining failures cover role/default-role behavior, JWT claim validation, sensitive authentication logging, and contract mutation authorization. See [Open Threads](<Open Threads.md>) and the [authentication remediation journal](<../engineering-journal/2026-08-09 - Authentication Security Remediation.md>).

## Repository context

- [Agent constitution](../../AGENTS.md)
- [Historical product context](<../../Project Cronus.md>) — useful context, but known to have drifted from the implementation.
- [Core service README](../../core-service/README.md)
- [Frontend README](../../frontend/README.md)
- [Lessons Learned](<Lessons Learned.md>)
