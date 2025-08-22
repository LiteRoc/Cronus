const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');

// Optional helper to enforce ownership of a single doc by tenant
function requireTenantOwnership(Model, idField = '_id') {
  return async (req, res, next) => {
    const id = req.params[idField] || req.params.id;
    if (!id || !id.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ error: `Invalid id format` });
    }
    const owned = await Model.exists({ _id: id, ...buildTenantFilter(req) });
    if (!owned && req.user.role === 'customer') {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  };
}
