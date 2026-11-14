# Inventory import Increment 1B: offline preview

This increment reads an existing TruAsset XLSX export and returns a validation
report. It does not create or update assets. No endpoint, database, application
startup, template lookup, department lookup, deployment, or scheduled job is involved.

From `core-service`:

```sh
node scripts/previewInventory.cjs /path/to/export.xlsx
node scripts/previewInventory.cjs /path/to/export.xlsx "Filtered Assets List"
node --test src/services/_tests_/inventoryImport.test.cjs
```

The preview is printed to stdout and contains source data; choose its destination
deliberately. Exit codes: 0 means no validation errors, 1 means validation errors,
2 means usage, file, or workbook-reading failure. Warnings alone do not fail validation.
The API is `parseExcel(buffer, { sheetName })`; `parseWorkbook` supports an already
decoded SheetJS workbook using raw numeric dates (`cellDates: false`). Existing
locked `xlsx` dependencies are reused without dependency or lockfile changes.

## Preservation and validation

- The first used row is the header row. Select a worksheet explicitly when more
  than one exists. Required headers and row values are Tag #, Manufacturer, Model.
- Each record includes its original worksheet row and a source entry per column,
  including unmapped columns and blanks. Source values, cell types, number formats,
  and formulas are retained separately from proposed fields.
- Text identifiers preserve leading zeros and long digit strings. Numeric identifier
  cells are flagged as errors because original zeros and precision cannot be proven.
- Model and Model Number remain distinct. Neither is silently combined or replaced.
- Excel 1900 and 1904 whole-day dates become ISO calendar dates, without local
  timezone conversion. Excel serial 60 in the 1900 system, fractional days,
  ambiguous text dates, and impossible dates fail validation. Original serials remain
  available in source. Acquisition dates are not installation dates.
- Reported purchase cost stays separate from the unset verified purchase price.
  Zero costs receive warnings; negative or nonnumeric costs fail validation.
- Missing templates are allowed and represented by `templateId: null` with a warning.
  Department names and parent tags are retained as source references, never IDs.
  Risk and maintenance strings remain source classifications, not inferred policies.
- Duplicate trimmed tags within the workbook fail validation. Repeated manufacturer
  and serial pairs receive review warnings. Existing operational assets are never queried.
- Formula cells (including cached results) and Excel error cells fail validation.
  Blank rows are skipped. Unknown statuses require later mapping.

`valid` means offline validation passed; it does not establish import readiness.
The `asset` object is a preview DTO, **not** an API creation payload. Current
`operationalOwnership.js` creation rules do not accept all lifecycle fields.
No creation allowlists, schemas, or ownership rules were changed.

## Verification and remaining work

Ten synthetic tests cover XLSX decoding, immutability, identifiers, separate models,
both date epochs, invalid dates, costs, required fields, duplicates, formulas/errors,
unknown columns/statuses, worksheet selection, and preview limits. The supplied
export was separately read without embedding customer records in tests or this file:
three records, 21 columns, no validation errors, nine review warnings. Its source
file hash remained unchanged. The general application/database suite was not run;
this module has no application integration and tests use no persistence.

The CLI accepts trusted local exports, capped at 20 MiB and a used worksheet range
ending within 100000 rows and 256 columns. These checks are not a hardened public
upload boundary: archive expansion/resource isolation and reader security review
remain necessary before accepting untrusted uploads.

Next: review field/status mappings and model proposals; design explicit facility
context, department/parent resolution, existing-asset duplicate checks, and optional
template matching. A later authorized increment can build an import plan and reuse
operational ownership rules. No persistence or deployment is authorized here.
