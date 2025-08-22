const express = require('express');
const mongoose = require('mongoose');
const debug = require('debug')('app:assetsRouter');
const Asset = require('../models/Asset'); // Import the Asset model
const EquipmentTemplate = require('../models/EquipmentTemplate.js');
const WorkOrder = require('../models/WorkOrder'); // Import the WorkOrder model
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware'); // Middleware for authentication/authorization
const { buildTenantFilter } = require('../middleware/tenantScope');
const workOrderRouter = require('./workOrderRouter'); // Work order routes

mongoose.set('strictPopulate', false); // Allow non-strict population

const assetRouter = express.Router();

// Manufacturers seen in this tenant's assets
assetRouter.get('/distinct/manufacturers', authenticateToken, async (req, res) => {
  try {
    const manufacturers = await Asset.distinct('manufacturer', buildTenantFilter(req));
    res.json((manufacturers || []).filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch manufacturers.' });
  }
});

// Models seen in this tenant's assets (optionally by manufacturer)
assetRouter.get('/distinct/models', authenticateToken, async (req, res) => {
  try {
    const { manufacturer } = req.query;
    const filter = { ...buildTenantFilter(req), ...(manufacturer ? { manufacturer } : {}) };
    const models = await Asset.distinct('model', filter);
    res.json((models || []).filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models.' });
  }
});

// GET all assets with optional filtering
assetRouter.get('/', authenticateToken, async (req, res) => {

  const tenantFilter = buildTenantFilter(req);
  const base = { ...tenantFilter, status: { $ne: 'Archived' }};

    const { search, manufacturer, model, status, page = 1, limit = 10 } = req.query;

    try {
        const query = { ...base};
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
assetRouter.get('/test-equipment', authenticateToken, async (req, res) => {
    try {
        const filter = { ...buildTenantFilter(req), category: 'test' };
        const testEquipment = await Asset.find(filter).lean();
        res.status(200).json(testEquipment);
    } catch (error) {
        debug('Error fetching test equipment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET a single asset by ID
assetRouter.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const filter = { _id: id, ...buildTenantFilter(req) };
        const asset = await Asset.findOne(filter)
          .populate({ path: 'workOrders', select: 'description status scheduledDate completionDate' })
          .populate({ path: 'maintenanceSchedule.procedure', select: 'name tasks' });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json(asset);
    } catch (error) {
        debug('Error fetching asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST: Create an asset
assetRouter.post('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
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

// PUT: Update an asset by ID
assetRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'utech'), async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        const updated = await Asset.findOneAndUpdate({ _id: id, ...buildTenantFilter(req) }, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset updated successfully', asset: updated });
    } catch (error) {
        debug('Error updating asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH: SOFT DELETE / Remove an asset by ID
assetRouter.patch('/:id/achive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const tenantFilter = buildTenantFilter(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    try {
        //const deletedAsset = await Asset.findByIdAndDelete(id, ...tenantFilter);
        // instead of findByIdAndDelete
        const deleted = await Asset.findOneAndUpdate(
          { _id: id, ...buildTenantFilter(req) },   // filter enforces tenant
          { 
            $set: { 
              deletedAt: new Date(), 
              deletedBy: req.user.id, 
              status: 'Archived' 
            } 
          },
          { new: true } // return the updated doc
        );

        if (!deleted) return res.status(404).json({ error: 'Asset not found' });

        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
        debug('Error deleting asset:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH: set or clear a parent for a child asset
assetRouter.patch('/:childId/parent', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { childId } = req.params;
    const { parentAsset, relationToParent } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(400).json({ error: 'Invalid childId format' });
    }
    if (parentAsset && !mongoose.Types.ObjectId.isValid(parentAsset)) {
      return res.status(400).json({ error: 'Invalid parentAsset format' });
    }

    // Ensure both child and (if provided) parent are within tenant scope for customers
    const child = await Asset.findOne({ _id: childId, ...buildTenantFilter(req) });
    if (!child) return res.status(404).json({ error: 'Child asset not found' });

    if (parentAsset) {
      const parent = await Asset.findOne({ _id: parentAsset, ...buildTenantFilter(req) });
      if (!parent) return res.status(404).json({ error: 'Parent asset not found (or not in tenant)' });
    }

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

// DELETE: clear a parent from a child asset
assetRouter.delete('/:childId/parent', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { childId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(400).json({ error: 'Invalid childId format' });
    }
    const child = await Asset.findById(childId, ...buildTenantFilter(req));
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

// GET: direct children of an asset
assetRouter.get('/:id/children', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }
    // Ensure the root asset is in-tenant
    const root = await Asset.findOne({ _id: id, ...buildTenantFilter(req) }).lean();
    if (!root) return res.status(404).json({ error: 'Asset not found' });

    const children = await Asset.find({ parentAsset: id, ...buildTenantFilter(req) })
      .select('ctrlNumber manufacturer model serialNumber status relationToParent parentAsset')
      .lean();
    res.json(children);
  } catch (err) {
    res.status(400).json({ error: 'Failed to list children' });
  }
});

// GET: lineage (ancestors up the chain)
assetRouter.get('/:id/lineage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid asset ID format' });

  // validate ownership of starting node
  let node = await Asset.findOne({ _id: id, ...buildTenantFilter(req) }).select('parentAsset ctrlNumber').lean();
  if (!node) return res.status(404).json({ error: 'Asset not found' });

  const chain = [];
  let hops = 0;
  while (node?.parentAsset && hops < 20) {
    const parent = await Asset.findOne({ _id: node.parentAsset, ...buildTenantFilter(req) })
      .select('ctrlNumber manufacturer model serialNumber status parentAsset')
      .lean();
    if (!parent) break;
    chain.push(parent);
    node = parent; hops++;
  }
  res.json(chain);
});

// GET: small tree (asset + nested children up to ?depth=)
assetRouter.get('/:id/tree', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const depth = Math.min(parseInt(req.query.depth || '3', 10) || 3, 6);
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid asset ID format' });

  async function build(nodeId, level) {
    const node = await Asset.findOne({ _id: nodeId, ...buildTenantFilter(req) })
      .select('ctrlNumber manufacturer model serialNumber status relationToParent parentAsset')
      .lean();
    if (!node) return null;
    if (level >= depth) return { ...node, children: [] };

    const kids = await Asset.find({ parentAsset: nodeId, ...buildTenantFilter(req) })
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
});

// Nested router for work orders
assetRouter.use('/:assetId/workorders', authenticateToken, async (req, res, next) => {
    const { assetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(assetId)) return res.status(400).json({ error: 'Invalid assetId' });
    const owned = await Asset.exists({ _id: assetId, ...buildTenantFilter(req) });
    if (!owned) return res.status(404).json({ error: 'Asset not found' });
    req.assetId = assetId;
    next();
  }, workOrderRouter);

module.exports = assetRouter;
