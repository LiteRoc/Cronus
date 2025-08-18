const mongoose = require("mongoose");
const Asset = require("../Asset");

const anesthesiaMachineSchema = new mongoose.Schema({
  vaporizerCount: Number,
  circuitType: String, // e.g., "circle", "open", "semi-open"
  backupO2: Boolean,
});

module.exports = Asset.discriminator("AnesthesiaMachine", anesthesiaMachineSchema);