import { createRequire } from 'node:module';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import contractMongoose from 'mongoose';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from './securityTestHarness.js';
import Contract from '../../models/Contract.js';
import { buildCoreLookup } from '../../services/coreLookupService.js';
import { getContractOverviewService } from '../../services/contractOverviewService.js';

const requireCore = createRequire(new URL('../../../../core-service/package.json', import.meta.url));
const coreMongoose = requireCore('mongoose');
const express = requireCore('express');
const secret = 'synthetic-vendor-history-only';
let harness, app, Vendor, vendor, contractId, facilityId;
jest.setTimeout(120000);
const headers = role => ({ Authorization: `Bearer ${jwt.sign({ sub: '000000000000000000000001', role }, secret,
  { issuer: 'cronus.api', audience: 'cronus.app', expiresIn: '10m' })}` });
const client = role => ({
  async get(path) {
    if (path.startsWith('/workorders/by-contract/')) return { data: { workOrders: [] } };
    if (!path.startsWith('/vendors/')) throw new Error('Unapproved test client target');
    const response = await request(app).get(path).set(headers(role));
    if (response.status !== 200) throw Object.assign(new Error('Core lookup denied'), { response: { status: response.status } });
    return { data: response.body };
  },
  async post() { throw new Error('Unapproved test client target'); },
});
beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.JWT_ISS = 'cronus.api';
  process.env.JWT_AUD = 'cronus.app';
  harness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose });
  Vendor = requireCore('./src/models/Vendor.js');
  const router = requireCore('./src/routers/vendorRouter.js');
  app = express();
  app.use(express.json());
  app.use('/vendors', router.vendorJsonErrorHandler, router);
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  vendor = await Vendor.create({ name: 'Historical synthetic Vendor', tenantId: new coreMongoose.Types.ObjectId(), notes: 'Private', preferredVendor: true });
  contractId = new contractMongoose.Types.ObjectId();
  facilityId = new contractMongoose.Types.ObjectId();
  await Contract.collection.insertOne({ _id: contractId, facilityId, name: 'Synthetic Contract', type: 'customer',
    startDate: new Date('2026-01-01'), coveredAssets: [], linkedVendor: vendor._id,
    vendorLinks: [{ _id: new contractMongoose.Types.ObjectId(), vendorId: vendor._id, nameSnapshot: '', coveredAssetIds: [] }],
  });
  await request(app).delete(`/vendors/${vendor._id}`).set(headers('admin')).expect(200);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (harness) { await Vendor.deleteMany({}); await Contract.deleteMany({}); }
});
afterAll(async () => { if (harness) await harness.stop(); });
for (const role of ['admin', 'technician']) {
  test(`${role}: existing Contract lookup resolves archived Vendor by minimal history path`, async () => {
    expect(await buildCoreLookup(client(role))('vendor', String(vendor._id))).toBe(vendor.name);
    const { data } = await client(role).get(`/vendors/${vendor._id}/history`);
    expect(data).toEqual({ _id: String(vendor._id), name: vendor.name });
    await request(app).get(`/vendors/${vendor._id}`).set(headers(role)).expect(404);
  });
  test(`${role}: VendorLink without snapshot retains archived name in real overview service`, async () => {
    const overview = await getContractOverviewService({ contractId, tenantFilter: { facilityId }, user: { role }, coreClient: client(role) });
    expect(overview.contract.vendorLinks[0].nameSnapshot).toBe(vendor.name);
    expect(String(overview.contract.vendorLinks[0].vendorId)).toBe(String(vendor._id));
    expect(await Vendor.countDocuments()).toBe(1);
  });
}
test('existing stored snapshot remains authoritative after archival', async () => {
  await Contract.collection.updateOne({ _id: contractId }, { $set: { 'vendorLinks.0.nameSnapshot': 'Historical snapshot' } });
  const overview = await getContractOverviewService({ contractId, tenantFilter: { facilityId }, user: { role: 'admin' }, coreClient: client('admin') });
  expect(overview.contract.vendorLinks[0].nameSnapshot).toBe('Historical snapshot');
});
test('history helper does not bypass the denied customer Vendor API role', async () => {
  expect(await buildCoreLookup(client('customer'))('vendor', String(vendor._id))).toBeNull();
});
