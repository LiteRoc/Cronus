const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const Template = require('../models/EquipmentTemplate');
const ownership = require('./operationalOwnership');

// Shared catalog; these predicates must never include Facility ownership.
const { activeFilter, isArchived } = require('./templateArchiveState');
const writableFilter = value => ({ _id: value, ...activeFilter(), templateReferenceReservation: null });

const providerFields = ['manufacturer', 'model', 'description', 'equipmentClass', 'di',
  'fdaProductCode', 'gmdnTerm', 'gmdnDefinition', 'brandName', 'catalogNumber', 'versionOrModel',
  'mrSafetyStatus', 'issuingAgency', 'classificationName', 'regulationNumber', 'panel',
  'recordStatus', 'prescriptionRequired', 'otc', 'submissionNumber', 'manufacturerDUNS'];
const businessFields = [...providerFields, 'alarm', 'hipaa', 'autoAddPmProcedure', 'requirePmPlan',
  'excludeFromLifecycle', 'excludeFromAEM', 'manufacturerRecommendedPMFrequency', 'isTestEquipment',
  'eolYears', 'lineItemPricing', 'lifecycleDefaults', 'benchmark', 'kind', 'subType'];
const nestedFields = {
  lifecycleDefaults: ['expectedLifeYears', 'typicalAnnualMaintenance'],
  benchmark: ['source', 'reportDate', 'expectedUsefulLifeYears', 'averageListPrice', 'averageQuotedPrice',
    'expectedAnnualMaintenance', 'expectedCapitalCostRatio', 'marketInterest', 'confidence', 'notes'],
};
function fields(body) {
  const result = ownership.pick(body, businessFields, true);
  for (const [key, allowed] of Object.entries(nestedFields)) {
    if (Object.hasOwn(result, key) && result[key] !== null) result[key] = ownership.pick(result[key], allowed, true);
  }
  if (typeof result.di === 'string') {
    result.di = result.di.trim();
    if (!result.di) delete result.di; // Do not introduce a unique empty identifier.
  }
  return result;
}
async function active(value) {
  const record = await Template.findById(ownership.id(String(value)));
  if (!record) ownership.fail(404, 'Template not found');
  if (isArchived(record)) ownership.fail(409, 'Template is archived');
  return record;
}
async function conflict(value) {
  await active(value);
  ownership.fail(409, 'Template is reserved or changed; retry');
}
const durable = { writeConcern: { w: 1, j: true } };

// Serializes each new reference with archive on standalone MongoDB. There is no
// lease, automatic retry, public release, or replayable callback. Only a known
// completed write (or a definitive no-write failure) permits exact-token release.
// An interrupted/uncertain writer leaves the reservation for explicit recovery.
async function withReference(value, operation, destinationId, write) {
  if (!value) return write();
  ownership.id(String(value));
  const token = randomUUID();
  const reserved = await Template.findOneAndUpdate(writableFilter(value), {
    $set: { templateReferenceReservation: { token, acquiredAt: new Date(), operation, destinationId } },
  }, { new: true, runValidators: true, timestamps: false, ...durable });
  if (!reserved) return conflict(value);
  const release = async () => {
    const result = await Template.updateOne({ _id: value, 'templateReferenceReservation.token': token },
      { $unset: { templateReferenceReservation: 1 } }, { timestamps: false, ...durable });
    if (result.matchedCount !== 1) ownership.fail(409, 'Template reservation changed');
  };
  let result;
  try { result = await write(); }
  catch (error) {
    if (error.templateNotWritten || ['ValidationError', 'CastError', 'StrictModeError', 'DocumentNotFoundError'].includes(error.name) || error.code === 11000) {
      await release();
    }
    throw error;
  }
  await release();
  return result;
}

async function duplicate(fields, ownId) {
  const alternatives = [];
  if (fields.di) alternatives.push({ di: fields.di });
  if (fields.manufacturer && fields.model) alternatives.push({ manufacturer: fields.manufacturer, model: fields.model });
  if (!alternatives.length) return null;
  return Template.findOne({ ...activeFilter(), ...(ownId ? { _id: { $ne: ownId } } : {}), $or: alternatives }).select('_id');
}
async function create(input, actor, provider = false) {
  const d = new Template({ ...input, status: 'Active', createdBy: actor, updatedBy: actor,
    ...(provider ? verification(actor) : {}) });
  const match = await duplicate(input);
  d.duplicateOf = match?._id || null;
  await d.validate();
  return withReference(match?._id, 'template-duplicate', d._id, () => d.save(durable));
}
function verification(actor) {
  // Actor records who requested the server/provider verification, not an FDA user.
  return { verified: true, verifiedAt: new Date(), verifiedBy: actor, verificationSource: 'AccessGUDID' };
}
async function update(value, input, actor, provider = false) {
  const before = await active(value);
  const draft = new Template(before.toObject());
  draft.set(input);
  await draft.validate();
  const changes = { ...input, updatedBy: actor };
  if (provider) Object.assign(changes, verification(actor));
  else if (providerFields.some(key => Object.hasOwn(input, key) && !isDeepStrictEqual(before.get(key), draft.get(key)))) {
    // An ordinary edit cannot inherit verification for changed provider data.
    Object.assign(changes, { verified: false, verifiedAt: null, verifiedBy: null, verificationSource: null });
  }
  const match = provider ? await duplicate({ ...before.toObject(), ...input }, before._id) : null;
  const newDuplicate = match && String(match._id) !== String(before.duplicateOf);
  if (provider) changes.duplicateOf = match?._id || before.duplicateOf || null;
  const write = async () => {
    // Version CAS prevents stale provider/ordinary edits from restoring a
    // reference removed by another request, even if it looked historical above.
    const result = await Template.findOneAndUpdate({ ...writableFilter(value), __v: before.__v ?? null },
      { $set: changes, $inc: { __v: 1 } }, { new: true, runValidators: true, ...durable });
    if (!result) {
      const error = new ownership.OwnershipError(409, 'Template changed or is archived; retry');
      error.templateNotWritten = true;
      throw error;
    }
    return result;
  };
  return withReference(newDuplicate ? match._id : null, 'template-duplicate', before._id, write);
}
async function upsertProvider(input, actor) {
  // Search by DI without an active filter so an archived DI is never recreated.
  const existing = await Template.findOne({ di: input.di });
  if (existing) return update(existing.id, input, actor, true);
  return create(input, actor, true);
}
async function archive(value, actor) {
  ownership.id(value);
  const result = await Template.findOneAndUpdate(writableFilter(value), {
    $set: { status: 'Archived', deletedAt: new Date(), deletedBy: actor, updatedBy: actor }, $inc: { __v: 1 },
  }, { new: true, runValidators: true, ...durable });
  if (result) return result;
  const existing = await Template.findById(value);
  if (!existing) ownership.fail(404, 'Template not found');
  if (isArchived(existing)) return existing; // Never invent or overwrite legacy provenance.
  ownership.fail(409, 'Template reference is reserved; archive blocked');
}

module.exports = { activeFilter, isArchived, fields, providerFields, active, withReference,
  create, update, upsertProvider, archive };
