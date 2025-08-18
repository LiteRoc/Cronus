const mongoose = require("mongoose");
const Asset = require("../Asset");

const monitorSchema = new mongoose.Schema({
  screenSizeInches: Number,
  resolution: String,
  softwareVersion: String,
  parametersMonitored: [String], // e.g., ["SpO2", "ECG", "NIBP"]
});

module.exports = Asset.discriminator("PatientMonitor", monitorSchema);