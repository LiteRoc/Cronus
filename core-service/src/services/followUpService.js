const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const { normalizedFacilityClaims } = require('../middleware/crmFacilityScope');

class FollowUpServiceError extends Error {
  constructor(status, message, code = 'followup_error') {
    super(message);
    this.name = 'FollowUpServiceError';
    this.status = status;
    this.code = code;
  }
}

const MUTABLE_FIELDS = ['title', 'description', 'dueAt', 'priority', 'assignedTo', 'contactId'];
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1000;
const MAX_PAGE_SIZE = 100;

function assertPlainBody(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new FollowUpServiceError(400, 'Request body must be a JSON object', 'validation_error');
  }
}

function parseObjectId(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === '')) return null;
  const text = value?.toString?.() || '';
  if (!mongoose.isValidObjectId(text)) {
    throw new FollowUpServiceError(400, `${field} must be a valid ObjectId`, 'validation_error');
  }
  return new mongoose.Types.ObjectId(text);
}

function parseDate(value, field) {
  if (value === null || value === undefined || value === '') {
    throw new FollowUpServiceError(400, `${field} is required`, 'validation_error');
  }
  if (typeof value !== 'string') {
    throw new FollowUpServiceError(
      400,
      `${field} must be an ISO-8601 timestamp with a timezone`,
      'validation_error',
    );
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    throw new FollowUpServiceError(
      400,
      `${field} must be an ISO-8601 timestamp with a timezone`,
      'validation_error',
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , timezone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth
    || hour > 23 || minute > 59 || second > 59) {
    throw new FollowUpServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
  }
  if (timezone !== 'Z') {
    const [offsetHour, offsetMinute] = timezone.slice(1).split(':').map(Number);
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new FollowUpServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new FollowUpServiceError(400, `${field} must be a valid timestamp`, 'validation_error');
  }
  return date;
}

function pickMutableFields(input, { partial = false } = {}) {
  assertPlainBody(input);
  const output = {};
  for (const field of MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'title')) {
    if (typeof output.title !== 'string' || !output.title.trim()) {
      throw new FollowUpServiceError(400, 'title is required', 'validation_error');
    }
  }
  if (Object.prototype.hasOwnProperty.call(output, 'description') && typeof output.description !== 'string') {
    throw new FollowUpServiceError(400, 'description must be a string', 'validation_error');
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'dueAt')) {
    output.dueAt = parseDate(output.dueAt, 'dueAt');
  }
  if (Object.prototype.hasOwnProperty.call(output, 'priority')
    && !['low', 'normal', 'high'].includes(output.priority)) {
    throw new FollowUpServiceError(400, 'priority must be low, normal, or high', 'validation_error');
  }
  if (!partial || Object.prototype.hasOwnProperty.call(output, 'assignedTo')) {
    output.assignedTo = parseObjectId(output.assignedTo, 'assignedTo');
  }
  if (Object.prototype.hasOwnProperty.call(output, 'contactId')) {
    output.contactId = parseObjectId(output.contactId, 'contactId', { nullable: true });
  }
  return output;
}

function userHasFacility(user, facilityId) {
  return normalizedFacilityClaims(user).has(facilityId.toString());
}

async function validateAssignee(assignedTo, facilityId) {
  const user = await User.findById(assignedTo).select('_id role facilityId facilities').lean();
  if (!user || !['admin', 'technician'].includes(user.role) || !userHasFacility(user, facilityId)) {
    throw new FollowUpServiceError(400, 'assignedTo is not available for the selected Facility', 'invalid_assignee');
  }
  return user._id;
}

async function listFollowUpAssignees({ facilityId }) {
  const users = await User.find({
    role: { $in: ['admin', 'technician'] },
    $or: [{ facilityId }, { facilities: facilityId }],
  }).select('_id username role').sort({ username: 1, _id: 1 }).lean();

  return users.map((user) => ({
    _id: user._id,
    name: user.username,
    role: user.role,
  }));
}

async function validateContact(contactId, facilityId) {
  if (!contactId) return null;
  const contact = await Contact.findOne({ _id: contactId, facilityIds: facilityId, archivedAt: null })
    .select('_id').lean();
  if (!contact) {
    throw new FollowUpServiceError(400, 'contactId is not available for the selected Facility', 'invalid_contact');
  }
  return contact._id;
}

function withDerivedOverdue(value, now = new Date()) {
  const plain = typeof value?.toObject === 'function' ? value.toObject() : { ...value };
  plain.overdue = plain.status === 'open' && new Date(plain.dueAt).getTime() < now.getTime();
  return plain;
}

function scopedActiveQuery(id, facilityId) {
  return { _id: id, facilityId, archivedAt: null };
}

async function createFollowUp({ body, facilityId, user }) {
  const values = pickMutableFields(body);
  values.assignedTo = await validateAssignee(values.assignedTo, facilityId);
  values.contactId = await validateContact(values.contactId, facilityId);
  const followUp = await FollowUp.create({
    ...values, facilityId, status: 'open', createdBy: user.id, updatedBy: user.id,
  });
  return withDerivedOverdue(followUp);
}

async function getFollowUp({ followUpId, facilityId, now }) {
  const id = parseObjectId(followUpId, 'FollowUp id');
  const followUp = await FollowUp.findOne(scopedActiveQuery(id, facilityId)).lean();
  if (!followUp) throw new FollowUpServiceError(404, 'FollowUp not found', 'not_found');
  return withDerivedOverdue(followUp, now);
}

function parseBoundedPositiveInteger(value, { name, defaultValue, maximum }) {
  if (value === undefined) return defaultValue;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new FollowUpServiceError(400, `${name} must be a positive integer`, 'validation_error');
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new FollowUpServiceError(400, `${name} must be between 1 and ${maximum}`, 'validation_error');
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseFilterDate(value, name) {
  if (value === undefined) return null;
  return parseDate(value, name);
}

async function listFollowUps({ facilityId, query = {}, now = new Date() }) {
  const page = parseBoundedPositiveInteger(query.page, { name: 'page', defaultValue: 1, maximum: MAX_PAGE });
  const limit = parseBoundedPositiveInteger(query.limit, { name: 'limit', defaultValue: 20, maximum: MAX_PAGE_SIZE });
  const filter = { facilityId, archivedAt: null };
  if (query.status !== undefined) {
    if (!['open', 'completed', 'cancelled'].includes(query.status)) {
      throw new FollowUpServiceError(400, 'status filter is invalid', 'validation_error');
    }
    filter.status = query.status;
  }
  if (query.assignedTo !== undefined) filter.assignedTo = parseObjectId(query.assignedTo, 'assignedTo');
  if (query.contactId !== undefined) filter.contactId = parseObjectId(query.contactId, 'contactId');

  const dueFrom = parseFilterDate(query.dueFrom, 'dueFrom');
  const dueTo = parseFilterDate(query.dueTo, 'dueTo');
  if (dueFrom && dueTo && dueFrom > dueTo) {
    throw new FollowUpServiceError(400, 'dueFrom must not be after dueTo', 'validation_error');
  }
  if (dueFrom || dueTo) filter.dueAt = { ...(dueFrom && { $gte: dueFrom }), ...(dueTo && { $lte: dueTo }) };
  if (query.overdue !== undefined) {
    if (!['true', 'false'].includes(String(query.overdue))) {
      throw new FollowUpServiceError(400, 'overdue must be true or false', 'validation_error');
    }
    if (String(query.overdue) === 'true') {
      if (filter.status && filter.status !== 'open') {
        throw new FollowUpServiceError(400, 'overdue=true requires status=open', 'validation_error');
      }
      filter.status = 'open';
      filter.dueAt = { ...(filter.dueAt || {}), $lt: now };
    } else {
      filter.$or = [{ status: { $ne: 'open' } }, { dueAt: { $gte: now } }];
    }
  }
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new FollowUpServiceError(400, `search must be ${MAX_SEARCH_LENGTH} characters or fewer`, 'validation_error');
  }
  if (search) {
    const textSearch = [
      { title: new RegExp(escapeRegex(search), 'i') },
      { description: new RegExp(escapeRegex(search), 'i') },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: textSearch }];
      delete filter.$or;
    } else filter.$or = textSearch;
  }
  const [followUps, total] = await Promise.all([
    FollowUp.find(filter).sort({ dueAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    FollowUp.countDocuments(filter),
  ]);
  return {
    followUps: followUps.map((followUp) => withDerivedOverdue(followUp, now)),
    total, page, limit, totalPages: Math.ceil(total / limit),
  };
}

async function updateFollowUp({ followUpId, body, facilityId, user }) {
  const id = parseObjectId(followUpId, 'FollowUp id');
  const changes = pickMutableFields(body, { partial: true });
  if (Object.keys(changes).length === 0) {
    throw new FollowUpServiceError(400, 'PATCH body must contain a mutable FollowUp field', 'validation_error');
  }
  const followUp = await FollowUp.findOne(scopedActiveQuery(id, facilityId));
  if (!followUp) throw new FollowUpServiceError(404, 'FollowUp not found', 'not_found');
  if (followUp.status !== 'open') {
    throw new FollowUpServiceError(409, 'Only open FollowUps may be edited', 'terminal_followup');
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'assignedTo')) {
    changes.assignedTo = await validateAssignee(changes.assignedTo, facilityId);
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'contactId')) {
    changes.contactId = await validateContact(changes.contactId, facilityId);
  }
  Object.assign(followUp, changes, { updatedBy: user.id });
  await followUp.save();
  return withDerivedOverdue(followUp);
}

async function transitionFollowUp({ followUpId, facilityId, user, transition, now = new Date() }) {
  const id = parseObjectId(followUpId, 'FollowUp id');
  const auditAt = transition === 'completed' ? 'completedAt' : 'cancelledAt';
  const auditBy = transition === 'completed' ? 'completedBy' : 'cancelledBy';
  const followUp = await FollowUp.findOne(scopedActiveQuery(id, facilityId));
  if (!followUp) throw new FollowUpServiceError(404, 'FollowUp not found', 'not_found');
  if (followUp.status !== 'open') {
    throw new FollowUpServiceError(409, 'Only open FollowUps may transition', 'terminal_followup');
  }
  followUp.status = transition;
  followUp[auditAt] = now;
  followUp[auditBy] = user.id;
  followUp.updatedBy = user.id;
  await followUp.save();
  return withDerivedOverdue(followUp, now);
}

function completeFollowUp(options) {
  return transitionFollowUp({ ...options, transition: 'completed' });
}

function cancelFollowUp(options) {
  return transitionFollowUp({ ...options, transition: 'cancelled' });
}

async function archiveFollowUp({ followUpId, facilityId, user, now = new Date() }) {
  const id = parseObjectId(followUpId, 'FollowUp id');
  const followUp = await FollowUp.findOne(scopedActiveQuery(id, facilityId));
  if (!followUp) throw new FollowUpServiceError(404, 'FollowUp not found', 'not_found');
  followUp.archivedAt = now;
  followUp.archivedBy = user.id;
  followUp.updatedBy = user.id;
  await followUp.save();
  return withDerivedOverdue(followUp, now);
}

module.exports = {
  FollowUpServiceError,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  archiveFollowUp,
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  getFollowUp,
  listFollowUpAssignees,
  listFollowUps,
  updateFollowUp,
  validateAssignee,
  validateContact,
  withDerivedOverdue,
};
