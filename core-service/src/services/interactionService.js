const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const Interaction = require('../models/Interaction');

class InteractionServiceError extends Error {
  constructor(status, message, code = 'interaction_error') {
    super(message);
    this.name = 'InteractionServiceError';
    this.status = status;
    this.code = code;
  }
}

const TYPES = ['meeting', 'call', 'email', 'site_visit', 'note'];
const DIRECTIONS = ['inbound', 'outbound', 'internal'];
const VISIBILITIES = ['operational', 'restricted'];
const MUTABLE_FIELDS = ['type', 'occurredAt', 'summary', 'body', 'direction', 'visibility', 'contactIds'];
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1000;
const MAX_PAGE_SIZE = 100;

function assertPlainBody(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new InteractionServiceError(400, 'Request body must be a JSON object', 'validation_error');
  }
}

function parseObjectId(value, field) {
  const text = value?.toString?.() || '';
  if (!mongoose.isValidObjectId(text)) {
    throw new InteractionServiceError(400, `${field} must be a valid ObjectId`, 'validation_error');
  }
  return new mongoose.Types.ObjectId(text);
}

function parseTimestamp(value, field) {
  if (typeof value !== 'string') {
    throw new InteractionServiceError(
      400, `${field} must be an ISO-8601 timestamp with a timezone`, 'validation_error',
    );
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    throw new InteractionServiceError(
      400, `${field} must be an ISO-8601 timestamp with a timezone`, 'validation_error',
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , timezone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth
    || hour > 23 || minute > 59 || second > 59) {
    throw new InteractionServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
  }
  if (timezone !== 'Z') {
    const [offsetHour, offsetMinute] = timezone.slice(1).split(':').map(Number);
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new InteractionServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InteractionServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
  }
  return parsed;
}

function parseOccurredAt(value, now = new Date()) {
  const occurredAt = parseTimestamp(value, 'occurredAt');
  if (occurredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new InteractionServiceError(
      400,
      'occurredAt cannot be more than five minutes in the future',
      'future_interaction',
    );
  }
  return occurredAt;
}

function parseContactIds(value) {
  if (!Array.isArray(value)) {
    throw new InteractionServiceError(400, 'contactIds must be an array', 'validation_error');
  }
  const unique = new Map();
  value.forEach((candidate, index) => {
    const id = parseObjectId(candidate, `contactIds[${index}]`);
    unique.set(id.toString(), id);
  });
  return [...unique.values()];
}

async function validateContacts(contactIds, facilityId) {
  if (contactIds.length === 0) return [];
  const contacts = await Contact.find({
    _id: { $in: contactIds },
    facilityIds: facilityId,
    status: 'active',
    archivedAt: null,
  }).select('_id').lean();
  if (contacts.length !== contactIds.length) {
    throw new InteractionServiceError(
      400,
      'One or more Contacts are not available for the selected Facility',
      'invalid_contacts',
    );
  }
  const valid = new Set(contacts.map((contact) => contact._id.toString()));
  return contactIds.filter((contactId) => valid.has(contactId.toString()));
}

function pickMutableFields(input, { partial = false, now = new Date() } = {}) {
  assertPlainBody(input);
  const output = {};
  MUTABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  });
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'type')) {
    if (!TYPES.includes(output.type)) {
      throw new InteractionServiceError(400, 'type is invalid', 'validation_error');
    }
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'occurredAt')) {
    output.occurredAt = parseOccurredAt(output.occurredAt, now);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'summary')) {
    if (typeof output.summary !== 'string' || !output.summary.trim()) {
      throw new InteractionServiceError(400, 'summary is required', 'validation_error');
    }
    output.summary = output.summary.trim();
  }
  if (Object.prototype.hasOwnProperty.call(output, 'body')) {
    if (typeof output.body !== 'string') {
      throw new InteractionServiceError(400, 'body must be a string', 'validation_error');
    }
    output.body = output.body.trim();
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'direction')) {
    if (!DIRECTIONS.includes(output.direction)) {
      throw new InteractionServiceError(400, 'direction is invalid', 'validation_error');
    }
  }
  if (Object.prototype.hasOwnProperty.call(output, 'visibility')
    && !VISIBILITIES.includes(output.visibility)) {
    throw new InteractionServiceError(400, 'visibility is invalid', 'validation_error');
  }
  if (!partial && !Object.prototype.hasOwnProperty.call(output, 'visibility')) {
    output.visibility = 'operational';
  }
  if (!partial && !Object.prototype.hasOwnProperty.call(output, 'body')) output.body = '';
  if (!partial && !Object.prototype.hasOwnProperty.call(output, 'contactIds')) output.contactIds = [];
  if (Object.prototype.hasOwnProperty.call(output, 'contactIds')) {
    output.contactIds = parseContactIds(output.contactIds);
  }
  return output;
}

function assertVisibilityAllowed(user, visibility) {
  if (user.role === 'technician' && visibility === 'restricted') {
    throw new InteractionServiceError(
      403,
      'Technicians may access operational Interactions only',
      'restricted_visibility',
    );
  }
}

function scopedActiveQuery(id, facilityId, user) {
  return {
    _id: id,
    facilityId,
    archivedAt: null,
    ...(user.role === 'technician' && { visibility: 'operational' }),
  };
}

async function createInteraction({ body, facilityId, user, now = new Date() }) {
  const values = pickMutableFields(body, { now });
  assertVisibilityAllowed(user, values.visibility);
  values.contactIds = await validateContacts(values.contactIds, facilityId);
  return Interaction.create({
    ...values, facilityId, createdBy: user.id, updatedBy: user.id,
  });
}

async function getInteraction({ interactionId, facilityId, user }) {
  const id = parseObjectId(interactionId, 'Interaction id');
  const interaction = await Interaction.findOne(scopedActiveQuery(id, facilityId, user)).lean();
  if (!interaction) throw new InteractionServiceError(404, 'Interaction not found', 'not_found');
  return interaction;
}

function parseBoundedPositiveInteger(value, { name, defaultValue, maximum }) {
  if (value === undefined) return defaultValue;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new InteractionServiceError(400, `${name} must be a positive integer`, 'validation_error');
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new InteractionServiceError(
      400, `${name} must be between 1 and ${maximum}`, 'validation_error',
    );
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listInteractions({ facilityId, user, query = {} }) {
  const page = parseBoundedPositiveInteger(
    query.page, { name: 'page', defaultValue: 1, maximum: MAX_PAGE },
  );
  const limit = parseBoundedPositiveInteger(
    query.limit, { name: 'limit', defaultValue: 20, maximum: MAX_PAGE_SIZE },
  );
  if (user.role === 'technician' && query.visibility === 'restricted') {
    return { interactions: [], total: 0, page, limit, totalPages: 0 };
  }
  const filter = {
    facilityId,
    archivedAt: null,
    ...(user.role === 'technician' && { visibility: 'operational' }),
  };
  if (query.type !== undefined) {
    if (!TYPES.includes(query.type)) {
      throw new InteractionServiceError(400, 'type filter is invalid', 'validation_error');
    }
    filter.type = query.type;
  }
  if (query.direction !== undefined) {
    if (!DIRECTIONS.includes(query.direction)) {
      throw new InteractionServiceError(400, 'direction filter is invalid', 'validation_error');
    }
    filter.direction = query.direction;
  }
  if (query.visibility !== undefined) {
    if (!VISIBILITIES.includes(query.visibility)) {
      throw new InteractionServiceError(400, 'visibility filter is invalid', 'validation_error');
    }
    filter.visibility = query.visibility;
  }
  if (query.contactId !== undefined) filter.contactIds = parseObjectId(query.contactId, 'contactId');
  const occurredFrom = query.occurredFrom === undefined
    ? null : parseTimestamp(query.occurredFrom, 'occurredFrom');
  const occurredTo = query.occurredTo === undefined
    ? null : parseTimestamp(query.occurredTo, 'occurredTo');
  if (occurredFrom && occurredTo && occurredFrom > occurredTo) {
    throw new InteractionServiceError(
      400, 'occurredFrom must not be after occurredTo', 'validation_error',
    );
  }
  if (occurredFrom || occurredTo) {
    filter.occurredAt = {
      ...(occurredFrom && { $gte: occurredFrom }),
      ...(occurredTo && { $lte: occurredTo }),
    };
  }
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new InteractionServiceError(
      400, `search must be ${MAX_SEARCH_LENGTH} characters or fewer`, 'validation_error',
    );
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ summary: pattern }, { body: pattern }];
  }
  const [interactions, total] = await Promise.all([
    Interaction.find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Interaction.countDocuments(filter),
  ]);
  return { interactions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateInteraction({ interactionId, body, facilityId, user, now = new Date() }) {
  const id = parseObjectId(interactionId, 'Interaction id');
  const changes = pickMutableFields(body, { partial: true, now });
  if (Object.keys(changes).length === 0) {
    throw new InteractionServiceError(
      400, 'PATCH body must contain a mutable Interaction field', 'validation_error',
    );
  }
  const interaction = await Interaction.findOne(scopedActiveQuery(id, facilityId, user));
  if (!interaction) throw new InteractionServiceError(404, 'Interaction not found', 'not_found');
  if (Object.prototype.hasOwnProperty.call(changes, 'visibility')) {
    assertVisibilityAllowed(user, changes.visibility);
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'contactIds')) {
    changes.contactIds = await validateContacts(changes.contactIds, facilityId);
  }
  Object.assign(interaction, changes, { updatedBy: user.id });
  await interaction.save();
  return interaction;
}

async function archiveInteraction({ interactionId, facilityId, user, now = new Date() }) {
  const id = parseObjectId(interactionId, 'Interaction id');
  const interaction = await Interaction.findOne(scopedActiveQuery(id, facilityId, user));
  if (!interaction) throw new InteractionServiceError(404, 'Interaction not found', 'not_found');
  interaction.archivedAt = now;
  interaction.archivedBy = user.id;
  interaction.updatedBy = user.id;
  await interaction.save();
  return interaction;
}

module.exports = {
  DIRECTIONS,
  FUTURE_TOLERANCE_MS,
  InteractionServiceError,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  TYPES,
  VISIBILITIES,
  archiveInteraction,
  createInteraction,
  getInteraction,
  listInteractions,
  parseOccurredAt,
  parseTimestamp,
  updateInteraction,
  validateContacts,
};
