//src/routes/contractRoutes.js

import express from "express";
import { attachCoreClient } from "../middleware/forwardCoreHeaders.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { 
    getContractOverview,
    getAllContracts,
    getOneContract,
    getAssetContract,
    getAssetCoverage,
    createContract,
    //updateContract,
    //addAmendment,
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
    //linkAssets,
    //linkVendor,
    //linkWorkOrder
} from "../controllers/contractController.js";

import { getContractValue } from "../controllers/contractValueController.js";
import { getContractLifecycleIntelligence } from "../controllers/contractLifecycleController.js";

const router = express.Router();

router.use(attachCoreClient); // automatically attach axios client

// CONTRACT ROUTES
router.get('/:id/overview', authenticateToken, getContractOverview);
router.get('/active-for-asset/:assetId', authenticateToken, getAssetContract);
router.get("/asset/:assetId/coverage", authenticateToken, getAssetCoverage);
router.get('/', authenticateToken, getAllContracts);
router.get('/:id', authenticateToken, getOneContract);
router.post('/', authenticateToken, createContract);
router.post('/:id/submit', authenticateToken, submitContract);
router.post('/:id/approve', authenticateToken, approveContract);
router.post('/:id/decline', authenticateToken, declineContract);
router.post('/:id/terminate', authenticateToken, terminateContract);
router.delete('/:id', authenticateToken, deleteContract);

// AMENDMENT ROUTES
router.post('/:id/amendments/draft', authenticateToken, createDraftAmendment);
router.post('/:id/amendments/:idx/submit', authenticateToken, submitAmendment);
router.post('/:id/amendments/:idx/approve', authenticateToken, approveAmendment);
router.get('/:id/amendments/:idx/preview', authenticateToken, previewApplyAmendment);
router.post('/:id/amendments/:idx/apply', authenticateToken, applyAmendment);
router.post('/:id/amendments/:idx/decline', authenticateToken, declineAmendment);
router.post('/:id/amendments/:idx/void', authenticateToken, voidAmendment);

// VALUE ROUTES
router.get('/:id/value', authenticateToken, getContractValue);

// VENDOR ROUTES
router.post('/:id/vendor-links', authenticateToken, addVendorLink);
router.patch('/:id/vendor-links/:linkId', authenticateToken, updateVendorLink);
router.post('/:id/vendor-links/:linkId/assets', authenticateToken, updateVendorLinkAssets);
router.get("/:id/vendor-links/:linkId/overview", authenticateToken, getVendorLinkOverview);
router.get("/:id/profitability", authenticateToken, getContractProfitability);
router.get('/:id/lifecycle-intelligence', authenticateToken, getContractLifecycleIntelligence);

/*
router.post('/', authenticateToken, createContract);
router.put('/:id', authenticateToken, updateContract);
router.patch('/:id/amendment', authenticateToken, addAmendment);
router.post('/:id/amendments', authenticateToken, applyAmendment);

router.post('/:id/workorders', authenticateToken, linkWorkOrder);
router.put('/:id/assets', authenticateToken, linkAssets);
router.put('/:id/vendor', authenticateToken, linkVendor);*/

export default router;