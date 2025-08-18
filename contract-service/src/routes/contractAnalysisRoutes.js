const express = require('express');
const router = express.Router();

const { getAnalysis } = require('../controllers/contractAnalysisController');

router.get('/:contractId/year/:year', getAnalysis);

module.exports = router;