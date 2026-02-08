// src/routes/contractValueRoutes.js

import { Router } from "express";
import { getContractValue } from "../controllers/contractValueController";

const contractValueRouter = Router();

// GET /contracts/:id/value?asOf=YYYY-MM-DD
// Optional: &rangeStart=YYYY-MM-DD&rangeEnd=YYYY-MM-DD
contractValueRouter.get("/:id/value", getContractValue);

export default contractValueRouter;
