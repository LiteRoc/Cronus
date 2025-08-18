const mongoose = require("mongoose");
const Asset = require("../Asset");

const ventilatorSchema = new mongoose.Schema({
  supportedModes: [String], // e.g., "AC", "SIMV", "CPAP"
  batteryBackup: Boolean,
  alarmSettings: String,
});

module.exports = Asset.discriminator("Ventilator", ventilatorSchema);