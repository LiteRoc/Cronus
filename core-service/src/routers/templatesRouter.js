const lifecycle = require('../services/templateLifecycle');
const ownership = require('../services/operationalOwnership');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const EquipmentTemplate = require('../models/EquipmentTemplate');
const Asset = require('../models/Asset');
const { buildTenantFilter } = require('../middleware/tenantScope');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { extractDIFromUDI, fetchDeviceFromGUDID, mapGUDIDToTemplatePayload, fetchClassificationByProductCode } = require('../helpers/templateHelpers');
const { getTemplateMaintenanceBenchmarks } = require('../services/templateLifecycleBenchmarks');
const debug = require('debug')('app:templatesRouter');

const router = express.Router();
const BASE = process.env.FDA_GUDID_BASE || 'https://accessgudid.nlm.nih.gov/api/v2';

// GET: All Templates
router.get('/', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const { manufacturer, q, limit = '25', skip = '0' } = req.query;
    const find = lifecycle.activeFilter();
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

// GET: shared active Template manufacturer choices (canonical Template readers).
router.get('/distinct/manufacturers', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const list = await EquipmentTemplate.distinct('manufacturer', lifecycle.activeFilter());
    res.json((list || []).filter(Boolean).sort());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  }
});

// GET: shared active Template model choices (canonical Template readers).
router.get('/distinct/models', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const { manufacturer } = req.query;
    if (!manufacturer) return res.status(400).json({ error: 'manufacturer is required' });
    const list = await EquipmentTemplate.distinct('model', { manufacturer, ...lifecycle.activeFilter() });
    res.json((list || []).filter(Boolean).sort());
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Manual creation keeps the existing admin-only policy.
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const payload = lifecycle.fields(req.body);
    if (!payload.manufacturer || !payload.model || !payload.description || !payload.equipmentClass) {
      ownership.fail(400, 'Missing required fields: manufacturer, model, description, or equipmentClass');
    }
    const template = await lifecycle.create(payload, req.user.id);
    res.status(201).json({ template, duplicateOf: template.duplicateOf,
      warning: template.duplicateOf ? 'Potential duplicate detected based on DI or manufacturer/model.' : undefined });
  } catch (error) { ownership.respond(res, error); }
});

// POST: Create an Asset/Template from DI or UDI  (no transactions)
router.post(['/from-di-or-udi', '/from-di'], authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    ownership.pick(req.body, req.path === '/from-di' ? ['di', 'udi'] : ['di', 'udi', 'createAsset', 'asset'], true);
    if (req.body.createAsset != null && typeof req.body.createAsset !== 'boolean') ownership.fail(400, 'Invalid createAsset');
    const { di: rawDi, udi, createAsset = false } = req.body;
    let assetInput = {};
    let facilityId;
    if (createAsset) {
      facilityId = await ownership.selectedFacility(req);
      ownership.agreeFacility(req.body.asset || {}, facilityId);
      assetInput = ownership.pick(req.body.asset || {}, ownership.assetCreateFields);
      await ownership.assetReferences(assetInput, facilityId);
    }
    if ((rawDi != null && typeof rawDi !== 'string') || (udi != null && typeof udi !== 'string')) ownership.fail(400, 'Invalid device identifier');
    if (createAsset && assetInput.ctrlNumber != null && typeof assetInput.ctrlNumber !== 'string') ownership.fail(400, 'Invalid control number');
    let di = rawDi;

    // 1) Resolve DI
    if (!di && udi) {
      const parsed = extractDIFromUDI(udi);
      di = parsed?.di;
    }
    if (!di || !di.trim()) return res.status(400).json({ error: 'Provide di or udi' });
    di = di.trim();
    const existing = await EquipmentTemplate.findOne({ di });
    if (existing) await lifecycle.active(existing.id);

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

    // Provider data cannot set lifecycle state or client-selected audit fields.
    tplPayload.di = di;
    const providerData = Object.fromEntries(lifecycle.providerFields
      .filter(key => Object.hasOwn(tplPayload, key)).map(key => [key, tplPayload[key]]));
    const templateDoc = await lifecycle.upsertProvider(providerData, req.user.id);

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
    const { pi = {} } = extractDIFromUDI(udi || '');
    const assetPayload = {
      ctrlNumber: assetInput.ctrlNumber?.trim(),
      templateId: templateDoc._id,
      manufacturer: (assetInput.manufacturer ?? templateDoc.manufacturer ?? '').toString().trim(),
      model: (assetInput.model ?? templateDoc.model ?? '').toString().trim(),
      description: assetInput.description ?? templateDoc.description ?? templateDoc.brandName ?? '',
      equipmentClass: templateDoc.equipmentClass,
      serialNumber: assetInput.serialNumber ?? pi.serialNumber ?? undefined,
      facilityId,
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
      createdBy: req.user.id,
      updatedBy: req.user.id,
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
    const assetId = new mongoose.Types.ObjectId();
    const assetDoc = await lifecycle.withReference(templateDoc._id, 'asset-create', assetId,
      () => Asset.create({ ...assetPayload, _id: assetId }));

    return res.status(201).json({
      template: templateDoc,
      asset: assetDoc,
      duplicateOf: templateDoc.duplicateOf || null,
      warning: templateDoc.duplicateOf
        ? 'Potential duplicate detected based on DI or manufacturer/model.'
        : undefined
    });

  } catch (e) {
    if (axios.isAxiosError(e)) return res.status(502).json({ error: 'Provider lookup failed' });
    return ownership.respond(res, e);
  }
});

// Provider refresh cannot mutate archived Templates or accept caller verification.
router.patch('/:id/sync-gudid', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const body = ownership.pick(req.body, ['di', 'udi'], true);
    const template = await lifecycle.active(req.params.id);
    if ((body.di != null && typeof body.di !== 'string') || (body.udi != null && typeof body.udi !== 'string')) ownership.fail(400, 'Invalid device identifier');
    const di = template.di || body.di || extractDIFromUDI(body.udi).di || body.udi;
    if (!di || !di.trim()) ownership.fail(400, 'No DI provided in template or request');
    const mapped = await mapGUDIDToTemplatePayload(await fetchDeviceFromGUDID(di.trim()));
    mapped.di = di.trim();
    const data = Object.fromEntries(lifecycle.providerFields
      .filter(key => Object.hasOwn(mapped, key)).map(key => [key, mapped[key]]));
    const updated = await lifecycle.update(template.id, data, req.user.id, true);
    res.json({ message: 'Template synced from GUDID', template: updated, duplicateOf: updated.duplicateOf });
  } catch (error) {
    if (axios.isAxiosError(error)) return res.status(502).json({ error: 'Provider lookup failed' });
    ownership.respond(res, error);
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin', 'tech'), async (req, res) => {
  try {
    const fields = lifecycle.fields(req.body);
    if (!Object.keys(fields).length) ownership.fail(400, 'No editable fields');
    const template = await lifecycle.update(req.params.id, fields, req.user.id);
    res.json({ message: 'Template updated successfully', template });
  } catch (error) { ownership.respond(res, error); }
});

// Preserve the misspelled public endpoint while moving the UI to /archive.
router.patch(['/:id/archive', '/:id/achive'], authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    ownership.pick(req.body || {}, [], true);
    const template = await lifecycle.archive(req.params.id, req.user.id);
    res.json({ message: 'Template archived', template });
  } catch (error) { ownership.respond(res, error); }
});

// GET: lifecycle summary for a template/model
router.get('/:id/lifecycle', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res) => {
  try {
    const { id } = req.params;

    const facilityId = String(req.headers['x-facility-id'] || '').trim();
    if (!mongoose.Types.ObjectId.isValid(facilityId)) {
      return res.status(400).json({ error: 'A valid x-facility-id header is required' });
    }

    let tenantFilter;
    try {
      tenantFilter = buildTenantFilter(req);
    } catch (error) {
      if (error.message.startsWith('Forbidden:')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }

    const template = await EquipmentTemplate.findById(id).lean();

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const facts=await require('../services/templateLifecycleAggregation').getTemplateLifecycleAggregation(template,{facilityId,asOf:new Date()});
    const benchmarks=await getTemplateMaintenanceBenchmarks(id,{facilityId,template,aggregate:facts});
    const narrow=facts.rows.map(row=>row.metrics?.projectedAnnualMaintenance);
    const narrowComplete=narrow.every(value=>typeof value==='number'&&Number.isFinite(value));
    const averageAnnualMaintenancePerAsset=facts.rows.length&&narrowComplete?narrow.reduce((sum,value)=>sum+value,0)/facts.rows.length:null;
    // Old bucket keys are omitted: changed boundaries must not silently reuse old labels.
    const {rows,...aggregate}=facts;
    return res.json({templateId:template._id,template:{_id:template._id,manufacturer:template.manufacturer,model:template.model,description:template.description},...aggregate,benchmarks,
      members:rows.map(row=>({assetId:row.assetId,asset:row.asset??null,replacementAssessment:row.assessment?.replacementAssessment??null,reason:row.reason??null})),
      summary:{totalAssets:facts.population.populationAssetCount,averageAnnualMaintenancePerAsset,maintenanceSampleCount:narrow.filter(value=>typeof value==='number').length,replacementRecommendedCount:facts.replacementReview.recommendedCount,replacementRecommendedPercent:facts.replacementReview.recommendedPercentOfPopulation,replacementRecommendedPercentDenominator:'populationAssetCount'},
      deprecatedAliases:{averageAnnualMaintenancePerAsset:'observed internal labor + parts; nullable complete fleet mean; not directMaintenance',replacementRecommendedPercent:'percent of operational population; null if empty',ageBuckets:'removed; use age.buckets with explicit continuous boundaries',lifecycleDefaults:'removed from operational summary; raw reference evidence is not adopted policy'}});
  } catch (err) {
    console.error('GET /templates/:id/lifecycle failed:', err);
    return res.status(500).json({
      error: 'Failed to compute template lifecycle summary',
    });
  }
});

module.exports = router;
