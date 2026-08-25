const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireCrmFacilityContext } = require('../middleware/crmFacilityScope');
const {
  FollowUpServiceError,
  archiveFollowUp,
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  getFollowUp,
  listFollowUpAssignees,
  listFollowUps,
  updateFollowUp,
} = require('../services/followUpService');

const followUpRouter = express.Router();
const followUpRoles = authorizeRoles('admin', 'technician');

function followUpJsonErrorHandler(error, _req, res, next) {
  if (error?.status === 400 && error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be a JSON object', code: 'validation_error' });
  }
  return next(error);
}

function sendFollowUpError(res, error) {
  if (error instanceof FollowUpServiceError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid FollowUp data', code: 'validation_error' });
  }
  return res.status(500).json({ error: 'FollowUp operation failed' });
}

followUpRouter.use(authenticateToken, followUpRoles, requireCrmFacilityContext);

followUpRouter.get('/', async (req, res) => {
  try {
    return res.json(await listFollowUps({ facilityId: req.crmFacilityId, query: req.query }));
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.get('/assignees', async (req, res) => {
  try {
    const items = await listFollowUpAssignees({ facilityId: req.crmFacilityId });
    return res.json({ items });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.get('/:id', async (req, res) => {
  try {
    const followUp = await getFollowUp({ followUpId: req.params.id, facilityId: req.crmFacilityId });
    return res.json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.post('/', async (req, res) => {
  try {
    const followUp = await createFollowUp({ body: req.body, facilityId: req.crmFacilityId, user: req.user });
    return res.status(201).json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.patch('/:id', async (req, res) => {
  try {
    const followUp = await updateFollowUp({
      followUpId: req.params.id,
      body: req.body,
      facilityId: req.crmFacilityId,
      user: req.user,
    });
    return res.json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.patch('/:id/complete', async (req, res) => {
  try {
    const followUp = await completeFollowUp({ followUpId: req.params.id, facilityId: req.crmFacilityId, user: req.user });
    return res.json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.patch('/:id/cancel', async (req, res) => {
  try {
    const followUp = await cancelFollowUp({ followUpId: req.params.id, facilityId: req.crmFacilityId, user: req.user });
    return res.json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

followUpRouter.patch('/:id/archive', authorizeRoles('admin'), async (req, res) => {
  try {
    const followUp = await archiveFollowUp({ followUpId: req.params.id, facilityId: req.crmFacilityId, user: req.user });
    return res.json({ followUp });
  } catch (error) {
    return sendFollowUpError(res, error);
  }
});

module.exports = followUpRouter;
module.exports.followUpJsonErrorHandler = followUpJsonErrorHandler;
