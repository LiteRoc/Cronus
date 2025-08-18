const mongoose = require("mongoose");
const Asset = require("../Asset");

const infusionPumpSchema = new mongoose.Schema({
  channelCount: Number,
  batteryType: String,
  softwareVersion: String,
});

module.exports = Asset.discriminator("InfusionPump", infusionPumpSchema);