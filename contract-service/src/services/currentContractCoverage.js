// Current snapshot only. Amendment dates and financial timelines are not membership sources.
const idOf = value => String(value?._id ?? value ?? '').trim().toLowerCase();
const validId = value => /^[a-f\d]{24}$/.test(value);
export class CoverageError extends Error {
  constructor(code, message, status = 409, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export function normalizeAssetIds(values, field = 'Asset IDs') {
  if (!Array.isArray(values)) throw new CoverageError('invalid_asset_ids', `${field} must be an array`, 400);
  const ids = values.map(idOf);
  if (ids.some(id => !validId(id))) throw new CoverageError('invalid_asset_id', `${field} contains an invalid Asset ID`, 400);
  return [...new Set(ids)];
}
export function resolveCurrentContractCoverage(contract) {
  const raw = (contract.coveredAssets ?? []).map(idOf);
  return {
    basis: 'current_snapshot',
    assetIds: [...new Set(raw.filter(validId))],
    invalidReferenceCount: raw.filter(id => !validId(id)).length,
    historicalReconstructionSupported: false
  };
}
export function resolveVendorResponsibility(contract, link) {
  const membership = new Set(resolveCurrentContractCoverage(contract).assetIds);
  const raw = [...new Set((link.coveredAssetIds ?? []).map(idOf))];
  return {
    assetIds: raw.filter(id => validId(id) && membership.has(id)),
    outOfCoverageAssetIds: raw.filter(id => validId(id) && !membership.has(id)),
    invalidReferenceCount: raw.filter(id => !validId(id)).length
  };
}
export function inspectVendorCoverage(contract) {
  const links = contract.vendorLinks ?? [];
  const anomalies = links.flatMap(link => {
    const result = resolveVendorResponsibility(contract, link);
    return result.outOfCoverageAssetIds.length || result.invalidReferenceCount ? [{
      linkId: idOf(link._id),
      ...result
    }] : [];
  });
  const overlaps = [];
  for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) {
    const a = links[i],
      b = links[j],
      other = new Set(resolveVendorResponsibility(contract, b).assetIds);
    const shared = resolveVendorResponsibility(contract, a).assetIds.filter(id => other.has(id));
    if (!shared.length) continue;
    const complementary = new Set([a.coverageType, b.coverageType]).size === 2 && [a.coverageType, b.coverageType].every(type => ['parts-only', 'labor-only'].includes(type));
    overlaps.push({
      linkIds: [idOf(a._id), idOf(b._id)],
      assetIds: shared,
      scopeTypes: [a.coverageType, b.coverageType],
      status: complementary ? 'complementary' : 'requires_review',
      code: complementary ? 'complementary_responsibility' : 'responsibility_overlap_requires_review'
    });
  }
  return {
    basis: 'current_snapshot',
    isConsistent: anomalies.length === 0,
    anomalies,
    overlaps,
    exclusivityPolicy: 'not_configured'
  };
}
export function assertResponsibilityContained(contract, ids) {
  const coverage = resolveCurrentContractCoverage(contract);
  if (coverage.invalidReferenceCount) throw new CoverageError('invalid_contract_coverage', 'Contract coverage contains invalid references; review required');
  const membership = new Set(coverage.assetIds);
  if (ids.some(id => !membership.has(id))) throw new CoverageError('outside_contract_coverage', 'Vendor responsibility must remain within current Contract coverage');
}
export async function validateVendorAssetAdditions({
  contract,
  assetIds,
  coreClient,
  facilityId
}) {
  const ids = normalizeAssetIds(assetIds);
  if (!validId(idOf(contract.facilityId)) || idOf(contract.facilityId) !== idOf(facilityId)) throw new CoverageError('contract_facility_mismatch', 'Contract not found in the selected Facility', 404);
  assertResponsibilityContained(contract, ids);
  for (const id of ids) {
    let asset;
    try {
      const {
        data
      } = await coreClient.get(`/assets/${id}`);
      asset = data;
    } catch (error) {
      if ([400, 403, 404].includes(error.response?.status)) throw new CoverageError('asset_unavailable', 'An Asset is unavailable in the selected Facility', 400);
      throw new CoverageError('asset_validation_unavailable', 'Asset validation is unavailable; no changes were saved', 503);
    }
    if (!asset || idOf(asset._id) !== id || idOf(asset.facilityId) !== idOf(contract.facilityId) || asset.deletedAt || asset.isArchived) throw new CoverageError('asset_unavailable', 'An Asset is unavailable in the selected Facility', 400);
  }
  return ids;
}
export function assertCoverageChangeSafe(contract, nextCoverage) {
  const next = {
    coveredAssets: nextCoverage,
    vendorLinks: contract.vendorLinks
  };
  const inspection = inspectVendorCoverage(next);
  if (!inspection.isConsistent) throw new CoverageError('vendor_responsibility_conflict', 'Coverage change requires explicit vendor responsibility disposition first', 409, inspection);
}
export function sendCoverageError(res, error) {
  if (error instanceof CoverageError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? {
        coverage: error.details
      } : {})
    });
    return true;
  }
  if (error.name === 'VersionError' || error.name === 'DocumentNotFoundError') {
    res.status(409).json({
      error: 'Contract changed concurrently; reload and retry',
      code: 'contract_revision_conflict'
    });
    return true;
  }
  return false;
}
