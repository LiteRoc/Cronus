const { Schema } = require('mongoose');

const reservation = new Schema({
  token: { type: String, required: true },
  operation: { type: String, enum: ['part-create', 'part-manufacturer-update', 'workorder-part-add'], required: true },
  destinationModel: { type: String, enum: ['Part', 'WorkOrder'], required: true },
  destinationId: { type: Schema.Types.ObjectId, required: true },
  acquiredAt: { type: Date, required: true }, // Diagnostics only. Never a lease/TTL.
  writer: { type: Schema.Types.Mixed, required: true },
}, { _id: false });
const receipt = new Schema({
  token: { type: String, required: true },
  operation: { type: String, required: true },
  referenceModel: { type: String, required: true },
  referenceId: { type: Schema.Types.ObjectId, required: true },
  at: { type: Date, required: true },
}, { _id: false });

function addReferenceMetadata(schema, { reservable = false, destination = false } = {}) {
  if (reservable) schema.add({
    referenceReservation: { type: reservation, default: undefined, select: false },
  });
  if (destination) schema.add({
    referenceReceipt: { type: receipt, default: undefined, select: false },
    referenceFence: { type: String, default: undefined, select: false },
  });
  // select:false protects reads; transforms also protect newly saved documents.
  for (const method of ['toJSON', 'toObject']) schema.set(method, {
    ...schema.get(method),
    transform(_doc, result) {
      delete result.referenceReservation;
      delete result.referenceReceipt;
      delete result.referenceFence;
      return result;
    },
  });
}
module.exports = addReferenceMetadata;
