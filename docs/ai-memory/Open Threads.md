# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Next priority: core-service authentication hardening

The isolated `coreAuthentication.security.test.js` suite has nine failures. Contract-service equivalents pass and are outside this next change.

### Role authorization and normalization

- A core-service admin-only route accepts a valid JWT with no role.
- Tested `tech` and `technician` authorization behavior conflicts with the expected canonical role convention.
- Before remediation, inspect core middleware, stored-role conventions, token producers/consumers, and callers. Do not silently normalize stored records.

### JWT issuer and audience validation

- Core-service accepts otherwise valid tokens with missing or incorrect issuer claims.
- Core-service accepts otherwise valid tokens with missing or incorrect audience claims.
- Confirm compatibility with every current token producer and consumer before enabling enforcement.

### Sensitive authentication logging

- Runtime testing confirms core login/authentication logging emits the user password field/hash.
- Remediation must remove sensitive logging without weakening diagnostic safety or logging tokens/claims unnecessarily.

## Contract and data compatibility

### Wayne Healthcare financial discrepancy

- `WHC-CAM-2024-001` has candidate baseline `$94,881.90`, ledger result `$383,524.75`, and stored `totalValue` `$383,524.74`.
- No authoritative repository source explains the penny difference.
- Do not repair until external commercial evidence resolves it; do not guess or round it away.

### Historical `linkedWorkOrders`

- `WorkOrder.contractId` is authoritative for active behavior.
- `Contract.linkedWorkOrders` remains because local read-only inspection found 36 references on one historical Contract.
- Removing it requires an explicit compatibility and migration decision.

### Multi-replica lifecycle execution

- Contract lifecycle operations are idempotent and same-process overlap is prevented.
- `noOverlap` is not a distributed lock; multiple replicas could race. Current Compose does not declare replicas.
- Do not add distributed infrastructure without explicit deployment evidence and authorization.

### Unmounted Customer/Vendor modules

- Contract-service Customer/Vendor implementations remain unmounted.
- Core-service appears to own active Vendor/Customer behavior, but external compatibility and historical ownership are not sufficiently proven for deletion.

## Other unresolved security/data risks

### Existing legacy `tech` records

Whether operational data contains legacy `tech` user records, and which callers depend on that value, remains unknown. Any assessment or normalization requires explicit database authorization.

### Possible existing plaintext-password records

The historical registration path could store plaintext passwords. Model middleware protects ordinary future `save` operations, but existing data was not inspected or migrated.

### `customerId` registration and tenant behavior

Registration requires `customerId` for customers, while static inspection previously found no corresponding current `User` schema/token field. Persistence and tenant behavior require a separate tenant-sensitive investigation.

### Password writes bypassing Mongoose save middleware

The hashing invariant applies to ordinary `save`; update, bulk, import, or direct-collection paths may bypass it and require deliberate review.

## Environment and dependency maintenance

- System Node is `v18.19.1`; Contract verification requires Node `>=20.19.0` and succeeded under Node 22.
- Core-service currently reports 27 dependency vulnerabilities. Do not run `npm audit fix` automatically.
- Contract dependency-directory ownership has had root-ownership complications. Keep environment repair separate from product/security commits.

## Future product direction

CRM concepts have been discussed—accounts, contacts, interactions, opportunities, CAM/service opportunities, renewals, and strategic account management—but implementation is deferred until core-service authentication hardening is complete.
