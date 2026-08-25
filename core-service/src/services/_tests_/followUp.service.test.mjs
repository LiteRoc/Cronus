import { createRequire } from 'node:module';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');

let FollowUp;
let service;
let harness;
const actorId = new mongoose.Types.ObjectId();
const facilityId = new mongoose.Types.ObjectId();
const assigneeId = new mongoose.Types.ObjectId();

jest.setTimeout(120000);

const base = (overrides = {}) => ({
  facilityId,
  title: 'Review service history',
  dueAt: new Date('2026-09-01T12:00:00.000Z'),
  status: 'open',
  priority: 'normal',
  assignedTo: assigneeId,
  createdBy: actorId,
  updatedBy: actorId,
  ...overrides,
});

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  harness = await createIsolatedMongoHarness(mongoose);
  FollowUp = requireCore('./src/models/FollowUp.js');
  service = requireCore('./src/services/followUpService.js');
});

afterEach(async () => FollowUp.deleteMany({}));
afterAll(async () => harness.stop());

describe('FollowUp schema lifecycle invariants', () => {
  test.each([
    ['completed without audits', { status: 'completed' }],
    ['cancelled without audits', { status: 'cancelled' }],
    ['open with completion audit', { completedAt: new Date(), completedBy: actorId }],
    ['open with cancellation audit', { cancelledAt: new Date(), cancelledBy: actorId }],
    ['completed with cancellation audit', { status: 'completed', completedAt: new Date(), completedBy: actorId, cancelledAt: new Date(), cancelledBy: actorId }],
    ['cancelled with completion audit', { status: 'cancelled', cancelledAt: new Date(), cancelledBy: actorId, completedAt: new Date(), completedBy: actorId }],
    ['archive time without actor', { archivedAt: new Date() }],
    ['archive actor without time', { archivedBy: actorId }],
  ])('rejects %s', async (_label, values) => {
    await expect(FollowUp.create(base(values))).rejects.toHaveProperty('name', 'ValidationError');
  });

  test.each([
    { status: 'open' },
    { status: 'completed', completedAt: new Date(), completedBy: actorId },
    { status: 'cancelled', cancelledAt: new Date(), cancelledBy: actorId },
    { status: 'open', archivedAt: new Date(), archivedBy: actorId },
  ])('accepts a consistent lifecycle record', async (values) => {
    await expect(FollowUp.create(base(values))).resolves.toBeDefined();
  });

  test('blocks direct query updates that could bypass lifecycle and archive validation', async () => {
    const followUp = await FollowUp.create(base());
    await expect(FollowUp.updateOne(
      { _id: followUp._id },
      { $set: { status: 'completed' } },
    )).rejects.toThrow('must load and save a validated document');
    await expect(FollowUp.findOneAndUpdate(
      { _id: followUp._id },
      { $set: { archivedAt: new Date() } },
    )).rejects.toThrow('must load and save a validated document');
    await expect(FollowUp.updateMany(
      { _id: followUp._id },
      { $set: { cancelledBy: actorId } },
    )).rejects.toThrow('must load and save a validated document');
    await expect(FollowUp.bulkWrite([{
      updateOne: {
        filter: { _id: followUp._id },
        update: { $set: { archivedBy: actorId } },
      },
    }])).rejects.toThrow('must load and save a validated document');
    const unchanged = await FollowUp.findById(followUp._id).lean();
    expect(unchanged).toMatchObject({
      status: 'open',
      completedAt: null,
      completedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      archivedAt: null,
      archivedBy: null,
    });
  });

  test('declares the Phase 1 query indexes', () => {
    const indexes = FollowUp.schema.indexes().map(([keys, options]) => ({ keys, options }));
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ keys: { facilityId: 1, archivedAt: 1, dueAt: 1, _id: 1 } }),
      expect.objectContaining({ keys: { facilityId: 1, archivedAt: 1, status: 1, dueAt: 1, _id: 1 } }),
      expect.objectContaining({ keys: { facilityId: 1, archivedAt: 1, assignedTo: 1, dueAt: 1, _id: 1 } }),
      expect.objectContaining({ keys: { facilityId: 1, archivedAt: 1, contactId: 1, dueAt: 1, _id: 1 } }),
    ]));
    expect(indexes.every(({ options }) => options.unique !== true)).toBe(true);
  });
});

describe('FollowUp derived state and bounds', () => {
  test.each([
    ['open past due', 'open', '2026-01-01T00:00:00.000Z', true],
    ['open future', 'open', '2027-01-01T00:00:00.000Z', false],
    ['open boundary', 'open', '2026-06-01T00:00:00.000Z', false],
    ['completed past due', 'completed', '2026-01-01T00:00:00.000Z', false],
    ['cancelled past due', 'cancelled', '2026-01-01T00:00:00.000Z', false],
  ])('%s derives overdue=%s', (_label, status, dueAt, expected) => {
    const value = service.withDerivedOverdue(
      { status, dueAt: new Date(dueAt) },
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(value.overdue).toBe(expected);
  });

  test('rejects pathological pagination and overlong search', async () => {
    await expect(service.listFollowUps({ facilityId, query: { page: '1001' } })).rejects.toMatchObject({ status: 400 });
    await expect(service.listFollowUps({ facilityId, query: { limit: '101' } })).rejects.toMatchObject({ status: 400 });
    await expect(service.listFollowUps({ facilityId, query: { search: 'x'.repeat(201) } })).rejects.toMatchObject({ status: 400 });
  });
});
