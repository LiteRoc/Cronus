const Schedule = require('../models/InternalCostRateSchedule');
const Facility = require('../models/Facility');
const Organization = require('../models/Organization');
const context = require('./workOrderCosts/context');
const {
  finite
} = require('./workOrderCosts/calculate');
const error = (status, message) => Object.assign(new Error(message), {
  status
});
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw error(400, 'Invalid work/effective date');
  return value;
}
async function facilityContext(facilityId) {
  const facility = await Facility.findById(facilityId).lean();
  return facility && facility.organizationId && (await Organization.exists({
    _id: facility.organizationId
  })) ? facility : null;
}
async function workDate(facilityId, supplied, now = new Date()) {
  if (supplied !== undefined) return supplied === null ? null : date(supplied);
  const f = await Facility.findById(facilityId).lean();
  if (!f?.timezone) return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: f.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return null;
  }
}
async function resolve(facilityId, day, diagnostics = {}) {
  if (!day) return null;
  date(day);
  const f = await facilityContext(facilityId);
  if (!f) return null;
  const schedule = await Schedule.findOne({
    organizationId: f.organizationId
  }).lean();
  if (!schedule) return null;
  // Preserve the nullable resolver contract. Only new-entry callers need the
  // non-sensitive reason; corrupt history is never repaired or repriced here.
  const unavailable = reason => {
    diagnostics.unknownReason = reason;
    return null;
  };
  if (!Array.isArray(schedule.publishedRevisions)) return unavailable('invalid_rate_schedule');
  const publications = schedule.publishedRevisions.filter(p => p && p.revision === schedule.revision);
  if (publications.length > 1) return unavailable('ambiguous_rate_schedule');
  const publication = publications[0];
  if (!Array.isArray(publication?.periods) || !publication.periods.length) return unavailable('invalid_rate_schedule');
  try {
    for (const p of publication.periods) {
      if (!p || !finite(p.rate) || typeof p.evidenceRef !== 'string' || !p.evidenceRef.trim()) return unavailable('invalid_rate_schedule');
      date(p.effectiveFrom);
      if (p.effectiveTo != null && date(p.effectiveTo) <= p.effectiveFrom) return unavailable('invalid_rate_schedule');
    }
  } catch (_) {
    return unavailable('invalid_rate_schedule');
  }
  const periods = publication.periods.filter(p => p.effectiveFrom <= day && (p.effectiveTo == null || day < p.effectiveTo));
  if (periods.length > 1) return unavailable('ambiguous_rate_schedule');
  const period = periods[0];
  return period ? {
    rate: period.rate,
    sourceId: String(schedule._id),
    sourceRevision: schedule.revision,
    evidenceRef: period.evidenceRef,
    organizationId: String(f.organizationId),
    effectiveFrom: period.effectiveFrom,
    effectiveTo: period.effectiveTo
  } : null;
}
async function publish({
  organizationId,
  expectedRevision,
  periods,
  reason
}, actor) {
  if (actor?.role !== 'admin') throw error(403, 'Admin approval required');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || typeof reason !== 'string' || !reason.trim() || !Array.isArray(periods) || !periods.length) throw error(400, 'Invalid publication');
  if (!(await Organization.exists({
    _id: organizationId
  }))) throw error(404, 'Organization not found');
  const normalized = periods.map(p => {
    if (!finite(p.rate) || typeof p.evidenceRef !== 'string' || !p.evidenceRef.trim() || Object.keys(p).some(k => !['effectiveFrom', 'effectiveTo', 'rate', 'evidenceRef'].includes(k))) throw error(400, 'Invalid rate authority');
    return {
      effectiveFrom: date(p.effectiveFrom),
      effectiveTo: p.effectiveTo == null ? null : date(p.effectiveTo),
      rate: p.rate,
      evidenceRef: p.evidenceRef
    };
  }).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  normalized.forEach((p, i) => {
    if (p.effectiveTo && p.effectiveTo <= p.effectiveFrom || i && (!normalized[i - 1].effectiveTo || normalized[i - 1].effectiveTo > p.effectiveFrom)) throw error(400, 'Overlapping or invalid periods');
  });
  const publication = {
    revision: expectedRevision + 1,
    periods: normalized,
    reason,
    approvedBy: actor.id,
    approvedAt: new Date()
  };
  return context.run(async () => {
    try {
      if (expectedRevision === 0) return await Schedule.create({
        organizationId,
        purpose: 'internal_labor_cost',
        currency: 'USD',
        revision: 1,
        publishedRevisions: [publication]
      });
      const updated = await Schedule.findOneAndUpdate({
        organizationId,
        revision: expectedRevision
      }, {
        $inc: {
          revision: 1
        },
        $push: {
          publishedRevisions: publication
        }
      }, {
        new: true,
        runValidators: true
      });
      if (!updated) throw error(409, 'Schedule changed');
      return updated;
    } catch (e) {
      if (e.code === 11000) throw error(409, 'Schedule already exists');
      throw e;
    }
  });
}
module.exports = {
  date,
  workDate,
  resolve,
  publish,
  facilityContext,
  error
};
