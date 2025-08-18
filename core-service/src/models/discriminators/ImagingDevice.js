const mongoose = require('mongoose');
const Asset = require('../Asset');

const imagingDeviceSchema = new mongoose.Schema({
  modality: String, // e.g., "X-ray", "MRI", "CT"
  roomNumber: String,
  softwareVersion: String,

  pacsInfo: {
    aeTitle: { type: String },
    pacsAeTitle: { type: String },
    pacsIp: { type: String },
    pacsPort: { type: Number },
    modalityType: { type: String }, // e.g., CT, MR, US
    dicomVersion: { type: String },
  },
});

module.exports = Asset.discriminator('ImagingDevice', imagingDeviceSchema);
