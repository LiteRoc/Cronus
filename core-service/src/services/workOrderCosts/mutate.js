const mongoose = require('mongoose');
const WorkOrder = require('../../models/WorkOrder');
const Part = require('../../models/Part');
const rates = require('../internalCostRates');
const context = require('./context');
const engine = require('./calculate');
const error = rates.error;
const roots = ['timeLogs', 'travelLogs', 'partsUsed', 'vendorService', 'economics'];
function revisionPredicate(w) {
  return {
    $expr: {
      $and: roots.map(k => w[k] === undefined ? {
        $eq: [{
          $type: '$' + k
        }, 'missing']
      } : {
        $eq: ['$' + k, {
          $literal: w[k]
        }]
      })
    }
  };
}
function envelope(actor, source) {
  return {
    version: 1,
    currency: 'USD',
    capturedBy: actor.id,
    capturedAt: new Date(),
    ...source
  };
}
async function labor(w, body, actor) {
  if (!engine.finite(body.timeSpent) || body.timeSpent < 1) throw error(400, 'Invalid labor minutes');
  const day = await rates.workDate(w.facilityId, body.workDate);
  const rate = await rates.resolve(w.facilityId, day);
  const pricing = envelope(actor, rate ? {
    basis: 'blended_internal',
    sourceKind: 'rate_schedule',
    ...rate,
    zeroEvidence: rate.rate === 0
  } : {
    basis: 'unknown',
    sourceKind: 'rate_schedule',
    unknownReason: day ? 'no_applicable_rate' : 'work_date_unknown'
  });
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: actor.id,
    timeSpent: body.timeSpent,
    description: body.description || '',
    createdAt: new Date(),
    workDate: day,
    laborRate: rate?.rate ?? null,
    laborCost: rate ? engine.amount(body.timeSpent, rate.rate, 60) : null,
    pricing
  };
}
async function part(w, body, actor) {
  if (!mongoose.isValidObjectId(body.partId) || !engine.finite(body.quantity) || body.quantity < 1) throw error(400, 'Invalid Part or quantity');
  // Preserve existing shared catalog ownership semantics; no new cross-service access.
  const catalog = await Part.findById(body.partId).lean();
  if (!catalog) throw error(404, 'Part not found');
  const known = engine.finite(catalog.price) && catalog.price > 0;
  return {
    _id: new mongoose.Types.ObjectId(),
    partId: catalog._id,
    quantity: body.quantity,
    note: body.note || '',
    usedBy: actor.id,
    usedAt: new Date(),
    unitCost: known ? catalog.price : null,
    extendedCost: known ? engine.amount(body.quantity, catalog.price) : null,
    pricing: envelope(actor, known ? {
      basis: 'catalog_default',
      sourceKind: 'part_catalog',
      sourceId: String(catalog._id),
      sourceRevision: catalog.updatedAt?.toISOString() || null
    } : {
      basis: 'unknown',
      sourceKind: 'part_catalog',
      unknownReason: catalog.price === 0 ? 'catalog_zero_unverified' : 'catalog_price_invalid'
    })
  };
}
async function createNative(data, options = {}) {
  return context.run(async () => {
    const doc = new WorkOrder(data);
    if (data.vendorService) {
      // The mounted creation form supplies service detail, not reviewed expense
      // attribution. Preserve its claims separately without certifying prices.
      const reportedAmounts = {};
      for (const key of ['laborCost', 'travelCost', 'partsCost', 'shippingCost', 'totalCost']) {
        if (data.vendorService[key] !== undefined) reportedAmounts[key] = data.vendorService[key];
        doc.vendorService[key] = null;
      }
      doc.vendorService.pricing = {
        basis: 'unknown',
        unknownReason: 'vendor_authority_unverified',
        reportedAmounts
      };
      doc.vendorService.attribution = {
        status: 'unresolved'
      };
    }
    doc.economics = {
      schemaVersion: 1,
      revision: 1,
      origin: 'native',
      changedAt: new Date(),
      changedBy: data.createdBy
    };
    doc.costs = engine.calculate(doc.toObject());
    return doc.save(options);
  });
}
async function mutate(filter, actor, action) {
  const before = await WorkOrder.findOne(filter).lean();
  if (!before) throw error(404, 'Work order not found');
  if ((before.economics?.schemaVersion != null &&
       (before.economics.schemaVersion !== 1 || !Number.isSafeInteger(before.economics.revision) || before.economics.revision < 1)) ||
      (before.costs?.calculationVersion && before.costs.calculationVersion !== engine.VERSION)) {
    throw error(409, 'Unsupported economic version');
  }
  const next = {
    ...before,
    timeLogs: [...(before.timeLogs || [])],
    travelLogs: [...(before.travelLogs || [])],
    partsUsed: [...(before.partsUsed || [])]
  };
  const result = await action(next);
  const changed = engine.fingerprint(next) !== engine.fingerprint(before);
  if (!changed && JSON.stringify(engine.stable(next)) === JSON.stringify(engine.stable(before))) return {
    workOrder: before,
    result
  };
  if (changed) {
    next.economics = {
      schemaVersion: 1,
      revision: (before.economics?.revision || 0) + 1,
      origin: before.economics?.origin || 'legacy_mixed',
      changedAt: new Date(),
      changedBy: actor.id,
      unresolvedLegacyComponents: before.economics?.unresolvedLegacyComponents || (before.economics ? [] : ['legacy_scope_unknown'])
    };
  }
  // Validate a cast copy, but preserve untouched legacy BSON exactly. Mongoose
  // query casting adds subdocument defaults even inside equality predicates.
  const candidate = new WorkOrder(next);
  await context.run(() => candidate.validate());
  const cast = candidate.toObject();
  // Cast new entries only; hydrating legacy entries must not persist defaults.
  for (const key of ['timeLogs', 'travelLogs', 'partsUsed']) {
    const existingIds = new Set((before[key] || []).filter(e => e._id).map(e => String(e._id)));
    next[key] = next[key].map((entry, index) => entry._id && !existingIds.has(String(entry._id)) ? cast[key][index] : entry);
  }
  const patch = {
    updatedBy: new mongoose.Types.ObjectId(actor.id),
    updatedAt: new Date()
  };
  for (const key of ['timeLogs', 'travelLogs', 'partsUsed']) {
    if (JSON.stringify(engine.stable(next[key])) !== JSON.stringify(engine.stable(before[key] || []))) patch[key] = next[key];
  }
  if (changed) {
    patch.economics = next.economics;
    patch.costs = engine.calculate(next);
  }
  const authorizedFilter = WorkOrder.findOne(filter).cast(WorkOrder);
  const updated = await WorkOrder.collection.findOneAndUpdate({
    $and: [authorizedFilter, revisionPredicate(before), {
      facilityId: before.facilityId ?? {
        $exists: false
      }
    }]
  }, {
    $set: patch
  }, {
    returnDocument: 'after',
    includeResultMetadata: false
  });
  if (!updated) throw error(409, 'Work order economics changed; retry');
  return {
    workOrder: updated,
    result
  };
}
module.exports = {
  mutate,
  createNative,
  labor,
  part,
  envelope,
  revisionPredicate,
  error
};
