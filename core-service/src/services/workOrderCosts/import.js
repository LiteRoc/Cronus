const mongoose = require('mongoose');
const WorkOrder = require('../../models/WorkOrder');
const Asset = require('../../models/Asset');
const context = require('./context');
const engine = require('./calculate');
const rates = require('../internalCostRates');
const {
  labor,
  envelope,
  error
} = require('./mutate');
function documented(value, evidence, actor) {
  const valid = engine.finite(value) && typeof evidence?.reference === 'string' && evidence.reference.trim() && (value !== 0 || evidence.knownZero === true);
  return {
    value: valid ? value : null,
    pricing: envelope(actor, valid ? {
      basis: 'documented',
      sourceKind: 'historical_document',
      sourceId: evidence.reference,
      evidenceRef: evidence.reference,
      zeroEvidence: value === 0
    } : {
      basis: 'unknown',
      sourceKind: 'historical_document',
      unknownReason: 'historical_authority_missing',
      reportedValue: typeof value === 'number' && Number.isFinite(value) ? value : null
    })
  };
}
async function prepare(payload, source, actor) {
  if (actor?.role !== 'admin') throw error(403, 'Admin import approval required');
  if ([source?.currency,payload?.currency,payload?.vendorService?.currency,...(payload?.partsUsed||[]).map(p=>p.currency)].some(currency=>currency!=null && currency!=='USD')) throw error(400,'Unsupported currency; no implicit conversion');
  if (!source?.system || !source.recordId || !source.documentRef || !source.facilityId) throw error(400, 'Import provenance required');
  if (['costs', 'economics', 'importIdentity', 'importProvenance'].some(k => Object.hasOwn(payload, k))) throw error(400, 'Protected import fields');
  const asset = await Asset.findOne({
    _id: payload.assetId,
    facilityId: source.facilityId,
    deletedAt: null
  }).lean();
  if (!asset) throw error(404, 'Asset not found in import Facility');
  const data = {
    assetId: asset._id,
    facilityId: asset.facilityId,
    description: payload.description,
    status: payload.status || 'Completed',
    workOrderType: payload.workOrderType,
    requestDate: payload.requestDate,
    completionDate: payload.completionDate,
    createdFrom: 'api',
    createdBy: actor.id,
    updatedBy: actor.id
  };
  const entries = [];
  for (const item of payload.timeLogs || []) {
    if (!item.workDate) entries.push(await labor(data, {
      timeSpent: item.timeSpent,
      description: item.description,
      workDate: null
    }, actor));else entries.push(await labor(data, {
      timeSpent: item.timeSpent,
      description: item.description,
      workDate: rates.date(item.workDate)
    }, actor));
  }
  data.timeLogs = entries;
  entries.forEach((entry, index) => {
    entry.pricing.importSource = {
      system: source.system,
      recordId: source.recordId,
      rowId: payload.timeLogs[index].sourceRowId ?? index,
      documentRef: source.documentRef
    };
  });
  data.partsUsed = (payload.partsUsed || []).map(item => {
    if (!mongoose.isValidObjectId(item.partId) || !engine.finite(item.quantity) || item.quantity < 1) throw error(400, 'Invalid imported Part usage');
    const d = documented(item.unitCost, item.evidence, actor);
    return {
      _id: new mongoose.Types.ObjectId(),
      partId: item.partId,
      quantity: item.quantity,
      unitCost: d.value,
      extendedCost: d.value === null ? null : engine.amount(item.quantity, d.value),
      pricing: {
        ...d.pricing,
        importSource: {
          system: source.system,
          recordId: source.recordId,
          rowId: item.sourceRowId ?? null,
          documentRef: source.documentRef
        }
      },
      usedAt: item.usedAt || null,
      usedBy: actor.id,
      note: item.note || ''
    };
  });
  data.travelLogs = (payload.travelLogs || []).map(item => ({
    _id: new mongoose.Types.ObjectId(),
    userId: actor.id,
    travelTime: item.travelTime,
    workDate: item.workDate ? rates.date(item.workDate) : null,
    travelCost: null,
    pricing: {
      basis: 'unknown',
      unknownReason: 'travel_policy_unapproved'
    }
  }));
  if (payload.vendorService) {
    const v = payload.vendorService;
    data.vendorService = {
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      invoiceNumber: v.invoiceNumber,
      poNumber: v.poNumber,
      sourceDocument: v.sourceDocument || source.documentRef,
      laborHours: v.laborHours,
      travelHours: v.travelHours,
      breakdownComplete: v.breakdownComplete === true,
      pricing: {
        components: {}
      },
      attribution: {
        status: ['attributable', 'covered_elsewhere'].includes(v.attribution?.status) && v.attribution?.evidenceRef ? v.attribution.status : 'unresolved',
        evidenceRef: v.attribution?.evidenceRef,
        knownZero: v.attribution?.knownZero === true,
        recordedBy: actor.id,
        recordedAt: new Date()
      }
    };
    for (const key of ['laborCost', 'travelCost', 'partsCost', 'shippingCost', 'totalCost']) {
      const d = documented(v[key], v.evidence?.[key], actor);
      data.vendorService[key] = d.value;
      if (key === 'totalCost') data.vendorService.pricing.total = d.pricing;else data.vendorService.pricing.components[key] = d.pricing;
    }
  }
  const doc = new WorkOrder(data);
  const scopesDeclared = ['labor', 'travel', 'parts', 'vendor'].every(k => source.completeScopes?.includes(k));
  doc.economics = {
    schemaVersion: 1,
    revision: 1,
    origin: scopesDeclared ? 'import' : 'legacy_mixed',
    changedAt: new Date(),
    changedBy: actor.id,
    unresolvedLegacyComponents: scopesDeclared ? [] : ['import_scope_not_asserted']
  };
  doc.importIdentity = JSON.stringify([source.system, source.recordId]);
  doc.importProvenance = {
    ...source,
    importedAt: new Date(),
    importedBy: actor.id,
    payloadHash: require('crypto').createHash('sha256').update(JSON.stringify(engine.stable({
      payload,
      source
    }))).digest('hex')
  };
  doc.costs = engine.calculate(doc.toObject());
  await context.run(() => doc.validate());
  return doc;
}
async function importWorkOrder(payload, source, actor) {
  const doc = await prepare(payload, source, actor);
  const existing = await WorkOrder.findOne({
    facilityId: doc.facilityId,
    importIdentity: doc.importIdentity
  }).lean();
  if (existing) {
    if (existing.importProvenance?.payloadHash === doc.importProvenance.payloadHash) return {
      action: 'no-op',
      workOrder: engine.serialize(existing)
    };
    throw error(409, 'Import differs; audited correction required');
  }
  try {
    await context.run(() => doc.save());
  } catch (e) {
    if (e.code === 11000) throw error(409, 'Concurrent duplicate import');
    throw e;
  }
  return {
    action: 'created',
    workOrder: engine.serialize(doc)
  };
}
module.exports = {
  prepare,
  importWorkOrder
};
