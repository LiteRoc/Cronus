import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');

const JWT_SECRET = 'cronus-contact-suite-only-secret-with-adequate-length';
const JWT_ISSUER = 'cronus.api';
const JWT_AUDIENCE = 'cronus.app';

let app;
let Contact;
let Facility;
let Organization;
let mongoHarness;
let organization;
let otherOrganization;
let primaryFacility;
let associatedFacility;
let outsideFacility;
let actorId;

jest.setTimeout(120000);

function tokenFor(overrides = {}, options = {}) {
  const payload = {
    id: actorId?.toString() || new mongoose.Types.ObjectId().toString(),
    role: 'admin',
    facilities: [],
    ...overrides,
  };
  if (Object.prototype.hasOwnProperty.call(overrides, 'role') && overrides.role === undefined) {
    delete payload.role;
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '10m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    ...options,
  });
}

function authHeaders({ role = 'admin', facility = primaryFacility, facilities = [] } = {}) {
  return {
    Authorization: `Bearer ${tokenFor({ role, facilities: facilities.map(String) })}`,
    'x-facility-id': facility._id.toString(),
  };
}

function contactBody(overrides = {}) {
  return {
    firstName: 'Avery',
    lastName: 'Morgan',
    title: 'Clinical Engineering Director',
    functionalDescription: 'Clinical engineering stakeholder',
    email: 'Avery.Morgan@example.test',
    phone: '(937) 555-0100',
    ...overrides,
  };
}

async function createStoredContact(overrides = {}) {
  const facilityIds = overrides.facilityIds || [primaryFacility._id];
  return Contact.create({
    organizationId: overrides.organizationId || organization._id,
    primaryFacilityId: overrides.primaryFacilityId || primaryFacility._id,
    facilityIds,
    firstName: overrides.firstName || 'Stored',
    lastName: overrides.lastName || 'Contact',
    title: overrides.title || '',
    functionalDescription: overrides.functionalDescription || '',
    email: overrides.email || '',
    phone: overrides.phone || '',
    normalizedEmail: overrides.normalizedEmail || '',
    normalizedName: overrides.normalizedName || 'stored contact',
    normalizedPhone: overrides.normalizedPhone || '',
    createdBy: overrides.createdBy || actorId,
    updatedBy: overrides.updatedBy || actorId,
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;

  mongoHarness = await createIsolatedMongoHarness(mongoose);
  Contact = requireCore('./src/models/Contact.js');
  Facility = requireCore('./src/models/Facility.js');
  Organization = requireCore('./src/models/Organization.js');
  const contactRouter = requireCore('./src/routers/contactRouter.js');

  app = express();
  app.use(express.json());
  app.use('/contacts', contactRouter.contactJsonErrorHandler, contactRouter);
});

beforeEach(async () => {
  actorId = new mongoose.Types.ObjectId();
  organization = await Organization.create({ name: `Health System ${new mongoose.Types.ObjectId()}` });
  otherOrganization = await Organization.create({ name: `Other System ${new mongoose.Types.ObjectId()}` });
  [primaryFacility, associatedFacility, outsideFacility] = await Facility.create([
    { organizationId: organization._id, name: 'Primary Facility' },
    { organizationId: organization._id, name: 'Associated Facility' },
    { organizationId: otherOrganization._id, name: 'Outside Facility' },
  ]);
});

afterEach(async () => {
  await Promise.all([
    Contact.deleteMany({}),
    Facility.deleteMany({}),
    Organization.deleteMany({}),
  ]);
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoHarness.stop();
});

describe('Contact authentication and role authorization', () => {
  test('rejects missing and invalid authentication', async () => {
    await request(app).get('/contacts').set('x-facility-id', primaryFacility._id.toString()).expect(401);
    await request(app)
      .get('/contacts')
      .set({ Authorization: 'Bearer invalid', 'x-facility-id': primaryFacility._id.toString() })
      .expect(403);
  });

  test.each([
    ['admin', 200],
    ['technician', 200],
    ['customer', 403],
    ['viewer', 403],
    ['tech', 403],
    ['unknown', 403],
    ['missing', 403],
  ])('enforces the canonical %s role outcome', async (role, expectedStatus) => {
    const claims = role === 'missing'
      ? { role: undefined, facilities: [primaryFacility._id.toString()] }
      : { role, facilities: [primaryFacility._id.toString()] };
    await request(app)
      .get('/contacts')
      .set({
        Authorization: `Bearer ${tokenFor(claims)}`,
        'x-facility-id': primaryFacility._id.toString(),
      })
      .expect(expectedStatus);
  });

  test.each([
    ['wrong issuer', { issuer: 'not-cronus.api' }],
    ['wrong audience', { audience: 'not-cronus.app' }],
    ['expired', { expiresIn: -1 }],
  ])('rejects a token with %s', async (_label, options) => {
    await request(app)
      .get('/contacts')
      .set({
        Authorization: `Bearer ${tokenFor({}, options)}`,
        'x-facility-id': primaryFacility._id.toString(),
      })
      .expect(403);
  });
});

describe('strict Contact Facility context', () => {
  test('requires a valid explicit Facility even for administrators', async () => {
    const token = tokenFor();
    await request(app).get('/contacts').set('Authorization', `Bearer ${token}`).expect(400);
    await request(app)
      .get('/contacts')
      .set({ Authorization: `Bearer ${token}`, 'x-facility-id': 'not-an-object-id' })
      .expect(400);
    await request(app)
      .get('/contacts')
      .set({
        Authorization: `Bearer ${token}`,
        'x-facility-id': new mongoose.Types.ObjectId().toString(),
      })
      .expect(404);
  });

  test('requires technician authorization for the selected Facility', async () => {
    await request(app)
      .get('/contacts')
      .set(authHeaders({ role: 'technician', facility: primaryFacility, facilities: [associatedFacility._id] }))
      .expect(403);
  });
});

describe('Contact creation and association invariants', () => {
  test('derives ownership and audit fields and ignores spoofed ownership', async () => {
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({
        organizationId: otherOrganization._id,
        primaryFacilityId: outsideFacility._id,
        facilityIds: [primaryFacility._id, associatedFacility._id],
      }))
      .expect(201);

    expect(response.body.contact).toMatchObject({
      organizationId: organization._id.toString(),
      primaryFacilityId: primaryFacility._id.toString(),
      createdBy: actorId.toString(),
      updatedBy: actorId.toString(),
    });
    expect(response.body.contact.facilityIds.map(String)).toEqual(expect.arrayContaining([
      primaryFacility._id.toString(),
      associatedFacility._id.toString(),
    ]));
    expect(response.body.contact.normalizedEmail).toBeUndefined();
  });

  test('rejects cross-Organization Facility associations', async () => {
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({ facilityIds: [primaryFacility._id, outsideFacility._id] }))
      .expect(400);
    expect(response.body.code).toBe('cross_organization_facility');
  });

  test('requires technicians to be authorized for every associated Facility', async () => {
    await request(app)
      .post('/contacts')
      .set(authHeaders({ role: 'technician', facilities: [primaryFacility._id] }))
      .send(contactBody({ facilityIds: [primaryFacility._id, associatedFacility._id] }))
      .expect(403);

    await request(app)
      .post('/contacts')
      .set(authHeaders({
        role: 'technician',
        facilities: [primaryFacility._id, associatedFacility._id],
      }))
      .send(contactBody({ facilityIds: [primaryFacility._id, associatedFacility._id] }))
      .expect(201);
  });

  test('returns validation errors for invalid Contact data and Facility identifiers', async () => {
    await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({ lastName: '' }))
      .expect(400);
    await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({ facilityIds: ['invalid'] }))
      .expect(400);
  });
});

describe('Contact reads, updates, and archival', () => {
  test('reads through any associated Facility and hides out-of-scope Contacts', async () => {
    const contact = await createStoredContact({
      facilityIds: [primaryFacility._id, associatedFacility._id],
    });
    await request(app)
      .get(`/contacts/${contact._id}`)
      .set(authHeaders({ facility: associatedFacility }))
      .expect(200);
    await request(app)
      .get(`/contacts/${contact._id}`)
      .set(authHeaders({ facility: outsideFacility }))
      .expect(404);
  });

  test('supports scoped pagination and conservative search', async () => {
    await createStoredContact({ firstName: 'Searchable', title: 'Clinical Director' });
    await createStoredContact({ firstName: 'Unrelated', lastName: 'Person' });
    const response = await request(app)
      .get('/contacts')
      .query({ search: 'Clinical', page: 1, limit: 10 })
      .set(authHeaders())
      .expect(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(response.body.contacts[0].firstName).toBe('Searchable');
  });

  test('allows updates only through the immutable primary Facility', async () => {
    const contact = await createStoredContact({
      facilityIds: [primaryFacility._id, associatedFacility._id],
    });
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders({ facility: associatedFacility }))
      .send({ title: 'New title' })
      .expect(403);
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ primaryFacilityId: associatedFacility._id })
      .expect(400);
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ organizationId: otherOrganization._id })
      .expect(400);

    const response = await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ title: 'Updated title', facilityIds: [primaryFacility._id] })
      .expect(200);
    expect(response.body.contact.title).toBe('Updated title');
    expect(response.body.contact.updatedBy).toBe(actorId.toString());
  });

  test('validates newly associated Facilities for technician updates', async () => {
    const contact = await createStoredContact();
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders({ role: 'technician', facilities: [primaryFacility._id] }))
      .send({ facilityIds: [primaryFacility._id, associatedFacility._id] })
      .expect(403);
  });

  test('returns 400 for an invalid Contact id', async () => {
    await request(app).get('/contacts/not-an-id').set(authHeaders()).expect(400);
  });

  test('allows only administrators to archive through primary Facility context', async () => {
    const contact = await createStoredContact();
    await request(app)
      .patch(`/contacts/${contact._id}/archive`)
      .set(authHeaders({ role: 'technician', facilities: [primaryFacility._id] }))
      .expect(403);

    const response = await request(app)
      .patch(`/contacts/${contact._id}/archive`)
      .set(authHeaders())
      .expect(200);
    expect(response.body.contact).toMatchObject({
      status: 'archived',
      archivedBy: actorId.toString(),
      updatedBy: actorId.toString(),
    });
    expect(response.body.contact.archivedAt).toBeTruthy();
    await request(app).get(`/contacts/${contact._id}`).set(authHeaders()).expect(404);
  });
});

describe('advisory Contact duplicate warnings', () => {
  test('returns accessible duplicate details without rejecting creation', async () => {
    const existing = await createStoredContact({
      firstName: 'Avery',
      lastName: 'Morgan',
      email: 'avery.morgan@example.test',
      phone: '9375550100',
      normalizedEmail: 'avery.morgan@example.test',
      normalizedName: 'avery morgan',
      normalizedPhone: '9375550100',
    });
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody())
      .expect(201);

    expect(response.body.warnings).toEqual([
      expect.objectContaining({
        code: 'possible_duplicate',
        matchedOn: ['email', 'name', 'phone'],
        matches: [expect.objectContaining({ id: existing._id.toString() })],
      }),
    ]);
    await expect(Contact.countDocuments({ organizationId: organization._id })).resolves.toBe(2);
  });

  test('does not leak identifiers for duplicates outside selected Facility scope', async () => {
    const hidden = await createStoredContact({
      primaryFacilityId: associatedFacility._id,
      facilityIds: [associatedFacility._id],
      firstName: 'Avery',
      lastName: 'Morgan',
      normalizedName: 'avery morgan',
    });
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({ email: '', phone: '' }))
      .expect(201);

    expect(response.body.warnings).toEqual([
      { code: 'possible_duplicate', hasRestrictedMatches: true },
    ]);
    const serialized = JSON.stringify(response.body.warnings);
    for (const forbidden of [
      hidden._id,
      hidden.firstName,
      hidden.lastName,
      hidden.email,
      ...(hidden.phone ? [hidden.phone] : []),
      associatedFacility._id,
      'matchedOn',
      'matches',
      'count',
    ].filter(Boolean)) {
      expect(serialized).not.toContain(String(forbidden));
    }
  });
});

describe('Contact request-body validation', () => {
  test.each([
    ['null', null],
    ['array', []],
    ['string', 'contact'],
    ['number', 42],
    ['boolean', true],
  ])('rejects a %s POST body with structured validation error', async (_label, body) => {
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .type('application/json')
      .send(JSON.stringify(body))
      .expect(400);
    expect(response.body).toMatchObject({ code: 'validation_error' });
  });

  test.each([
    ['null', null],
    ['array', []],
    ['string', 'contact'],
    ['number', 42],
    ['boolean', false],
  ])('rejects a %s PATCH body with structured validation error', async (_label, body) => {
    const contact = await createStoredContact();
    const response = await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .type('application/json')
      .send(JSON.stringify(body))
      .expect(400);
    expect(response.body).toMatchObject({ code: 'validation_error' });
  });

  test('rejects an empty or server-owned-only PATCH body', async () => {
    const contact = await createStoredContact();
    for (const body of [{}, { updatedBy: new mongoose.Types.ObjectId() }]) {
      const response = await request(app)
        .patch(`/contacts/${contact._id}`)
        .set(authHeaders())
        .send(body)
        .expect(400);
      expect(response.body).toMatchObject({ code: 'validation_error' });
    }
  });
});

describe('additional Contact tenant and association boundaries', () => {
  test('excludes Contacts associated only with another Facility from lists', async () => {
    await createStoredContact({
      primaryFacilityId: associatedFacility._id,
      facilityIds: [associatedFacility._id],
    });
    const response = await request(app).get('/contacts').set(authHeaders()).expect(200);
    expect(response.body).toMatchObject({ contacts: [], total: 0 });
  });

  test('returns 404 for out-of-scope PATCH and archive requests', async () => {
    const contact = await createStoredContact();
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders({ facility: outsideFacility }))
      .send({ title: 'Hidden update' })
      .expect(404);
    await request(app)
      .patch(`/contacts/${contact._id}/archive`)
      .set(authHeaders({ facility: outsideFacility }))
      .expect(404);
  });

  test('rejects archival through a secondary associated Facility', async () => {
    const contact = await createStoredContact({
      facilityIds: [primaryFacility._id, associatedFacility._id],
    });
    await request(app)
      .patch(`/contacts/${contact._id}/archive`)
      .set(authHeaders({ facility: associatedFacility }))
      .expect(403);
  });

  test('requires PATCH facilityIds to retain the primary Facility', async () => {
    const contact = await createStoredContact({
      facilityIds: [primaryFacility._id, associatedFacility._id],
    });
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ facilityIds: [associatedFacility._id] })
      .expect(400);
  });

  test('rejects missing and cross-Organization Facility associations on PATCH', async () => {
    const contact = await createStoredContact();
    await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ facilityIds: [primaryFacility._id, new mongoose.Types.ObjectId()] })
      .expect(400);
    const response = await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders())
      .send({ facilityIds: [primaryFacility._id, outsideFacility._id] })
      .expect(400);
    expect(response.body.code).toBe('cross_organization_facility');
  });

  test('allows a technician to add an authorized same-Organization Facility', async () => {
    const contact = await createStoredContact();
    const response = await request(app)
      .patch(`/contacts/${contact._id}`)
      .set(authHeaders({
        role: 'technician',
        facilities: [primaryFacility._id, associatedFacility._id],
      }))
      .send({ facilityIds: [primaryFacility._id, associatedFacility._id] })
      .expect(200);
    expect(response.body.contact.facilityIds.map(String)).toEqual(expect.arrayContaining([
      primaryFacility._id.toString(),
      associatedFacility._id.toString(),
    ]));
  });
});

describe('Contact response privacy and archive visibility', () => {
  test('never exposes normalization fields from POST, detail, list, or PATCH', async () => {
    const created = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody())
      .expect(201);
    const contactId = created.body.contact._id;
    const detail = await request(app).get(`/contacts/${contactId}`).set(authHeaders()).expect(200);
    const list = await request(app).get('/contacts').set(authHeaders()).expect(200);
    const updated = await request(app)
      .patch(`/contacts/${contactId}`)
      .set(authHeaders())
      .send({ email: 'updated@example.test' })
      .expect(200);

    for (const response of [created.body, detail.body, list.body, updated.body]) {
      expect(JSON.stringify(response)).not.toContain('normalizedEmail');
      expect(JSON.stringify(response)).not.toContain('normalizedName');
      expect(JSON.stringify(response)).not.toContain('normalizedPhone');
    }
  });

  test('removes archived Contacts from list and detail', async () => {
    const contact = await createStoredContact();
    await request(app)
      .patch(`/contacts/${contact._id}/archive`)
      .set(authHeaders())
      .expect(200);
    await request(app).get(`/contacts/${contact._id}`).set(authHeaders()).expect(404);
    const list = await request(app).get('/contacts').set(authHeaders()).expect(200);
    expect(list.body).toMatchObject({ contacts: [], total: 0 });
  });
});

describe('Contact duplicate boundaries', () => {
  test('does not warn for matching data in another Organization', async () => {
    await createStoredContact({
      organizationId: otherOrganization._id,
      primaryFacilityId: outsideFacility._id,
      facilityIds: [outsideFacility._id],
      firstName: 'Avery',
      lastName: 'Morgan',
      email: 'avery.morgan@example.test',
      phone: '9375550100',
      normalizedEmail: 'avery.morgan@example.test',
      normalizedName: 'avery morgan',
      normalizedPhone: '9375550100',
    });
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody())
      .expect(201);
    expect(response.body.warnings).toEqual([]);
  });

  test('does not match empty email or phone values', async () => {
    await createStoredContact({
      firstName: 'First',
      lastName: 'Person',
      email: '',
      phone: '',
      normalizedEmail: '',
      normalizedName: 'first person',
      normalizedPhone: '',
    });
    const response = await request(app)
      .post('/contacts')
      .set(authHeaders())
      .send(contactBody({
        firstName: 'Second',
        lastName: 'Person',
        email: '',
        phone: '',
      }))
      .expect(201);
    expect(response.body.warnings).toEqual([]);
  });
});

describe('Contact search, pagination, and generic failures', () => {
  test('treats search regular-expression metacharacters literally', async () => {
    await createStoredContact({ firstName: 'Literal', title: 'Uses .* literally' });
    await createStoredContact({ firstName: 'Other', title: 'Clinical leader' });
    const response = await request(app)
      .get('/contacts')
      .query({ search: '.*' })
      .set(authHeaders())
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.contacts[0].firstName).toBe('Literal');
  });

  test('rejects overlong search and pathological pagination', async () => {
    await request(app)
      .get('/contacts')
      .query({ search: 'x'.repeat(201) })
      .set(authHeaders())
      .expect(400);
    for (const query of [
      { page: 0 },
      { page: 1001 },
      { page: '1x' },
      { limit: 0 },
      { limit: 101 },
      { limit: '20x' },
    ]) {
      await request(app).get('/contacts').query(query).set(authHeaders()).expect(400);
    }
  });

  test('returns a generic 500 without exposing internal errors', async () => {
    const failure = 'sensitive-internal-failure';
    jest.spyOn(Facility, 'findById').mockReturnValue({
      select: () => ({ lean: async () => { throw new Error(failure); } }),
    });
    const response = await request(app).get('/contacts').set(authHeaders()).expect(500);
    expect(response.body).toEqual({ error: 'Failed to validate Facility context' });
    expect(JSON.stringify(response.body)).not.toContain(failure);
  });
});
