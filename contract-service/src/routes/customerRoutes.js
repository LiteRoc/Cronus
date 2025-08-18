const express = require('express');
const router = express.Router();

const { 
    getAllCustomers,
    getOneCumstomer,
    createCustomer,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');

router.get('/', getAllCustomers);
router.get('/:id', getOneCumstomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;