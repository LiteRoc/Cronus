// Canonical Template evidence contract. Keep projections and recognition together.
// manufacturer is identity evidence; policy matching uses _id, not manufacturer/model/category.
const TEMPLATE_FIELDS = Object.freeze(['_id', 'manufacturer', 'benchmark', 'lifecycleDefaults', 'eolYears']);
function populatedLifecycleTemplate(value) {
  return value && typeof value === 'object' && /^[a-f\d]{24}$/i.test(String(value._id ?? '')) &&
    TEMPLATE_FIELDS.slice(1).some(field => Object.prototype.hasOwnProperty.call(value, field)) ? value : null;
}
module.exports = { TEMPLATE_FIELDS, populatedLifecycleTemplate };
