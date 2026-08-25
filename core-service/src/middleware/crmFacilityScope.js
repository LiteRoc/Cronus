const mongoose = require('mongoose');
const Facility = require('../models/Facility');

function normalizedFacilityClaims(user) {
  const claims = [...(Array.isArray(user.facilities) ? user.facilities : [])];
  if (user.facilityId) claims.push(user.facilityId);

  return new Set(claims.map((facility) => {
    const value = typeof facility === 'object' && facility !== null
      ? facility._id || facility.id || facility
      : facility;
    return value?.toString();
  }).filter(Boolean));
}

async function requireCrmFacilityContext(req, res, next) {
  const selectedFacilityId = String(req.headers['x-facility-id'] || '').trim();

  if (!selectedFacilityId) {
    return res.status(400).json({ error: 'x-facility-id header is required' });
  }
  if (!mongoose.isValidObjectId(selectedFacilityId)) {
    return res.status(400).json({ error: 'x-facility-id must be a valid ObjectId' });
  }

  if (req.user.role === 'technician') {
    const allowedFacilities = normalizedFacilityClaims(req.user);
    if (!allowedFacilities.has(selectedFacilityId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  try {
    const facility = await Facility.findById(selectedFacilityId)
      .select('_id organizationId')
      .lean();
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    req.crmFacility = facility;
    req.crmFacilityId = facility._id;
    next();
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to validate Facility context' });
  }
}

module.exports = { normalizedFacilityClaims, requireCrmFacilityContext };
