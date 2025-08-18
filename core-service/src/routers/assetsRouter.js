const express = require('express');
const mongoose = require('mongoose');
const debug = require('debug')('app:assetsRouter');
const Asset = require('../models/Asset'); // Import the Asset model
const EquipmentTemplate = require('../models/EquipmentTemplate.js');
const WorkOrder = require('../models/WorkOrder'); // Import the WorkOrder model
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware'); // Middleware for authentication/authorization
const workOrderRouter = require('./workOrderRouter'); // Work order routes

mongoose.set('strictPopulate', false); // Allow non-strict population

const assetRouter = express.Router();

// GET: Manufactures for a dropdown list
assetRouter.get("/distinct/manufacturers", async (req, res) => {
  try {
    const manufacturers = await Asset.distinct("manufacturer");
    res.status(200).json(manufacturers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch manufacturers." });
  }
});

// GET: Models for a dropdown list
assetRouter.get("/distinct/models", async (req, res) => {
  const { manufacturer } = req.query;
  if (!manufacturer) return res.status(400).json({ error: "Manufacturer required." });

  try {
    const models = await Asset.distinct("model", { manufacturer });
    res.status(200).json(models);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

// GET all assets with optional filtering
assetRouter.get('/', async (req, res) => {
    const { search, manufacturer, model, status, page = 1, limit = 10 } = req.query;

    try {
        const query = {};
        if (search) {
            query.$or = [
                { ctrlNumber: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
            ];
        }
        if (manufacturer) query.manufacturer = manufacturer;
        if (model) query.model = model;
        if (status) query.status = status;

        // Parse the `page` and `limit` to ensure they are numbers
        const pageNumber = parseInt(page, 10) || 1; // Default to 1 if not provided
        const limitNumber = parseInt(limit, 10) || 10; // Default to 10 if not provided
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch total count and paginated assets
        const totalAssets = await Asset.countDocuments(query);
        const assets = await Asset.find(query)
            .skip(skip)
            .limit(limitNumber)
            .populate({
                path: 'workOrders',
                select: 'description status scheduledDate completionDate workOrderNumber', // Optimize with selected fields
            })
            .lean();

        // Add a fallback for legacy-required fields & schedule shape
        const enrichedAssets = assets.map(asset => ({
            ...asset,

            // legacy fields some UIs expect:
            serialNumber: asset.serialNumber ?? '',
            description: asset.description ?? '',
            notes: asset.notes ?? '',

            // keep existing fallback schedule:
            maintenanceSchedule: asset.maintenanceSchedule || { message: 'No schedule defined' },
        }));

        res.status(200).json({
            assets: enrichedAssets,
            totalPages: Math.ceil(totalAssets / limitNumber),
            currentPage: pageNumber,
            totalAssets,
        });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET: Return only test equipment
assetRouter.get('/test-equipment', async (req, res) => {
    try {
        const testEquipment = await Asset.find({ category: 'test' }).lean();
        res.status(200).json(testEquipment);
    } catch (error) {
        debug('Error fetching test equipment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET a single asset by ID
assetRouter.get('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const asset = await Asset.findById(id)
        .populate({
            path: 'workOrders',
            select: 'description status scheduledDate completionDate',
        })
        .populate({
            path: 'maintenanceSchedule.procedure', // Populate the procedure within the maintenanceSchedule
            select: 'name tasks', // Specify fields to return from the procedure
        });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json(asset);
    } catch (error) {
        debug('Error fetching asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST: Create an asset
assetRouter.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      templateId,
      ctrlNumber,
      facility,
      department,
      locationNote,
      notes,
      manufacturer,
      model,
      description,
      serialNumber,
      parentAsset,
      relationToParent,
      maintenanceSchedule,
      attributes,
    } = req.body || {};

    if (!ctrlNumber?.trim()) {
      return res.status(400).json({ error: 'ctrlNumber is required' });
    }

    if (templateId && !mongoose.Types.ObjectId.isValid(templateId)) {
      return res.status(400).json({ error: 'Invalid templateId format' });
    }
    if (parentAsset && !mongoose.Types.ObjectId.isValid(parentAsset)) {
      return res.status(400).json({ error: 'Invalid parentAsset format' });
    }

    let tpl = null;
    if (templateId) {
      tpl = await EquipmentTemplate.findById(templateId).lean();
      if (!tpl) return res.status(404).json({ error: 'Template not found' });
    }

    const payload = {
      ctrlNumber: ctrlNumber.trim(),
      templateId: templateId || null,
      manufacturer: (manufacturer ?? tpl?.manufacturer ?? '').toString().trim(),
      model: (model ?? tpl?.model ?? '').toString().trim(),
      description: (description ?? tpl?.description ?? tpl?.brandName ?? ''),
      kind: tpl?.kind || 'GenericAsset',
      serialNumber: serialNumber || undefined,
      equipmentClass: tpl?.equipmentClass || '',
      classificationName: tpl?.classificationName || '',
      regulationNumber: tpl?.regulationNumber || '',
      panel: tpl?.panel || '',
      recordStatus: tpl?.recordStatus || '',
      submissionNumber: tpl?.submissionNumber || '',
      manufacturerDUNS: tpl?.manufacturerDUNS || '',
      gmdnDefinition: tpl?.gmdnDefinition || '',
      facility,
      department,
      locationNote,
      notes: notes ?? null,
      parentAsset: parentAsset || null,
      relationToParent,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      attributes: {
        ...(attributes && typeof attributes === 'object' ? attributes : {}),
        ...(tpl?.di ? { di: tpl.di } : {}),
        ...(tpl?.fdaProductCode ? { fdaProductCode: tpl.fdaProductCode } : {}),
        ...(tpl?.gmdnTerm ? { gmdnTerm: tpl.gmdnTerm } : {}),
        ...(tpl?.gmdnCode ? { gmdnCode: tpl.gmdnCode } : {}),
        ...(tpl?.issuingAgency ? { issuingAgency: tpl.issuingAgency } : {}),
        ...(tpl?.brandName ? { brandName: tpl.brandName } : {}),
      },
    };

    if (!payload.manufacturer) {
      return res.status(400).json({ error: 'manufacturer is required (from template or body)' });
    }
    if (!payload.model) {
      return res.status(400).json({ error: 'model is required (from template or body)' });
    }

    if (maintenanceSchedule && typeof maintenanceSchedule === 'object') {
      payload.maintenanceSchedule = { ...maintenanceSchedule };
    } else if (tpl?.manufacturerRecommendedPMFrequency) {
      payload.maintenanceSchedule = {
        intervalMonths: tpl.manufacturerRecommendedPMFrequency,
      };
    }

    const duplicate = await Asset.findOne({
      $or: [
        { ctrlNumber: payload.ctrlNumber },
        ...(payload.serialNumber ? [{ serialNumber: payload.serialNumber }] : []),
      ],
    });

    if (duplicate) {
      payload.duplicateOf = duplicate._id; // Optional: add this field to your Asset model

      const asset = await Asset.create(payload);
      return res.status(201).json({
        asset,
        duplicateOf: duplicate._id,
        warning: 'Potential duplicate detected based on Tag# or Serial#',
      });
    }

    const asset = await Asset.create(payload);
    return res.status(201).json({ message: 'Asset created successfully', asset });

  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'ctrlNumber';
      return res.status(409).json({
        error: 'Duplicate value',
        field,
        value: error?.keyValue?.[field],
        message: `${field} must be unique.`,
      });
    }

    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.fromEntries(
          Object.entries(error.errors).map(([k, v]) => [k, v.message])
        ),
      });
    }

    console.error('Error creating asset:', error);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PATCH: set or clear a parent for a child asset
assetRouter.patch('/:childId/parent', async (req, res) => {
  try {
    const { childId } = req.params;
    const { parentAsset, relationToParent } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(400).json({ error: 'Invalid childId format' });
    }
    if (parentAsset && !mongoose.Types.ObjectId.isValid(parentAsset)) {
      return res.status(400).json({ error: 'Invalid parentAsset format' });
    }

    const child = await Asset.findById(childId);
    if (!child) return res.status(404).json({ error: 'Child asset not found' });

    // Optional policy: enforce serial for children
    // if (parentAsset && !child.serialNumber) {
    //   return res.status(400).json({ error: 'Child assets must have a serialNumber.' });
    // }

    child.parentAsset = parentAsset || null;
    if (relationToParent !== undefined) {
      const allowed = ['Monitors', 'Component', 'Accessory', 'Connected', 'Other'];
      child.relationToParent = allowed.includes(relationToParent) ? relationToParent : 'Other';
    }

    await child.save(); // schema pre-save will guard against cycles/self-parenting
    res.json({ message: 'Parent updated', asset: child });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update parent' });
  }
});

// GET: direct children of an asset
assetRouter.get('/:id/children', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }
    const children = await Asset.find({ parentAsset: id })
      .select('ctrlNumber manufacturer model serialNumber status relationToParent parentAsset')
      .lean();
    res.json(children);
  } catch (err) {
    res.status(400).json({ error: 'Failed to list children' });
  }
});

// GET: lineage (ancestors up the chain)
assetRouter.get('/:id/lineage', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }
    const chain = [];
    let node = await Asset.findById(id).select('parentAsset ctrlNumber').lean();
    let hops = 0;
    while (node?.parentAsset && hops < 20) {
      const parent = await Asset.findById(node.parentAsset)
        .select('ctrlNumber manufacturer model serialNumber status parentAsset').lean();
      if (!parent) break;
      chain.push(parent);
      node = parent; hops++;
    }
    res.json(chain); // nearest parent first
  } catch (err) {
    res.status(400).json({ error: 'Failed to get lineage' });
  }
});

// GET: small tree (asset + nested children up to ?depth=)
assetRouter.get('/:id/tree', async (req, res) => {
  try {
    const { id } = req.params;
    const depth = Math.min(parseInt(req.query.depth || '3', 10) || 3, 6); // sane caps
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    async function build(nodeId, level) {
      const node = await Asset.findById(nodeId)
        .select('ctrlNumber manufacturer model serialNumber status relationToParent parentAsset')
        .lean();
      if (!node) return null;

      if (level >= depth) {
        return { ...node, children: [] };
      }
      const kids = await Asset.find({ parentAsset: nodeId })
        .select('ctrlNumber manufacturer model serialNumber status relationToParent parentAsset')
        .lean();

      const children = [];
      for (const k of kids) {
        const sub = await build(k._id, level + 1);
        if (sub) children.push(sub);
      }
      return { ...node, children };
    }

    const tree = await build(id, 1);
    if (!tree) return res.status(404).json({ error: 'Asset not found' });
    res.json(tree);
  } catch (err) {
    res.status(400).json({ error: 'Failed to build tree' });
  }
});

// PUT: Update an asset by ID
assetRouter.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const updatedAsset = await Asset.findByIdAndUpdate(id, updatedData, { new: true, runValidators: true });
        if (!updatedAsset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset updated successfully', asset: updatedAsset });
    } catch (error) {
        debug('Error updating asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE: Remove an asset by ID
assetRouter.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const deletedAsset = await Asset.findByIdAndDelete(id);
        if (!deletedAsset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
        debug('Error deleting asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE: clear a parent from a child asset
assetRouter.delete('/:childId/parent', async (req, res) => {
  try {
    const { childId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(400).json({ error: 'Invalid childId format' });
    }
    const child = await Asset.findById(childId);
    if (!child) return res.status(404).json({ error: 'Child asset not found' });

    // no-op if already null is fine
    child.parentAsset = null;
    child.relationToParent = 'Other'; // optional reset
    await child.save();

    res.json({ message: 'Parent cleared', asset: child });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to clear parent' });
  }
});

// Nested router for work orders
assetRouter.use('/:assetId/workorders', (req, res, next) => {
    req.assetId = req.params.assetId; // Pass assetId to workOrderRouter
    next();
}, workOrderRouter);

module.exports = assetRouter;
