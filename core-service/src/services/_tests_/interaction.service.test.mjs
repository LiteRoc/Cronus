import { createRequire } from 'node:module';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
let Interaction;
let service;
let harness;
const facilityId = new mongoose.Types.ObjectId();
const actorId = new mongoose.Types.ObjectId();

jest.setTimeout(120000);

const base = (overrides = {}) => ({
  facilityId,
  type: 'meeting',
  occurredAt: new Date('2026-08-25T12:00:00.000Z'),
  summary: 'Quarterly review',
  direction: 'internal',
  visibility: 'operational',
  createdBy: actorId,
  updatedBy: actorId,
  ...overrides,
});

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  harness = await createIsolatedMongoHarness(mongoose);
  Interaction = requireCore('./src/models/Interaction.js');
  service = requireCore('./src/services/interactionService.js');
});
afterEach(async () => Interaction.deleteMany({}));
afterAll(async () => harness.stop());

describe('Interaction schema invariants', () => {
  test('requires paired archive fields', async () => {
    await expect(Interaction.create(base({ archivedAt: new Date() })))
      .rejects.toHaveProperty('name', 'ValidationError');
    await expect(Interaction.create(base({ archivedBy: actorId })))
      .rejects.toHaveProperty('name', 'ValidationError');
  });

  test('blocks query mutation APIs', async () => {
    const interaction = await Interaction.create(base());
    await expect(Interaction.updateOne(
      { _id: interaction._id }, { $set: { visibility: 'restricted' } },
    )).rejects.toThrow('must load and save a validated document');
    await expect(Interaction.findOneAndUpdate(
      { _id: interaction._id }, { $set: { archivedAt: new Date() } },
    )).rejects.toThrow('must load and save a validated document');
    await expect(Interaction.bulkWrite([{
      updateOne: { filter: { _id: interaction._id }, update: { $set: { archivedBy: actorId } } },
    }])).rejects.toThrow('must load and save a validated document');
  });

  test('declares only non-unique Phase 1 indexes', () => {
    const indexes = Interaction.schema.indexes().map(([keys, options]) => ({ keys, options }));
    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ keys: { facilityId: 1, archivedAt: 1, occurredAt: -1, _id: -1 } }),
      expect.objectContaining({
        keys: { facilityId: 1, archivedAt: 1, visibility: 1, occurredAt: -1, _id: -1 },
      }),
      expect.objectContaining({
        keys: { facilityId: 1, archivedAt: 1, contactIds: 1, occurredAt: -1, _id: -1 },
      }),
    ]));
    expect(indexes.every(({ options }) => options.unique !== true)).toBe(true);
  });
});

describe('Interaction timestamp and bounds', () => {
  test.each([
    '2026-08-25',
    '2026-08-25T12:00:00',
    '2026-02-30T12:00:00Z',
    '2026-08-25T24:00:00Z',
    '2026-08-25T12:60:00Z',
    '2026-08-25T12:00:00+24:00',
  ])('rejects invalid timestamp %s', (value) => {
    expect(() => service.parseTimestamp(value, 'occurredAt')).toThrow();
  });

  test('accepts five-minute clock skew and rejects anything later', () => {
    const now = new Date('2026-08-25T12:00:00.000Z');
    expect(service.parseOccurredAt('2026-08-25T12:05:00.000Z', now)).toBeInstanceOf(Date);
    expect(() => service.parseOccurredAt('2026-08-25T12:05:00.001Z', now))
      .toThrow('five minutes');
  });

  test('rejects pathological list bounds', async () => {
    const user = { role: 'admin' };
    await expect(service.listInteractions({ facilityId, user, query: { page: 1001 } }))
      .rejects.toMatchObject({ status: 400 });
    await expect(service.listInteractions({ facilityId, user, query: { limit: 101 } }))
      .rejects.toMatchObject({ status: 400 });
    await expect(service.listInteractions({ facilityId, user, query: { search: 'x'.repeat(201) } }))
      .rejects.toMatchObject({ status: 400 });
  });
});
