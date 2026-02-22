// src/services/lifecycleMaintenance.js
import mongoose from 'mongoose';
import WorkOrder from '../models/WorkOrder.js';

function asObjectId(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Sums maintenance dollars from completed work orders for an asset.
 * Relies on WorkOrder.costs (labor/parts/total) being kept current.
 *
 * @param {string|ObjectId} assetId
 * @param {object} [opts]
 * @param {Date} [opts.now] - for testability
 * @param {string[]} [opts.completedStatuses] - default ['Completed']
 * @param {ObjectId|string} [opts.facilityId] - optional tenant scoping
 */
async function getMaintenanceTotals(assetId, opts = {}) {
  const {
    now = new Date(),
    completedStatuses = ['Completed'],
    facilityId = null,
  } = opts;

  const assetObjectId = asObjectId(assetId);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setDate(twelveMonthsAgo.getDate() - 365);

  const matchBase = {
    assetId: assetObjectId,
    deletedAt: null,
    status: { $in: completedStatuses },
  };

  if (facilityId) {
    matchBase.facilityId = asObjectId(facilityId);
  }

  // NOTE: If some legacy WOs don't have costs yet, you can either:
  // - treat missing costs.total as 0 (this pipeline does), OR
  // - add a cleanup job to backfill costs.
  const [result] = await WorkOrder.aggregate([
    { $match: matchBase },

    {
      $facet: {
        lifetime: [
          {
            $group: {
              _id: null,
              labor: { $sum: { $ifNull: ['$costs.labor', 0] } },
              parts: { $sum: { $ifNull: ['$costs.parts', 0] } },
              total: { $sum: { $ifNull: ['$costs.total', 0] } },
              count: { $sum: 1 },
            },
          },
        ],
        last12Months: [
          // Only count WOs that actually have a completionDate
          {
            $match: {
              completionDate: { $gte: twelveMonthsAgo, $lte: now },
            },
          },
          {
            $group: {
              _id: null,
              labor: { $sum: { $ifNull: ['$costs.labor', 0] } },
              parts: { $sum: { $ifNull: ['$costs.parts', 0] } },
              total: { $sum: { $ifNull: ['$costs.total', 0] } },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },

    {
      $project: {
        lifetime: { $ifNull: [{ $arrayElemAt: ['$lifetime', 0] }, { labor: 0, parts: 0, total: 0, count: 0 }] },
        last12Months: { $ifNull: [{ $arrayElemAt: ['$last12Months', 0] }, { labor: 0, parts: 0, total: 0, count: 0 }] },
      },
    },
  ]);

  // Normalize
  return {
    lifetime: {
      labor: Number(result?.lifetime?.labor || 0),
      parts: Number(result?.lifetime?.parts || 0),
      total: Number(result?.lifetime?.total || 0),
      count: Number(result?.lifetime?.count || 0),
    },
    last12Months: {
      labor: Number(result?.last12Months?.labor || 0),
      parts: Number(result?.last12Months?.parts || 0),
      total: Number(result?.last12Months?.total || 0),
      count: Number(result?.last12Months?.count || 0),
    },
  };
}

export default {
  getMaintenanceTotals,
};