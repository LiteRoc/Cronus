import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const JWT_SECRET = 'cronus-followup-suite-only-secret-with-adequate-length';
const JWT_ISSUER = 'cronus.api';
const JWT_AUDIENCE = 'cronus.app';

let app;
let Contact;
let Facility;
let FollowUp;
let Organization;
let User;
let harness;
let organization;
let facility;
let otherFacility;
let actorId;
let adminAssignee;
let technicianAssignee;
let contact;

jest.setTimeout(120000);

function tokenFor(overrides = {}, options = {}) {
  const payload = { id: actorId.toString(), role: 'admin', facilities: [], ...overrides };
  if (Object.prototype.hasOwnProperty.call(overrides, 'role') && overrides.role === undefined) delete payload.role;
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
    title: 'Call clinical engineering director',
    description: 'Review replacement priorities',
    dueAt: '2026-09-15T14:00:00.000Z',
    priority: 'normal',
    assignedTo: adminAssignee._id.toString(),
    ...overrides,
  };
}

async function insertUser({ role = 'technician', facilities = [facility._id], facilityId = null } = {}) {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id,
    username: `user-${_id}`,
    email: `${_id}@example.test`,
    password: 'not-used-by-tests',
    role,
    facilities,
    ...(facilityId && { facilityId }),
  });
  return User.findById(_id).lean();
}

async function storedFollowUp(overrides = {}) {
  const status = overrides.status || 'open';
  return FollowUp.create({
    facilityId: overrides.facilityId || facility._id,
    title: overrides.title || 'Stored follow-up',
    description: overrides.description || '',
    dueAt: overrides.dueAt || new Date('2026-09-15T14:00:00.000Z'),
    status,
    priority: overrides.priority || 'normal',
    assignedTo: overrides.assignedTo || adminAssignee._id,
    contactId: Object.prototype.hasOwnProperty.call(overrides, 'contactId') ? overrides.contactId : null,
    completedAt: status === 'completed' ? (overrides.completedAt || new Date()) : null,
    completedBy: status === 'completed' ? (overrides.completedBy || actorId) : null,
    cancelledAt: status === 'cancelled' ? (overrides.cancelledAt || new Date()) : null,
    cancelledBy: status === 'cancelled' ? (overrides.cancelledBy || actorId) : null,
    archivedAt: overrides.archivedAt || null,
    archivedBy: overrides.archivedBy || null,
    createdBy: overrides.createdBy || actorId,
    updatedBy: overrides.updatedBy || actorId,
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
  FollowUp = requireCore('./src/models/FollowUp.js');
  Organization = requireCore('./src/models/Organization.js');
  User = requireCore('./src/models/User.js');
  const router = requireCore('./src/routers/followUpRouter.js');
  app = express();
  app.use(express.json());
  app.use('/followups', router.followUpJsonErrorHandler, router);
});

beforeEach(async () => {
  actorId = new mongoose.Types.ObjectId();
  organization = await Organization.create({ name: `Health System ${new mongoose.Types.ObjectId()}` });
  [facility, otherFacility] = await Facility.create([
    { organizationId: organization._id, name: 'Primary Facility' },
    { organizationId: organization._id, name: 'Other Facility' },
  ]);
  adminAssignee = await insertUser({ role: 'admin', facilities: [facility._id] });
  technicianAssignee = await insertUser({ role: 'technician', facilities: [facility._id] });
  contact = await Contact.create({
    organizationId: organization._id,
    primaryFacilityId: facility._id,
    facilityIds: [facility._id],
    firstName: 'Avery',
    lastName: 'Morgan',
    createdBy: actorId,
    updatedBy: actorId,
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([
    FollowUp.deleteMany({}), Contact.deleteMany({}), User.deleteMany({}),
    Facility.deleteMany({}), Organization.deleteMany({}),
  ]);
});
afterAll(async () => harness.stop());

describe('FollowUp authentication and strict Facility context', () => {
  test('rejects missing and invalid authentication', async () => {
    await request(app).get('/followups').set('x-facility-id', facility._id.toString()).expect(401);
    await request(app).get('/followups').set({ Authorization: 'Bearer invalid', 'x-facility-id': facility._id.toString() }).expect(403);
  });

  test.each([
    ['admin', 200], ['technician', 200], ['customer', 403], ['viewer', 403],
    ['tech', 403], ['unknown', 403], ['missing', 403],
  ])('enforces canonical role %s', async (role, expected) => {
    const claims = role === 'missing' ? { role: undefined, facilities: [facility._id] } : { role, facilities: [facility._id] };
    await request(app).get('/followups').set({
      Authorization: `Bearer ${tokenFor(claims)}`,
      'x-facility-id': facility._id.toString(),
    }).expect(expected);
  });

  test('requires an explicit valid existing Facility even for admins', async () => {
    const authorization = `Bearer ${tokenFor()}`;
    await request(app).get('/followups').set('Authorization', authorization).expect(400);
    await request(app).get('/followups').set({ Authorization: authorization, 'x-facility-id': 'bad' }).expect(400);
    await request(app).get('/followups').set({ Authorization: authorization, 'x-facility-id': new mongoose.Types.ObjectId().toString() }).expect(404);
  });

  test('rejects a technician selecting an unauthorized Facility', async () => {
    await request(app).get('/followups').set(headers({
      role: 'technician', selectedFacility: otherFacility, facilities: [facility._id],
    })).expect(403);
  });
});

describe('FollowUp creation, ownership, assignee, and Contact validation', () => {
  test('derives ownership, forces open, and prevents audit/lifecycle spoofing', async () => {
    const response = await request(app).post('/followups').set(headers()).send(body({
      facilityId: otherFacility._id,
      status: 'completed',
      completedAt: new Date(),
      completedBy: new mongoose.Types.ObjectId(),
      archivedAt: new Date(),
      archivedBy: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      updatedBy: new mongoose.Types.ObjectId(),
      contactId: contact._id,
    })).expect(201);
    expect(response.body.followUp).toMatchObject({
      facilityId: facility._id.toString(),
      status: 'open',
      createdBy: actorId.toString(),
      updatedBy: actorId.toString(),
      contactId: contact._id.toString(),
    });
    expect(response.body.followUp.completedAt).toBeNull();
    expect(response.body.followUp.archivedAt).toBeNull();
  });

  test.each([
    ['missing assignee', { assignedTo: undefined }],
    ['invalid assignee', { assignedTo: 'bad' }],
    ['nonexistent assignee', { assignedTo: new mongoose.Types.ObjectId() }],
  ])('rejects %s', async (_label, changes) => {
    const requestBody = body(changes);
    if (changes.assignedTo === undefined) delete requestBody.assignedTo;
    await request(app).post('/followups').set(headers()).set('Content-Type', 'application/json').send(JSON.stringify(requestBody)).expect(400);
  });

  test.each(['customer', 'viewer', 'tech', 'unknown'])('rejects a %s assignee', async (role) => {
    const assignee = await insertUser({ role, facilities: [facility._id] });
    await request(app).post('/followups').set(headers()).send(body({ assignedTo: assignee._id })).expect(400);
  });

  test('rejects an assignee with no role', async () => {
    const assigneeId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: assigneeId,
      username: `missing-role-${assigneeId}`,
      email: `${assigneeId}@example.test`,
      password: 'not-used-by-tests',
      facilities: [facility._id],
    });
    await request(app).post('/followups').set(headers()).send(body({ assignedTo: assigneeId })).expect(400);
  });

  test('accepts Facility-authorized admin and technician assignees', async () => {
    await request(app).post('/followups').set(headers()).send(body({ assignedTo: adminAssignee._id })).expect(201);
    await request(app).post('/followups').set(headers()).send(body({ assignedTo: technicianAssignee._id })).expect(201);
  });

  test('rejects an otherwise valid assignee without selected-Facility access', async () => {
    const assignee = await insertUser({ role: 'technician', facilities: [otherFacility._id] });
    await request(app).post('/followups').set(headers()).send(body({ assignedTo: assignee._id })).expect(400);
  });

  test('unlinks and reassigns Contacts only within the selected Facility', async () => {
    const replacement = await Contact.create({
      organizationId: organization._id,
      primaryFacilityId: facility._id,
      facilityIds: [facility._id],
      firstName: 'Replacement', lastName: 'Contact', createdBy: actorId, updatedBy: actorId,
    });
    const followUp = await storedFollowUp({ contactId: contact._id });
    const unlinked = await request(app).patch(`/followups/${followUp._id}`)
      .set(headers()).send({ contactId: null }).expect(200);
    expect(unlinked.body.followUp.contactId).toBeNull();
    const reassigned = await request(app).patch(`/followups/${followUp._id}`)
      .set(headers()).send({ contactId: replacement._id }).expect(200);
    expect(reassigned.body.followUp.contactId).toBe(replacement._id.toString());
  });

  test('validates optional Contact within selected Facility without disclosure', async () => {
    const inaccessible = await Contact.create({
      organizationId: organization._id,
      primaryFacilityId: otherFacility._id,
      facilityIds: [otherFacility._id],
      firstName: 'Hidden', lastName: 'Person', createdBy: actorId, updatedBy: actorId,
    });
    await request(app).post('/followups').set(headers()).send(body({ contactId: inaccessible._id })).expect(400);
    await request(app).post('/followups').set(headers()).send(body({ contactId: 'bad' })).expect(400);
    contact.status = 'archived'; contact.archivedAt = new Date(); contact.archivedBy = actorId; await contact.save();
    await request(app).post('/followups').set(headers()).send(body({ contactId: contact._id })).expect(400);
  });
});

describe('FollowUp validation and terminal lifecycle', () => {
  test.each([null, [], 'text', 42, true])('rejects malformed POST body %p', async (requestBody) => {
    await request(app).post('/followups').set(headers())
      .set('Content-Type', 'application/json').send(JSON.stringify(requestBody)).expect(400);
  });

  test.each([
    ['2026-09-15T14:00:00.000Z', '2026-09-15T14:00:00.000Z'],
    ['2026-09-15T10:00:00-04:00', '2026-09-15T14:00:00.000Z'],
  ])('accepts timezone-explicit dueAt %s', async (dueAt, expected) => {
    const response = await request(app).post('/followups').set(headers()).send(body({ dueAt })).expect(201);
    expect(response.body.followUp.dueAt).toBe(expected);
  });

  test.each([
    0,
    [],
    {},
    '2026-09-15T14:00:00',
    '2026-09-15',
    '2026-02-30T14:00:00Z',
    '2026-09-15T25:00:00Z',
    '2026-09-15T14:00:00+24:00',
  ])('rejects coerced or ambiguous dueAt %p', async (dueAt) => {
    await request(app).post('/followups').set(headers()).send(body({ dueAt })).expect(400);
  });

  test.each([
    ['missing title', { title: undefined }],
    ['missing dueAt', { dueAt: undefined }],
    ['invalid dueAt', { dueAt: 'not-a-date' }],
    ['invalid priority', { priority: 'urgent' }],
  ])('rejects %s', async (_label, changes) => {
    const requestBody = body(changes);
    for (const [key, value] of Object.entries(changes)) if (value === undefined) delete requestBody[key];
    await request(app).post('/followups').set(headers()).set('Content-Type', 'application/json').send(JSON.stringify(requestBody)).expect(400);
  });

  test.each([null, [], 'text', 42, true])('rejects malformed PATCH body %p', async (requestBody) => {
    const followUp = await storedFollowUp();
    await request(app).patch(`/followups/${followUp._id}`).set(headers()).set('Content-Type', 'application/json').send(JSON.stringify(requestBody)).expect(400);
  });

  test('rejects empty and server-owned-only PATCH bodies', async () => {
    const followUp = await storedFollowUp();
    await request(app).patch(`/followups/${followUp._id}`).set(headers()).send({}).expect(400);
    await request(app).patch(`/followups/${followUp._id}`).set(headers()).send({
      status: 'completed', facilityId: otherFacility._id, updatedBy: new mongoose.Types.ObjectId(),
    }).expect(400);
  });

  test('updates allowlisted fields while open and preserves ownership', async () => {
    const followUp = await storedFollowUp();
    const response = await request(app).patch(`/followups/${followUp._id}`).set(headers()).send({
      title: 'Updated title', assignedTo: technicianAssignee._id, facilityId: otherFacility._id, status: 'cancelled',
    }).expect(200);
    expect(response.body.followUp).toMatchObject({ title: 'Updated title', status: 'open', facilityId: facility._id.toString() });
    expect(response.body.followUp.assignedTo).toBe(technicianAssignee._id.toString());
  });

  test.each(['completed', 'cancelled'])('freezes ordinary edits after %s', async (status) => {
    const followUp = await storedFollowUp({ status });
    await request(app).patch(`/followups/${followUp._id}`).set(headers()).send({ title: 'Forbidden edit' }).expect(409);
  });

  test('completes once with canonical audit fields and cannot then cancel', async () => {
    const followUp = await storedFollowUp();
    const response = await request(app).patch(`/followups/${followUp._id}/complete`).set(headers()).expect(200);
    expect(response.body.followUp.status).toBe('completed');
    expect(response.body.followUp.completedBy).toBe(actorId.toString());
    expect(response.body.followUp.completedAt).toBeTruthy();
    expect(response.body.followUp.cancelledAt).toBeNull();
    await request(app).patch(`/followups/${followUp._id}/complete`).set(headers()).expect(409);
    await request(app).patch(`/followups/${followUp._id}/cancel`).set(headers()).expect(409);
  });

  test('cancels once with canonical audit fields and cannot then complete', async () => {
    const followUp = await storedFollowUp();
    const response = await request(app).patch(`/followups/${followUp._id}/cancel`).set(headers()).expect(200);
    expect(response.body.followUp.status).toBe('cancelled');
    expect(response.body.followUp.cancelledBy).toBe(actorId.toString());
    expect(response.body.followUp.cancelledAt).toBeTruthy();
    expect(response.body.followUp.completedAt).toBeNull();
    await request(app).patch(`/followups/${followUp._id}/cancel`).set(headers()).expect(409);
    await request(app).patch(`/followups/${followUp._id}/complete`).set(headers()).expect(409);
  });
});

describe('FollowUp Facility isolation and archive', () => {
  test('list excludes another Facility and scoped detail returns 404', async () => {
    const visible = await storedFollowUp();
    const hidden = await storedFollowUp({ facilityId: otherFacility._id });
    const list = await request(app).get('/followups').set(headers()).expect(200);
    expect(list.body.followUps.map((item) => item._id)).toEqual([visible._id.toString()]);
    await request(app).get(`/followups/${hidden._id}`).set(headers()).expect(404);
  });

  test.each([
    ['update', (id) => `/followups/${id}`, { title: 'No' }],
    ['complete', (id) => `/followups/${id}/complete`, {}],
    ['cancel', (id) => `/followups/${id}/cancel`, {}],
    ['archive', (id) => `/followups/${id}/archive`, {}],
  ])('out-of-scope %s returns 404', async (_label, url, requestBody) => {
    const hidden = await storedFollowUp({ facilityId: otherFacility._id });
    await request(app).patch(url(hidden._id)).set(headers()).send(requestBody).expect(404);
  });

  test('archive remains admin-only', async () => {
    const target = await storedFollowUp();
    await request(app).patch(`/followups/${target._id}/archive`)
      .set(headers({ role: 'technician', facilities: [facility._id] })).expect(403);
  });

  test.each(['open', 'completed', 'cancelled'])('admin archives a %s FollowUp', async (status) => {
    const target = await storedFollowUp({ status });
    const response = await request(app).patch(`/followups/${target._id}/archive`).set(headers()).expect(200);
    expect(response.body.followUp.archivedBy).toBe(actorId.toString());
    await request(app).get(`/followups/${target._id}`).set(headers()).expect(404);
    const list = await request(app).get('/followups').set(headers()).expect(200);
    expect(list.body.followUps.map((item) => item._id)).not.toContain(target._id.toString());
  });
});

describe('FollowUp filters, bounds, and safe failures', () => {
  test('filters status, assignee, Contact, dates, overdue, and literal search', async () => {
    const past = await storedFollowUp({
      title: 'Call [MRI] team', dueAt: new Date('2020-01-01T00:00:00.000Z'), contactId: contact._id,
    });
    await storedFollowUp({ status: 'completed', dueAt: new Date('2020-01-01T00:00:00.000Z') });
    await storedFollowUp({ assignedTo: technicianAssignee._id, dueAt: new Date('2030-01-01T00:00:00.000Z') });
    const cases = [
      ['status=completed', 1],
      [`assignedTo=${technicianAssignee._id}`, 1],
      [`contactId=${contact._id}`, 1],
      ['dueFrom=2029-01-01T00%3A00%3A00.000Z&dueTo=2031-01-01T00%3A00%3A00.000Z', 1],
      ['overdue=true', 1],
      ['search=%5BMRI%5D', 1],
    ];
    for (const [query, count] of cases) {
      const response = await request(app).get(`/followups?${query}`).set(headers()).expect(200);
      expect(response.body.total).toBe(count);
    }
    const detail = await request(app).get(`/followups/${past._id}`).set(headers()).expect(200);
    expect(detail.body.followUp.overdue).toBe(true);
  });

  test.each([
    'status=invalid', 'assignedTo=bad', 'contactId=bad', 'dueFrom=bad',
    'dueFrom=2030-01-01T00%3A00%3A00Z&dueTo=2020-01-01T00%3A00%3A00Z',
    'dueFrom=2026-01-01T00%3A00%3A00', 'overdue=maybe', 'page=1001', 'limit=101',
  ])('rejects invalid filter %s', async (query) => {
    await request(app).get(`/followups?${query}`).set(headers()).expect(400);
  });

  test('applies inclusive date boundaries and exact overdue boundaries', async () => {
    const boundary = '2026-09-15T14:00:00.000Z';
    await storedFollowUp({ title: 'Boundary MRI', dueAt: new Date(boundary) });
    const dueFrom = await request(app).get(`/followups?dueFrom=${encodeURIComponent(boundary)}`)
      .set(headers()).expect(200);
    expect(dueFrom.body.total).toBe(1);
    const dueTo = await request(app).get(`/followups?dueTo=${encodeURIComponent(boundary)}`)
      .set(headers()).expect(200);
    expect(dueTo.body.total).toBe(1);
    const atBoundary = await requireCore('./src/services/followUpService.js').listFollowUps({
      facilityId: facility._id,
      query: { overdue: 'true' },
      now: new Date(boundary),
    });
    expect(atBoundary.total).toBe(0);
  });

  test('composes status, overdue, search, and archived exclusion', async () => {
    await storedFollowUp({ title: 'MRI open past', dueAt: new Date('2020-01-01T00:00:00.000Z') });
    await storedFollowUp({ title: 'MRI completed past', status: 'completed', dueAt: new Date('2020-01-01T00:00:00.000Z') });
    await storedFollowUp({ title: 'MRI open future', dueAt: new Date('2030-01-01T00:00:00.000Z') });
    await storedFollowUp({ title: 'MRI archived past', dueAt: new Date('2020-01-01T00:00:00.000Z'), archivedAt: new Date(), archivedBy: actorId });
    const overdueOpen = await request(app).get('/followups?status=open&overdue=true&search=MRI')
      .set(headers()).expect(200);
    expect(overdueOpen.body.total).toBe(1);
    await request(app).get('/followups?status=completed&overdue=true').set(headers()).expect(400);
    await request(app).get('/followups?status=cancelled&overdue=true').set(headers()).expect(400);
    const notOverdueOpen = await request(app).get('/followups?status=open&overdue=false&search=MRI')
      .set(headers()).expect(200);
    expect(notOverdueOpen.body.total).toBe(1);
    const notOverdueCompleted = await request(app).get('/followups?status=completed&overdue=false&search=MRI')
      .set(headers()).expect(200);
    expect(notOverdueCompleted.body.total).toBe(1);
  });

  test.each(['bad', 'not-an-object-id'])('rejects invalid FollowUp id %s on every mutation', async (id) => {
    await request(app).patch(`/followups/${id}`).set(headers()).send({ title: 'No' }).expect(400);
    await request(app).patch(`/followups/${id}/complete`).set(headers()).expect(400);
    await request(app).patch(`/followups/${id}/cancel`).set(headers()).expect(400);
    await request(app).patch(`/followups/${id}/archive`).set(headers()).expect(400);
  });

  test('rejects overlong search and invalid resource IDs', async () => {
    await request(app).get(`/followups?search=${'x'.repeat(201)}`).set(headers()).expect(400);
    await request(app).get('/followups/bad').set(headers()).expect(400);
  });

  test('returns a generic 500 for unexpected failures', async () => {
    jest.spyOn(FollowUp, 'find').mockImplementationOnce(() => { throw new Error('sensitive detail'); });
    const response = await request(app).get('/followups').set(headers()).expect(500);
    expect(response.body).toEqual({ error: 'FollowUp operation failed' });
    expect(JSON.stringify(response.body)).not.toContain('sensitive detail');
  });
});

describe('FollowUp Facility-scoped assignee picker', () => {
  test.each([
    ['admin', 200], ['technician', 200], ['customer', 403], ['viewer', 403],
    ['tech', 403], ['unknown', 403], ['missing', 403],
  ])('enforces canonical caller role %s', async (role, expected) => {
    const claims = role === 'missing' ? { role: undefined, facilities: [facility._id] } : { role, facilities: [facility._id] };
    await request(app).get('/followups/assignees').set({
      Authorization: `Bearer ${tokenFor(claims)}`,
      'x-facility-id': facility._id.toString(),
    }).expect(expected);
  });

  test('requires explicit valid authorized Facility context', async () => {
    const auth = `Bearer ${tokenFor({ role: 'technician', facilities: [facility._id] })}`;
    await request(app).get('/followups/assignees').set('Authorization', auth).expect(400);
    await request(app).get('/followups/assignees').set({ Authorization: auth, 'x-facility-id': 'bad' }).expect(400);
    await request(app).get('/followups/assignees').set({
      Authorization: auth, 'x-facility-id': otherFacility._id.toString(),
    }).expect(403);
  });

  test('returns only minimal canonical Facility-authorized assignees without cross-Facility leakage', async () => {
    const alternateAdmin = await insertUser({ role: 'admin', facilities: [], facilityId: facility._id });
    const otherTechnician = await insertUser({ role: 'technician', facilities: [otherFacility._id] });
    await insertUser({ role: 'customer', facilities: [facility._id] });
    await insertUser({ role: 'viewer', facilities: [facility._id] });
    await insertUser({ role: 'tech', facilities: [facility._id] });
    const response = await request(app).get('/followups/assignees').set(headers()).expect(200);
    const ids = response.body.items.map((item) => item._id);
    expect(ids).toEqual(expect.arrayContaining([
      adminAssignee._id.toString(), technicianAssignee._id.toString(), alternateAdmin._id.toString(),
    ]));
    expect(ids).not.toContain(otherTechnician._id.toString());
    for (const item of response.body.items) {
      expect(Object.keys(item).sort()).toEqual(['_id', 'name', 'role']);
      expect(['admin', 'technician']).toContain(item.role);
    }
  });
});
