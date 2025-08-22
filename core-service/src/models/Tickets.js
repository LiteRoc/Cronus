const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketSchema = new Schema({
  customerId:  { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  assetId:     { type: Schema.Types.ObjectId, ref: 'Asset', index: true },

  type:        { type: String, enum: ['service', 'consumable'], required: true, index: true },
  status:      { type: String, enum: ['Open','Needs Info','Approved','Converted','Rejected','Closed'], default: 'Open', index: true },
  priority:    { type: String, enum: ['Low','Normal','High','Critical'], default: 'Normal' },

  subject:     { type: String, required: true },
  description: { type: String, default: '' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },

  // Consumable request details (optional)
  partId:      { type: Schema.Types.ObjectId, ref: 'Part' }, // consumables
  quantity:    { type: Number, min: 1 },

  // Linking to downstream WO (once converted)
  workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', index: true, default: null },

  // Audit
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy:   { type: Schema.Types.ObjectId, ref: 'User' },

  // Soft delete
  deletedAt:   { type: Date, default: null, index: true },
  deletedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

TicketSchema.index({ customerId: 1, status: 1, createdAt: -1 });
TicketSchema.index({ customerId: 1, type: 1, createdAt: -1 });

TicketSchema.index({ assetId: 1, status: 1 });
TicketSchema.index({ workOrderId: 1 });

module.exports = mongoose.model('Ticket', TicketSchema);