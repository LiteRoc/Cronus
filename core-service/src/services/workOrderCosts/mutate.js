const mongoose = require('mongoose');
const WorkOrder = require('../../models/WorkOrder');
const Part = require('../../models/Part');
const referenceLifecycle = require('../referenceLifecycle');
const rates = require('../internalCostRates');
const context = require('./context');
const engine = require('./calculate');
const ownership = require('../operationalOwnership');
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
  const diagnostics = {};
  const rate = await rates.resolve(w.facilityId, day, diagnostics);
  const pricing = envelope(actor, rate ? {
    basis: 'blended_internal',
    sourceKind: 'rate_schedule',
    ...rate,
    zeroEvidence: rate.rate === 0
  } : {
    basis: 'unknown',
    sourceKind: 'rate_schedule',
    unknownReason: diagnostics.unknownReason || (day ? 'no_applicable_rate' : 'work_date_unknown')
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
// Corrections retain entry identity and creation metadata. Only a changed work
// date authorizes a new effective-dated snapshot; minutes use captured authority.
async function updateLabor(filter, logId, input, actor) {
  if (typeof logId !== 'string' || !/^[a-f\d]{24}$/i.test(logId)) throw error(400, 'Invalid log ID');
  const body = ownership.pick(input, ['timeSpent', 'description', 'workDate'], true);
  if (Object.hasOwn(body, 'timeSpent') && (!engine.finite(body.timeSpent) || body.timeSpent < 1)) throw error(400, 'Invalid labor minutes');
  if (Object.hasOwn(body, 'description') && typeof body.description !== 'string') throw error(400, 'Invalid labor description');
  if (Object.hasOwn(body, 'workDate')) rates.date(body.workDate);
  return mutate(filter, actor, async w => {
    const matches = w.timeLogs.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => String(entry._id).toLowerCase() === logId.toLowerCase());
    if (!matches.length) throw error(404, 'Log not found');
    if (matches.length !== 1) throw error(409, 'Ambiguous labor entry');
    const { entry, index } = matches[0];
    const next = { ...entry, ...body };
    if (Object.hasOwn(body, 'workDate') && body.workDate !== entry.workDate) {
      const snapshot = await labor(w, next, actor);
      for (const key of ['workDate', 'laborRate', 'laborCost', 'pricing']) next[key] = snapshot[key];
    } else if (Object.hasOwn(body, 'timeSpent') && body.timeSpent !== entry.timeSpent) {
      if (engine.trusted(entry.pricing, entry.laborRate)) {
        next.laborCost = engine.amount(next.timeSpent, entry.laborRate, 60);
      } else {
        // Unverified legacy numbers are not historical rate authority.
        next.laborRate = null;
        next.laborCost = null;
      }
    }
    w.timeLogs[index] = next;
  });
}
async function part(w, body, actor, handle) {
  if (!mongoose.isValidObjectId(body.partId) || !engine.finite(body.quantity) || body.quantity < 1) throw error(400, 'Invalid Part or quantity');
  // Preserve existing shared catalog ownership semantics; no new cross-service access.
  if (!handle || handle.reservation.operation !== 'workorder-part-add' ||
      String(handle.referenceId) !== String(body.partId)) throw error(409, 'Part reservation required');
  const catalog = handle.catalog;
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
async function mutate(filter, actor, action, handle = null) {
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
  const update = { $set: patch };
  if (handle) {
    Object.assign(update.$set, referenceLifecycle.destinationStamp(handle));
    handle.writeStarted = true;
  }
  const updated = await WorkOrder.collection.findOneAndUpdate({
    $and: [authorizedFilter, ...(handle ? [referenceLifecycle.destinationGuard(handle)] : []), revisionPredicate(before), {
      facilityId: before.facilityId ?? {
        $exists: false
      }
    }]
  }, update, {
    returnDocument: 'after',
    includeResultMetadata: false,
    ...(handle ? { writeConcern: { w: 1, j: true } } : {})
  });
  if (!updated) referenceLifecycle.notWritten(409, 'Work order economics changed; retry');
  try {
    if (changed) await require('../lifecycleCache').markStale([before.assetId, updated.assetId]);
  } catch (_) {
    // Fingerprint validation remains authoritative if dirty marking fails.
  }
  delete updated.referenceReceipt; delete updated.referenceFence; // Raw collection result is sent to API callers.
  return {
    workOrder: updated,
    result
  };
}
// Reservation and archive compete on the Part; the destination receipt is
// appended in the same atomic WorkOrder CAS as the usage and cost snapshots.
async function addPart(filter, body, actor) {
  if (!mongoose.isValidObjectId(body.partId) || !engine.finite(body.quantity) || body.quantity < 1) throw error(400, 'Invalid Part or quantity');
  return referenceLifecycle.withReservation(Part, body.partId, 'workorder-part-add', String(filter._id),
    handle => mutate(filter, actor, async w => {
      const entry = await part(w, body, actor, handle);
      w.partsUsed.push(entry);
      return entry;
    }, handle));
}

module.exports = {
  updateLabor,
  addPart,
  mutate,
  createNative,
  labor,
  part,
  envelope,
  revisionPredicate,
  error
};
