import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const JWT_SECRET = 'cronus-interaction-suite-only-secret-with-adequate-length';
const JWT_ISSUER = 'cronus.api';
const JWT_AUDIENCE = 'cronus.app';

let app;
let Contact;
let Facility;
let Interaction;
let Organization;
let harness;
let facility;
let otherFacility;
let actorId;
let contact;
let secondContact;
let secondaryFacilityContact;
let archivedContact;

jest.setTimeout(120000);

function tokenFor(overrides = {}, options = {}) {
  const payload = { id: actorId.toString(), role: 'admin', facilities: [], ...overrides };
  if (Object.prototype.hasOwnProperty.call(overrides, 'role') && overrides.role === undefined) {
    delete payload.role;
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '10m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, ...options,
  });
}

function headers({ role = 'admin', selectedFacility = facility, facilities = [] } = {}) {
  return {
    Authorization: `Bearer ${tokenFor({ role, facilities: facilities.map(String) })}`,
    'x-facility-id': selectedFacility._id.toString(),
  };
}

function body(overrides = {}) {
  return {
    type: 'meeting',
    occurredAt: '2026-08-25T14:00:00.000Z',
    summary: 'Clinical engineering review',
    direction: 'internal',
    ...overrides,
  };
}

async function storedInteraction(overrides = {}) {
  return Interaction.create({
    facilityId: overrides.facilityId || facility._id,
    type: overrides.type || 'meeting',
    occurredAt: overrides.occurredAt || new Date('2026-08-25T14:00:00.000Z'),
    summary: overrides.summary || 'Stored interaction',
    body: overrides.body || '',
    direction: overrides.direction || 'internal',
    visibility: overrides.visibility || 'operational',
    contactIds: overrides.contactIds || [],
    archivedAt: overrides.archivedAt || null,
    archivedBy: overrides.archivedBy || null,
    createdBy: overrides.createdBy || actorId,
    updatedBy: overrides.updatedBy || actorId,
  });
}

async function makeContact(overrides = {}) {
  return Contact.create({
    organizationId: overrides.organizationId || facility.organizationId,
    primaryFacilityId: overrides.primaryFacilityId || facility._id,
    facilityIds: overrides.facilityIds || [facility._id],
    firstName: overrides.firstName || 'Avery',
    lastName: overrides.lastName || `Morgan-${new mongoose.Types.ObjectId()}`,
    status: overrides.status || 'active',
    archivedAt: overrides.archivedAt || null,
    archivedBy: overrides.archivedBy || null,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;
  harness = await createIsolatedMongoHarness(mongoose);
  Contact = requireCore('./src/models/Contact.js');
  Facility = requireCore('./src/models/Facility.js');
  Interaction = requireCore('./src/models/Interaction.js');
  Organization = requireCore('./src/models/Organization.js');
  const router = requireCore('./src/routers/interactionRouter.js');
  app = express();
  app.use(express.json());
  app.use('/interactions', router.interactionJsonErrorHandler, router);
});

beforeEach(async () => {
  actorId = new mongoose.Types.ObjectId();
  const organization = await Organization.create({ name: `System ${new mongoose.Types.ObjectId()}` });
  [facility, otherFacility] = await Facility.create([
    { organizationId: organization._id, name: 'Primary Facility' },
    { organizationId: organization._id, name: 'Other Facility' },
  ]);
  contact = await makeContact();
  secondContact = await makeContact({ firstName: 'Blair' });
  secondaryFacilityContact = await makeContact({
    primaryFacilityId: otherFacility._id,
    facilityIds: [otherFacility._id, facility._id],
    firstName: 'Casey',
  });
  archivedContact = await makeContact({
    firstName: 'Archived',
    status: 'archived',
    archivedAt: new Date(),
    archivedBy: actorId,
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([
    Interaction.deleteMany({}),
    Contact.deleteMany({}),
    Facility.deleteMany({}),
    Organization.deleteMany({}),
  ]);
});
afterAll(async () => harness.stop());

describe('Interaction authentication and strict Facility context', () => {
  test('rejects missing and invalid authentication', async () => {
    await request(app).get('/interactions').set('x-facility-id', facility._id.toString()).expect(401);
    await request(app).get('/interactions').set({
      Authorization: 'Bearer invalid', 'x-facility-id': facility._id.toString(),
    }).expect(403);
  });

  test.each([
    ['admin', 200], ['technician', 200], ['customer', 403], ['viewer', 403],
    ['tech', 403], ['unknown', 403], ['missing', 403],
  ])('enforces canonical role %s', async (role, expected) => {
    const claims = role === 'missing'
      ? { role: undefined, facilities: [facility._id] }
      : { role, facilities: [facility._id] };
    await request(app).get('/interactions').set({
      Authorization: `Bearer ${tokenFor(claims)}`,
      'x-facility-id': facility._id.toString(),
    }).expect(expected);
  });

  test('requires a valid existing explicit Facility for administrators', async () => {
    const authorization = `Bearer ${tokenFor()}`;
    await request(app).get('/interactions').set('Authorization', authorization).expect(400);
    await request(app).get('/interactions').set({
      Authorization: authorization, 'x-facility-id': 'bad',
    }).expect(400);
    await request(app).get('/interactions').set({
      Authorization: authorization, 'x-facility-id': new mongoose.Types.ObjectId().toString(),
    }).expect(404);
  });

  test('enforces the complete technician Facility-context matrix', async () => {
    const technicianToken = tokenFor({
      role: 'technician',
      facilities: [facility._id],
    });
    const authorization = `Bearer ${technicianToken}`;

    await request(app).get('/interactions')
      .set('Authorization', authorization)
      .expect(400);
    await request(app).get('/interactions').set({
      Authorization: authorization,
      'x-facility-id': 'bad',
    }).expect(400);

    const nonexistentFacilityId = new mongoose.Types.ObjectId();
    await request(app).get('/interactions').set({
      Authorization: `Bearer ${tokenFor({
        role: 'technician',
        facilities: [nonexistentFacilityId],
      })}`,
      'x-facility-id': nonexistentFacilityId.toString(),
    }).expect(404);
    await request(app).get('/interactions').set(headers({
      role: 'technician', selectedFacility: otherFacility, facilities: [facility._id],
    })).expect(403);
    await request(app).get('/interactions').set(headers({
      role: 'technician', selectedFacility: facility, facilities: [facility._id],
    })).expect(200);
  });
});

describe('Interaction creation and validation', () => {
  test('creates a summary-only operational Interaction and derives server fields', async () => {
    const spoofedActor = new mongoose.Types.ObjectId();
    const spoofedAt = new Date('2000-01-01T00:00:00.000Z');
    const response = await request(app).post('/interactions').set(headers()).send(body({
      facilityId: otherFacility._id,
      createdBy: spoofedActor,
      updatedBy: spoofedActor,
      archivedAt: spoofedAt,
      archivedBy: spoofedActor,
      createdAt: spoofedAt,
      updatedAt: spoofedAt,
    })).expect(201);
    const interaction = response.body.interaction;
    expect(interaction).toMatchObject({
      summary: 'Clinical engineering review',
      body: '',
      visibility: 'operational',
      contactIds: [],
      facilityId: facility._id.toString(),
      createdBy: actorId.toString(),
      updatedBy: actorId.toString(),
      archivedAt: null,
      archivedBy: null,
    });
    expect(interaction.createdAt).not.toBe(spoofedAt.toISOString());
    expect(interaction.updatedAt).not.toBe(spoofedAt.toISOString());

    const persisted = await Interaction.findById(interaction._id).lean();
    expect(persisted.facilityId.toString()).toBe(facility._id.toString());
    expect(persisted.createdBy.toString()).toBe(actorId.toString());
    expect(persisted.updatedBy.toString()).toBe(actorId.toString());
    expect(persisted.archivedAt).toBeNull();
    expect(persisted.archivedBy).toBeNull();
    expect(persisted.createdAt.toISOString()).not.toBe(spoofedAt.toISOString());
    expect(persisted.updatedAt.toISOString()).not.toBe(spoofedAt.toISOString());
  });

  test('supports one, multiple, deduplicated, and secondary-Facility Contacts', async () => {
    for (const ids of [
      [contact._id],
      [contact._id, secondContact._id],
      [contact._id, contact._id],
      [secondaryFacilityContact._id],
    ]) {
      const response = await request(app).post('/interactions').set(headers())
        .send(body({ contactIds: ids.map(String), summary: `Contacts ${ids.length}` }))
        .expect(201);
      expect(new Set(response.body.interaction.contactIds).size)
        .toBe(new Set(ids.map(String)).size);
    }
  });

  test('rejects invalid, archived, inactive, missing, and inaccessible Contacts safely', async () => {
    const inactive = await makeContact({ status: 'inactive', firstName: 'Inactive' });
    const inaccessible = await makeContact({
      primaryFacilityId: otherFacility._id, facilityIds: [otherFacility._id], firstName: 'Hidden',
    });
    for (const id of [
      'bad', archivedContact._id.toString(), inactive._id.toString(),
      new mongoose.Types.ObjectId().toString(), inaccessible._id.toString(),
    ]) {
      const response = await request(app).post('/interactions').set(headers())
        .send(body({ contactIds: [id] })).expect(400);
      expect(response.body).not.toHaveProperty('facilityId');
      expect(response.body.error).not.toMatch(/Archived|Inactive|Hidden|Other Facility/);
    }
  });

  test.each([
    [{ type: undefined }, 'type'],
    [{ occurredAt: undefined }, 'occurredAt'],
    [{ summary: undefined }, 'summary'],
    [{ summary: '  ' }, 'summary'],
    [{ direction: 'sideways' }, 'direction'],
    [{ visibility: 'secret' }, 'visibility'],
    [{ body: 42 }, 'body'],
    [{ contactIds: 'not-an-array' }, 'contactIds'],
  ])('rejects invalid input %#', async (changes) => {
    const input = body(changes);
    Object.keys(input).forEach((key) => input[key] === undefined && delete input[key]);
    await request(app).post('/interactions').set(headers()).send(input).expect(400);
  });

  test.each([
    '2026-08-25',
    '2026-08-25T14:00:00',
    '2026-02-30T14:00:00Z',
    '2026-08-25T25:00:00Z',
  ])('rejects non-strict occurredAt %s', async (occurredAt) => {
    await request(app).post('/interactions').set(headers())
      .send(body({ occurredAt })).expect(400);
  });

  test('rejects non-string and materially future occurredAt values', async () => {
    for (const occurredAt of [42, [], {}, new Date(Date.now() + 6 * 60 * 1000).toISOString()]) {
      await request(app).post('/interactions').set(headers())
        .send(body({ occurredAt })).expect(400);
    }
  });

  test('accepts an explicit numeric offset and stores the normalized UTC instant', async () => {
    const response = await request(app).post('/interactions').set(headers()).send(body({
      occurredAt: '2026-08-25T10:30:00-04:00',
      summary: 'Offset timestamp',
    })).expect(201);
    expect(response.body.interaction.occurredAt).toBe('2026-08-25T14:30:00.000Z');

    const persisted = await Interaction.findById(response.body.interaction._id).lean();
    expect(persisted.occurredAt.toISOString()).toBe('2026-08-25T14:30:00.000Z');
  });

  test('handles malformed and non-object JSON bodies', async () => {
    await request(app).post('/interactions').set(headers())
      .set('Content-Type', 'application/json').send('{').expect(400);
    await request(app).post('/interactions').set(headers())
      .set('Content-Type', 'application/json').send('null').expect(400);
    await request(app).post('/interactions').set(headers()).send([]).expect(400);
  });
});

describe('restricted Interaction visibility', () => {
  test('allows a technician to create, read, and update an operational Interaction', async () => {
    const technicianId = new mongoose.Types.ObjectId();
    const technicianHeaders = {
      Authorization: `Bearer ${tokenFor({
        id: technicianId.toString(),
        role: 'technician',
        facilities: [facility._id],
      })}`,
      'x-facility-id': facility._id.toString(),
    };
    const created = await request(app).post('/interactions').set(technicianHeaders).send(body({
      visibility: 'operational',
      summary: 'Technician operational record',
    })).expect(201);
    expect(created.body.interaction).toMatchObject({
      facilityId: facility._id.toString(),
      createdBy: technicianId.toString(),
      updatedBy: technicianId.toString(),
      visibility: 'operational',
    });
    const originalCreatedAt = created.body.interaction.createdAt;

    const detail = await request(app).get(`/interactions/${created.body.interaction._id}`)
      .set(technicianHeaders).expect(200);
    expect(detail.body.interaction.summary).toBe('Technician operational record');

    const updated = await request(app).patch(`/interactions/${created.body.interaction._id}`)
      .set(technicianHeaders)
      .send({ summary: 'Technician correction', body: 'Operational details', direction: 'outbound' })
      .expect(200);
    expect(updated.body.interaction).toMatchObject({
      summary: 'Technician correction',
      body: 'Operational details',
      direction: 'outbound',
      visibility: 'operational',
      createdBy: technicianId.toString(),
      updatedBy: technicianId.toString(),
      createdAt: originalCreatedAt,
    });
    const persisted = await Interaction.findById(created.body.interaction._id).lean();
    expect(persisted.summary).toBe('Technician correction');
    expect(persisted.visibility).toBe('operational');
  });

  test('admin creates, reads, and changes restricted visibility', async () => {
    const created = await request(app).post('/interactions').set(headers())
      .send(body({ visibility: 'restricted' })).expect(201);
    await request(app).get(`/interactions/${created.body.interaction._id}`)
      .set(headers()).expect(200);
    await request(app).patch(`/interactions/${created.body.interaction._id}`)
      .set(headers()).send({ visibility: 'operational' }).expect(200);
  });

  test('technician cannot create or promote to restricted', async () => {
    const technicianHeaders = headers({ role: 'technician', facilities: [facility._id] });
    await request(app).post('/interactions').set(technicianHeaders)
      .send(body({ visibility: 'restricted' })).expect(403);
    const operational = await storedInteraction();
    await request(app).patch(`/interactions/${operational._id}`).set(technicianHeaders)
      .send({ visibility: 'restricted' }).expect(403);
  });

  test('technician lists, totals, searches, filters, details, and updates exclude restricted', async () => {
    const operational = await storedInteraction({ summary: 'Shared needle' });
    const restricted = await storedInteraction({
      summary: 'Restricted needle', body: 'private needle', visibility: 'restricted',
    });
    const technicianHeaders = headers({ role: 'technician', facilities: [facility._id] });
    const list = await request(app).get('/interactions').set(technicianHeaders).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.interactions.map((item) => item._id)).toEqual([operational._id.toString()]);
    const search = await request(app).get('/interactions?search=needle')
      .set(technicianHeaders).expect(200);
    expect(search.body.total).toBe(1);
    const serializedSearch = JSON.stringify(search.body);
    expect(serializedSearch).not.toContain(restricted._id.toString());
    expect(serializedSearch).not.toContain('Restricted needle');
    expect(serializedSearch).not.toContain('private needle');
    const probe = await request(app).get('/interactions?visibility=restricted')
      .set(technicianHeaders).expect(200);
    expect(probe.body).toMatchObject({ total: 0, totalPages: 0, interactions: [] });
    await request(app).get(`/interactions/${restricted._id}`).set(technicianHeaders).expect(404);
    await request(app).patch(`/interactions/${restricted._id}`).set(technicianHeaders)
      .send({ summary: 'Probe' }).expect(404);
  });

  test('filters restricted records before technician pagination and counting', async () => {
    const operationalNewest = await storedInteraction({
      occurredAt: new Date('2026-08-25T16:00:00Z'), summary: 'Operational newest',
    });
    await storedInteraction({
      occurredAt: new Date('2026-08-25T15:00:00Z'),
      summary: 'Restricted between one',
      visibility: 'restricted',
    });
    const operationalMiddle = await storedInteraction({
      occurredAt: new Date('2026-08-25T14:00:00Z'), summary: 'Operational middle',
    });
    await storedInteraction({
      occurredAt: new Date('2026-08-25T13:00:00Z'),
      summary: 'Restricted between two',
      visibility: 'restricted',
    });
    const operationalOldest = await storedInteraction({
      occurredAt: new Date('2026-08-25T12:00:00Z'), summary: 'Operational oldest',
    });
    const technicianHeaders = headers({ role: 'technician', facilities: [facility._id] });
    const firstPage = await request(app).get('/interactions?page=1&limit=2')
      .set(technicianHeaders).expect(200);
    expect(firstPage.body).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
    expect(firstPage.body.interactions.map((item) => item._id)).toEqual([
      operationalNewest._id.toString(), operationalMiddle._id.toString(),
    ]);
    const secondPage = await request(app).get('/interactions?page=2&limit=2')
      .set(technicianHeaders).expect(200);
    expect(secondPage.body.interactions.map((item) => item._id))
      .toEqual([operationalOldest._id.toString()]);
  });
});

describe('Interaction scope, editing, and archive', () => {
  test('isolates cross-Facility list, detail, update, and archive', async () => {
    const hidden = await storedInteraction({ facilityId: otherFacility._id });
    const list = await request(app).get('/interactions').set(headers()).expect(200);
    expect(list.body.total).toBe(0);
    await request(app).get(`/interactions/${hidden._id}`).set(headers()).expect(404);
    await request(app).patch(`/interactions/${hidden._id}`).set(headers())
      .send({ summary: 'No' }).expect(404);
    await request(app).patch(`/interactions/${hidden._id}/archive`)
      .set(headers()).expect(404);
  });

  test('edits preserve creation audit and update modification audit', async () => {
    const interaction = await storedInteraction({ contactIds: [contact._id] });
    const original = interaction.toObject();
    const nextActor = new mongoose.Types.ObjectId();
    const response = await request(app).patch(`/interactions/${interaction._id}`).set({
      Authorization: `Bearer ${tokenFor({ id: nextActor.toString() })}`,
      'x-facility-id': facility._id.toString(),
    }).send({
      summary: 'Corrected summary',
      body: 'Optional detail',
      contactIds: [],
      facilityId: otherFacility._id,
      createdBy: nextActor,
    }).expect(200);
    expect(response.body.interaction).toMatchObject({
      summary: 'Corrected summary',
      body: 'Optional detail',
      contactIds: [],
      createdBy: original.createdBy.toString(),
      updatedBy: nextActor.toString(),
      facilityId: facility._id.toString(),
    });
    expect(response.body.interaction.createdAt).toBe(original.createdAt.toISOString());
    expect(new Date(response.body.interaction.updatedAt).getTime())
      .toBeGreaterThanOrEqual(original.updatedAt.getTime());
  });

  test('rejects malformed, non-object, empty, and server-owned-only PATCH bodies', async () => {
    const interaction = await storedInteraction();
    await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .set('Content-Type', 'application/json').send('{').expect(400);
    await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .set('Content-Type', 'application/json').send('null').expect(400);
    await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .set('Content-Type', 'application/json').send('"primitive"').expect(400);
    await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .send([]).expect(400);
    await request(app).patch(`/interactions/${interaction._id}`)
      .set(headers()).send({}).expect(400);
    await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .send({
        facilityId: otherFacility._id,
        createdBy: actorId,
        updatedBy: actorId,
        archivedAt: new Date(),
        archivedBy: actorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).expect(400);
  });

  test('PATCH replaces, deduplicates, and clears Contacts', async () => {
    const interaction = await storedInteraction();
    const linked = await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .send({ contactIds: [contact._id, secondContact._id, contact._id].map(String) }).expect(200);
    expect(linked.body.interaction.contactIds).toHaveLength(2);
    const cleared = await request(app).patch(`/interactions/${interaction._id}`).set(headers())
      .send({ contactIds: [] }).expect(200);
    expect(cleared.body.interaction.contactIds).toEqual([]);
  });

  test('PATCH rejects archived, inactive, and inaccessible Contacts without disclosure', async () => {
    const interaction = await storedInteraction();
    const inactive = await makeContact({ status: 'inactive', firstName: 'PatchInactive' });
    const inaccessible = await makeContact({
      primaryFacilityId: otherFacility._id,
      facilityIds: [otherFacility._id],
      firstName: 'PatchHidden',
    });
    for (const contactId of [archivedContact._id, inactive._id, inaccessible._id]) {
      const response = await request(app).patch(`/interactions/${interaction._id}`)
        .set(headers())
        .send({ contactIds: [contactId.toString()] })
        .expect(400);
      expect(response.body).toEqual({
        error: 'One or more Contacts are not available for the selected Facility',
        code: 'invalid_contacts',
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /Archived|PatchInactive|PatchHidden|Other Facility/,
      );
    }
  });

  test('archive is admin-only and removes list/detail visibility', async () => {
    const interaction = await storedInteraction();
    await request(app).patch(`/interactions/${interaction._id}/archive`)
      .set(headers({ role: 'technician', facilities: [facility._id] })).expect(403);
    await request(app).patch(`/interactions/${interaction._id}/archive`)
      .set(headers()).expect(200);
    const list = await request(app).get('/interactions').set(headers()).expect(200);
    expect(list.body.total).toBe(0);
    await request(app).get(`/interactions/${interaction._id}`).set(headers()).expect(404);
  });
});

describe('Interaction list filters and safe failures', () => {
  test('filters fields and applies inclusive date boundaries', async () => {
    await storedInteraction({
      type: 'call', direction: 'inbound', visibility: 'restricted',
      contactIds: [contact._id], occurredAt: new Date('2026-08-25T10:00:00.000Z'),
      summary: 'Exact [review]',
    });
    await storedInteraction({
      type: 'email', direction: 'outbound',
      occurredAt: new Date('2026-08-25T11:00:00.000Z'), summary: 'Other',
    });
    const query = new URLSearchParams({
      type: 'call',
      direction: 'inbound',
      visibility: 'restricted',
      contactId: contact._id.toString(),
      occurredFrom: '2026-08-25T10:00:00.000Z',
      occurredTo: '2026-08-25T10:00:00.000Z',
      search: '[review]',
    });
    const response = await request(app).get(`/interactions?${query}`).set(headers()).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.interactions[0].summary).toBe('Exact [review]');
  });

  test('orders newest first and applies bounded pagination', async () => {
    await storedInteraction({ occurredAt: new Date('2026-08-25T09:00:00Z'), summary: 'Old' });
    await storedInteraction({ occurredAt: new Date('2026-08-25T11:00:00Z'), summary: 'New' });
    const response = await request(app).get('/interactions?page=1&limit=1')
      .set(headers()).expect(200);
    expect(response.body).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(response.body.interactions[0].summary).toBe('New');
  });

  test('rejects invalid filters, IDs, ranges, search, and pagination', async () => {
    for (const path of [
      '/interactions?type=custom',
      '/interactions?direction=sideways',
      '/interactions?visibility=secret',
      '/interactions?contactId=bad',
      '/interactions?occurredFrom=2026-08-25',
      '/interactions?occurredFrom=2026-08-26T00:00:00Z&occurredTo=2026-08-25T00:00:00Z',
      `/interactions?search=${'x'.repeat(201)}`,
      '/interactions?page=0',
      '/interactions?limit=101',
    ]) {
      await request(app).get(path).set(headers()).expect(400);
    }
    await request(app).get('/interactions/bad').set(headers()).expect(400);
    await request(app).patch('/interactions/bad').set(headers())
      .send({ summary: 'No' }).expect(400);
  });

  test('returns generic 500 without internal details', async () => {
    jest.spyOn(Interaction, 'find').mockImplementationOnce(() => {
      throw new Error('secret internal database detail');
    });
    const response = await request(app).get('/interactions').set(headers()).expect(500);
    expect(response.body).toEqual({ error: 'Interaction operation failed' });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});
