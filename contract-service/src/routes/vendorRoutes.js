const express = require('express');
const router = express.Router();

const { 
    getAllVendors,
    getOneVendor,
    creatVendor,
    updateVendor,
    deleteVendor
} = require('../controllers/vendorController');

router.get('/', getAllVendors);
router.get('/:id', getOneVendor);
router.post('/', creatVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;