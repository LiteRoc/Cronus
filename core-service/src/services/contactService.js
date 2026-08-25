const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const Facility = require('../models/Facility');
const { normalizedFacilityClaims } = require('../middleware/crmFacilityScope');

class ContactServiceError extends Error {
  constructor(status, message, code = 'contact_error') {
    super(message);
    this.name = 'ContactServiceError';
    this.status = status;
    this.code = code;
  }
}

const CONTACT_FIELDS = [
  'firstName',
  'lastName',
  'title',
  'functionalDescription',
  'email',
  'phone',
  'notes',
  'status',
];
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1000;
const MAX_PAGE_SIZE = 100;

function assertPlainBody(input) {
  if (
    input === null
    || typeof input !== 'object'
    || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    throw new ContactServiceError(400, 'Request body must be a JSON object', 'validation_error');
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizationFields(contact) {
  return {
    normalizedEmail: normalizeEmail(contact.email),
    normalizedName: normalizeName(contact.firstName, contact.lastName),
    normalizedPhone: normalizePhone(contact.phone),
  };
}

function pickContactFields(input, { partial = false } = {}) {
  assertPlainBody(input);
  const output = {};
  for (const field of CONTACT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  }

  for (const field of ['firstName', 'lastName']) {
    if (!partial || Object.prototype.hasOwnProperty.call(output, field)) {
      if (typeof output[field] !== 'string' || !output[field].trim()) {
        throw new ContactServiceError(400, `${field} is required`, 'validation_error');
      }
    }
  }

  for (const field of CONTACT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(output, field) && typeof output[field] !== 'string') {
      throw new ContactServiceError(400, `${field} must be a string`, 'validation_error');
    }
  }

  if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email.trim())) {
    throw new ContactServiceError(400, 'email must be valid', 'validation_error');
  }
  if (Object.prototype.hasOwnProperty.call(output, 'status') && !['active', 'inactive'].includes(output.status)) {
    throw new ContactServiceError(400, 'status must be active or inactive', 'validation_error');
  }

  return output;
}

function uniqueObjectIdStrings(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new ContactServiceError(400, `${fieldName} must be an array`, 'validation_error');
  }

  const ids = [];
  const seen = new Set();
  for (const value of values) {
    const stringValue = value?.toString?.() || '';
    if (!mongoose.isValidObjectId(stringValue)) {
      throw new ContactServiceError(400, `${fieldName} contains an invalid ObjectId`, 'validation_error');
    }
    if (!seen.has(stringValue)) {
      ids.push(stringValue);
      seen.add(stringValue);
    }
  }
  return ids;
}

function ensureTechnicianFacilityAccess(user, facilityIds) {
  if (user.role !== 'technician') return;
  const allowed = normalizedFacilityClaims(user);
  if (facilityIds.some((facilityId) => !allowed.has(facilityId.toString()))) {
    throw new ContactServiceError(403, 'Forbidden', 'forbidden');
  }
}

async function validateFacilityAssociations({
  primaryFacility,
  facilityIds,
  user,
  technicianFacilityIds = facilityIds,
}) {
  const primaryId = primaryFacility._id.toString();
  const normalizedIds = uniqueObjectIdStrings(facilityIds, 'facilityIds');
  if (!normalizedIds.includes(primaryId)) normalizedIds.unshift(primaryId);

  ensureTechnicianFacilityAccess(user, technicianFacilityIds);

  const facilities = await Facility.find({ _id: { $in: normalizedIds } })
    .select('_id organizationId')
    .lean();
  if (facilities.length !== normalizedIds.length) {
    throw new ContactServiceError(400, 'Every associated Facility must exist', 'invalid_facility_association');
  }

  const organizationId = primaryFacility.organizationId.toString();
  if (facilities.some((facility) => facility.organizationId.toString() !== organizationId)) {
    throw new ContactServiceError(
      400,
      'Every associated Facility must belong to the primary Facility Organization',
      'cross_organization_facility',
    );
  }

  return normalizedIds.map((facilityId) => new mongoose.Types.ObjectId(facilityId));
}

function duplicateMatchFields(contact, normalized) {
  const matchedOn = [];
  if (normalized.normalizedEmail && contact.normalizedEmail === normalized.normalizedEmail) matchedOn.push('email');
  if (normalized.normalizedName && contact.normalizedName === normalized.normalizedName) matchedOn.push('name');
  if (normalized.normalizedPhone && contact.normalizedPhone === normalized.normalizedPhone) matchedOn.push('phone');
  return matchedOn;
}

async function duplicateWarnings({ organizationId, selectedFacilityId, values, excludeContactId = null }) {
  const normalized = normalizationFields(values);
  const comparisons = [
    normalized.normalizedEmail && { normalizedEmail: normalized.normalizedEmail },
    normalized.normalizedName && { normalizedName: normalized.normalizedName },
    normalized.normalizedPhone && { normalizedPhone: normalized.normalizedPhone },
  ].filter(Boolean);
  if (comparisons.length === 0) return [];

  const query = {
    organizationId,
    archivedAt: null,
    $or: comparisons,
  };
  if (excludeContactId) query._id = { $ne: excludeContactId };

  const candidates = await Contact.find(query)
    .select('firstName lastName title email phone facilityIds +normalizedEmail +normalizedName +normalizedPhone')
    .lean();
  if (candidates.length === 0) return [];

  const selectedId = selectedFacilityId.toString();
  const accessibleMatches = [];
  const accessibleMatchedFields = new Set();
  let hasRestrictedMatches = false;

  for (const candidate of candidates) {
    const matchedOn = duplicateMatchFields(candidate, normalized);
    const visible = candidate.facilityIds.some((facilityId) => facilityId.toString() === selectedId);
    if (visible) {
      matchedOn.forEach((field) => accessibleMatchedFields.add(field));
      accessibleMatches.push({
        id: candidate._id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        title: candidate.title,
        email: candidate.email,
        phone: candidate.phone,
        matchedOn,
      });
    } else {
      hasRestrictedMatches = true;
    }
  }

  const warnings = [];
  if (accessibleMatches.length > 0) {
    warnings.push({
      code: 'possible_duplicate',
      matchedOn: [...accessibleMatchedFields].sort(),
      matches: accessibleMatches,
    });
  }
  if (hasRestrictedMatches) {
    warnings.push({ code: 'possible_duplicate', hasRestrictedMatches: true });
  }
  return warnings;
}

async function createContact({ body, facility, user }) {
  const values = pickContactFields(body);
  const requestedFacilities = Object.prototype.hasOwnProperty.call(body, 'facilityIds')
    ? body.facilityIds
    : [facility._id];
  const facilityIds = await validateFacilityAssociations({
    primaryFacility: facility,
    facilityIds: requestedFacilities,
    user,
  });
  const normalized = normalizationFields(values);
  const warnings = await duplicateWarnings({
    organizationId: facility.organizationId,
    selectedFacilityId: facility._id,
    values,
  });

  const contact = await Contact.create({
    ...values,
    ...normalized,
    organizationId: facility.organizationId,
    primaryFacilityId: facility._id,
    facilityIds,
    createdBy: user.id,
    updatedBy: user.id,
  });
  return { contact, warnings };
}

function scopedActiveContactQuery(contactId, selectedFacilityId) {
  return {
    _id: contactId,
    facilityIds: selectedFacilityId,
    archivedAt: null,
  };
}

async function getContact({ contactId, selectedFacilityId }) {
  if (!mongoose.isValidObjectId(contactId)) {
    throw new ContactServiceError(400, 'Contact id must be a valid ObjectId', 'validation_error');
  }
  const contact = await Contact.findOne(scopedActiveContactQuery(contactId, selectedFacilityId)).lean();
  if (!contact) throw new ContactServiceError(404, 'Contact not found', 'not_found');
  return contact;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listContacts({ selectedFacilityId, query }) {
  const page = parseBoundedPositiveInteger(query.page, { name: 'page', defaultValue: 1, maximum: MAX_PAGE });
  const limit = parseBoundedPositiveInteger(query.limit, {
    name: 'limit',
    defaultValue: 20,
    maximum: MAX_PAGE_SIZE,
  });
  const filter = { facilityIds: selectedFacilityId, archivedAt: null };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new ContactServiceError(
      400,
      `search must be ${MAX_SEARCH_LENGTH} characters or fewer`,
      'validation_error',
    );
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { firstName: pattern },
      { lastName: pattern },
      { title: pattern },
      { functionalDescription: pattern },
      { email: pattern },
      { phone: pattern },
    ];
  }

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);

  return { contacts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function parseBoundedPositiveInteger(value, { name, defaultValue, maximum }) {
  if (value === undefined) return defaultValue;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new ContactServiceError(400, `${name} must be a positive integer`, 'validation_error');
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ContactServiceError(
      400,
      `${name} must be between 1 and ${maximum}`,
      'validation_error',
    );
  }
  return parsed;
}

async function updateContact({ contactId, body, selectedFacilityId, user }) {
  if (!mongoose.isValidObjectId(contactId)) {
    throw new ContactServiceError(400, 'Contact id must be a valid ObjectId', 'validation_error');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'primaryFacilityId')) {
    throw new ContactServiceError(400, 'primaryFacilityId is immutable', 'immutable_field');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'organizationId')) {
    throw new ContactServiceError(400, 'organizationId is derived and immutable', 'immutable_field');
  }

  const contact = await Contact.findOne(scopedActiveContactQuery(contactId, selectedFacilityId))
    .select('+normalizedEmail +normalizedName +normalizedPhone');
  if (!contact) throw new ContactServiceError(404, 'Contact not found', 'not_found');
  if (!contact.primaryFacilityId.equals(selectedFacilityId)) {
    throw new ContactServiceError(403, 'Contact updates require primary Facility context', 'primary_facility_required');
  }

  const changes = pickContactFields(body, { partial: true });
  const hasFacilityChanges = Object.prototype.hasOwnProperty.call(body, 'facilityIds');
  if (Object.keys(changes).length === 0 && !hasFacilityChanges) {
    throw new ContactServiceError(400, 'PATCH body must contain a mutable Contact field', 'validation_error');
  }
  const nextValues = {
    firstName: changes.firstName ?? contact.firstName,
    lastName: changes.lastName ?? contact.lastName,
    email: changes.email ?? contact.email,
    phone: changes.phone ?? contact.phone,
  };

  if (hasFacilityChanges) {
    const requestedIds = uniqueObjectIdStrings(body.facilityIds, 'facilityIds');
    const primaryId = contact.primaryFacilityId.toString();
    if (!requestedIds.includes(primaryId)) {
      throw new ContactServiceError(400, 'facilityIds must include primaryFacilityId', 'validation_error');
    }
    const oldIds = new Set(contact.facilityIds.map((facilityId) => facilityId.toString()));
    const newlyAssociated = requestedIds.filter((facilityId) => !oldIds.has(facilityId));
    const primaryFacility = await Facility.findById(contact.primaryFacilityId)
      .select('_id organizationId')
      .lean();
    changes.facilityIds = await validateFacilityAssociations({
      primaryFacility,
      facilityIds: requestedIds,
      user,
      technicianFacilityIds: newlyAssociated,
    });
  }

  Object.assign(contact, changes, normalizationFields(nextValues), { updatedBy: user.id });
  const warnings = await duplicateWarnings({
    organizationId: contact.organizationId,
    selectedFacilityId,
    values: nextValues,
    excludeContactId: contact._id,
  });
  await contact.save();
  return { contact, warnings };
}

async function archiveContact({ contactId, selectedFacilityId, user }) {
  if (!mongoose.isValidObjectId(contactId)) {
    throw new ContactServiceError(400, 'Contact id must be a valid ObjectId', 'validation_error');
  }
  const contact = await Contact.findOne(scopedActiveContactQuery(contactId, selectedFacilityId));
  if (!contact) throw new ContactServiceError(404, 'Contact not found', 'not_found');
  if (!contact.primaryFacilityId.equals(selectedFacilityId)) {
    throw new ContactServiceError(403, 'Contact archival requires primary Facility context', 'primary_facility_required');
  }

  contact.status = 'archived';
  contact.archivedAt = new Date();
  contact.archivedBy = user.id;
  contact.updatedBy = user.id;
  await contact.save();
  return contact;
}

module.exports = {
  ContactServiceError,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  archiveContact,
  createContact,
  duplicateWarnings,
  getContact,
  listContacts,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  updateContact,
  validateFacilityAssociations,
};
