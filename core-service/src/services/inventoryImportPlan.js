// Pure snapshot planning. This module never loads models, reads files, or writes data.
const { isArchived } = require('./templateArchiveState');
const text = value => typeof value === 'string' ? value.trim() : '';
const normalized = value => text(value).replace(/\s+/g, ' ').toLowerCase();
const id = value => typeof value === 'string' && /^[a-f\d]{24}$/.test(value);

function matchingModelLabel(asset) {
  const model = text(asset.model);
  const number = text(asset.modelNumber);
  if (!number || normalized(model) === normalized(number)) return model || number;
  if (normalized(number).startsWith(normalized(model))) return number;
  return `${model} ${number}`.trim();
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Expected a snapshot object.');
  if (!text(snapshot.id) || !/^\d{4}-\d{2}-\d{2}T/.test(snapshot.capturedAt || '') || !Number.isFinite(Date.parse(snapshot.capturedAt))) throw new Error('Snapshot id and ISO capturedAt are required.');
  // A facility-only asset list cannot establish globally unique control numbers.
  if (snapshot.assetsScope !== 'global') throw new Error('Snapshot assetsScope must be global; a facility-only list cannot clear duplicate tags.');
  for (const collection of ['assets', 'departments', 'templates']) {
    if (!Array.isArray(snapshot[collection])) throw new Error(`Snapshot ${collection} must be an explicit array (empty is allowed).`);
    const seen = new Set();
    for (const record of snapshot[collection]) {
      if (!record || !id(record._id) || seen.has(record._id)) throw new Error(`Invalid or repeated id in snapshot ${collection}.`);
      seen.add(record._id);
      if (collection !== 'templates' && !id(record.facilityId)) throw new Error(`Snapshot ${collection} requires facilityId.`);
      const required = collection === 'assets' ? ['ctrlNumber', 'manufacturer'] : collection === 'departments' ? ['name'] : ['manufacturer', 'model'];
      if (required.some(key => !text(record[key]))) throw new Error(`Snapshot ${collection} is missing required text fields.`);
      for (const key of ['serialNumber', 'di']) if (record[key] != null && typeof record[key] !== 'string') throw new Error(`Snapshot ${key} must be text.`);
    }
  }
}

function buildImportPlan(report, { facilityId, snapshot = null, departmentMappings = [] } = {}) {
  if (!id(facilityId)) throw new Error('An explicit facilityId (24 lowercase hex characters) is required.');
  if (!Array.isArray(departmentMappings)) throw new Error('departmentMappings must be an array.');
  const departmentNames = new Map();
  for (const mapping of departmentMappings) {
    if (!mapping || mapping.facilityId !== facilityId || !text(mapping.sourceName) || !text(mapping.targetName)) throw new Error('Department mappings require the selected facilityId and nonempty sourceName/targetName.');
    const key = normalized(mapping.sourceName);
    if (departmentNames.has(key)) throw new Error('Duplicate source department mapping.');
    departmentNames.set(key, text(mapping.targetName));
  }
  if (!report || !Array.isArray(report.rows) || !Array.isArray(report.issues) || typeof report.valid !== 'boolean') throw new Error('Expected an inventory parser report.');
  if (snapshot !== null) validateSnapshot(snapshot);
  const issues = structuredClone(report.issues);
  const add = (severity, code, row, message) => issues.push({ severity, code, row, message });
  if (!snapshot) add('review', 'SNAPSHOT_REQUIRED', null, 'Reference and existing-asset checks have not run; supply an authorized snapshot.');
  if (!report.valid || issues.some(i => i.severity === 'error')) add('error', 'SOURCE_VALIDATION_FAILED', null, 'Source validation errors must be corrected before proposing this batch.');
  const input = structuredClone(report.rows);
  if (!input.length) add('error', 'NO_ASSETS', null, 'No assets to plan.');
  const localDepartments = snapshot?.departments.filter(d => d.facilityId === facilityId) || [];
  const localAssets = snapshot?.assets.filter(a => a.facilityId === facilityId) || [];
  const templates = snapshot?.templates.filter(t => !isArchived(t)) || [];
  const departmentProposals = new Map();
  const plans = input.map(record => {
    const a = record.asset;
    if (!a || !Number.isInteger(record.row)) throw new Error('Malformed parser row.');
    const label = matchingModelLabel(a);
    const proposed = { ...a, facilityId, templateId: null, verifiedPurchasePrice: null };
    const sourceDepartmentName = a.departmentName ?? null;
    const mappedDepartment = departmentNames.get(normalized(a.departmentName));
    if (mappedDepartment) proposed.departmentName = mappedDepartment;
    // Never trust pre-resolved references in a hand-edited preview report.
    delete proposed.departmentId;
    delete proposed.parentAsset;
    const resolution = { department: 'not-supplied', parent: 'not-supplied', template: 'not-checked', duplicateCheck: 'not-checked' };
    for (const field of ['ctrlNumber', 'manufacturer', 'model']) if (!text(a[field])) add('error', 'REQUIRED_VALUE', record.row, `Required value: ${field}`);
    if (a.status && !['Active', 'Inactive', 'Pending', 'Retired'].includes(a.status)) add('review', 'STATUS_MAPPING_REQUIRED', record.row, 'Source status requires an explicit mapping.');
    if (snapshot) {
      // Replace deferred parser warnings only after the respective checks actually run.
      for (let i = issues.length - 1; i >= 0; i--) {
        if (issues[i].row === record.row && ['UNRESOLVED_DEPARTMENT', 'TEMPLATE_UNMATCHED'].includes(issues[i].code)) issues.splice(i, 1);
      }
      resolution.duplicateCheck = 'checked-against-snapshot';
      if (snapshot.assets.some(x => text(x.ctrlNumber) === text(a.ctrlNumber))) add('error', 'EXISTING_TAG', record.row, 'Asset tag already exists in the supplied global snapshot; creation is blocked.');
      const serial = normalized(a.serialNumber);
      if (serial) {
        const sameSerial = snapshot.assets.filter(x => normalized(x.serialNumber) === serial);
        if (sameSerial.some(x => normalized(x.manufacturer) === normalized(a.manufacturer))) add('review', 'EXISTING_MANUFACTURER_SERIAL', record.row, 'Manufacturer and serial match an existing asset; review required.');
        if (sameSerial.some(x => normalized(x.manufacturer) !== normalized(a.manufacturer))) add('warning', 'EXISTING_SERIAL_OTHER_MANUFACTURER', record.row, 'Serial matches an existing asset with a different manufacturer.');
      }
      if (text(a.departmentName)) {
        const candidates = localDepartments.filter(d => normalized(d.name) === normalized(proposed.departmentName));
        resolution.department = candidates.length === 1 ? 'matched' : candidates.length ? 'ambiguous' : 'unmatched';
        if (candidates.length === 1) proposed.departmentId = candidates[0]._id;
        else if (!candidates.length && mappedDepartment) {
          resolution.department = 'creation-proposed';
          const key = normalized(mappedDepartment);
          if (!departmentProposals.has(key)) departmentProposals.set(key, {
            facilityId, name: mappedDepartment, action: 'propose-create', status: 'pending', departmentId: null, sourceNames: [], rows: [],
          });
          const proposal = departmentProposals.get(key);
          if (!proposal.sourceNames.includes(sourceDepartmentName)) proposal.sourceNames.push(sourceDepartmentName);
          proposal.rows.push(record.row);
          add('review', 'DEPARTMENT_CREATION_PENDING', record.row, 'Approved department name is proposed for creation only; no department exists or ID has been assigned.');
        } else add('review', 'DEPARTMENT_REVIEW', record.row, 'Department requires a unique match within the selected facility; no department will be created automatically.');
      }
      if (text(a.parentAssetTag)) {
        const candidates = localAssets.filter(x => text(x.ctrlNumber) === text(a.parentAssetTag));
        if (text(a.parentAssetTag) === text(a.ctrlNumber)) {
          resolution.parent = 'invalid';
          add('error', 'SELF_PARENT', record.row, 'An asset cannot be its own parent.');
        } else if (candidates.length === 1) {
          resolution.parent = 'matched'; proposed.parentAsset = candidates[0]._id;
        } else {
          resolution.parent = candidates.length ? 'ambiguous' : 'unmatched';
          add('review', 'PARENT_REVIEW', record.row, 'Parent requires an existing unique asset in this facility; workbook parent relationships are deferred.');
        }
      }
      const nameMatches = templates.filter(t => normalized(t.manufacturer) === normalized(a.manufacturer) && normalized(t.model) === normalized(label));
      const diMatches = text(a.fdaDI) ? templates.filter(t => text(t.di) === text(a.fdaDI)) : [];
      const candidates = [...new Map([...diMatches, ...nameMatches].map(t => [t._id, t])).values()];
      const conflict = (diMatches.length && (candidates.length !== 1 || !nameMatches.some(t => t._id === diMatches[0]._id))) ||
        (text(a.fdaDI) && candidates.some(t => text(t.di) && text(t.di) !== text(a.fdaDI)));
      if (candidates.length === 1 && !conflict) {
        proposed.templateId = candidates[0]._id; resolution.template = 'matched';
      } else if (candidates.length) {
        resolution.template = 'review';
        add('review', 'TEMPLATE_REVIEW', record.row, 'Template evidence is ambiguous or DI and manufacturer/model disagree; keep template unset pending review.');
      } else {
        resolution.template = 'unmatched';
        add('warning', 'TEMPLATE_UNMATCHED', record.row, 'No active template matched in the snapshot; a template is optional.');
      }
    }
    return { row: record.row, source: record.source, sourceDepartmentName, matchingModelLabel: label, proposed, resolution };
  });
  // Independently flag workbook duplicates, even for manually constructed reports.
  const tags = new Set();
  const serials = new Map();
  for (const row of plans) {
    const tag = text(row.proposed.ctrlNumber);
    if (tags.has(tag)) add('error', 'DUPLICATE_PLAN_TAG', row.row, 'Asset tag repeats within this plan.');
    tags.add(tag);
    const serial = normalized(row.proposed.serialNumber);
    if (serial) {
      const previous = serials.get(serial) || [];
      if (previous.some(x => normalized(x.manufacturer) === normalized(row.proposed.manufacturer))) add('review', 'WORKBOOK_MANUFACTURER_SERIAL', row.row, 'Manufacturer and serial repeat within this workbook.');
      else if (previous.length) add('warning', 'WORKBOOK_SERIAL_OTHER_MANUFACTURER', row.row, 'Serial repeats in the workbook with a different manufacturer.');
      previous.push(row.proposed); serials.set(serial, previous);
    }
  }
  for (const row of plans) {
    const applicable = issues.filter(i => i.row == null || i.row === row.row);
    row.disposition = applicable.some(i => i.severity === 'error') ? 'blocked' : applicable.some(i => i.severity === 'review') ? 'review' : 'proposed-create';
  }
  return {
    kind: 'offline-inventory-plan', facilityId,
    snapshot: snapshot ? { id: snapshot.id, capturedAt: snapshot.capturedAt, assetsScope: snapshot.assetsScope } : null,
    readyToImport: false,
    scope: 'Snapshot-only proposals; facility authorization, fresh reference checks, ownership validation and persistence are not performed.',
    rows: plans, issues,
    departmentProposals: [...departmentProposals.values()],
    summary: { total: plans.length, ...Object.fromEntries(['blocked', 'review', 'proposed-create'].map(s => [s, plans.filter(r => r.disposition === s).length])) },
  };
}

module.exports = { matchingModelLabel, buildImportPlan };
