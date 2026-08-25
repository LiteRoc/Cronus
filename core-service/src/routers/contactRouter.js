const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");
const { requireCrmFacilityContext } = require("../middleware/crmFacilityScope");
const {
  ContactServiceError,
  archiveContact,
  createContact,
  getContact,
  listContacts,
  updateContact,
} = require("../services/contactService");

const contactRouter = express.Router();
const contactRoles = authorizeRoles("admin", "technician");

function contactJsonErrorHandler(error, _req, res, next) {
  if (error?.status === 400 && error?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request body must be a JSON object",
      code: "validation_error",
    });
  }
  return next(error);
}

contactRouter.use(authenticateToken, contactRoles, requireCrmFacilityContext);

function sendContactError(res, error) {
  if (error instanceof ContactServiceError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ error: "Invalid Contact data", code: "validation_error" });
  }
  return res.status(500).json({ error: "Contact operation failed" });
}

contactRouter.get("/", async (req, res) => {
  try {
    const result = await listContacts({ selectedFacilityId: req.crmFacilityId, query: req.query });
    return res.json(result);
  } catch (error) {
    return sendContactError(res, error);
  }
});

contactRouter.get("/:id", async (req, res) => {
  try {
    const contact = await getContact({
      contactId: req.params.id,
      selectedFacilityId: req.crmFacilityId,
    });
    return res.json({ contact });
  } catch (error) {
    return sendContactError(res, error);
  }
});

contactRouter.post("/", async (req, res) => {
  try {
    const result = await createContact({ body: req.body, facility: req.crmFacility, user: req.user });
    return res.status(201).json(result);
  } catch (error) {
    return sendContactError(res, error);
  }
});

contactRouter.patch("/:id", async (req, res) => {
  try {
    const result = await updateContact({
      contactId: req.params.id,
      body: req.body,
      selectedFacilityId: req.crmFacilityId,
      user: req.user,
    });
    return res.json(result);
  } catch (error) {
    return sendContactError(res, error);
  }
});

contactRouter.patch("/:id/archive", authorizeRoles("admin"), async (req, res) => {
  try {
    const contact = await archiveContact({
      contactId: req.params.id,
      selectedFacilityId: req.crmFacilityId,
      user: req.user,
    });
    return res.json({ contact });
  } catch (error) {
    return sendContactError(res, error);
  }
});

module.exports = contactRouter;
module.exports.contactJsonErrorHandler = contactJsonErrorHandler;
