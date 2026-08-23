//src/routes/contractRoutes.js

import express from "express";
import { attachCoreClient } from "../middleware/forwardCoreHeaders.js";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { 
    getContractOverview,
    getAllContracts,
    getOneContract,
    getAssetContract,
    getAssetCoverage,
    createContract,
    applyAmendment,
    previewApplyAmendment,
    createDraftAmendment,
    submitAmendment,
    approveAmendment,
    declineAmendment,
    voidAmendment,
    submitContract,
    approveContract,
    declineContract,
    terminateContract,      
    deleteContract,
    updateVendorLink,
    updateVendorLinkAssets,
    addVendorLink,
    getVendorLinkOverview,
    getContractProfitability,
} from "../controllers/contractController.js";

import { getContractValue } from "../controllers/contractValueController.js";
import { getContractLifecycleIntelligence } from "../controllers/contractLifecycleController.js";

const router = express.Router();
const adminMutation = [authenticateToken, authorizeRoles("admin")];

router.use(attachCoreClient); // automatically attach axios client

// CONTRACT ROUTES
router.get('/:id/overview', authenticateToken, getContractOverview);
router.get('/active-for-asset/:assetId', authenticateToken, getAssetContract);
router.get("/asset/:assetId/coverage", authenticateToken, getAssetCoverage);
router.get('/', authenticateToken, getAllContracts);
router.get('/:id', authenticateToken, getOneContract);
router.post('/', ...adminMutation, createContract);
router.post('/:id/submit', ...adminMutation, submitContract);
router.post('/:id/approve', ...adminMutation, approveContract);
router.post('/:id/decline', ...adminMutation, declineContract);
router.post('/:id/terminate', ...adminMutation, terminateContract);
router.delete('/:id', ...adminMutation, deleteContract);

// AMENDMENT ROUTES
router.post('/:id/amendments/draft', ...adminMutation, createDraftAmendment);
router.post('/:id/amendments/:idx/submit', ...adminMutation, submitAmendment);
router.post('/:id/amendments/:idx/approve', ...adminMutation, approveAmendment);
router.get('/:id/amendments/:idx/preview', authenticateToken, previewApplyAmendment);
router.post('/:id/amendments/:idx/apply', ...adminMutation, applyAmendment);
router.post('/:id/amendments/:idx/decline', ...adminMutation, declineAmendment);
router.post('/:id/amendments/:idx/void', ...adminMutation, voidAmendment);

// VALUE ROUTES
router.get('/:id/value', authenticateToken, getContractValue);

// VENDOR ROUTES
router.post('/:id/vendor-links', ...adminMutation, addVendorLink);
router.patch('/:id/vendor-links/:linkId', ...adminMutation, updateVendorLink);
router.post('/:id/vendor-links/:linkId/assets', ...adminMutation, updateVendorLinkAssets);
router.get("/:id/vendor-links/:linkId/overview", authenticateToken, getVendorLinkOverview);
router.get("/:id/profitability", authenticateToken, getContractProfitability);
router.get('/:id/lifecycle-intelligence', authenticateToken, getContractLifecycleIntelligence);

export default router;
