const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireCrmFacilityContext } = require('../middleware/crmFacilityScope');
const {
  InteractionServiceError,
  archiveInteraction,
  createInteraction,
  getInteraction,
  listInteractions,
  updateInteraction,
} = require('../services/interactionService');

const interactionRouter = express.Router();
const interactionRoles = authorizeRoles('admin', 'technician');

function interactionJsonErrorHandler(error, _req, res, next) {
  if (error?.status === 400 && error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be a JSON object', code: 'validation_error' });
  }
  return next(error);
}

function sendInteractionError(res, error) {
  if (error instanceof InteractionServiceError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid Interaction data', code: 'validation_error' });
  }
  return res.status(500).json({ error: 'Interaction operation failed' });
}

interactionRouter.use(authenticateToken, interactionRoles, requireCrmFacilityContext);

interactionRouter.get('/', async (req, res) => {
  try {
    return res.json(await listInteractions({
      facilityId: req.crmFacilityId, user: req.user, query: req.query,
    }));
  } catch (error) {
    return sendInteractionError(res, error);
  }
});

interactionRouter.get('/:id', async (req, res) => {
  try {
    const interaction = await getInteraction({
      interactionId: req.params.id, facilityId: req.crmFacilityId, user: req.user,
    });
    return res.json({ interaction });
  } catch (error) {
    return sendInteractionError(res, error);
  }
});

interactionRouter.post('/', async (req, res) => {
  try {
    const interaction = await createInteraction({
      body: req.body, facilityId: req.crmFacilityId, user: req.user,
    });
    return res.status(201).json({ interaction });
  } catch (error) {
    return sendInteractionError(res, error);
  }
});

interactionRouter.patch('/:id', async (req, res) => {
  try {
    const interaction = await updateInteraction({
      interactionId: req.params.id, body: req.body,
      facilityId: req.crmFacilityId, user: req.user,
    });
    return res.json({ interaction });
  } catch (error) {
    return sendInteractionError(res, error);
  }
});

interactionRouter.patch('/:id/archive', authorizeRoles('admin'), async (req, res) => {
  try {
    const interaction = await archiveInteraction({
      interactionId: req.params.id, facilityId: req.crmFacilityId, user: req.user,
    });
    return res.json({ interaction });
  } catch (error) {
    return sendInteractionError(res, error);
  }
});

module.exports = interactionRouter;
module.exports.interactionJsonErrorHandler = interactionJsonErrorHandler;
