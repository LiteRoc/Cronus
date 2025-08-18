const mongoose = require("mongoose");
const Asset = require("../Asset");

const defibrillatorSchema = new mongoose.Schema({
  mode: String, // e.g., "AED", "Manual"
  energyLevels: [String], // e.g., ["50J", "100J", "200J"]
  lastShockTestDate: Date,
});

module.exports = Asset.discriminator("Defibrillator", defibrillatorSchema);