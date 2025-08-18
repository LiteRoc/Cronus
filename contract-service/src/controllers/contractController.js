const Contract = require('../models/Contract');

// GET - List All Contracts
exports.getAllContracts = async (req, res) => {
    try {
    const contracts = await Contract.find()
      .populate('linkedVendor')
      .populate('linkedCustomer')
      .populate('coveredAssets', 'ctrlNumber manufacturer model')
      .lean();
    res.status(200).json(contracts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
};

// GET - Get a single Contract
exports.getOneContract =  async (req, res) => {
    try {
    const contract = await Contract.findById(req.params.id)
      .populate('linkedVendor')
      .populate('linkedCustomer')
      .populate('coveredAssets', 'ctrlNumber manufacturer model')
      .populate('linkedWorkOrders')
      .lean();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.status(200).json(contract);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
};

// POST - Create a new Contract
exports.creatContract = async (req, res) => {
    try {
    const newContract = new Contract(req.body);
    await newContract.save();
    res.status(201).json({ message: 'Contract created', contract: newContract });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create contract', details: err.message });
  }
};

// PUT - Update a existing Contract
exports.updateContract = async (req, res) => {
    try {
    const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Contract not found' });
    res.status(200).json({ message: 'Contract updated', contract: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update contract', details: err.message });
  }
};

// PATCH - Add an Amendment to a contract
exports.addAmendment = async (req, res) => {
    try {
    const { date, description, changeType, assetId, financialChange } = req.body;
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    contract.amendments.push({ date, description, changeType, assetId, financialChange });

    // Optionally update coveredAssets and totalValue
    if (changeType === 'add') {
      contract.coveredAssets.push(assetId);
      if (financialChange) contract.totalValue += financialChange;
    }
    if (changeType === 'remove') {
      contract.coveredAssets = contract.coveredAssets.filter(id => id.toString() !== assetId);
      if (financialChange) contract.totalValue -= financialChange;
    }

    await contract.save();
    res.status(200).json({ message: 'Amendment added', contract });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add amendment', details: err.message });
  }
};

// DELETE - Delete a Contract
exports.deleteContract = async (req,res) => {
    try {
    const deleted = await Contract.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Contract not found' });
    res.status(200).json({ message: 'Contract deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contract' });
  }
};