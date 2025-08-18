const mongoose = require("mongoose");
const Asset = require("../Asset");

const autoclaveSchema = new mongoose.Schema({
  chamberSizeLiters: Number,
  lastSporeTestDate: Date,
  cycleTypes: [String], // e.g., ["Gravity", "Pre-Vac", "Flash"]
});

module.exports = Asset.discriminator("Autoclave", autoclaveSchema);