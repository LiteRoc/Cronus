const mongoose = require("mongoose");
const Asset = require("../Asset");

const testEquipmentSchema = new mongoose.Schema({
  calibrationDate: Date,
  calibrationDueDate: Date,
  equipmentType: String, // e.g., EST tester, simulator
});

module.exports = Asset.discriminator("TestEquipment", testEquipmentSchema);