require("dotenv").config();
const mongoose = require("mongoose");
const Asset = require("../models/Asset");
const EquipmentTemplate = require("../models/EquipmentTemplate");

const KNOWN_WAYNE_ASSET = "WHC2318812";

const parents = [
  {
    ctrlNumber: "00AD-02679",
    manufacturer: "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.",
    model: "Logiq P6",
    description: "Ultrasound, Diagnostic, General Purpose",
    serialNumber: "236902SU3",
    department: "L & D",
    locationNote: "Wayne Healthcare/L & D/L&D/",
    facilityAssetTagNumber: "03848"
  },
  {
    ctrlNumber: "00AD-02683",
    manufacturer: "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.",
    model: "Logiq P6",
    description: "Ultrasound, Diagnostic, General Purpose",
    serialNumber: "236903SU1",
    department: "Emergency Department",
    locationNote: "/Emergency Department/Emergency Department/",
    facilityAssetTagNumber: "3852"
  }
];

const transducers = [
  ["00AD-01118", "Philips Medical Systems Hsg", "L12-5", "Ultrasound Transducer, 5-12 MHz", "031X2X", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-01119", "Philips Medical Systems Hsg", "C5-1", "Ultrasound Transducer, 1-5 MHz", "030LIB", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-01120", "Philips Medical Systems Hsg", "V6-2", "Ultrasound Transducer, 2-6 MHz", "L12-5", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-02558", "Philips Medical Systems Hsg", "C5-1", "Ultrasound Transducer, 1-5 MHz", "03H4ZV", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-02559", "Philips Medical Systems Hsg", "C10-3V", "Ultrasound Transducer, 3-10 MHz", "03FLFF", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-02560", "Philips Medical Systems Hsg", "C9-5ec", "Ultrasound Transducer, 5-9 MHz", "0316CP", "Radiology", "/Radiology/Radiology/", null],
  ["00AD-02562", "Philips Medical Systems Hsg", "L12-5", "Ultrasound Transducer, 5-12 MHz", "031RGW", "Radiology", "/Radiology/Radiology/", null],

  ["00AD-02680", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "II L", "Transducer, Standard, 0 To 2.9", "141197WP7", "L & D", "Wayne Healthcare/L & D/L&D/", "00AD-02679"],
  ["00AD-02681", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "4 C", "Transducer, Standard, 0 To 2.9", "298592WX7", "L & D", "Wayne Healthcare/L & D/L&D/", "00AD-02679"],
  ["00AD-02684", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "4 C", "Transducer, Standard, 0 To 2.9", "304538WX2", "L & D", "Wayne Healthcare/L & D/L&D/", "00AD-02683"],
  ["00AD-02685", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "II L", "Transducer, Standard, 0 To 2.9", "142406WP8", "L & D", "Wayne Healthcare/L & D/L&D/", "00AD-02683"],

  ["29261", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "II L", "Transducer, Standard, 0 To 2.9", "322292WX4", "Emergency Department", "/Emergency Department/Emergency Department/", null],

  ["285463KR6", "GE Healthcare Austria GmbH & Co OG", "RIC5-9A-RS", "Rectal/vaginal ultrasound imaging transducer", "285463KR6", "Clinics", "Western Ohio OBGYN in MOB", "WHC2318812"],
  ["1102550WX9", "GE Healthcare Austria GmbH & Co OG", "RAB6-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "1102550WX9", "Clinics", "Western Ohio OBGYN in MOB", "WHC2318812"],

  ["B18P1H", "Philips Ultrasound LLC", "Transducer C5-1", "Extracorporeal ultrasound imaging transducer, hand-held", "B18P1H", "Respiratory Therapy", "Ultrasound room 1", null],
  ["F03G4J", "Philips Ultrasound LLC", "Transducer C5-1", "Extracorporeal ultrasound imaging transducer, hand-held", "F03G4J", "Radiology", "Ultrasound room 1", null]
];

async function getOrCreateTemplate(manufacturer, model, description) {
  let template = await EquipmentTemplate.findOne({ manufacturer, model });

  if (!template) {
    template = await EquipmentTemplate.create({
      manufacturer,
      model,
      description,
      verified: false,
      status: "Active",
      kind: "GenericAsset",
      autoAddPmProcedure: false,
      requirePmPlan: false,
      manufacturerRecommendedPMFrequency: 12
    });
  }

  return template;
}

async function upsertAsset(payload) {
  return Asset.findOneAndUpdate(
    { ctrlNumber: payload.ctrlNumber },
    { $set: payload },
    { upsert: true, new: true, runValidators: true }
  );
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const knownWayneAsset = await Asset.findOne({ ctrlNumber: KNOWN_WAYNE_ASSET });

  if (!knownWayneAsset) {
    throw new Error(`Could not find ${KNOWN_WAYNE_ASSET} to determine Wayne facilityId.`);
  }

  const facilityId = knownWayneAsset.facilityId;

  for (const parent of parents) {
    const template = await getOrCreateTemplate(
      parent.manufacturer,
      parent.model,
      parent.description
    );

    await upsertAsset({
      ctrlNumber: parent.ctrlNumber,
      templateId: template._id,
      manufacturer: parent.manufacturer,
      model: parent.model,
      description: parent.description,
      serialNumber: parent.serialNumber,
      status: "Active",
      facilityId,
      departmentId: null,
      locationNote: parent.locationNote,
      parentAsset: null,
      relationToParent: "Other",
      contractId: null,
      contractValue: 0,
      attributes: {
        sourceSystem: "TruAsset",
        department: parent.department,
        facilityAssetTagNumber: parent.facilityAssetTagNumber,
        coverageCode: "Not Covered",
        coverageLevel: "Undefined",
        importedForRelationshipMapping: true
      }
    });

    console.log(`Parent ready: ${parent.ctrlNumber}`);
  }

  for (const row of transducers) {
    const [
      ctrlNumber,
      manufacturer,
      model,
      description,
      serialNumber,
      department,
      locationNote,
      parentTag
    ] = row;

    const template = await getOrCreateTemplate(manufacturer, model, description);

    let parentAsset = null;
    if (parentTag) {
      const parent = await Asset.findOne({ ctrlNumber: parentTag });
      if (!parent) {
        console.warn(`WARNING: Parent not found for ${ctrlNumber}: ${parentTag}`);
      } else {
        parentAsset = parent._id;
      }
    }

    await upsertAsset({
      ctrlNumber,
      templateId: template._id,
      manufacturer,
      model,
      description,
      serialNumber,
      status: "Active",
      facilityId,
      departmentId: null,
      locationNote,
      parentAsset,
      relationToParent: "Accessory",
      contractId: null,
      contractValue: 0,
      attributes: {
        sourceSystem: "TruAsset",
        department,
        parentAssetTag: parentTag,
        assetCategory: "Ultrasound Transducer",
        coverageCode: "Not Covered"
      }
    });

    console.log(`Transducer ready: ${ctrlNumber}${parentTag ? ` -> ${parentTag}` : " -> unassigned"}`);
  }

  await mongoose.disconnect();
  console.log("Done importing Wayne ultrasound parents/transducers.");
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});