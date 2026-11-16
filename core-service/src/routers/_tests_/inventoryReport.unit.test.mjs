import { createRequire } from 'node:module';
import { jest } from '@jest/globals';
const require = createRequire(import.meta.url);
const A = require('../../models/Asset'), F = require('../../models/Facility'), D = require('../../models/Department');
const ownership = require('../../services/operationalOwnership');
const router = require('../inventoryReportRouter');
const handler = router.stack.find(layer => layer.route?.path === '/').route.stack.at(-1).handle;
const facility = '000000000000000000000001', department = '000000000000000000000002';
let assetQuery, query;
beforeEach(() => {
  jest.spyOn(ownership, 'selectedFacility').mockResolvedValue(facility);
  jest.spyOn(F, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ _id: facility, name: 'Synthetic Hospital' }) }) });
  jest.spyOn(D, 'find').mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [{ _id: department, name: 'Imaging' }] }) }) });
  assetQuery = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
  jest.spyOn(A, 'find').mockImplementation(value => { query = value; return assetQuery; });
});
afterEach(() => jest.restoreAllMocks());
async function run(filters = {}) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader: jest.fn() };
  await handler({ query: filters, headers: {}, user: { role: 'admin' } }, res);
  return res;
}
test('default query uses exact Facility, excludes deleted/archived, bounds and sorts results', async () => {
  const res = await run();
  expect(query).toEqual({ facilityId: facility, deletedAt: null, isArchived: { $ne: true } });
  expect(assetQuery.limit).toHaveBeenCalledWith(5001); expect(assetQuery.maxTimeMS).toHaveBeenCalledWith(10000);
  expect(assetQuery.sort).toHaveBeenCalledWith({ ctrlNumber: 1, _id: 1 });
  expect(res.body).toMatchObject({ rowCount: 0, rows: [], facility: { id: facility }, filters: { archive: 'exclude' } });
});
test('report projection preserves missing values and exposes no operational financial fields', async () => {
  assetQuery.lean.mockResolvedValue([{ _id: 'asset-a', ctrlNumber: 'A-1', departmentId: 'outside', serialNumber: '', notes: 'private', purchaseCost: 900,
    maintenanceSchedule: { nextMaintenance: new Date('2027-01-01'), lastMaintenance: 'invalid' } }]);
  const res = await run();
  expect(res.body.rows[0]).toMatchObject({ department: '', departmentState: 'unavailable', serialNumber: '', lastPM: null, nextPM: '2027-01-01T00:00:00.000Z' });
  expect(res.body.rows[0]).not.toHaveProperty('purchaseCost'); expect(res.body.rows[0]).not.toHaveProperty('notes');
  expect(res.body.dataQuality).toEqual({ missingSerial: 1, unassignedDepartment: 0, unavailableDepartment: 1, missingNextPM: 0 });
});
test('literal search cannot become a regular expression or replace Facility scope', async () => {
  await run({ q: '.*', status: 'Active', departmentId: department });
  expect(query.facilityId).toBe(facility); expect(query.departmentId).toBe(department);
  expect(query.$or[0]).toEqual({ ctrlNumber: { $regex: '\\.\\*', $options: 'i' } });
});
test.each([{ archive: 'bad' }, { status: { $ne: '' } }, { departmentId: 'bad' }, { q: ['a', 'b'] }, { q: 'x'.repeat(121) }, { facilityId: 'override' }])('invalid input %j stops before query', async filters => {
  expect((await run(filters)).statusCode).toBe(400); expect(A.find).not.toHaveBeenCalled();
});
test('foreign department filter cannot be used', async () => { expect((await run({ departmentId: '000000000000000000000099' })).statusCode).toBe(404); expect(A.find).not.toHaveBeenCalled(); });
test('oversized or failed query never supplies success-looking partial rows', async () => {
  assetQuery.lean.mockResolvedValue(Array.from({ length: 5001 }, () => ({})));
  const oversized = await run(); expect(oversized.statusCode).toBe(413); expect(oversized.body.rows).toBeUndefined();
  assetQuery.lean.mockRejectedValue(new Error('private database diagnostic'));
  const failed = await run(); expect(failed.statusCode).toBe(503); expect(JSON.stringify(failed.body)).not.toContain('private database');
});
