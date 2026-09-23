import { jest } from '@jest/globals';
import Contract from '../../models/Contract.js';
import { getContractProfitability } from '../contractController.js';
const assetId = '000000000000000000000002';
const scope = value => ({
  knownSubtotal: value,
  total: value,
  isComplete: true,
  missingComponents: [],
  valuationBases: []
});
const row = () => ({
  assetId,
  economics: {
    schemaVersion: 1,
    revision: 1
  },
  costs: {
    calculationVersion: 'wo-cost-v1',
    cacheState: 'current',
    inputRevision: 1,
    scopes: {
      internal: scope(75),
      vendorDirect: scope(25),
      directMaintenance: scope(100)
    },
    components: {
      internalLabor: scope(75),
      internalTravel: scope(0),
      internalParts: scope(0)
    }
  }
});
async function run(workOrder, vendorLinks = []) {
  const contract = {
    type: 'customer',
    totalValue: 3650,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    coveredAssets: [assetId],
    vendorLinks,
    amendments: []
  };
  jest.spyOn(Contract, 'findOne').mockReturnValue({
    lean: async () => contract
  });
  const req = {
    params: {
      id: '000000000000000000000001'
    },
    query: {
      asOf: '2026-07-01'
    },
    headers: {},
    user: {
      role: 'admin'
    },
    core: {
      get: jest.fn().mockResolvedValue({
        data: {
          items: [workOrder]
        }
      })
    }
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  await getContractProfitability(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
  return res.json.mock.calls[0][0].data;
}
afterEach(() => jest.restoreAllMocks());
test('complete direct costs subtract once from separate revenue', async () => {
  const result = await run(row());
  expect(result.profitabilityComplete).toBe(true);
  expect(result.net.ytd).toBe(result.revenue.ytd - 100);
  expect(result.vendorPayout.ytd).toBe(0);
  expect(result.internalCostToServe.ytd_allAssets).toBe(75);
});
test('unknown direct cost with known subtotal cannot produce a margin', async () => {
  const w = row();
  w.costs.scopes.directMaintenance = {
    ...scope(75),
    total: null,
    isComplete: false,
    missingComponents: [{
      reason: 'parts_unknown'
    }]
  };
  const result = await run(w);
  expect(result.net).toEqual({
    ytd: null,
    marginPct: null
  });
  expect(result.economicScopes.directMaintenance.knownSubtotal).toBe(75);
});
test('annual vendor payout stays separate and unresolved overlap with direct expense withholds margin', async () => {
  const result = await run(row(), [{
    _id: '000000000000000000000003',
    vendorId: '000000000000000000000004',
    annualCost: 365,
    coveredAssetIds: [assetId]
  }]);
  expect(result.vendorPayout.ytd).toBeGreaterThan(0);
  expect(result.economicScopes.directMaintenance.total).toBe(100);
  expect(result.net.ytd).toBeNull();
  expect(result.incompleteReason).toBe('vendor_payout_attribution_unreconciled');
});
