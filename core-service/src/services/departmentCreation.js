// No app, models, network, or database configuration is loaded by this module.
const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
class DepartmentCreationError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function checkedName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || /[\x00-\x1f\x7f]/.test(name)) throw new DepartmentCreationError(400, 'Department name must be 1–120 characters without control characters.');
  return name.trim();
}
function checkedDepartments(records, facilityId) {
  if (!Array.isArray(records) || records.some(d => !d || !validId(String(d._id)) || String(d.facilityId) !== facilityId || typeof d.name !== 'string' || !d.name.trim())) throw new DepartmentCreationError(409, 'Department response requires reconciliation.');
  return records;
}

// Called by the authenticated route only. No index/schema changes are introduced.
async function createOrReuseDepartment(Department, facilityId, value) {
  if (!validId(String(facilityId))) throw new DepartmentCreationError(400, 'Invalid facility.');
  const name = checkedName(value);
  const records = await Department.find({ facilityId }).select('_id facilityId name').lean();
  const candidates = checkedDepartments(records, String(facilityId)).filter(d => normalize(d.name) === normalize(name));
  if (candidates.length > 1) throw new DepartmentCreationError(409, 'Multiple departments have this name; review is required.');
  if (candidates.length === 1) return { created: false, department: candidates[0] };
  const created = await Department.create({ facilityId, name });
  return { created: true, department: { _id: created._id, facilityId: created.facilityId, name: created.name } };
}

function prepareDepartmentCreation(importPlan) {
  if (!importPlan || importPlan.kind !== 'offline-inventory-plan' || !validId(importPlan.facilityId) || !Array.isArray(importPlan.departmentProposals) || !importPlan.departmentProposals.length) throw new DepartmentCreationError(400, 'An offline plan with department proposals is required.');
  const seen = new Set();
  const departments = importPlan.departmentProposals.map(proposal => {
    if (proposal.facilityId !== importPlan.facilityId || proposal.action !== 'propose-create' || proposal.status !== 'pending' || proposal.departmentId !== null) throw new DepartmentCreationError(400, 'Invalid or conflicting department proposal.');
    const name = checkedName(proposal.name);
    if (seen.has(normalize(name))) throw new DepartmentCreationError(400, 'Duplicate proposed department name.');
    seen.add(normalize(name));
    return { name, sourceNames: structuredClone(proposal.sourceNames || []), rows: structuredClone(proposal.rows || []) };
  });
  return { kind: 'department-creation-plan', facilityId: importPlan.facilityId, snapshot: structuredClone(importPlan.snapshot), status: 'prepared-not-executed', departments };
}

async function runDepartmentCreation(plan, { execute = false, confirmFacilityId, api } = {}) {
  if (!plan || plan.kind !== 'department-creation-plan' || !validId(plan.facilityId) || !Array.isArray(plan.departments) || !plan.departments.length) throw new DepartmentCreationError(400, 'Invalid department creation plan.');
  const names = plan.departments.map(d => checkedName(d.name));
  if (new Set(names.map(normalize)).size !== names.length) throw new DepartmentCreationError(400, 'Duplicate proposed department name.');
  const requests = names.map(name => ({ method: 'POST', path: '/departments', headers: { 'x-facility-id': plan.facilityId }, body: { name } }));
  // Preview is safe by default: even a supplied API adapter is never touched.
  if (!execute) return { status: 'preview', facilityId: plan.facilityId, requests, results: [], executed: false };
  if (execute !== true || confirmFacilityId !== plan.facilityId || !api || typeof api.listDepartments !== 'function' || typeof api.createDepartment !== 'function') throw new DepartmentCreationError(400, 'Execution requires an API adapter and explicit matching facility confirmation.');
  // Preflight every name before any create, so an ambiguous match makes no writes.
  let listed;
  try { listed = await api.listDepartments(plan.facilityId); }
  catch { throw new DepartmentCreationError(409, 'Unable to complete preflight; no creation requests were sent.'); }
  const existing = checkedDepartments(listed, plan.facilityId);
  const matches = names.map(name => existing.filter(d => normalize(d.name) === normalize(name)));
  if (matches.some(found => found.length > 1)) throw new DepartmentCreationError(409, 'Ambiguous existing departments; no creation requests were sent.');
  const results = [];
  for (let i = 0; i < names.length; i++) {
    if (matches[i].length === 1) {
      results.push({ name: names[i], status: 'reused', departmentId: String(matches[i][0]._id) });
      continue;
    }
    try {
      const response = await api.createDepartment(plan.facilityId, { name: names[i] });
      const department = response?.department;
      checkedDepartments([department], plan.facilityId);
      if (normalize(department.name) !== normalize(names[i]) || typeof response.created !== 'boolean') throw new DepartmentCreationError(409, 'Unexpected creation response.');
      results.push({ name: names[i], status: response.created ? 'created' : 'reused', departmentId: String(department._id) });
    } catch {
      // A timeout can occur after a write. Never retry or roll back automatically.
      results.push({ name: names[i], status: 'reconciliation-required', departmentId: null });
      for (const name of names.slice(i + 1)) results.push({ name, status: 'not-attempted', departmentId: null });
      return { status: 'reconciliation-required', executed: true, facilityId: plan.facilityId, results };
    }
  }
  return { status: 'completed', executed: true, facilityId: plan.facilityId, results };
}

module.exports = { DepartmentCreationError, createOrReuseDepartment, prepareDepartmentCreation, runDepartmentCreation };
