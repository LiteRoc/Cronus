const mongoose = require("mongoose");
const Asset = require("../Asset");

const washerDisinfectorSchema = new mongoose.Schema({
  washCycles: [String],
  detergentType: String,
  lastBiologicalTestDate: Date,
});

module.exports = Asset.discriminator("WasherDisinfector", washerDisinfectorSchema);