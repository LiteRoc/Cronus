// Offline preparation and injected orchestration only. No models or network clients.
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { buildImportPlan } = require('./inventoryImportPlan');
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/.test(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const createFields = ['ctrlNumber', 'manufacturer', 'model', 'description', 'serialNumber', 'departmentId', 'locationNote', 'notes', 'parentAsset', 'relationToParent'];
class AssetCreationError extends Error {}
function fail(message) { throw new AssetCreationError(message); }
function checkSafeKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key.includes('.') || key.startsWith('$') || ['__proto__', 'constructor', 'prototype'].includes(key)) fail('Source structure contains unsupported keys.');
    checkSafeKeys(child);
  }
}
function buildRow(row, facilityId, snapshot, sheetName) {
  const a = row.proposed;
  if (!a || row.disposition !== 'proposed-create' || a.facilityId !== facilityId || !Number.isInteger(row.row) || !Array.isArray(row.source) || !row.source.length) fail('Every asset must have a validated source row and proposed-create disposition.');
  if (!['ctrlNumber', 'manufacturer', 'model'].every(k => text(a[k]))) fail('Required asset identity fields are missing.');
  if (!validId(a.departmentId) || (a.templateId !== null && !validId(a.templateId))) fail('Resolved department and optional template IDs are required.');
  if (a.verifiedPurchasePrice != null || a.purchaseCost != null || a.purchase?.price != null) fail('Verified purchase costs must remain blank.');
  if (a.parentAssetTag && !validId(a.parentAsset)) fail('Parent reference requires review.');
  if (a.status && !['Active', 'Inactive', 'Pending', 'Retired'].includes(a.status)) fail('Status requires mapping.');
  const source = {
    schemaVersion: 1, sourceSystem: 'TruAsset', sheetName: sheetName ?? null,
    sourceRow: row.row, snapshot: structuredClone(snapshot),
    sourceDepartmentName: row.sourceDepartmentName ?? null,
    originalModel: a.model, originalModelNumber: a.modelNumber ?? null,
    matchingModelLabel: row.matchingModelLabel,
    reportedPurchaseCost: a.reportedPurchaseCost ?? null,
    verifiedPurchasePrice: null, cells: structuredClone(row.source),
  };
  checkSafeKeys(source);
  source.importKey = createHash('sha256').update(JSON.stringify({ facilityId, tag: a.ctrlNumber, cells: source.cells })).digest('hex');
  const body = Object.fromEntries(createFields.filter(k => a[k] !== undefined).map(k => [k, structuredClone(a[k])]));
  body.templateId = a.templateId;
  // Template-generated top-level attributes cannot overwrite this source namespace.
  body.attributes = { truAssetImport: source };
  // An explicit empty schedule avoids inventing PM timing from a template or source string.
  body.maintenanceSchedule = {};
  const followUp = {};
  if (a.acquisitionDate != null) {
    const date = a.acquisitionDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) fail('Acquisition date requires a valid calendar date.');
    followUp.acquisitionDate = date;
  }
  if (a.status) followUp.status = a.status;
  if (a.equipmentClass != null) followUp.equipmentClass = a.equipmentClass;
  return { row: row.row, ctrlNumber: a.ctrlNumber, create: body, followUp, sourceDepartmentName: row.sourceDepartmentName ?? null };
}

function prepareAssetCreation(importPlan) {
  if (!importPlan || importPlan.kind !== 'offline-inventory-plan' || !validId(importPlan.facilityId) || !importPlan.snapshot?.id || !Array.isArray(importPlan.rows) || !importPlan.rows.length || !Array.isArray(importPlan.issues)) fail('A snapshot-backed offline import plan is required.');
  if (importPlan.issues.some(i => ['error', 'review'].includes(i.severity)) || importPlan.departmentProposals?.length) fail('Resolve blocking issues and department proposals before preparing asset creation.');
  const items = importPlan.rows.map(row => buildRow(row, importPlan.facilityId, importPlan.snapshot, importPlan.sheetName));
  if (new Set(items.map(item => text(item.ctrlNumber))).size !== items.length) fail('Duplicate tags in the asset plan.');
  // Revalidate identities/references against a fresh supplied snapshot before any future writes.
  const validationReport = {
    valid: true, issues: structuredClone(importPlan.issues),
    rows: importPlan.rows.map(row => ({ row: row.row, source: structuredClone(row.source), asset: structuredClone(row.proposed) })),
  };
  return {
    kind: 'asset-creation-plan', facilityId: importPlan.facilityId,
    snapshot: structuredClone(importPlan.snapshot), sheetName: importPlan.sheetName ?? null, status: 'prepared-not-executed',
    verifiedCostsPolicy: 'leave-unset', items, validationReport,
  };
}

function assertPrepared(plan) {
  if (!plan || plan.kind !== 'asset-creation-plan' || !validId(plan.facilityId) || !Array.isArray(plan.items) || !plan.items.length || !plan.validationReport) fail('Invalid asset creation plan.');
  // Regenerate allowed payloads instead of trusting edits to an executable plan.
  const rebuilt = prepareAssetCreation({ kind: 'offline-inventory-plan', facilityId: plan.facilityId, snapshot: plan.snapshot, sheetName: plan.sheetName, issues: plan.validationReport.issues, rows: plan.validationReport.rows.map(r => ({ row: r.row, source: r.source, sourceDepartmentName: plan.items.find(i => i.row === r.row)?.sourceDepartmentName, matchingModelLabel: plan.items.find(i => i.row === r.row)?.create.attributes.truAssetImport.matchingModelLabel, proposed: r.asset, disposition: 'proposed-create' })) });
  if (!isDeepStrictEqual(plan.items, rebuilt.items)) fail('Prepared payloads were changed; regenerate the plan.');
}

function verifyPreflight(plan, snapshot) {
  const fresh = buildImportPlan(plan.validationReport, { facilityId: plan.facilityId, snapshot });
  if (!snapshot || fresh.rows.length !== plan.items.length || fresh.rows.some(r => r.disposition !== 'proposed-create')) fail('Fresh reference checks require review; no creation requests were sent.');
  for (const row of fresh.rows) {
    const item = plan.items.find(i => i.row === row.row);
    if (!item || row.proposed.departmentId !== item.create.departmentId || row.proposed.templateId !== item.create.templateId) fail('A department or template match changed; regenerate the plan before creation.');
  }
}
function checkAsset(asset, item, facilityId, final = false, expectedAssetId = null) {
  const refId = ref => ref && typeof ref === 'object' ? ref._id : ref;
  if (!asset || !validId(asset._id) || refId(asset.facilityId) !== facilityId || asset.ctrlNumber !== text(item.ctrlNumber) || refId(asset.departmentId) !== item.create.departmentId || (refId(asset.templateId) ?? null) !== item.create.templateId) fail('Asset identity or reference response requires reconciliation.');
  if (expectedAssetId !== null && asset._id !== expectedAssetId) fail('Returned asset ID differs from the created asset; reconciliation is required.');
  for (const key of ['manufacturer', 'model', 'serialNumber', 'locationNote']) {
    if (item.create[key] != null && asset[key] !== text(item.create[key])) fail('Asset text response requires reconciliation.');
  }
  for (const key of ['description', 'notes']) if (item.create[key] != null && asset[key] !== item.create[key]) fail('Asset source text requires reconciliation.');
  if (!isDeepStrictEqual(asset.attributes?.truAssetImport, item.create.attributes.truAssetImport)) fail('Original source data was not preserved.');
  if (asset.purchaseCost != null || asset.purchase?.price != null) fail('Verified cost was unexpectedly populated.');
  if (asset.installationDate != null || asset.serviceStartDate != null) fail('An unexpected installation or service-start date requires review.');
  if (Object.values(asset.maintenanceSchedule || {}).some(value => value != null)) fail('An inferred maintenance schedule requires review.');
  if (asset.duplicateOf) fail('The creation API reported a possible duplicate.');
  if (final) for (const [key, value] of Object.entries(item.followUp)) {
    const actual = key === 'acquisitionDate' && typeof asset[key] === 'string' ? asset[key].slice(0, 10) : asset[key];
    if (actual !== value) fail('Follow-up field response requires reconciliation.');
  }
}

async function runAssetCreation(plan, { execute = false, confirmFacilityId, api } = {}) {
  assertPrepared(plan);
  const requests = plan.items.map(item => ({
    row: item.row, ctrlNumber: item.ctrlNumber,
    create: { method: 'POST', path: '/assets', headers: { 'x-facility-id': plan.facilityId }, body: structuredClone(item.create) },
    followUp: { method: 'PUT', path: '/assets/<returned-asset-id>', body: structuredClone(item.followUp), headers: { 'x-facility-id': plan.facilityId } },
    readBack: { method: 'GET', path: '/assets/<returned-asset-id>', headers: { 'x-facility-id': plan.facilityId } },
  }));
  if (!execute) return { status: 'preview', executed: false, requests, results: [] };
  if (execute !== true || confirmFacilityId !== plan.facilityId || !api || !['getReferenceSnapshot', 'createAsset', 'updateAsset', 'getAsset'].every(k => typeof api[k] === 'function')) fail('Execution requires explicit facility confirmation and a complete authenticated API adapter.');
  let snapshot;
  try { snapshot = await api.getReferenceSnapshot(); }
  catch { fail('Reference preflight failed; no creation requests were sent.'); }
  verifyPreflight(plan, snapshot);
  const results = [];
  for (const item of plan.items) {
    let assetId = null, stage = 'create';
    try {
      const created = await api.createAsset(plan.facilityId, structuredClone(item.create));
      const asset = created?.asset;
      if (asset?.facilityId === plan.facilityId && asset.ctrlNumber === text(item.ctrlNumber) && validId(asset._id)) assetId = asset._id;
      if (created?.warning || created?.duplicateOf) fail('Duplicate response requires review.');
      checkAsset(asset, item, plan.facilityId);
      stage = 'follow-up';
      if (Object.keys(item.followUp).length) {
        const updated = await api.updateAsset(plan.facilityId, assetId, structuredClone(item.followUp));
        checkAsset(updated?.asset, item, plan.facilityId, true, assetId);
      }
      stage = 'read-back';
      const saved = await api.getAsset(plan.facilityId, assetId);
      checkAsset(saved?.asset ?? saved, item, plan.facilityId, true, assetId);
      results.push({ ctrlNumber: item.ctrlNumber, assetId, status: 'completed' });
    } catch {
      // Any write/response can be uncertain. Never retry, delete, or continue the batch.
      results.push({ ctrlNumber: item.ctrlNumber, assetId, status: 'reconciliation-required', stage });
      for (const remaining of plan.items.slice(results.length)) results.push({ ctrlNumber: remaining.ctrlNumber, assetId: null, status: 'not-attempted' });
      return { status: 'reconciliation-required', executed: true, results };
    }
  }
  return { status: 'completed', executed: true, results };
}

module.exports = { prepareAssetCreation, runAssetCreation, AssetCreationError };
