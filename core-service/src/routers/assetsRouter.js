const express = require('express');
const mongoose = require('mongoose');
const debug = require('debug')('app:assetsRouter');
const Asset = require('../models/Asset'); // Import the Asset model
const EquipmentTemplate = require('../models/EquipmentTemplate.js');
const WorkOrder = require('../models/WorkOrder'); // Import the WorkOrder model
//const Contract = require('../models/Contract'); // Import the Contract model
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware'); // Middleware for authentication/authorization
const { buildTenantFilter } = require('../middleware/tenantScope');
const workOrderRouter = require('./workOrderRouter'); // Work order routes
const { computeLifecycleMetrics } = require('../utils/lifecycle');
const { getMaintenanceTotals } = require('../services/lifecycleMaintenance.js').default;
const { computeBenchmarkComparison } = require('../utils/lifecycleBenchmark');

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

    const { search, manufacturer, model, status, page = 1, limit = 10, facilityId, departmentId, templateId, ctrlNumber, replacementRecommended, ageExceeded, highMaintenance, ccrAboveBenchmark } = req.query;

    try {
        const query = { ...base };
        if (search) {
            query.$or = [
                { ctrlNumber: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } },
                { serialNumber: { $regex: search, $options: 'i' } },
            ];
        }

        if (facilityId && mongoose.Types.ObjectId.isValid(facilityId)) {
          query.facilityId = facilityId;
        }

        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
          query.departmentId = departmentId;
        }

        if (templateId && mongoose.Types.ObjectId.isValid(templateId)) {
          query.templateId = new mongoose.Types.ObjectId(templateId);
        }

        if (ctrlNumber) {
          query.ctrlNumber = { $regex: ctrlNumber, $options: "i" };
        }

        if (replacementRecommended === "true") {
          query["metrics.replacementRecommended"] = true;
        }

        if (ageExceeded === "true") {
          query["metrics.replacementRecommended"] = true;
          query["metrics.replacementReason"] = /expected life|useful life|exceeds/i;
        }

        if (highMaintenance === "true") {
          query["metrics.projectedAnnualMaintenance"] = { $gt: 0 };
          // Better comparison to benchmark can come later if needed.
        }

        if (ccrAboveBenchmark === "true") {
          query["metrics.replacementReason"] = /maintenance|CCR|capital cost/i;
        }

        if (manufacturer) query.manufacturer = manufacturer;
        if (model) query.model = model;
        //if (status) query.status = status || "Active";
        query.status = status ?? 'Active'
        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
          query.departmentId = new mongoose.Types.ObjectId(departmentId); // ✅ only if explicitly provided
        }

        // Use if want to limit customer to a department
        /*if (req.user.role === 'customer' && req.user.departmentId) {
          query.departmentId = req.user.departmentId;
        }*/

        //console.log('Final asset query:', query);

        // Parse the `page` and `limit` to ensure they are numbers
        const pageNumber = parseInt(page, 10) || 1; // Default to 1 if not provided
        let limitNumber = parseInt(limit, 10) || 10; // Default to 10 if not provided

        // Cap limit between 1 and 100
        if (limitNumber < 1) limitNumber = 1;
        if (limitNumber > 100) limitNumber = 100;
        
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
            //.populate({
              //path: 'contractId',
              //select: 'type name startDate endDate',
            //})
            .lean();


        console.log('Returned assets count:', assets.length);
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
    const userId = req.user.id;

    const populatedAssets = await Asset.find({ assignedTo: userId })
      .populate({
        path: "templateId",
        match: { isTestEquipment: true }
      })
      .lean();

    const testEquipAssets = populatedAssets.filter(a => a.templateId !== null);

    res.status(200).json(testEquipAssets);
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
          .populate({ path: 'templateId', select:  'manufacturer model description benchmark lifecycleDefaults eolYears' })
          .populate({ path: 'workOrders', select: 'description status scheduledDate completionDate' })
          .populate({ path: 'maintenanceSchedule.procedure', select: 'name tasks' });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const benchmarkComparison = computeBenchmarkComparison(asset, asset.templateId);

        res.status(200).json({
          ...asset.toObject(),
          benchmarkComparison,
        });
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
      facilityId,
      departmentId,
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

    console.log('Incoming created Asset:', req.body);

    if (!ctrlNumber?.trim()) {
      return res.status(400).json({ error: 'ctrlNumber is required' });
    }

    if (templateId && !mongoose.Types.ObjectId.isValid(templateId)) {
      return res.status(400).json({ error: 'Invalid templateId format' });
    }
    if (parentAsset && !mongoose.Types.ObjectId.isValid(parentAsset)) {
      return res.status(400).json({ error: 'Invalid parentAsset format' });
    }
    if (facilityId && !mongoose.Types.ObjectId.isValid(facilityId)) {
      return res.status(400).json({ error: 'Invalid facilityId format' });
    }
    if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ error: 'Invalid departmentId format' });
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
      model: (model ?? tpl?.model ?? tpl?.versionOrModel ?? '').toString().trim(),
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
      facilityId,
      departmentId,
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

    console.log("attributes type:", typeof payload.attributes, Array.isArray(payload.attributes));
    console.dir(payload.attributes, { depth: 5 });


    console.log("Final payload to create Asset:", payload);

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
      console.error("Asset validation error:", error?.errors || error);
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

// ---------- Batch get assets ----------
assetRouter.post("/batch", authenticateToken, async (req, res) => {
    try {
      // NOTE: do not destructure here ... req.body.assetIds is an array
      const assetIds = req.body.assetIds ?? req.body.ids;
      const tenantId = req.user.tenantId;

      console.log( "assetIds:", assetIds);

      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        console.warn("assets/batch called without assetIds array", req.body);
        return res
          .status(400)
          .json({ message: "assetIds must be a non-empty array" });
      }

      // Query all assets by ID + tenant
      const assets = await Asset.find({
        _id: { $in: assetIds },
        tenantId,
      })
        .lean();

      return res.json({ assets: [].concat(assets) });
    } catch (error) {
      console.error("Error fetching batch assets:", error);
      return res.status(500).json({
        message: "Server error fetching assets",
        error,
      });
    }
  }
);

// PUT: Update an asset by ID
assetRouter.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
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
assetRouter.patch('/:id/archive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
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

    // Ensure the asset belongs to the tenant
    const owned = await Asset.exists({ _id: assetId, ...buildTenantFilter(req) });

    if (!owned) return res.status(404).json({ error: 'Asset not found' });

    // Fetch asset-specific work orders
    const workOrders = await WorkOrder.find({ assetId, ...buildTenantFilter(req) })
      .select("workOrderNumber description status workOrderType assignedTo createdAt dueDate scheduledDate")
      .populate("assignedTo", "name email username");

    res.json({ workOrders });
});

assetRouter.get('/:id/lifecycle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid asset ID format' });

    const asset = await Asset.findOne({ _id: id, ...buildTenantFilter(req) })
      .populate('templateId')
      .lean();

    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const template = asset.templateId || null // in case we want to pull lifecycle defaults from the template;

    const maintenanceTotals = await getMaintenanceTotals(asset._id);

    const metrics = computeLifecycleMetrics({
      asset,
      template,
      lifetimeMaintenanceTotal: maintenanceTotals.lifetime.total,
      last12MonthMaintenanceTotal: maintenanceTotals.last12Months.total,
    });
    
    res.json({ 
      assetId: asset._id,
      templateId: asset.templateId?._id || null,
      purchase: asset.purchase || null,
      metrics });
  } catch (err) {
    console.error('GET /assets/:id/lifecycle failed:', err);
    return res.status(500).json({ error: 'Failed to calculate lifecycle' });
  }
});

module.exports = assetRouter;
