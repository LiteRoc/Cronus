// One bounded durable record per token. Only the built-in _id index is needed.
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  referenceModel: String,
  referenceId: mongoose.Schema.Types.ObjectId,
  reservation: mongoose.Schema.Types.Mixed,
  expectedFence: { type: String, default: null },
  state: { type: String, enum: ['reserved', 'committed', 'absent', 'released'] },
  outcome: { type: String, enum: ['committed', 'absent'] },
  audit: mongoose.Schema.Types.Mixed,
}, { versionKey: false, autoCreate: false, autoIndex: false });
module.exports = mongoose.model('ReferenceOperation', schema);
