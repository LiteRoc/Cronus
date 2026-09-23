const router = require('express').Router();
const {
  authenticateToken,
  authorizeRoles
} = require('../middleware/authMiddleware');
const ownership = require('../services/operationalOwnership');
const rates = require('../services/internalCostRates');
const Schedule = require('../models/InternalCostRateSchedule');
router.use(authenticateToken, authorizeRoles('admin'));
async function organization(req) {
  const facilityId = await ownership.selectedFacility(req);
  const f = await rates.facilityContext(facilityId);
  if (!f) throw rates.error(404, 'Organization not found');
  return f.organizationId;
}
router.get('/', async (req, res) => {
  try {
    const organizationId = await organization(req);
    res.json(await Schedule.findOne({
      organizationId
    }).lean());
  } catch (e) {
    res.status(e.status || 500).json({
      error: e.status ? e.message : 'Rate lookup failed'
    });
  }
});
router.post('/publish', async (req, res) => {
  try {
    const body = ownership.pick(req.body, ['expectedRevision', 'periods', 'reason'], true);
    res.status(201).json(await rates.publish({
      ...body,
      organizationId: await organization(req)
    }, req.user));
  } catch (e) {
    res.status(e.status || 400).json({
      error: e.status ? e.message : 'Invalid rate publication'
    });
  }
});
module.exports = router;
