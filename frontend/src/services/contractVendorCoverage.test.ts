import { beforeEach, afterEach, expect, test } from 'vitest';
import type { AxiosAdapter } from 'axios';
import contractClient from './contractClient';
import { addVendorLink, updateVendorLinkAssets, getContractLifecycleIntelligence } from './contractAPI';
const old = contractClient.defaults.adapter;
let url: string | undefined, body: unknown;
beforeEach(() => {
  contractClient.defaults.adapter = (async config => {
    url = config.url;
    body = config.data ? JSON.parse(config.data) : undefined;
    return {
      data: {
        success: true,
        data: {
          coveredAssetIds: ['A'],
          responsibility: {
            assetIds: ['A'],
            outOfCoverageAssetIds: ['B']
          }
        }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    };
  }) satisfies AxiosAdapter;
});
afterEach(() => {
  contractClient.defaults.adapter = old;
});
test('creation preserves submitted responsibility IDs for backend validation', async () => {
  await addVendorLink('C', {
    vendorId: 'V',
    coverageType: 'parts-only',
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    annualCost: 100,
    coveredAssetIds: ['A']
  });
  expect(url).toBe('/contracts/C/vendor-links');
  expect(body).toMatchObject({
    coveredAssetIds: ['A'],
    coverageType: 'parts-only'
  });
});
test('explicit add/remove batch transmitted intact', async () => {
  const result = await updateVendorLinkAssets('C', 'L', {
    add: ['A'],
    remove: ['B']
  });
  expect(url).toBe('/contracts/C/vendor-links/L/assets');
  expect(body).toEqual({
    add: ['A'],
    remove: ['B']
  });
  expect(result.responsibility.outOfCoverageAssetIds).toEqual(['B']);
});
test('lifecycle client preserves current coverage metadata', async () => {
  contractClient.defaults.adapter = (async config => ({
    data: {
      coverage: {
        basis: 'current_snapshot',
        assetIds: ['A'],
        historicalReconstructionSupported: false
      }
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  })) satisfies AxiosAdapter;
  expect(await getContractLifecycleIntelligence('C')).toMatchObject({
    coverage: {
      basis: 'current_snapshot',
      assetIds: ['A']
    }
  });
});
