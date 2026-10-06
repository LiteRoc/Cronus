import { jest } from '@jest/globals';
import { resolveCurrentContractCoverage, resolveVendorResponsibility, inspectVendorCoverage, normalizeAssetIds, assertCoverageChangeSafe, validateVendorAssetAdditions } from '../currentContractCoverage.js';
const A = '000000000000000000000001',
  B = '000000000000000000000002',
  F = '000000000000000000000003';
const contract = (extra = {}) => ({
  facilityId: F,
  coveredAssets: [A],
  vendorLinks: [],
  ...extra
});
test('current resolver normalizes and deduplicates only membership, not vendor or amendment evidence', () => expect(resolveCurrentContractCoverage(contract({
  coveredAssets: [A, A.toUpperCase(), {
    _id: B
  }, null, 'bad'],
  vendorLinks: [{
    coveredAssetIds: ['000000000000000000000004']
  }],
  amendments: [{
    status: 'approved',
    items: [{
      assetId: '000000000000000000000005'
    }]
  }]
}))).toEqual({
  basis: 'current_snapshot',
  assetIds: [A, B],
  invalidReferenceCount: 2,
  historicalReconstructionSupported: false
}));
for (const values of [null, 'x', {}, ['bad'], [null], [123]]) test(`invalid mutation IDs ${JSON.stringify(values)} reject instead of dropping`, () => expect(() => normalizeAssetIds(values)).toThrow());
test('mutation deduplication is deterministic', () => expect(normalizeAssetIds([B, A, B])).toEqual([B, A]));
test('vendor responsibility intersects membership and retains anomaly evidence', () => expect(resolveVendorResponsibility(contract(), {
  coveredAssetIds: [A, B, B, 'bad']
})).toEqual({
  assetIds: [A],
  outOfCoverageAssetIds: [B],
  invalidReferenceCount: 1
}));
test('inspection is read-only', () => {
  const c = contract({
    vendorLinks: [{
      _id: B,
      coveredAssetIds: [B]
    }]
  });
  const before = JSON.stringify(c);
  expect(inspectVendorCoverage(c)).toMatchObject({
    isConsistent: false,
    anomalies: [{
      linkId: B,
      outOfCoverageAssetIds: [B]
    }]
  });
  expect(JSON.stringify(c)).toBe(before);
});
for (const [a, b, state] of [['parts-only', 'labor-only', 'complementary'], ['pm-only', 'parts-only', 'requires_review'], ['full', 'full', 'requires_review'], ['t&m', 'other', 'requires_review']]) test(`${a}/${b} overlap is surfaced without invented exclusivity`, () => expect(inspectVendorCoverage(contract({
  vendorLinks: [{
    _id: A,
    coverageType: a,
    coveredAssetIds: [A]
  }, {
    _id: B,
    coverageType: b,
    coveredAssetIds: [A]
  }]
}))).toMatchObject({
  isConsistent: true,
  exclusivityPolicy: 'not_configured',
  overlaps: [{
    status: state,
    assetIds: [A]
  }]
}));
test('coverage removal fails without mutating responsibility', () => {
  const c = contract({
    vendorLinks: [{
      coveredAssetIds: [A]
    }]
  });
  expect(() => assertCoverageChangeSafe(c, [])).toThrow('disposition');
  expect(c.coveredAssets).toEqual([A]);
  expect(c.vendorLinks[0].coveredAssetIds).toEqual([A]);
});
test('coverage without assigned removals is safe', () => expect(() => assertCoverageChangeSafe(contract(), [])).not.toThrow());
test('legacy anomalies are not auto-fixed by an unrelated change', () => expect(() => assertCoverageChangeSafe(contract({
  vendorLinks: [{
    coveredAssetIds: [B]
  }]
}), [A])).toThrow());
test('source outage fails closed without upstream details', async () => {
  const coreClient = {
    get: jest.fn().mockRejectedValue({
      response: {
        status: 500,
        data: 'private'
      }
    })
  };
  await expect(validateVendorAssetAdditions({
    contract: contract(),
    assetIds: [A],
    coreClient,
    facilityId: F
  })).rejects.toMatchObject({
    status: 503,
    code: 'asset_validation_unavailable'
  });
});
for (const status of [400, 403, 404]) test(`upstream ${status} maps to non-sensitive unavailable`, async () => {
  await expect(validateVendorAssetAdditions({
    contract: contract(),
    assetIds: [A],
    coreClient: {
      get: async () => {
        throw {
          response: {
            status
          }
        };
      }
    },
    facilityId: F
  })).rejects.toMatchObject({
    status: 400,
    code: 'asset_unavailable'
  });
});
for (const asset of [null, {
  _id: B,
  facilityId: F
}, {
  _id: A,
  facilityId: B
}, {
  _id: A,
  facilityId: F,
  deletedAt: '2026-01-01'
}, {
  _id: A,
  facilityId: F,
  isArchived: true
}]) test(`malformed/inaccessible Asset response ${JSON.stringify(asset)}`, async () => await expect(validateVendorAssetAdditions({
  contract: contract(),
  assetIds: [A],
  coreClient: {
    get: async () => ({
      data: asset
    })
  },
  facilityId: F
})).rejects.toMatchObject({
  code: 'asset_unavailable'
}));
test('valid Asset additions normalize and validate once', async () => {
  const get = jest.fn().mockResolvedValue({
    data: {
      _id: A,
      facilityId: F
    }
  });
  expect(await validateVendorAssetAdditions({
    contract: contract(),
    assetIds: [A, A],
    coreClient: {
      get
    },
    facilityId: F
  })).toEqual([A]);
  expect(get).toHaveBeenCalledTimes(1);
});
