const express = require('express');
const router = express.Router();
const { 
    getAllContracts,
    getOneContract,
    creatContract,
    updateContract,
    addAmendment,
    deleteContract
} = require('../controllers/contractController');

router.get('/', getAllContracts);
router.get('/:id', getOneContract);
router.post('/', creatContract);
router.put('/:id', updateContract);
router.patch('/:id/amendment', addAmendment);
router.delete('/:id', deleteContract);

module.exports = router;