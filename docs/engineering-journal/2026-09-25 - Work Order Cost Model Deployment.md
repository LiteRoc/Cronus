# Work Order Cost Model Deployment — Gitea #7

Status: **Code/runtime deployment successful; authenticated business-path smoke testing remains unverified.**

## Deployed checkpoint

Deployed application SHA: `c3f0966df5c3d9ccbdb57af5f968bd6d0f77f639`.

The stable runtime checkout, `/home/thecapt/apps/cronus-main`, is clean and detached at that SHA. The subsequent documentation commit does not advance the runtime checkout or change the deployed application.

This deployment follows the #7 implementation at `168af0134155060cfeb9bfcbffa202562d876eb1`, the [approved Decisions 1–9](<2026-09-25 - Work Order Cost Model Approved Decisions.md>) recorded at `82d05755e4da6d6c12f3edb60224f5c71fa44515`, and deployment hardening at the deployed SHA. Gitea #7 was already closed as a software-remediation issue; operational rollout is separately authorized work.

## Runtime topology normalization

Before deployment, both backends mounted the paused Interaction worktree, while the frontend used an older detached main checkpoint. All three application source mounts now use the approved stable checkout:

| Service | Host source mounted at `/app` | New container ID | Started (UTC) | Restart count |
| --- | --- | --- | --- | --- |
| core-service | `/home/thecapt/apps/cronus-main/core-service` | `efb934aa68e701d2ffc02389cfe8234baa4af0a2e363378ee32c813881abc2e8` | 2026-09-25 12:35:53.260886806 | 0 |
| contract-service | `/home/thecapt/apps/cronus-main/contract-service` | `86d58510ae9931fd5ac0ec6b1c86ee0e0881462cbf538f0891902ba5bf0b73ef` | 2026-09-25 12:37:13.453506588 | 0 |
| frontend | `/home/thecapt/apps/cronus-main/frontend` | `c2cfb3b6debe352ddf9cf25d27a1546cfc8ec1eef1613c502af0e37e307aa9c6` | 2026-09-25 12:39:21.484388651 | 0 |

The user authorized a private maintenance window with no intentional users, explicitly replacing the proposed firewall block. No firewall or port-binding changes were made. All three application services were stopped in one Compose operation before advancing the stable checkout. Core, Contract, then frontend were recreated and verified sequentially with `--no-deps --no-build --force-recreate`. Mongo was excluded. Normal access was released after the available checks passed; the authenticated-check limitation was explicitly retained.

No image rebuild occurred. Existing anonymous dependency volumes were preserved:

- Core: `b91a7df36f132613f1211d1f382beee7583525370554ef583e9a6c214fc26828`.
- Contract: `4f192c56b2a2fc2bdb01130f4745616511b60a392f38de2cdd0dcc026a957274`.
- Frontend: `3ffcb701e87f2c9a9742f1c8f325c2f3f320712a3399f350721d4f7a7e40d81b`.

## Runtime configuration and scheduler state

Compose project/profile: `cronus` / `localmongo`. The deployment used all three files:

- `/home/thecapt/apps/cronus/docker-compose.yml`
- `/home/thecapt/apps/cronus-runtime/frontend-main.compose.yml`
- `/home/thecapt/apps/cronus-runtime/backend-main.compose.yml`

Compose environment-file source: `/home/thecapt/apps/cronus/.env`. Existing backend service `.env` files remain mounted read-only at `/app/.env`; secret values were not displayed or copied into the stable checkout.

Backend override SHA-256:

```text
fcc6af1e5e22b55b702d35bb9735459e0a7e5b255ad6a5a69b36eda27383f0f4
```

These override files remain outside the repository. The backend override was structurally validated without printing environment values.

Both application services receive `CRON_ENABLED=false`. Their disabled-state startup messages were observed, and source verification confirmed the registration gates. Core job modules are not imported when disabled; Contract lifecycle scheduling returns before registration. Scheduler re-enablement requires separate authorization.

## Mongo preservation and startup/index verification

Mongo container remained `eb448adced267f889f9ca4bdabd1c1e42cbed0f00c3d9c0af7e080b524c1092e`, with original start time `2026-08-13T09:58:17.095549826Z` and restart count **0**.

Storage volumes remained:

- `/data/db`: `cronus_mongo-data`.
- `/data/configdb`: `d185264a73e09e0cbbd0c0e2bd47bee7f2c4068a86b3cb9987eb243929da6dc9`.

Both backends reported successful Mongo connectivity. Metadata-only verification confirmed the existing unique Organization rate-schedule index and partial unique Work Order `{facilityId, importIdentity}` index. No manual index creation, deletion or rebuild was performed. No startup/index-error markers were observed in the inspected deployment logs. This does not certify business-data quality.

Contract startup logging no longer emits the database URI or raw connection errors. Filtered startup diagnostics found no URI/credential-exposure markers. A diagnostic `docker top` command initially omitted the required PID column; the corrected read-only check passed. This was a verification-command error, not an application failure.

## Read-only smoke results

Verified during deployment:

- All application containers running with correct stable-source mounts, preserved dependency volumes and restart counts of zero.
- Fresh startup and checked backend source fingerprints consistent with the pinned deployed checkout.
- Unauthenticated protected Core Asset, Work Order and rate-schedule endpoints returned **401**.
- Unauthenticated Contract list, overview and profitability endpoints returned **401**.
- Frontend application shell returned **200**.
- Served branding matched the pinned source asset.
- Eleven checked frontend modules were served successfully without transform errors, including the nullable/completeness-aware Work Order cost summary.
- No repair process was present in the final application process inspection, and no repair tool was invoked by the deployment.

The frontend checks establish source delivery and module transformation, not authenticated end-to-end rendering of business records.

## Important verification limitation

**Authenticated business-path smoke testing remains unverified.** No approved local Cronus credential/session source was available. The user authorized skipping these checks rather than creating, resetting, extracting or exposing credentials.

Still unverified after deployment:

- Login.
- Authenticated Facility-scoped Asset reads.
- Authenticated Facility-scoped Work Order reads.
- Authenticated Contract responses.
- Authenticated Asset and Template lifecycle responses.
- Record-level verification that viewing a Work Order does not mutate economic revision or `costs.calculatedAt`.

Likewise, the absent-rate-schedule behavior was not exercised against authenticated live records. Prior isolated regressions and source review support that behavior; they are not a substitute for a performed post-deployment business-path test.

This is a verification gap, not a failed deployment. Do not report these checks as passed.

## Preserved boundaries and separately gated next steps

No labor-rate schedule publication, repair preview/application, historical recovery, migration, intentional real business-data mutation, scheduled-job execution or CRM work occurred as part of this deployment. Database access for deployment verification was limited to metadata; no business document contents were queried.

Frozen reproduction remains `cae8e991137fdbf5ebfe52658512b03a4085aa17`. Paused Interaction remains separate and unmerged at `807bc38122e771dacccbc23fca4a66363dd58d55`.

Next steps require their own authorization:

1. Governed organization/network-wide blended labor-rate publication.
2. Authenticated business-path smoke checks using an approved existing session when available.
3. Real-data aggregate-repair preview; any subsequent apply remains separately gated.

This journal entry is documentation only. It does not enable schedulers, authorize the next operational action, or alter the runtime checkout.
