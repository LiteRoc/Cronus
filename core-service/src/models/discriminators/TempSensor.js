const mongoose = require('mongoose');
const Asset = require('../Asset');

const tempSensorSchema = new mongoose.Schema({
  subType: { type: String, enum: ['Sonicu','CheckPoint','Other'], required: true },

  // Sonicu
  macAddress: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    sparse: true,
    index: true,
    set: v => (v || '').replace(/[-;.\s]/g, ':').toUpperCase(), // accept ; - . spaces
    validate: {
      //validator: v => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v),
      validator: function (v) {
        if (this.subType !== 'Sonicu') return true;
        return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v);
      },
      message: 'Invalid MAC format. Use AA:BB:CC:DD:EE:FF'
    }
  },

  probes: [{
    serialNumber: { type: String, required: true, trim: true },
    calibrationDate: Date,
    isActive: { type: Boolean, default: true }
  }],

  // CheckPoint
  checkPointNumber: {
    type: String,
    trim: true,
    required: function () { return this.subType === 'CheckPoint'; }
  },
  sensorName: { type: String, trim: true },
  sensorNumber: { type: String, trim: true },

  // Other
  // (nothing required; user can use base fields + attributes)
});

module.exports = Asset.discriminator('TempSensor', tempSensorSchema);