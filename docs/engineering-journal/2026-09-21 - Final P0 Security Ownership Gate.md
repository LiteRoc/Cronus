# Final P0 Security/Ownership Gate — September 21, 2026

P0 SECURITY/OWNERSHIP STABILIZATION GATE: PASS

## Authority and limits

Fresh read-only review of main `20f3d65ceea25f1fed8bcdb071be11ec4fc1af37`,
after Gitea #16 closure. Source was inspected, not application entry points
executed. No new reproduction, remediation, real-data/deployed-runtime checks,
Docker, scheduled jobs, external-provider calls or dependency changes occurred.
PASS means no new credible mounted P0 path was found in this focused sweep;
it is not proof that the application has no remaining security defects.

## Publication and verification

#16 fix `2bbe4ba5af5a38ed6f5b06ad7b5131126495df01` fast-forwarded main from
`2f7bea84f2585eb6de14f3706c4b744b4719ab1b`. Narrow documentation produced main
`20f3d65ceea25f1fed8bcdb071be11ec4fc1af37`; both remote main refs matched.
Interaction merged that main without rewriting history at
`45f19da5bc5572b9b35c3290559b3a585058af0b`; both remote refs matched.
Only expected memory-document conflicts occurred. Test harness initialization
exposed the missing existing Interaction error-handler export; work stopped
for approval. The approved addition to each picker mock changed no other bytes.
Frozen reproduction comparisons use evidence `ed51a0e1eab67ef00fc7501b4f7557c22c84b0aa`.

| Verification | Main | Interaction combined |
| --- | ---: | ---: |
| Original S2 SECURITY assertions | 11 | 11 |
| Permanent picker | 49 | 49 |
| Supplier #13 | 59 | 59 |
| Facility #3 | 45 | 45 |
| Vendor #4 | 90 | 90 |
| Work Order subresources #5 | 295 | 295 |
| Ownership #6 | 215 | 215 |
| Interaction | not on main | 54 |
| Complete safe core | 919 | 973 |
| Authentication | 31 | 31 |
| Frontend picker compatibility/isolation | 16 | 16 |

All passed. Core 919 = prior main 870 + picker 49; combined 973 = main 919 +
Interaction 54 = prior combined 924 + picker 49. Frozen 91-case evidence retains
its original 80 observations/controls and 11 originally failing security cases;
post-fix security runs select those 11 and skip historical observations.
TypeScript, syntax, npm inventory, whitespace and diff/scope checks passed.
The earlier linked main environment reported 490 frontend extraneous entries;
root Interaction inventory reported none. No manifests/lockfiles/installations
were changed. All persistence tests used fail-closed synthetic harnesses.

[Final #16 comment](http://192.168.1.185:3000/LiteRoc/cronus/issues/16#issuecomment-103)
records verification. API readback confirmed #16 closed and #3/#4/#5/#6/#13 closed;
#14/#15 remain open with P1 labels. No other issue was changed.

## Mounted-surface review

The actual mounts in `core-service/app.js` were traced: Assets, Templates,
Work Orders, authentication, Users, reports, Parts, Suppliers, Procedures,
Tasks, dashboard, Vendors, Facilities, Departments, Contacts and FollowUps.
`contract-service/server.js` calls `createApp` from `app.js`, which mounts
`src/routes/contractRoutes.js` at /contracts. Interaction is not mounted on main.

- Authentication: operational routers invoke token authentication; signature,
  issuer/audience and expiry checks remain in place, with no missing-role admin
  default. User management is admin-gated. Public registration rejects admin;
  accepted August 9 policy explicitly permits canonical viewer/technician/customer
  registration, so that existing choice is not relabeled a new P0. Login/home
  and public UI assets are intentionally public. No operational anonymous or
  invalid-token bypass was identified beyond already-deferred configuration risk.
- Route ordering: the later apparent anonymous `app.get('/workorders')` is
  preceded by the mounted router's authenticated/role-gated terminating GET /.
  Its normal success/error paths respond rather than calling next. It is not
  treated as a reachable bypass based on source appearance alone.
- Query authorization: Asset/Work Order search retains tenant predicates in
  $and; distinct, hierarchy, batch, reports and dashboards retain Facility
  filters. Template lifecycle uses authorized explicit context. Existing global
  record semantics and read-role policy differences remain hardening/policy
  considerations, not a newly demonstrated foreign-Facility disclosure.
- Creation/mutation: #6 derives Asset/WO ownership from validated context and
  Asset references, constrains Department/parent/assignee references, blocks
  body ownership/audit replacement, hardens UDI Asset creation, and uses atomic
  Ticket promotion. Ordinary WO edits and status cannot archive; destructive
  routes retain admin gates. #5 checks authorized parent and subresource binding,
  server audit identity and same-Facility equipment on the write path.
- Picker: #16 requires explicit authorized context for admin and technician,
  same-Facility personally assigned eligible active/nondeleted equipment;
  response remains exactly _id, ctrlNumber, manufacturer, model. Tests verify
  foreign stale assignment exclusion and independent local/foreign attachment.
- Shared reference data: Supplier #13 requires canonical internal roles, with
  admin-only creation and explicit input/read projection. Vendor #4 preserves
  differentiated read projection, admin mutation, disabled creation and
  non-destructive archival. Part/Manufacturer/Template broad ordinary updates
  are the accepted S3 P1 findings; no new operational removal evidence was found.
  Do not invent Facility ownership for these shared-reference entities.
- CRM already on main: Contact/FollowUp router-wide canonical roles and explicit
  Facility validation feed scoped services; reference associations, transitions
  and admin archival retain their guards. No new CRM implementation was made.
- Cross-service: mounted contract mutations are admin-only; controllers/services
  scope Contract lookup through tenant filters and context resolution. Mounted
  enrichment uses request-specific clients forwarding token and Facility to
  scoped core endpoints. The mutable withForwardedHeaders helper is defined and
  imported but no invocation was found; active preview uses makeCoreClient.
  Its source presence is not evidence of an active concurrent credential leak.
  Contract historical/reference validation and global-record semantics remain
  deferred, without new material foreign-disclosure evidence in this review.
- Debug/admin/seed: core /admin seed router is neither imported nor mounted;
  old core Contract/portal routers are commented out. No mounted seed/debug
  mutation path was found. Cron imports were inspected only; nothing executed.

## Reconciliation and remaining work

Supplier anonymous disclosure/create is closed by #13. Shared-resource archive
concerns were reproduced with no P0 operational removal and reclassified to
open P1 #14/#15. Picker cross-Facility disclosure is closed by #16 after main
and Interaction verification. Together #3 query isolation, #4 Vendor access,
#5 subresource boundaries, #6 ownership/creation and #13/#16 close the known
post-#6 P0 paths. No new candidate is classified REPRODUCTION REQUIRED here.

Remaining P1/hardening/deferred: #14/#15 lifecycle/audit protection and accepted
archive/UDI policies; historical-reference isolation and ownership normalization;
JWT fallback/test-mode configuration; customer identity mismatch; historical
plaintext-password possibility; Part/Procedure/Task ownership and role policy;
error/privacy/logging consistency; audited transfers and deployed transaction
capability. Business correctness #7–#12 is separate. No deferred item was
promoted to P0 solely from an old source pattern or remediated during this gate.

## Stopping point

P0 security/ownership stabilization is complete at this checkpoint. Recommend
next a separately authorized #7 investigation: keep WorkOrder cost snapshots
correct across every mutation path. #7 has not started. #14/#15 remediation,
Interaction frontend and Opportunity have not started. CRM remains paused
pending human direction. This documentation is the end of the sequence.
