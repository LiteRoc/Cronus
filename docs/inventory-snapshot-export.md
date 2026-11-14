# Read-only reference snapshot: Ubuntu handoff

The standalone `core-service/scripts/exportInventorySnapshot.cjs` uses the existing
`mongodb` and `dotenv` dependencies. It never loads Cronus, Mongoose models,
scheduled jobs, or application configuration code. Database operations are limited
to collection listing and projected `find` reads. No writes, index creation,
transactions, database creation, or deployment operations are issued.

## 1. Copy the exporter from Windows

The local import work is uncommitted and has not been pushed. Copy this single
file; a Git pull on Ubuntu will not retrieve it. In Windows PowerShell:

```powershell
scp "C:\Users\jason\Documents\ChatGPT\Cronus\inventory-import\core-service\scripts\exportInventorySnapshot.cjs" thecapt@ubuntu-lab:/tmp/cronus-inventory-import/core-service/exportInventorySnapshot.cjs
```

If `ubuntu-lab` does not resolve, substitute the Ubuntu machine's current address.
The destination uses the previously established worktree, whose continued
existence must be confirmed on Ubuntu. If `/tmp` was cleared, stop and report that
rather than changing or copying files into the running application checkout.

## 2. Check prerequisites on Ubuntu

```bash
cd /tmp/cronus-inventory-import/core-service
node --version
node -e "require('mongodb'); require('dotenv'); console.log('Dependencies available')"
node ./exportInventorySnapshot.cjs --help
```

Use Node 18 or newer. If the isolated worktree has no dependencies, the approved
dependency installation can be run there with `npm ci --ignore-scripts --no-audit
--no-fund`. Do not start Cronus or any container to run this exporter.

## 3. Select configuration without displaying credentials

Set `CRONUS_ENV` to the actual environment file used for Cronus's `MONGO_URI`.
This example is based on the earlier checkout location and must be verified; the
exporter never assumes a file location or automatically loads `.env`.

```bash
CRONUS_ENV=/home/thecapt/apps/cronus/core-service/.env
test -f "$CRONUS_ENV" && echo "Environment file found"
node ./exportInventorySnapshot.cjs --env "$CRONUS_ENV" --show-database
```

The helper parses the configuration and prints **only the explicit database name**;
it does not connect. It refuses to guess the driver's default database if the URI
has no explicit name. Do not paste `.env`, a URI, or credentials into the chat.
If Cronus gets `MONGO_URI` from an already configured shell environment, omit
`--env` instead. An explicit environment file takes precedence over shell values.

Enter the name printed above:

```bash
read -r -p "Cronus database name: " CRONUS_DB
node ./exportInventorySnapshot.cjs --env "$CRONUS_ENV" --db "$CRONUS_DB" --list-facilities
```

This connects for read-only facility identity listing. Note the target
facility ID (`_id`), using the name/code to select the correct record. Multiple
similarly named records require an explicit choice; do not guess from asset tags.

Use an existing database read-only credential when available. The script does not
create accounts or change credentials, roles, services, or network configuration.
Driver failures suppress connection details. A generic failure may mean the host
is unreachable from the Ubuntu shell, the credentials lack read/list permissions,
or majority reads are unsupported. Do not start or modify infrastructure as a
workaround; report the exporter message for follow-up.

## 4. Export to a new private file

```bash
mkdir -p "$HOME/cronus-reference-exports"
chmod 700 "$HOME/cronus-reference-exports"
CRONUS_SNAPSHOT="$HOME/cronus-reference-exports/cronus-reference-$(date -u +%Y%m%dT%H%M%SZ).json"
node ./exportInventorySnapshot.cjs --env "$CRONUS_ENV" --db "$CRONUS_DB" --output "$CRONUS_SNAPSHOT"
```

Success prints only counts. The file is created with mode `0600` on Ubuntu.
Existing files are never overwritten. No file is produced for database read
failures, missing collections, invalid required fields, or size-limit failures.
The JSON contains customer inventory identifiers, so keep it outside Git and
share only for this import review. Exit status 0 means success; 2 means failure.

For transfer, show the file path (not its contents):

```bash
printf '%s\n' "$CRONUS_SNAPSHOT"
```

Copy it back to Windows, using the exact path printed above in place of the
example timestamp:

```powershell
scp thecapt@ubuntu-lab:/home/thecapt/cronus-reference-exports/cronus-reference-YYYYMMDDTHHMMSSZ.json "$env:USERPROFILE\Downloads\cronus-reference.json"
```

Attach that JSON in this chat and provide the selected facility ID.
Do not paste the entire JSON into the chat. We can then run the planner locally
without further database access. An import is not performed by this workflow.

## What is exported and what it proves

- All `assets`, including archived records and all facilities: `_id`, `facilityId`,
  `ctrlNumber`, `manufacturer`, `serialNumber`.
- All `departments`: `_id`, `facilityId`, `name`.
- Shared `equipmenttemplates`, including archived records: `_id`, `manufacturer`,
  `model`, `di`, `status`, `deletedAt`, `deletedBy`, `archivedAt`, `archivedBy`,
  `isArchived`. Raw archive values are preserved rather than Mongoose-cast.
- Snapshot UUID, beginning/end timestamps, global asset scope, and a consistency
  label. It contains no connection string, credentials, or database name.

The facility-list mode separately reads only facility `_id`, `name`, and `code`;
the snapshot does not include facility contact/address data. Global assets are
necessary because Cronus asset tags are globally unique. Full inventory snapshots
must stay with authorized operators, not be exposed in a normal facility-user UI.

Reads use primary/majority settings, finite timeouts, and no automatic read retry.
These are sequential reads, not an atomic cross-collection snapshot. Inventory can
change while or after the export runs. Later execution must refresh checks and
enforce current ownership and unique-index rules. No live readiness is claimed.

The exporter caps output at 20 MiB and 100000 combined reference records. It fails
instead of silently truncating. Required collections must exist, even if empty;
an incorrect database must not appear to be an empty reference dataset. Required
IDs and text fields are validated; legacy records with invalid fields stop export
and require review, never automatic repair.

## Verification

Run locally from `core-service`:

```bash
node --test src/services/_tests_/inventoryImport.test.cjs src/services/_tests_/inventoryImportPlan.test.cjs src/services/_tests_/inventorySnapshotExport.test.cjs
```

Tests use only synthetic in-process read adapters (unexpected database operations
throw) and temporary files. Coverage includes projected fields, cross-facility
assets, BSON identifiers/dates, legacy archive values, planner compatibility,
missing collections, malformed records, cursor/connection cleanup, output limits,
non-overwrite behavior, private file modes where supported, credential-safe errors,
and CLI configuration. No real database or application service was contacted.
