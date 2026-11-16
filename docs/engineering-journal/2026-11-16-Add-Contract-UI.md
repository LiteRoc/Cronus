# Add Contract UI

## Add Contract UI — November 16, 2026

Implemented on `feat/add-contract-ui`, based on `64e565b`; not yet committed,
merged, or deployed to the normal runtime checkout.

- Administrator-only Add Contract form remains accessible on an empty list.
- Requires a selected Facility; creates a draft through the existing Contract API.
- Collects name, customer/vendor type, term dates, and original base annual value.
- Contract numbers and audit provenance remain backend-owned.
- Explicit request Facility headers are preserved by the Contract client.
- Form guards repeated pending submissions and ignores stale completion after
  unmount or Facility change. Uncertain saves direct users to check the list.
- Amendment effective dates render in UTC to avoid prior-day local display.
- Vite development proxy supports a separate frontend preview using the existing
  APIs; no backend CORS policy change was made.

Verification: 437/437 frontend tests across 43 files PASS; 14 new focused cases.
TypeScript passed earlier with the established ignoreDeprecations 5.0 override.
Final Vite bundle and whitespace checks PASS; existing bundle-size warning remains.
Owner browser verification demonstrated Facility-specific creation and amendment
tracking against existing backends. Real Contract/amendment records were created
and lifecycle statuses changed by the owner; synthetic automated tests made no
operational writes. No backend code, schema, scheduler, or Docker change occurred.
Normal-runtime deployment remains outstanding.

Follow-up limitations: draft amendment editing is unavailable; date-only display
in other existing views was not comprehensively corrected. No approval of
pending commercial terms is implied by this feature verification.
