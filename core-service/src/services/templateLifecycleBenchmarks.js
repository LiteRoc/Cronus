// src/services/templateLifecycleBenchmarks.js
import mongoose from 'mongoose';
import Asset from '../models/Asset.js';

function asObjectId(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

function median(nums) {
  const arr = (nums || []).map(n => Number(n) || 0).sort((a, b) => a - b);
  const n = arr.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export async function getTemplateMaintenanceBenchmarks(templateId, opts = {}) {
  const {
    facilityId = null,
    now = new Date(),
    completedStatuses = ['Completed'],
    includeRetired = false,
  } = opts;

  const templateObjectId = asObjectId(templateId);
  const start12m = new Date(now);
  start12m.setDate(start12m.getDate() - 365);

  const assetMatch = {
    templateId: templateObjectId,
    deletedAt: null,
  };

  if (!includeRetired) assetMatch.status = { $ne: 'Retired' };

  // Lookup workorders ONCE per asset (outside $facet)
  // We compute annual + lifetime totals in a single $group using conditional sums.
  const pipeline = [
    { $match: assetMatch },

    {
      $lookup: {
        from: 'workorders',
        let: { assetId: '$_id' },
        pipeline: [
          {
            $match: {
              deletedAt: null,
              status: { $in: completedStatuses },
              $expr: { $eq: ['$assetId', '$$assetId'] },
            },
          },
          {
            $group: {
              _id: null,

              lifetimeTotal: { $sum: { $ifNull: ['$costs.total', 0] } },
              lifetimeWOs: { $sum: 1 },

              annualTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$completionDate', start12m] },
                        { $lte: ['$completionDate', now] },
                      ],
                    },
                    { $ifNull: ['$costs.total', 0] },
                    0,
                  ],
                },
              },
              annualWOs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$completionDate', start12m] },
                        { $lte: ['$completionDate', now] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              lifetimeTotal: 1,
              lifetimeWOs: 1,
              annualTotal: 1,
              annualWOs: 1,
            },
          },
        ],
        as: 'woAgg',
      },
    },

    { $unwind: { path: '$woAgg', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        annualMaintenance: { $ifNull: ['$woAgg.annualTotal', 0] },
        annualWOs: { $ifNull: ['$woAgg.annualWOs', 0] },
        lifetimeMaintenance: { $ifNull: ['$woAgg.lifetimeTotal', 0] },
        lifetimeWOs: { $ifNull: ['$woAgg.lifetimeWOs', 0] },
      },
    },

    // Now we can safely facet WITHOUT $lookup
    {
      $facet: {
        tenant: [
          ...(facilityId ? [{ $match: { facilityId: asObjectId(facilityId) } }] : []),
          {
            $group: {
              _id: null,
              sampleAssets: { $sum: 1 },

              avgAnnualMaintenance: { $avg: '$annualMaintenance' },
              annualValues: { $push: '$annualMaintenance' },
              sampleWOsAnnual: { $sum: '$annualWOs' },

              avgLifetimeMaintenance: { $avg: '$lifetimeMaintenance' },
              sampleWOsLifetime: { $sum: '$lifetimeWOs' },
            },
          },
          {
            $project: {
              _id: 0,
              sampleAssets: 1,
              avgAnnualMaintenance: 1,
              annualValues: 1,
              sampleWOsAnnual: 1,
              avgLifetimeMaintenance: 1,
              sampleWOsLifetime: 1,
            },
          },
        ],

        global: [
          {
            $group: {
              _id: null,
              sampleAssets: { $sum: 1 },

              avgAnnualMaintenance: { $avg: '$annualMaintenance' },
              annualValues: { $push: '$annualMaintenance' },
              sampleWOsAnnual: { $sum: '$annualWOs' },

              avgLifetimeMaintenance: { $avg: '$lifetimeMaintenance' },
              sampleWOsLifetime: { $sum: '$lifetimeWOs' },
            },
          },
          {
            $project: {
              _id: 0,
              sampleAssets: 1,
              avgAnnualMaintenance: 1,
              annualValues: 1,
              sampleWOsAnnual: 1,
              avgLifetimeMaintenance: 1,
              sampleWOsLifetime: 1,
            },
          },
        ],
      },
    },

    {
      $project: {
        tenant: { $ifNull: [{ $arrayElemAt: ['$tenant', 0] }, null] },
        global: { $ifNull: [{ $arrayElemAt: ['$global', 0] }, null] },
      },
    },
  ];

  const [result] = await Asset.aggregate(pipeline);

  const normalize = (obj) => {
    if (!obj) {
      return {
        sampleAssets: 0,
        avgAnnualMaintenance: 0,
        medianAnnualMaintenance: 0,
        sampleWOsAnnual: 0,
        avgLifetimeMaintenance: 0,
        sampleWOsLifetime: 0,
      };
    }

    const annualValues = obj.annualValues || [];
    return {
      sampleAssets: Number(obj.sampleAssets || 0),
      avgAnnualMaintenance: round2(obj.avgAnnualMaintenance || 0),
      medianAnnualMaintenance: round2(median(annualValues)),
      sampleWOsAnnual: Number(obj.sampleWOsAnnual || 0),
      avgLifetimeMaintenance: round2(obj.avgLifetimeMaintenance || 0),
      sampleWOsLifetime: Number(obj.sampleWOsLifetime || 0),
    };
  };

  return {
    tenant: normalize(result?.tenant),
    global: normalize(result?.global),
  };
}