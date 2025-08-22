function buildTenantFilter(req) {
  if (!req.user) {
    throw new Error('Unauthorized: user context is missing');
  }

  if (req.user.role === 'admin') {
    return {}; // Admins can see everything
  }

  if (!req.user.facilityId) {
    throw new Error('Forbidden: facilityId is required for non-admin users');
  }

  const filter = { facilityId: req.user.facilityId };

  // Optional: add department-level scoping if available
  if (req.user.departmentId) {
    filter.departmentId = req.user.departmentId;
  }

  return filter;
}

module.exports = { buildTenantFilter };