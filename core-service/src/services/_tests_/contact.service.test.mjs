import { createRequire } from 'node:module';

const requireCore = createRequire(new URL('../../../package.json', import.meta.url));
const mongoose = requireCore('mongoose');
const Contact = requireCore('./src/models/Contact.js');
const {
  normalizeEmail,
  normalizeName,
  normalizePhone,
} = requireCore('./src/services/contactService.js');

describe('Contact service normalization', () => {
  test('normalizes comparison values without changing display inputs', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(normalizeName('  Mary  Jane ', ' VAN   BUREN ')).toBe('mary jane van buren');
    expect(normalizePhone('+1 (937) 555-0100 ext. 4')).toBe('193755501004');
  });
});

describe('Contact schema invariants and indexes', () => {
  test('requires ownership, audit, and identity fields', () => {
    for (const path of [
      'organizationId',
      'primaryFacilityId',
      'facilityIds',
      'firstName',
      'lastName',
      'createdBy',
      'updatedBy',
    ]) {
      expect(Contact.schema.path(path).isRequired).toBeTruthy();
    }
    expect(Contact.schema.path('normalizedEmail').options.select).toBe(false);
    expect(Contact.schema.path('normalizedName').options.select).toBe(false);
    expect(Contact.schema.path('normalizedPhone').options.select).toBe(false);
  });

  test('has scoped duplicate-warning indexes and no unique email index', () => {
    const indexes = Contact.schema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      [{ facilityIds: 1, archivedAt: 1, lastName: 1, firstName: 1, _id: 1 }, expect.any(Object)],
      [
        { organizationId: 1, normalizedEmail: 1 },
        expect.objectContaining({ partialFilterExpression: { archivedAt: null } }),
      ],
      [
        { organizationId: 1, normalizedName: 1 },
        expect.objectContaining({ partialFilterExpression: { archivedAt: null } }),
      ],
      [
        { organizationId: 1, normalizedPhone: 1 },
        expect.objectContaining({ partialFilterExpression: { archivedAt: null } }),
      ],
    ]));
    for (const [definition, options] of indexes) {
      if (definition.normalizedEmail || definition.email) expect(options.unique).not.toBe(true);
    }
  });

  test.each([
    ['archived without audit fields', { status: 'archived' }],
    ['archived without actor', { status: 'archived', archivedAt: new Date() }],
    ['active with archive time', { status: 'active', archivedAt: new Date() }],
    ['inactive with archive actor', { status: 'inactive', archivedBy: new mongoose.Types.ObjectId() }],
  ])('rejects contradictory archive state: %s', async (_label, archiveState) => {
    const primaryFacilityId = new mongoose.Types.ObjectId();
    const contact = new Contact({
      organizationId: new mongoose.Types.ObjectId(),
      primaryFacilityId,
      facilityIds: [primaryFacilityId],
      firstName: 'Archive',
      lastName: 'Invariant',
      createdBy: new mongoose.Types.ObjectId(),
      updatedBy: new mongoose.Types.ObjectId(),
      ...archiveState,
    });

    await expect(contact.validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
