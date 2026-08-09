# Lessons Learned

This is a staging area for reusable, evidence-supported engineering lessons. These statements are not architectural decisions or mandates by themselves.

## Turn static findings into executable tests before remediation

The initial assessment identified plausible authentication and authorization problems through source inspection. Encoding them in isolated tests separated runtime-confirmed behavior from hypotheses and created a stable baseline for narrow changes.

## Put security invariants at the persistence boundary when practical

Hashing only in a registration handler left other ordinary user-creation paths exposed. Enforcing password hashing in the `User` model's save lifecycle protects callers that persist through that boundary. This does not cover update, bulk, import, or direct-collection operations that bypass save middleware; those paths still require explicit review.

## Code changes are not verification

The registration remediation was considered verified only after the relevant isolated suite executed again and all 7 registration/password failures passed. The same run retained 24 failures in unrelated security areas, preventing a narrow success from being overstated as complete security remediation.

## Disposable isolation enables safer security verification

The suite used a disposable Node 20 container, a cached MongoDB binary, MongoMemoryServer-only databases, a deliberately unusable configured database URI, and connection guards. This allowed endpoint and persistence behavior to be tested without connecting to operational databases or external services.

## Preserve narrow scope when security findings are interdependent

Registration roles intersect with broader role normalization, JWT defaults, tenant context, and authorization. Resolving only the approved registration contract while leaving those concerns as explicit open threads kept the change reviewable and its verification attributable.
