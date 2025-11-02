const { default: mongoose } = require("mongoose");

function buildTenantFilter(req) {
  if (!req.user) {
    throw new Error('Unauthorized: user context is missing');
  }

  const { role, facilityId: tokenFacilityId, facilities = [] } = req.user;
  const selectedFacilityId = (req.headers['x-facility-id'] || '').toString().trim();

  // --- Admins ---
  if (role === "admin") {
    if (!selectedFacilityId) {
      // Allow admins to see *all* facilities and global records
      return {
        $or: [{ facilityId: { $exists: false } }, { facilityId: { $ne: null } }],
      };
    }
    return {
      $or: [
        { facilityId: mongoose.Types.ObjectId.createFromHexString(selectedFacilityId) },
        { facilityId: { $exists: false } }, // include global parts
      ],
    };
  }

  // --- Techs & Customers ---
  const activeFacilityId = selectedFacilityId || tokenFacilityId;

  // Security check: only allow selectedFacilityId if it’s in user’s allowed facilities
  if (
    selectedFacilityId &&
    !facilities.some(f => {
      const id = typeof f === 'object' ? f._id?.toString() : f?.toString();
      return id === selectedFacilityId;
    })
  ) {
    console.log("Rejected facility:", selectedFacilityId);
    console.log("Allowed facilities:", facilities.map(f =>
      typeof f === 'object' ? f._id?.toString() : f?.toString()
    ));
    throw new Error('Forbidden: selected facility is not within user scope');
  }



  // Base facility filter (includes global)
  const filter = {
    $or: [
      { facilityId: mongoose.Types.ObjectId.createFromHexString(activeFacilityId) },
      { facilityId: { $exists: false } },
    ],
  };
  console.log('Using tenant filter:', filter);

  // Optional: department scoping
  /*if (departmentId) {
    filter.departmentId = mongoose.Types.ObjectId.createFromHexString(departmentId);
  }*/

  return filter;
}

module.exports = { buildTenantFilter };