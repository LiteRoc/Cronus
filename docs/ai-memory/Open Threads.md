# Open Threads

This file records verified defects and clearly unresolved engineering work. A failed security test is runtime evidence for the behavior exercised by that test; risks inferred from source or compatibility analysis remain labeled as unresolved until investigated.

## Verified authentication/security defects

### Canonical role authorization and default-role behavior

- Both services elevate a valid token with no role claim to `admin` in authentication middleware.
- Core authorization still recognizes the legacy `tech` spelling where the canonical `technician` role is expected, and rejects `technician` in the tested technician gate.
- Remediation must be scoped across token handling, authorization gates, and compatibility with existing callers and records. It must not silently normalize stored data.

### JWT issuer and audience validation

- Runtime tests establish that core-service accepts otherwise valid tokens with missing or incorrect issuer or audience claims.
- Runtime tests establish the same missing issuer/audience enforcement in contract-service.
- Expected issuers, audiences, and compatibility with every token producer and consumer must be confirmed before remediation.

### Sensitive authentication logging

- Runtime testing confirms that core login logging emits the retrieved user object, including its stored password field/hash.
- Authentication logs should also be reviewed for bearer tokens and unnecessary claims, but no broader defect should be claimed without evidence.

### Contract mutation authorization

- Runtime tests establish that contract mutation routes do not effectively reject non-administrator roles before route processing.
- Covered tests include contract deletion and representative approve, terminate, and amendment-application lifecycle mutations.
- Remediation must preserve authentication, tenant/facility scoping, mutation audit expectations, and intended administrator behavior.

## Unresolved risks requiring investigation

### Existing legacy `tech` records

The repository previously used both `tech` and `technician`. Static inspection and tests establish an application-level inconsistency, but no operational database was queried. Whether legacy `tech` user records exist, how many exist, and which clients depend on that value remain unknown.

### Possible existing plaintext-password records

Runtime tests confirmed that the former registration path stored a plaintext password. The new model middleware protects ordinary future `save` operations, but existing data was not inspected or migrated. The presence and scope of plaintext operational records remain unknown and require an explicitly authorized assessment and remediation plan.

### `customerId` registration and tenant behavior

Registration accepts and requires `customerId` for the `customer` role, while static inspection shows that `customerId` is not defined on the current `User` schema and is not added to the login token. Its persistence and effective tenant behavior therefore require investigation. Any correction is tenant-isolation-sensitive and may require schema, token, compatibility, and migration planning.

### Password writes that bypass Mongoose save middleware

The password hash invariant is enforced by `User` save middleware. Operations such as `updateOne`, `findOneAndUpdate`, `insertMany`, bulk writes, and direct collection writes may bypass save middleware. Known repository user-write paths must be reviewed before password-update features or imports rely on the invariant. The current administrator seed path hashes explicitly before `updateOne`; other operational or external paths have not been verified.
