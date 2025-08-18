const axios = require('axios');
const BASE = process.env.FDA_GUDID_BASE || 'https://accessgudid.nlm.nih.gov/api/v2';

function extractDIFromUDI(input) {
  if (!input || typeof input !== 'string') return { di: null };

  const raw = input.trim();

  // HIBCC (+) and ICCBBA (=) pass through as-is
  if (raw.startsWith('+')) return { di: raw, issuingAgency: 'HIBCC' };
  if (raw.startsWith('=')) return { di: raw, issuingAgency: 'ICCBBA' };

  // ---- GS1 parsing ----
  // Normalize: remove non-printables; keep parens for AI boundaries
  const text = raw.replace(/[\u0000-\u001F\u007F]/g, '');

  // 1) Parentheses style e.g. "(01)00840682104784(21)ABC(11)240101"
  const mParen = text.match(/\(01\)\s*([0-9]{14})/);
  let di = mParen?.[1];

  // 2) Compact style (no parentheses), find "01" + 14 digits
  if (!di) {
    const compact = text.replace(/[^0-9A-Za-z]/g, '');
    const i = compact.indexOf('01');
    if (i !== -1) {
      const candidate = compact.slice(i + 2, i + 2 + 14);
      if (/^\d{14}$/.test(candidate)) di = candidate;
    }
  }

  // Parse a few common PI AIs for convenience
  const getAI = (ai, len, variable = false) => {
    // Parentheses case
    const r = new RegExp(`\\(${ai}\\)\\s*([^()]+)`);
    const m = text.match(r);
    if (m) return variable ? m[1] : m[1].slice(0, len);

    // Compact fallback
    const compact = text.replace(/[^0-9A-Za-z]/g, '');
    const idx = compact.indexOf(ai);
    if (idx === -1) return undefined;
    const rest = compact.slice(idx + ai.length);
    if (variable) {
      // stop at the next AI start (very rough but works well enough)
      const next = rest.search(/(0[1-9]|1[0-9]|2[0-9]|3[0-9])/);
      return next > 0 ? rest.slice(0, next) : rest;
    }
    return rest.slice(0, len);
  };

  const toISO = (yymmdd) => {
    if (!yymmdd || yymmdd.length !== 6) return undefined;
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${yymmdd.slice(2,4)}-${yymmdd.slice(4,6)}`;
  };

  const pi = {
    lotNumber: getAI('10', 0, true),
    serialNumber: getAI('21', 0, true),
    mfgDate: toISO(getAI('11', 6)),
    expDate: toISO(getAI('17', 6)),
  };

  return { di: di || null, issuingAgency: di ? 'GS1' : undefined, pi };
}

async function fetchDeviceFromGUDID(di) {
  const url = `${BASE}/devices/lookup.json`;
  const { data } = await axios.get(url, { params: { di } });
  return data;
}

// PRIVATE helper
function pickProductCode(device) {
  const candidates = [
    { key: 'device.productCodes.fdaProductCode[0].productCode', value: device?.productCodes?.fdaProductCode?.[0]?.productCode },
    { key: 'device.productCodes.fda[0].productCode', value: device?.productCodes?.fda?.[0]?.productCode },
    { key: 'device.productCodes[0].productCode', value: device?.productCodes?.[0]?.productCode },
    { key: 'device.productCodes[0].code', value: device?.productCodes?.[0]?.code },
    { key: 'device.productCode', value: device?.productCode },
    { key: 'device.fdaProductCode', value: device?.fdaProductCode },
    { key: 'device.fda_product_code', value: device?.fda_product_code },
  ].filter(c => Boolean(c.value));

  if (candidates.length > 0) {
    console.log(`[pickProductCode] Using FDA product code: ${candidates[0].value} (from ${candidates[0].key})`);
    return candidates[0].value;
  }

  console.warn('[pickProductCode] No product code found in provided device object.');
  console.log('productCodes keys:', Object.keys(device?.productCodes || {}));
  return '';
}

// Map AccessGUDID JSON -> your template fields (w/ description)
async function mapGUDIDToTemplatePayload(deviceJson) {
  const device = deviceJson?.gudid?.device || deviceJson?.device || deviceJson;

  //const di = device?.di || device?.deviceId || '';
  const di =
    device?.identifiers?.[0]?.deviceId ||  // <-- often found here
    device?.identifiers?.[0]?.deviceIdentifier ||
    device?.di ||
    device?.deviceId || 
    '';

  const brandName = device?.brandName || device?.tradeName || '';
  const model =
    device?.versionOrModelNumber ||
    device?.modelNumber ||
    device?.brandName ||
    'Unknown Model';
  const catalogNumber = device?.catalogNumber || '';

  // Try multiple places for a human-friendly description, then fall back
  const rawDescription =
    device?.deviceDescription ||
    device?.deviceName?.name ||
    device?.gmdnPTDefinition || // sometimes present and descriptive
    '';

  const description = (
    rawDescription ||
    `${brandName || ''} ${model || ''}${catalogNumber ? ` (Cat ${catalogNumber})` : ''}`
  ).trim();

  const fdaProductCode = pickProductCode(device);

  // Temp: to confirm where the FDA code actually appears for my specific device
  //console.log(Object.keys(device));
  let equipmentClass = '';
  let classificationName = '';
  let classification = null;

  // If product code found, try to look up classification
  if (fdaProductCode) {
    try {
      classification = await fetchClassificationByProductCode(fdaProductCode);
      equipmentClass = classification?.equipmentClass || '';
      classificationName = classification?.classificationName || '';
      console.log(`[mapGUDIDToTemplatePayload] Equipment class for ${fdaProductCode}: "${equipmentClass}"`);
    } catch (err) {
      console.warn(`[mapGUDIDToTemplatePayload] Failed to fetch classification for ${fdaProductCode}:`, err.message);
    }
  } else {
    console.warn('[mapGUDIDToTemplatePayload] Skipping classification lookup — no product code found.');
  }

  return {
    di,
    manufacturer: device?.companyName || device?.labelerName || device?.company || '',
    model,
    brandName,
    versionOrModel: device?.versionOrModelNumber || device?.modelNumber || '',
    catalogNumber,
    fdaProductCode,
    gmdnTerm: device?.gmdnTerms?.gmdn?.[0]?.gmdnPTName || device?.gmdnPTName || device?.gmdnTerm || '',
    gmdnDefinition: device?.gmdnTerms?.gmdn?.[0]?.gmdnPTDefinition || '',
    mrSafetyStatus: device?.MRISafetyStatus || device?.mrSafetyStatus || '',
    issuingAgency: device?.issuingAgency || device?.udiIssuingAgency || '',
    description,

    // ✅ New fields
    classificationName: classificationName || device?.productCodes?.fdaProductCode?.[0]?.productCodeName || '',
    regulationNumber: classification?.regulationNumber || '',
    panel: classification?.panel || '',
    recordStatus: device?.deviceRecordStatus || '',
    prescriptionRequired: device?.rx ?? null,
    otc: device?.otc ?? null,
    submissionNumber: device?.premarketSubmissions?.premarketSubmission?.[0]?.submissionNumber || '',
    manufacturerDUNS: device?.dunsNumber || '',

    equipmentClass,
    verified: true,
    status: 'Active',
  };
}

// Lookup FDA device class by product code (openFDA)
async function fetchClassificationByProductCode(productCode) {
  if (!productCode) return null;
  try {
    const url = `https://api.fda.gov/device/classification.json?search=product_code:${encodeURIComponent(productCode)}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const rec = data?.results?.[0];
    if (!rec) return null;
    
    return {
        equipmentClass: rec.device_class ? `Class ${rec.device_class}` : undefined,
        panel: rec.panel,
        regulationNumber: rec.regulation_number,
        deviceName: rec.device_name
    };
  } catch {
    return null; // don't fail your request if openFDA hiccups
  }
}

module.exports = {
  extractDIFromUDI,
  fetchDeviceFromGUDID,
  mapGUDIDToTemplatePayload,
  fetchClassificationByProductCode
};