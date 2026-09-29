// Shared archive policy. Missing/exact null are the only inactive metadata values.
// Preserve stored BSON state before Mongoose can cast malformed legacy values.
const metadata = ['deletedAt', 'deletedBy', 'archivedAt', 'archivedBy', 'isArchived'];
const hydratedState = new WeakMap();
const absent = value => value === undefined || value === null;
function rawArchived(t) {
  return (!absent(t.status) && (typeof t.status !== 'string' || t.status === 'Archived')) ||
    metadata.some(key => !absent(t[key]));
}
function isArchived(t) { return hydratedState.get(t) === true || rawArchived(t); }
function remember(t, raw) { hydratedState.set(t, rawArchived(raw)); }
const activeFilter = () => ({ $expr: { $and: [
  { $in: [{ $type: '$status' }, ['missing', 'null', 'string']] },
  { $ne: ['$status', 'Archived'] },
  ...metadata.map(key => ({ $in: [{ $type: `$${key}` }, ['missing', 'null']] })),
] } });
module.exports = { isArchived, remember, activeFilter };
