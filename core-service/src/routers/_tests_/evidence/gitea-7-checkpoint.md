# Gitea #7 evidence-only checkpoint

Date: 2026-09-22. Investigation/reproduction complete; business decisions remain
unanswered and remediation is not authorized. This is not an accepted ADR.

- Branch: `repro/gitea-7-cost-snapshots`
- Worktree: `/tmp/cronus-gitea-7`
- Exact commit parent / established main: `40fd8de41169cb3b6daa231cd4dff031b3e8e34e`
- Paused Interaction baseline: `7b94984ece211e007ed8f9cdfb461942f2c5ade2`
- Commit message: `test: preserve Work Order cost snapshot reproduction`
- Authorized push targets: existing `gitea` and `github`, only this reproduction branch.
- This checkpoint commit's identity is obtained with `git rev-parse HEAD`;
  its parent with `git rev-parse HEAD^`. The final handoff records the resulting
  commit SHA and actual post-push checks; this pre-commit record does not claim
  that a future push has already succeeded.

## Verification

- Phase 1: all seven files match the previously recorded SHA-256 values in
  phase1-preservation.json; no assertion or evidence edits.
- Phase 2 checkpoint rerun: 6/6 tests, one suite passed; exit 0, 1.291 seconds.
  Real mounted router, synthetic JWT/facility fixtures, fail-closed isolated
  MongoMemoryServer. No evidence-output variable supplied, so frozen JSON was
  not rewritten. The new phase2-preservation.json records eight frozen files.
- Runtime: existing Node v18.19.1, cached MongoDB 8.2.1, downloads disabled.
  Existing Node compatibility/experimental and duplicate-index warnings remain.
- Test command from core-service:
  `MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.workorder-cost-snapshots-phase2-reproduction.config.cjs --runInBand`.
- Production/tracked files unchanged before staging; staging was initially empty.
- Staged allowlist: exactly the 19 evidence-only additions listed below; no unrelated or production files staged.
- git diff --check and git diff --cached --check: both passed (exit 0).
- Only the temporary node_modules symlink created for reproduction was removed
  after verification. The original installed dependencies were not modified.
  Reruns need existing compatible dependencies made available again; the link
  is deliberately not committed.
- No production remediation, business-policy approval, real database access,
  Docker/runtime infrastructure changes, jobs, imports, migrations, CRM edits,
  or main/Interaction merge is part of this checkpoint.
- Phase 1 was hash-verified, not rerun; historical passing results remain in its
  frozen evidence. No broader suite was run for this evidence-only checkpoint.

## Exact changed files

All changes are additions; no baseline file is modified.

- `core-service/jest.workorder-cost-snapshots-phase2-reproduction.config.cjs`
- `core-service/jest.workorder-cost-snapshots-reproduction.config.cjs`
- `core-service/src/routers/_tests_/evidence/gitea-7-checkpoint.md`
- `core-service/src/routers/_tests_/evidence/gitea-7-decision-packet.md`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/C-priced-labor-delete.json`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/D-priced-part-quantity.json`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/E-priced-part-delete.json`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/F-later-unrelated-save.json`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/G-catalog-price-change.json`
- `core-service/src/routers/_tests_/evidence/gitea-7-phase2/README.md`
- `core-service/src/routers/_tests_/evidence/gitea-7/A-labor-addition.json`
- `core-service/src/routers/_tests_/evidence/gitea-7/B-part-addition.json`
- `core-service/src/routers/_tests_/evidence/gitea-7/README.md`
- `core-service/src/routers/_tests_/evidence/gitea-7/final/A-labor-addition.json`
- `core-service/src/routers/_tests_/evidence/gitea-7/final/B-part-addition.json`
- `core-service/src/routers/_tests_/phase1-preservation.json`
- `core-service/src/routers/_tests_/phase2-preservation.json`
- `core-service/src/routers/_tests_/workOrderCostSnapshots.phase2.reproduction.mjs`
- `core-service/src/routers/_tests_/workOrderCostSnapshots.reproduction.mjs`
