const mongoose = require('mongoose');
const { Schema } = mongoose;

const analysisSchema = new Schema({
  contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
  year: { type: Number, required: true },
  totalWorkOrderCost: { type: Number, default: 0 },
  totalPartsCost: { type: Number, default: 0 },
  totalLaborHours: { type: Number, default: 0 },
  totalLaborCost: { type: Number, default: 0 },
  contractValue: { type: Number }, // snapshot from Contract
  estimatedInHouseCost: { type: Number }, // based on average internal rates
  netGainLoss: { type: Number }, // contractValue - estimatedInHouseCost
  performanceRating: { type: String, enum: ['excellent', 'good', 'neutral', 'poor'], default: 'neutral' },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('ContractAnalysis', analysisSchema);