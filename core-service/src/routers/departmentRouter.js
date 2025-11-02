const express = require("express");
const Department = require("../models/Department");
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require("../middleware/tenantScope");

const departmentRouter = express.Router();

// GET /departments/by-facility/:facilityId
departmentRouter.get("/by-facility/:facilityId", authenticateToken, async (req, res) => {
  try {
    // Validate and scope facility access
    const tenantFilter = buildTenantFilter(req);

    // Force the filter to match the requested facilityId
    const { facilityId } = req.params;
    if (
      tenantFilter.facilityId.toString() !== facilityId.toString()
    ) {
      return res.status(403).json({ error: "Access denied for this facility." });
    }

    const departments = await Department.find({ facilityId });
    console.log('Returned departments:', departments);
    res.json(departments);
  } catch (err) {
    console.error("Error fetching departments:", err.message);
    res.status(403).json({ error: err.message });
  }
});

module.exports = departmentRouter;