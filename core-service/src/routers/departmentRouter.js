//src/routers/departmentRouter.js
const express = require("express");
const Department = require("../models/Department");
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require("../middleware/tenantScope");

const departmentRouter = express.Router();

// GET /departments/ uses header: x-facility-id to filter
departmentRouter.get("/", authenticateToken, async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const facilityId = req.headers["x-facility-id"];

    if (!facilityId)
      return res.status(400).json({ error: "x-facility-id header required" });

    // Admin have rights to everything
    if (req.user.role === "admin") {
        const departments = await Department.find({ facilityId });
        return res.json(departments);
      }

    const allowedFacilities = tenantFilter.facilities || [tenantFilter.facilityId];

    if (!allowedFacilities.includes(facilityId.toString())) {
      return res.status(403).json({ error: "Access denied for this facility." });
    }

    const departments = await Department.find({ facilityId });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = departmentRouter;