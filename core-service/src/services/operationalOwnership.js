const mongoose = require('mongoose');
const Facility = require('../models/Facility');
const Department = require('../models/Department');
const Asset = require('../models/Asset');
const User = require('../models/User');
const Template = require('../models/EquipmentTemplate');
const Procedure = require('../models/Procedure');
const { normalizedFacilityClaims } = require('../middleware/crmFacilityScope');
const { buildTenantFilter } = require('../middleware/tenantScope');

class OwnershipError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new OwnershipError(status, message); };
function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail(400, 'Invalid reference');
  return value;
}
function object(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request body');
  for (const [key, value] of Object.entries(body)) {
    if (key.includes('.') || key.startsWith('$') || ['__proto__', 'constructor', 'prototype'].includes(key)) fail(400, 'Invalid request field');
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) { for (const item of value) if (item && typeof item === 'object') object(item); }
      else object(value);
    }
  }
  return body;
}
function pick(body, fields, strict = false) {
  object(body);
  if (strict && Object.keys(body).some(key => !fields.includes(key))) fail(400, 'Field is not editable');
  return Object.fromEntries(fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
}
async function selectedFacility(req, session = null) {
  const selected = String(req.headers['x-facility-id'] || '').trim();
  if (!selected) fail(400, 'x-facility-id header is required');
  id(selected);
  if (req.user.role !== 'admin' && !normalizedFacilityClaims(req.user).has(selected)) fail(403, 'Forbidden');
  const facility = await Facility.findById(selected).select('_id').session(session).lean();
  if (!facility) fail(404, 'Facility not found');
  return facility._id;
}
function agreeFacility(body, facilityId) {
  if (Object.hasOwn(body, 'facilityId') && String(body.facilityId) !== String(facilityId)) fail(400, 'Conflicting Facility');
}
function visibility(req) {
  const selected = String(req.headers['x-facility-id'] || '').trim();
  if (selected) {
    id(selected);
    if (req.user.role !== 'admin' && !(req.user.facilities || []).some(f => String(f?._id || f) === selected)) fail(403, 'Forbidden');
  } else if (req.user.role !== 'admin') id(req.user.facilityId);
  return buildTenantFilter(req);
}
async function reference(Model, value, filter = {}, session = null) {
  id(value);
  const query = Model.findOne({ _id: value, ...filter });
  if (session) query.session(session);
  const doc = await query;
  if (!doc) fail(404, 'Reference not found');
  return doc;
}
async function assignee(value, facilityId, session = null) {
  const user = await reference(User, value, {}, session);
  if (!['admin', 'technician'].includes(user.role) || !normalizedFacilityClaims(user).has(String(facilityId))) fail(404, 'Reference not found');
  return user._id;
}
async function defaultAssignee(value, facilityId) {
  id(value);
  const user = await User.findById(value);
  return user && ['admin', 'technician'].includes(user.role) && normalizedFacilityClaims(user).has(String(facilityId))
    ? user._id : undefined;
}
async function department(value, facilityId, session = null) {
  if (value === null || value === '') return null;
  return (await reference(Department, value, { facilityId }, session))._id;
}
const assetCreateFields = ['templateId','ctrlNumber','departmentId','locationNote','notes','manufacturer','model','description','serialNumber','parentAsset','relationToParent','maintenanceSchedule','attributes'];
const assetEditFields = [...assetCreateFields, 'revisionNumber','status','purchase','acquisitionDate','installationDate','retirementDate','purchaseDate','purchaseCost','budgetValue','contractValue','manufacturerRecommendedPMFrequency','equipmentClass','classificationName','regulationNumber','panel','recordStatus','prescriptionRequired','otc','submissionNumber','manufacturerDUNS','gmdnDefinition','riskLevel','isHIPAARelevant','isAlarmed','isSecuritySensitive','isAEMExcluded','documents','images'];
async function assetReferences(payload, facilityId, ownId = null) {
  if (Object.hasOwn(payload, 'departmentId')) payload.departmentId = await department(payload.departmentId, facilityId);
  if (payload.templateId) payload.templateId = (await reference(Template, payload.templateId))._id;
  if (payload.parentAsset) {
    if (String(payload.parentAsset) === String(ownId)) fail(400, 'Invalid parent relationship');
    await reference(Asset, payload.parentAsset, { facilityId });
  }
  if (payload.maintenanceSchedule != null) {
    payload.maintenanceSchedule = pick(payload.maintenanceSchedule, ['frequency','intervalMonths','nextMaintenance','lastMaintenance','procedure'], true);
    if (payload.maintenanceSchedule.procedure) await reference(Procedure, payload.maintenanceSchedule.procedure);
    else if (payload.maintenanceSchedule.procedure === '') payload.maintenanceSchedule.procedure = null;
  }
  if (payload.purchase != null) payload.purchase = pick(payload.purchase, ['price','date','expectedLifeYears','salvageValue'], true);
}
function respond(res, error) {
  if (error instanceof OwnershipError) return res.status(error.status).json({ error: error.message });
  if (['CastError','ValidationError','StrictModeError'].includes(error.name)) return res.status(400).json({ error: 'Invalid input' });
  if (error.name === 'VersionError') return res.status(409).json({ error: 'Record changed; retry' });
  if (error.code === 11000) return res.status(409).json({ error: 'Duplicate value' });
  return res.status(500).json({ error: 'Internal Server Error' });
}
module.exports = { OwnershipError, fail, id, object, pick, selectedFacility, agreeFacility, visibility, reference, assignee, defaultAssignee, department, assetCreateFields, assetEditFields, assetReferences, respond };
