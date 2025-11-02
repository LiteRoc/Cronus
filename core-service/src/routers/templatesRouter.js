const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const EquipmentTemplate = require('../models/EquipmentTemplate');
const Asset = require('../models/Asset');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { extractDIFromUDI, fetchDeviceFromGUDID, mapGUDIDToTemplatePayload, fetchClassificationByProductCode } = require('../helpers/templateHelpers');

const router = express.Router();
const BASE = process.env.FDA_GUDID_BASE || 'https://accessgudid.nlm.nih.gov/api/v2';

// GET: All Templates
router.get('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { manufacturer, q, limit = '25', skip = '0' } = req.query;
    const find = {};
    if (manufacturer) find.manufacturer = manufacturer;
    if (q) {
      find.$or = [
        { model: { $regex: q, $options: 'i' } },
        { brandName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { fdaProductCode: { $regex: q, $options: 'i' } },
      ];
    }
    const skipVal = Number(skip) || 0;
    const limitNum = Number(limit) || 25;

    const totalCount = await EquipmentTemplate.countDocuments(find);
    const docs = await EquipmentTemplate.find(find)
      .skip(skipVal)
      .limit(limitNum)
      .sort({ manufacturer: 1, model: 1 });

    res.json({ templates: docs, totalCount });

  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to list templates' });
  }
});

// GET: a single template (internal only)
router.get('/:id',  authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }

    try {
      const template = await EquipmentTemplate.findById(id).lean();
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.status(200).json(template);
    } catch (error) {
      debug('Error fetching template:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// GET: Manufacturers from templates (Admin/User global; Customer optionally scoped)
router.get('/distinct/manufacturers', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role === 'customer') {
      // Limit to what this customer actually has (optional behavior)
      const list = await Asset.distinct('manufacturer', { customerId: req.user.customerId });
      return res.json((list || []).filter(Boolean).sort());
    }
    const list = await EquipmentTemplate.distinct('manufacturer');
    res.json((list || []).filter(Boolean).sort());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
});

// GET: Models from templates (Admin/User global; Customer optionally scoped)
router.get('/distinct/models', authenticateToken, async (req, res) => {
  try {
    const { manufacturer } = req.query;
    if (!manufacturer) return res.status(400).json({ error: 'manufacturer is required' });
    const list = await EquipmentTemplate.distinct('model', { manufacturer });
    res.json((list || []).filter(Boolean).sort());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST: manual upsert (admin)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const payload = req.body || {};

    // Validate required fields for manual creation
    if (!payload.manufacturer || !payload.model || !payload.description || !payload.equipmentClass) {
      return res.status(400).json({ error: 'Missing required fields: manufacturer, model, description, or equipmentClass' });
    }

    // 1. Duplicate detection
    const existing = await EquipmentTemplate.findOne({
      $or: [
        { di: payload.di },
        { manufacturer: payload.manufacturer, model: payload.model }
      ],
    });

    if (existing) {
      payload.duplicateOf = existing._id;
    }

    // 2. Create the template
    const created = await EquipmentTemplate.create(payload);

    res.status(201).json({
      template: created,
      duplicateOf: payload.duplicateOf || null,
      warning: payload.duplicateOf
        ? 'Potential duplicate detected based on DI or manufacturer/model.'
        : undefined,
    });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to create template' });
  }
});

// POST: Create an Asset/Template from DI or UDI  (no transactions)
router.post('/from-di-or-udi', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { di: rawDi, udi, createAsset = false, asset: assetInput = {} } = req.body || {};
    let di = rawDi;

    // 1) Resolve DI
    if (!di && udi) {
      const parsed = extractDIFromUDI(udi);
      di = parsed?.di;
    }
    if (!di) return res.status(400).json({ error: 'Provide di or udi' });

    // 2) Fetch & map
    const device = await fetchDeviceFromGUDID(di);
    const tplPayload = await mapGUDIDToTemplatePayload(device);
    if (!tplPayload.di && di) tplPayload.di = di;

    // 3) Enrich
    try {
      const klass = await fetchClassificationByProductCode(tplPayload.fdaProductCode);
      if (klass?.equipmentClass) {
        tplPayload.equipmentClass = klass.equipmentClass;
        tplPayload.panel = klass.panel || tplPayload.panel;
        tplPayload.regulationNumber = klass.regulationNumber || tplPayload.regulationNumber;
      }
    } catch (_) {}

    // 4) Upsert Template
    const templateDoc = await EquipmentTemplate.findOneAndUpdate(
      { di: tplPayload.di },
      { $set: tplPayload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 5) Duplicate Detection
    const potentialDuplicate = await EquipmentTemplate.findOne({
      $or: [
        { di: tplPayload.di },
        { manufacturer: tplPayload.manufacturer, model: tplPayload.model }
      ],
      _id: { $ne: templateDoc._id }
    });

    if (potentialDuplicate) {
      await EquipmentTemplate.findByIdAndUpdate(templateDoc._id, {
        $set: { duplicateOf: potentialDuplicate._id }
      });
      templateDoc.duplicateOf = potentialDuplicate._id;
    }

    // If not creating asset
    if (!createAsset) {
      return res.status(201).json({
        template: templateDoc,
        duplicateOf: templateDoc.duplicateOf || null,
        warning: templateDoc.duplicateOf
          ? 'Potential duplicate detected based on DI or manufacturer/model.'
          : undefined
      });
    }

    // 6) Build asset payload (unchanged)
    const { pi } = extractDIFromUDI(udi || '');
    const assetPayload = {
      ctrlNumber: assetInput.ctrlNumber?.trim(),
      templateId: templateDoc._id,
      manufacturer: (assetInput.manufacturer ?? templateDoc.manufacturer ?? '').toString().trim(),
      model: (assetInput.model ?? templateDoc.model ?? '').toString().trim(),
      description: assetInput.description ?? templateDoc.description ?? templateDoc.brandName ?? '',
      equipmentClass: templateDoc.equipmentClass,
      serialNumber: assetInput.serialNumber ?? pi.serialNumber ?? undefined,
      facilityId: assetInput.facilityId || undefined,
      departmentId: assetInput.departmentId || undefined,
      locationNote: assetInput.locationNote || undefined,
      notes: assetInput.notes ?? null,
      parentAsset: assetInput.parentAsset || null,
      relationToParent: assetInput.relationToParent || undefined,
      maintenanceSchedule: assetInput.maintenanceSchedule
        ? { ...assetInput.maintenanceSchedule }
        : (templateDoc.manufacturerRecommendedPMFrequency
            ? { intervalMonths: templateDoc.manufacturerRecommendedPMFrequency }
            : undefined),
      classificationName: templateDoc.classificationName || '',
      regulationNumber: templateDoc.regulationNumber || '',
      panel: templateDoc.panel || '',
      recordStatus: templateDoc.recordStatus || '',
      prescriptionRequired: templateDoc.prescriptionRequired ?? null,
      otc: templateDoc.otc ?? null,
      submissionNumber: templateDoc.submissionNumber || '',
      manufacturerDUNS: templateDoc.manufacturerDUNS || '',
      gmdnDefinition: templateDoc.gmdnDefinition || '',
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      attributes: {
        ...(typeof assetInput.attributes === 'object' ? assetInput.attributes : {}),
        ...(pi.serialNumber ? { udiSerial: pi.serialNumber } : {}),
        ...(pi.expDate ? { udiExpiration: pi.expDate } : {}),
        ...(pi.mfgDate ? { udiManufactured: pi.mfgDate } : {}),
        ...(templateDoc.di ? { di: templateDoc.di } : {}),
        ...(templateDoc.fdaProductCode ? { fdaProductCode: templateDoc.fdaProductCode } : {}),
        ...(templateDoc.gmdnTerm ? { gmdnTerm: templateDoc.gmdnTerm } : {}),
        ...(templateDoc.gmdnCode ? { gmdnCode: templateDoc.gmdnCode } : {}),
        ...(templateDoc.issuingAgency ? { issuingAgency: templateDoc.issuingAgency } : {}),
        ...(templateDoc.brandName ? { brandName: templateDoc.brandName } : {}),
      },
    };

    if (!assetPayload.manufacturer) {
      return res.status(400).json({ error: 'manufacturer is required (from template or asset body)' });
    }
    if (!assetPayload.model) {
      return res.status(400).json({ error: 'model is required (from template or asset body)' });
    }

    // 7) Create asset
    const assetDoc = await Asset.create(assetPayload);

    return res.status(201).json({
      template: templateDoc,
      asset: assetDoc,
      duplicateOf: templateDoc.duplicateOf || null,
      warning: templateDoc.duplicateOf
        ? 'Potential duplicate detected based on DI or manufacturer/model.'
        : undefined
    });

  } catch (e) {
    // same error handling block as before
    if (axios.isAxiosError(e)) {
      return res
        .status(e.response?.status || 502)
        .json({ error: e.response?.data || 'GUDID lookup failed' });
    }
    if (e?.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'ctrlNumber';
      return res.status(409).json({
        error: 'Duplicate value',
        field,
        value: e?.keyValue?.[field],
        message: `${field} must be unique.`,
      });
    }
    const status = e.status || (e.name === 'ValidationError' ? 400 : 500);
    return res.status(status).json({ error: e.message || 'Failed to create template/asset' });
  }
});

// POST: create/upsert from DI or UDI
router.post('/from-di', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { di: rawDi, udi } = req.body || {};
    let di = rawDi;
    if (!di && udi) di = extractDIFromUDI(udi).di || undefined;
    if (!di) return res.status(400).json({ error: 'Provide di or udi' });

    const device = await fetchDeviceFromGUDID(di);
    const payload = await mapGUDIDToTemplatePayload(device);
    payload.di = di;

    // Enrich with FDA classification info
    try {
      const klass = await fetchClassificationByProductCode(payload.fdaProductCode);
      if (klass?.equipmentClass) {
        payload.equipmentClass = klass.equipmentClass;
        payload.panel = klass.panel || payload.panel;
        payload.regulationNumber = klass.regulationNumber || payload.regulationNumber;
      }
    } catch (_) {
      // don't block on classification lookup
    }

    // Create or update template (based on DI)
    const doc = await EquipmentTemplate.findOneAndUpdate(
      { di: payload.di },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Now check for possible duplicates (excluding itself)
    const potentialDuplicate = await EquipmentTemplate.findOne({
      $or: [
        { di: payload.di },
        { manufacturer: payload.manufacturer, model: payload.model }
      ],
      _id: { $ne: doc._id }
    });

    if (potentialDuplicate) {
      await EquipmentTemplate.findByIdAndUpdate(doc._id, {
        $set: { duplicateOf: potentialDuplicate._id }
      });
      doc.duplicateOf = potentialDuplicate._id;
    }

    return res.status(201).json({
      template: doc,
      duplicateOf: doc.duplicateOf || null,
      warning: doc.duplicateOf
        ? 'Potential duplicate detected based on DI or manufacturer/model.'
        : undefined
    });

  } catch (e) {
    if (axios.isAxiosError(e)) {
      return res
        .status(e.response?.status || 502)
        .json({ error: e.response?.data || 'GUDID lookup failed' });
    }
    res.status(500).json({ error: e.message || 'Failed to create template from DI' });
  }
});

// PATCH: Sync/Update and existing template from GUDID
router.patch('/:id/sync-gudid', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { id } = req.params;
    const { di, udi } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const tpl = await EquipmentTemplate.findById(id);
    if (!tpl) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Prefer tpl.di, then di from body, then raw udi
    const finalDi = tpl.di || di || udi;
    if (!finalDi) {
      return res.status(400).json({ error: 'No DI provided in template or request' });
    }

    const device = await fetchDeviceFromGUDID(finalDi);
    const mapped = await mapGUDIDToTemplatePayload(device);

    // Also apply finalDi if tpl was missing it
    if (!tpl.di) {
      mapped.di = finalDi;
    }

    // Prepare updated fields
    const refresh = {
      di: mapped.di,
      issuingAgency: mapped.issuingAgency,
      brandName: mapped.brandName,
      manufacturer: mapped.manufacturer,
      model: mapped.model,
      catalogNumber: mapped.catalogNumber,
      description: mapped.description,
      fdaProductCode: mapped.fdaProductCode,
      gmdnTerm: mapped.gmdnTerm,
      gmdnDefinition: mapped.gmdnDefinition,
      equipmentClass: mapped.equipmentClass,
      classificationName: mapped.classificationName,
      regulationNumber: mapped.regulationNumber,
      panel: mapped.panel,
      recordStatus: mapped.recordStatus,
      prescriptionRequired: mapped.prescriptionRequired,
      otc: mapped.otc,
      submissionNumber: mapped.submissionNumber,
      manufacturerDUNS: mapped.manufacturerDUNS,
      _rawGUDID: mapped._rawGUDID,
      verified: true
    };

    // Check for potential duplicates
    const existing = await EquipmentTemplate.findOne({
      $or: [
        { di: mapped.di },
        { manufacturer: mapped.manufacturer, model: mapped.model }
      ],
      _id: { $ne: id } // exclude the current one
    });

    let duplicateOf = null;
    if (existing) {
      duplicateOf = existing._id;
      refresh.duplicateOf = existing._id;

      // Update the current template to mark it as a duplicate
      await EquipmentTemplate.findByIdAndUpdate(id, { $set: refresh }, { new: true });
      const updated = await EquipmentTemplate.findById(id);

      return res.status(200).json({
        message: 'Template synced from GUDID (duplicate flagged)',
        template: updated,
        duplicateOf,
        warning: 'Potential duplicate detected based on DI or manufacturer/model.'
      });
    }

    // No duplicate — update normally
    const updated = await EquipmentTemplate.findByIdAndUpdate(id, { $set: refresh }, { new: true });
    res.json({ message: 'Template synced from GUDID', template: updated });

  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || 'GUDID sync failed' });
  }
});

// PUT: Update a Template
router.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid asset ID format' });
    }

  try {
    const updatedTemplate = await EquipmentTemplate.findByIdAndUpdate(id, updatedData);
    if (!updatedTemplate) return status(404).json({ error: 'Template not found'});

    res.status(200).json({ message: 'Template updated successfully', template: updatedTemplate });
  } catch (err) {
      debug('Error updating Template:', err);
      res.status(500).json({ error: 'Internal Server Error'});
  }
});

// PATCH: SOFT DELETE / Remove and asset by ID
router.patch('/:id/achive', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const deletedTemplate = await EquipmentTemplate.findByIdAndUpdate(
            { _id: req.params.id },
            { $set: { deletedAt: new Date(), deletedBy: req.user.id, status: 'Archived', updatedBy: req.user.id } },
            { new: true }
    );
    if (!deletedTemplate) return res.status(404).json({ error: 'Template not found' });

    res.status(200).json({ message: "Template achived successfull" });
  } catch (error) {
    debug('Error achiving Template:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;