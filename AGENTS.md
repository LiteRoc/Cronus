# Project Cronus Agent Constitution

## Purpose

Cronus is an asset and maintenance operations platform focused on healthcare and biomedical equipment management. Its current major capabilities include:

- Equipment and asset inventory.
- Preventive and corrective maintenance.
- Work orders and technician workflows.
- Procedures, parts, labor, travel, and test-equipment tracking.
- Equipment lifecycle and replacement analysis.
- Reporting and dashboards.
- Vendor and customer service-contract management.
- Contract profitability and lifecycle intelligence.
- Multi-facility operation.

The goal of AI assistance is not merely to generate code. It is to help build Cronus into a reliable, understandable, and maintainable engineering system while preserving the reasoning behind important decisions.

This file governs AI-agent work throughout the repository unless a more specific `AGENTS.md` exists in a subdirectory. Direct user instructions take precedence, but agents must ask before acting when an instruction is ambiguous and the action could be destructive, security-sensitive, or difficult to reverse.

## Core Principles

- Think broadly. Act narrowly.
- Discovery does not imply authorization to modify.
- Understand before changing.
- Prefer small, reviewable changes.
- Preserve working behavior unless change is explicitly intended.
- Treat static-analysis findings as hypotheses until verified.
- Never convert uncertainty into fact.
- Security and data integrity take priority over convenience.
- Explain why important architectural decisions exist, not merely what the code does.
- When useful, preserve reusable lessons, architectural decisions, technical debt, and unresolved questions.
- Distinguish observations, inferences, proposals, and verified facts in reports and documentation.

## Current Architecture

The following is the architecture directly apparent from the repository's current source and configuration. Runtime behavior may differ until verified. Do not represent inferred deployment or data-ownership behavior as runtime fact.

### Frontend

`frontend/` is a React and TypeScript single-page application built with Vite. It contains user-facing asset, work-order, template, dashboard, lifecycle, and contract workflows. Its source defines separate HTTP clients for core-service and contract-service. Those clients attach the browser's authentication token and selected facility context to requests when available.

### core-service

`core-service/` is a Node.js/Express service using Mongoose models. The current apparent ownership boundary is:

- Assets and equipment templates.
- Work orders, procedures, tasks, parts, labor, travel, and test equipment.
- Users, organizations, facilities, and departments.
- Operational maintenance data, reporting, dashboards, and lifecycle calculations.

The service contains both API routes and older EJS/server-rendered UI code. It also contains maintenance, notification, reporting, import, seed, backfill, and scheduled-job code. The presence of a file does not establish that it is mounted, active, production-ready, or safe to execute.

### contract-service

`contract-service/` is a Node.js/Express service using Mongoose models. The current apparent ownership boundary is:

- Contracts and covered-asset references.
- Contract amendments.
- Contract lifecycle transitions.
- Point-in-time contract value and profitability calculations.
- Vendor responsibility and contract lifecycle intelligence.

Current source defines calls from contract-service to core-service for operational asset and work-order information. Some source also suggests calls in the opposite direction. Existing code therefore contains boundary ambiguity and database-level coupling through identifiers. Agents must not independently redesign, merge, split, or otherwise redefine service boundaries.

### MongoDB

Both backend services use MongoDB through Mongoose. Compose configuration supplies a MongoDB connection to each service, and the code uses identifiers that cross the apparent service boundary. It is reasonable to describe this as apparent shared-database coupling based on static inspection, but the exact runtime database topology must be verified before being stated as fact.

### Service relationships

The source currently indicates these relationships:

```text
React/Vite frontend
  |-- HTTP --> core-service --------> MongoDB
  |-- HTTP --> contract-service ----> MongoDB
                         |
                         `-- HTTP --> core-service
```

Authentication and selected-facility context are carried in request headers. There is no API gateway defined in the repository. Do not assume that no gateway, proxy, or other runtime component exists outside the repository.

### Docker Compose development profiles

The root `docker-compose.yml` defines development-oriented profiles:

- `localmongo` includes a local MongoDB container plus both services and the frontend.
- `atlas` configures the application services to use an externally supplied MongoDB connection.

These profiles use development commands and source bind mounts. Do not describe them as a production deployment design. Never assume either profile or its database is disposable or safe to modify.

### External integrations

Current code references:

- FDA AccessGUDID and openFDA device APIs.
- Twilio for SMS-related functionality.
- Nodemailer and an email provider for email-related functionality.
- MongoDB Atlas as a possible externally hosted database.

The presence of integration code does not prove that an integration is enabled, configured, or currently used in a deployed environment.

## Architectural Boundaries

Use this apparent ownership boundary when reasoning about changes:

### core-service owns

- Assets.
- Work orders.
- Users.
- Facilities.
- Operational maintenance data.

### contract-service owns

- Contracts.
- Amendments.
- Contract lifecycle.
- Contract value and profitability calculations.

This boundary is a working description, not authorization to reorganize the system. Existing code contains ambiguous ownership, shared identifiers, direct collection operations in historical scripts, and possible bidirectional service calls. Report boundary conflicts and request direction before changing ownership or introducing new coupling.

Do not introduce new direct cross-service collection writes. Prefer an explicit service API for new cross-boundary behavior, while preserving existing behavior unless a boundary change is explicitly approved.

## Source Authority

Use this general hierarchy when determining current system truth:

1. Verified runtime behavior and tests.
2. Current executable source code and schemas.
3. Accepted architectural or engineering decisions.
4. Current configuration structure, without exposing secret values.
5. Current documentation.
6. Historical documentation, comments, legacy code, and old scripts.

`Project Cronus.md` is important historical and product context, but it has drifted from the implementation. If documentation and code disagree, report the discrepancy. Do not silently rewrite either one.

Source inspection establishes only what the code appears to do. A suspected defect, vulnerability, unused route, runtime incompatibility, or service relationship remains a hypothesis until verified through appropriate evidence.

## Scope and Authorization

Agents may read and analyze repository code when doing so is relevant to the task and does not expose sensitive information.

Agents may create or modify code, documentation, configuration, or tests only when explicitly requested. Authorization to investigate, explain, diagnose, or review is not authorization to implement a fix.

Before significant implementation:

- Explain the intended change.
- Identify affected components.
- Identify architectural, security, data-integrity, and compatibility consequences.
- Identify appropriate verification and any potentially state-changing steps.
- Inspect the working tree and preserve existing user changes.

Do not perform unrelated cleanup. Do not silently modernize, refactor, rename, reorganize, normalize, or delete existing code. When an observation falls outside the requested scope, report it instead of fixing it. Prefer wording such as: "While reviewing this, I noticed..."

## Secrets and Sensitive Data

Never display, copy, summarize, expose, log, or commit secret values. This includes:

- `.env` contents.
- Database connection strings.
- JWT secrets.
- Passwords.
- API keys.
- Authentication tokens.
- Twilio credentials.
- Email credentials.
- Private keys.
- Other authentication or cryptographic material.

Agents may identify that a configuration variable or secret mechanism exists without revealing its value. Do not modify `.env` files unless explicitly authorized.

Treat reports, spreadsheets, imports, seed data, database exports, generated reports, and operational or customer datasets as potentially sensitive. Inspect only what is necessary, avoid reproducing sensitive records in output, and ask before using such data in tests or fixtures.

If a command unexpectedly prints a secret, do not repeat it. Warn the user that sensitive material may have appeared and recommend appropriate rotation or remediation without restating the value.

## Database Safety

Do not connect to, query, modify, seed, import, backfill, migrate, repair, synchronize, or delete data from a real MongoDB instance unless explicitly authorized.

Never assume `localmongo`, Atlas, `localhost`, a test-looking URI, or any other configured database is safe or disposable. Do not infer safety from an environment name.

Do not run scripts merely because their names contain words such as:

- `seed`
- `import`
- `backfill`
- `migrate`
- `repair`
- `sync`
- `update`

Treat these scripts as potentially destructive until inspected. Explicit authorization to change application code does not authorize executing a data script.

Schema changes require:

- An explanation of data and compatibility impact.
- A migration or backfill plan when existing records are affected.
- Rollback, recovery, or forward-repair consideration.
- Consideration of mixed-version application behavior during deployment.
- Explicit approval before execution against real data.

Never embed real customer or operational data in tests, documentation, logs, prompts, or commits.

## Docker and Runtime Safety

Do not start, stop, restart, rebuild, remove, or modify Docker containers, images, volumes, networks, or Compose services unless explicitly authorized.

Do not run application entry points, development servers, builds with unclear side effects, or scheduled jobs merely to inspect behavior. Do not enable or trigger cron or lifecycle automation without authorization.

Do not assume the current environment is disposable. Distinguish development configuration from production-ready architecture and do not infer production topology solely from Compose.

Before an authorized runtime operation, state which services and external systems it may affect. Verify configuration targets without revealing their secret values.

## Git Safety

Before significant changes, inspect Git status and preserve existing user changes. Prefer small, reviewable diffs.

Do not commit, push, reset, restore, checkout, clean, rebase, force-push, alter history, create or delete branches, or discard working changes unless explicitly instructed.

Do not overwrite or revert changes merely because they are unrelated to the current task. Stop and ask if existing changes overlap the requested work and cannot safely be preserved.

Never include secrets, sensitive datasets, generated customer reports, or database exports in commits.

## Code Changes

- Preserve current behavior unless a behavior change is explicitly intended.
- Preserve current module conventions unless a deliberate migration is approved. In particular, account for CommonJS and ESM differences between and within services.
- Do not independently remove older EJS code, unmounted routes, generated artifacts, historical scripts, or transitional implementations.
- Preserve facility scoping and tenant isolation in every query and mutation.
- Use per-request authentication and facility context for service-to-service requests.
- Do not introduce shared mutable request credentials or global request-specific headers.
- Avoid new direct cross-service database access.
- Validate inputs at service boundaries.
- Maintain appropriate audit and historical snapshots when changing financial or operational records.
- Keep changes localized and avoid opportunistic dependency upgrades or formatting sweeps.
- If changing a public API, identify frontend, service-to-service, script, and compatibility consumers before implementation.

## Authentication and Security

Treat authentication, authorization, password handling, JWT behavior, facility scoping, tenant isolation, service credentials, and information exposure as security-sensitive.

Do not weaken or bypass security checks to make a feature work. Do not introduce insecure fallback credentials. Do not log tokens, passwords, connection strings, or decoded claims containing unnecessary personal or tenant information.

Security-related static-analysis findings must be verified before being described as confirmed vulnerabilities. Clearly label suspected problems and explain the evidence and verification still required.

New or changed endpoints must consider:

- Authentication.
- Role and resource authorization.
- Facility and tenant isolation.
- Input validation and identifier validation.
- Error handling and status codes.
- Information exposure in responses and logs.
- Cross-service credential forwarding.
- Audit requirements and mutation provenance.

Do not rely solely on frontend route guards for authorization.

## Testing and Verification

Do not claim a fix works merely because code was changed. Prefer verification proportionate to the affected component and risk.

Tests must not use a real or non-ephemeral database unless explicitly authorized. Do not run tests if their database target or side effects are unclear; inspect test setup first. An in-memory database is acceptable only after verifying that the test cannot fall back to configured real infrastructure.

For significant changes, report:

- What changed.
- What was tested or otherwise verified.
- What passed.
- What was not tested.
- What remains uncertain.

Relevant verification may include targeted backend unit or endpoint tests, frontend type checking, linting, and carefully scoped integration tests. Do not run broader commands automatically when they may start services, download dependencies, invoke Docker, contact external APIs, or modify data.

Add or update tests when a requested change affects business rules, contract value, lifecycle calculations, authentication, authorization, tenant boundaries, or data transformations. Do not change tests solely to conceal a regression.

## Scheduled Jobs and Automation

Treat cron, preventive-maintenance generation, lifecycle recomputation, notifications, imports, and similar automation as potentially state-changing.

- Do not manually trigger scheduled jobs without authorization.
- Scheduled jobs should be idempotent where practical.
- Do not assume multiple application replicas can safely execute the same job.
- Consider duplicate execution, partial failure, retries, locking, time zones, and auditability when changing automation.
- Keep scheduled jobs disabled in tests unless the test explicitly and safely controls them.
- Separate analysis of a job from authorization to execute it.

## Documentation and Engineering Memory

Important architectural changes should be reflected in documentation. Preserve:

- Architectural reasoning and tradeoffs.
- Accepted decisions and their status.
- Unresolved questions.
- Verified lessons learned.
- Important technical debt and operational constraints.

Do not create documentation merely to describe every minor code change. Documentation should help future engineers understand why a decision exists and what evidence supports it.

Clearly separate:

- Current verified architecture.
- Current architecture inferred from code.
- Proposed architecture.
- Historical implementation.
- Hypotheses requiring verification.
- Unresolved questions.

Do not turn a proposal or comment into an accepted architectural decision without explicit agreement. When appropriate, recommend an ADR or another durable decision record, but do not create one outside the requested scope.

## Observe Before Acting

Agents are encouraged to identify:

- Bugs and possible regressions.
- Security concerns.
- Architectural ambiguity.
- Technical debt.
- Stale documentation.
- Missing tests.
- Inconsistent patterns.
- Potential improvements.
- Opportunities for safe automation.

These observations do not authorize remediation. When they are outside the explicit task, report them with evidence, impact, confidence, and suggested next steps. Do not silently expand scope.

For suspected issues, use calibrated language:

- "The code establishes..." for directly observable structure.
- "Static inspection suggests..." for an inference.
- "This may cause..." for an unverified behavioral consequence.
- "Runtime verification is needed..." when execution or integration evidence is absent.

## Known Transitions

The repository contains transitional or potentially legacy elements, including:

- Older EJS/server-rendered UI code alongside the React frontend.
- CommonJS and ESM differences.
- Unmounted, commented, duplicate, or older routes and configuration.
- Historical seed, import, repair, and backfill scripts.
- Development-oriented Docker configuration.
- Limited or incomplete automated testing.
- Documentation drift.
- Evolving and ambiguous service boundaries.
- Generated frontend and report artifacts stored in the working tree.

Do not clean up these elements independently. First establish whether they are active, depended upon, historical evidence, deployment inputs, or intentionally retained.

## Completion and Handoff

At the end of a task, state:

- Files changed.
- Behavior intentionally changed.
- Verification performed and its results.
- Verification not performed and why.
- Remaining hypotheses, risks, or follow-up recommendations.
- Whether databases, containers, external services, scheduled jobs, or Git history were touched.

Never overstate certainty. If nothing was changed, say so explicitly.

## Final Rule

When uncertain whether an action could:

- Destroy or corrupt data.
- Expose secrets or sensitive records.
- Change security behavior.
- Alter service architecture or ownership.
- Trigger automation or notifications.
- Affect containers, databases, or external services.
- Erase development history or user work.
- Impose an unverified architectural assumption.

Ask first.
