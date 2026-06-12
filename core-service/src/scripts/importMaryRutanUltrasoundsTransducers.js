require("dotenv").config();
const mongoose = require("mongoose");

const Asset = require("../models/Asset");

const VOLUSON_P8_TEMPLATE_ID = "6a27fe6750f0330fe79dda5d";
const LOGIQ_E10_TEMPLATE_ID = "6a29887530ca88097a2707b6";

const FACILITY_LOOKUP_ASSETS = [
  "MRH2500605",
  "MRH1519001",
  "MRH2300401",
  "MRH2535103",
  "MRH2535105"
];

const parentUltrasounds = [
  {
    ctrlNumber: "MRH2201102",
    templateId: VOLUSON_P8_TEMPLATE_ID,
    manufacturer: "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.",
    model: "VOLUSON",
    description: "General-purpose ultrasound imaging system",
    serialNumber: "VP8810352",
    department: "Urbana Specialty Clinic",
    locationNote: "Exam Room 5 (OB/GYN)",
    modelNumber: "P8 BT18",
    di: "00840682138192",
    coverageLevel: "Undefined"
  },
  {
    ctrlNumber: "MRH2100701",
    templateId: VOLUSON_P8_TEMPLATE_ID,
    manufacturer: "GE Ultrasound Korea Ltd.",
    model: "VOLUSON",
    description: "General-purpose ultrasound imaging system",
    serialNumber: "VP8806624",
    department: "OB/GYN Clinic",
    locationNote: "OB/GYN (Spare Mobile Machine)",
    modelNumber: "P8 BT18",
    di: "00840682138192",
    coverageLevel: "Undefined"
  },
  {
    ctrlNumber: "MRH2522001",
    templateId: LOGIQ_E10_TEMPLATE_ID,
    manufacturer: "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC",
    model: "LOGIQ",
    description: "LOGIQ E10-V R4 Console",
    serialNumber: "LEX400611",
    department: "Radiology General",
    locationNote: "Radiology ultrasound room",
    modelNumber: "E10-V R4",
    di: "00195278869616",
    coverageLevel: "NEW"
  }
];

const transducers = [
  ["024520TS9", "PARALLEL DESIGN", "NA", "6S-D", "Extracorporeal ultrasound imaging transducer, hand-held", "024520TS9", "Cardiology", "cardiology", "447225yp4"],
  ["71132KR5", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "71132KR5", "OB/GYN Clinic", "Trophon Closet", null],
  ["93163KR4", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RIC5-9-D", "RIC5-9-D", "Transducer, Transvaginal", "93163KR4", "OB/GYN Clinic", "Mary Rutan Hospital/OB/GYN/OB/GYN/", null],
  ["125424PD2", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "125-D", "125-D", "Ultrasound, Transducer, Standa", "125424PD2", "Cardiology", "/Cardiology/Cardiology/", "447225yp4"],
  ["130034YP2", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "ML6-15-D", "ML6-15-D", "Transducer, Standard", "130034YP2", "Radiology General", "/Radiology/Radiology/", null],
  ["133968KR8", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RAB6-D", "RAB6-D", "Transducer, 4D 2-5 Mhz", "133968kr8", "OB/GYN Clinic", "Mary Rutan Hospital/OB/GYN/OB/GYN/", null],
  ["143941wp3", "GE HEALTHCARE JAPAN CORPORATION", "NA", "9L-D", "Extracorporeal ultrasound imaging transducer, hand-held", "143941wp3", "Cardiology", "cardiology", "447225yp4"],
  ["143994WP2", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "9L-D", "9L-D", "Transducer, Standard", "143994WP2", "Cardiology", "/Cardiology/Cardiology/", "MRH2535103"],
  ["164749YP4", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "C1-6-D", "C1-6-D", "Transducer, Standard", "164749YP4", "Radiology General", "/Radiology/Radiology/", null],
  ["170507YP8", "GE HEALTHCARE JAPAN CORPORATION", "NA", "C1-5-D", "Extracorporeal ultrasound imaging transducer, hand-held", "17507YP8", "Indian Lake Clinic", "Indian Lake (From OB/GYN Clinic)", "MRH1519001"],
  ["189520KR0", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RIC5-9-D", "RIC5-9-D", "Transducer, Transvaginal", "189520kr0", "OB/GYN Clinic", "Mary Rutan Hospital/OB/GYN/OB/GYN/", null],
  ["199642KRO", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "199642KRO", "OB/GYN Clinic", "Ultrasound Room 1", "MRH2521101"],
  ["217910kr9", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RIC5-9-D", "RIC5-9-D", "Transducer, Transvaginal", "217910kr9", "OB/GYN Clinic", "OB/GYN", null],
  ["223855kr8", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RIC5-9-D", "RIC5-9-D", "Transducer, Transvaginal", "223855kr8", "OB/GYN Clinic", "OB/GYN", null],
  ["226919KR9", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "226919KR9", "Indian Lake Clinic", "Indian Lake (From OB/GYN Clinic)", "MRH1519001"],
  ["234537PD9", "PARALLEL DESIGN", "NA", "L2-9-D", "Extracorporeal ultrasound imaging transducer, hand-held", "234537PD9", "Radiology General", "Radiology ultrasound room", "MRH2522001"],
  ["239736YP2", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "NA", "C1-5-D", "Extracorporeal ultrasound imaging transducer, hand-held", "239736YP2", "OB/GYN Clinic", "Ultrasound Room 2", "MRH2500605"],
  ["245623KR4", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "245623KR4", "OB/GYN Clinic", "Trophon Closet", null],
  ["278503KR8", "GE Healthcare Austria GmbH & Co OG", "RIC5-9A-RS", "RIC5-9A-RS", "Rectal/vaginal ultrasound imaging transducer", "278503KR8", "Urbana Specialty Clinic", "Exam Room 5 (Voluson Cart)", "MRH2201102"],
  ["284608KR7", "GE Healthcare Austria GmbH & Co OG", "RIC5-9A-RS", "RIC5-9A-RS", "Rectal/vaginal ultrasound imaging transducer", "284608KR7", "OB/GYN Clinic", "Clean Storage Hall (On wall)", "MRH2100701"],
  ["301377KR8", "GE Healthcare Austria GmbH & Co OG", "RIC5-9A-RS", "RIC5-9A-RS", "Rectal/vaginal ultrasound imaging transducer", "301377KR8", "OB/GYN Clinic", "Clean Storage Hall (On wall)", "MRH2100701"],
  ["315935wx7", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "RIC5-9-D", "RIC5-9-D", "Transducer, Transvaginal", "315935wx7", "Radiology General", "Radiology ultrasound room", "MRH2522001"],
  ["323077WP8", "GE HEALTHCARE JAPAN CORPORATION", "NA", "9L-D", "Extracorporeal ultrasound imaging transducer, hand-held", "323077WP8", "Cardiology", "cardiology", "MRH2535105"],
  ["326050WX2", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "IC5-9-D", "IC5-9-D", "Transducer, Standard", "326050WX2", "Radiology General", "/Radiology/Radiology/", null],
  ["327158KR2", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "327158KR2", "OB/GYN Clinic", "Trophon Closet", null],
  ["330133KR0", "GE Healthcare Austria GmbH & Co OG", "NA", "RIC5-9-D", "Rectal/vaginal ultrasound imaging transducer", "330133KR0", "OB/GYN Clinic", "Trophon Closet", null],
  ["440779WX7", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "IC5-9-D", "IC5-9-D", "Transducer, Standard", "440779WX7", "Radiology General", "/Radiology/Radiology/", null],
  ["447225yp4", "GE HEALTHCARE JAPAN CORPORATION", "NA", "4Vc-D", "Extracorporeal ultrasound imaging transducer, hand-held", "447225yp4", "Cardiology", "cardiology", "MRH2300401"],
  ["473134yp5", "GE HEALTHCARE JAPAN CORPORATION", "NA", "4Vc-D", "Extracorporeal ultrasound imaging transducer, hand-held", "473134yp5", "Cardiology", "cardiology", "MRH2535103"],
  ["477996YP3", "GE HEALTHCARE JAPAN CORPORATION", "NA", "4Vc-D", "Extracorporeal ultrasound imaging transducer, hand-held", "477996YP3", "Cardiology", "cardiology", "MRH2535105"],
  ["501802YP3", "GE HEALTHCARE JAPAN CORPORATION", "NA", "C3-10-D", "Extracorporeal ultrasound imaging transducer, hand-held", "501802YP3", "Radiology General", "Radiology ultrasound room", "MRH2522001"],
  ["540612WX9", "GE Healthcare Austria GmbH & Co OG", "NA", "RAB6-D", "Extracorporeal ultrasound imaging transducer, hand-held", "540612WX9", "Indian Lake Clinic", "Indian Lake (From OB/GYN Clinic)", "MRH1519001"],
  ["562584WX3", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "NA", "RAB6-D", "Extracorporeal ultrasound imaging transducer, hand-held", "562584WX3", "OB/GYN Clinic", "Ultrasound Room 2", "MRH2500605"],
  ["658117WX7", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "IC5-9-D", "IC5-9-D", "Transducer, Standard", "658117wx7", "Radiology General", "/Radiology/Radiology/", null],
  ["921204WX4", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "NA", "RAB2-6-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "921204WX4", "OB/GYN Clinic", "Mobile/Spare US Cart", "MRH2100701"],
  ["939919WX7", "GE MEDICAL SYSTEMS INFORMATION TECHNOLOGIES, INC.", "NA", "4C-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "939919WX7", "OB/GYN Clinic", "Mobile/Spare US Cart", "MRH2100701"],
  ["1021525WX9", "GE Healthcare Austria GmbH & Co OG", "NA", "RAB2-6-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "1021525WX9", "Urbana Specialty Clinic", "Exam Room 5 (Voluson Cart)", "MRH2201102"],
  ["1028467WX7", "GE PARALLEL DESIGN, INC.", "NA", "4C-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "1028467WX7", "Urbana Specialty Clinic", "Exam Room 5 (Voluson Cart)", "MRH2201102"],
  ["1236001WX2", "GE HEALTHCARE JAPAN CORPORATION", "NA", "12L-RS", "Extracorporeal ultrasound imaging transducer, hand-held", "1236001WX2", "Urbana Specialty Clinic", "Exam Room 5 (Voluson Cart)", "MRH2201102"],
  ["1486327WX8", "GE Healthcare Austria GmbH & Co OG", "NA", "RAB6-D", "Extracorporeal ultrasound imaging transducer, hand-held", "1486327WX8", "OB/GYN Clinic", "Ultrasound Room 1", "MRH2521101"],
  ["34700738", "GE MEDICAL SYSTEMS, ULTRASOUND & PRIMARY CARE DIAGNOSTICS, LLC", "S4-10-D", "S4-10-D", "Transducer, Standard", "34700738", "Radiology General", "/Radiology/Radiology/", null],
  ["B20P18", "Philips Ultrasound LLC", "Transducer L12-5", "989605418552", "Extracorporeal ultrasound imaging transducer, hand-held", "B20P18", "Radiology General", "Imaging Center", "MRH1717701"],
  ["B22MGN", "Philips Ultrasound LLC", "Transducer L18-5", "989605409582", "Extracorporeal ultrasound imaging transducer, hand-held", "B22MGN", "Radiology General", "Imaging Center", "MRH1717701"],
  ["CB3C4C135915", "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.", "SP5-1s Ultrasonic Transducer(FDA)", "120-002703-00", "Extracorporeal ultrasound imaging transducer, hand-held", "CB3C4C135915", "Emergency Room", "Emergency room CC", "MRH2507706"],
  ["HP8R47035109", "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.", "L12-3RCs Ultrasonic Probe(FDA)", "120-018861-00", "Extracorporeal ultrasound imaging transducer, hand-held", "HP8R47035109", "Emergency Room", "Emergency room CC", "MRH2507706"],
  ["JK9U3C100880", "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.", "SC6-1s Ultrasonic Probe(FDA)", "120-013162-00", "Extracorporeal ultrasound imaging transducer, hand-held", "JK9U3C100880", "Same Day Surgery", "Same Day Surgery", "MRH2410105"],
  ["jk9u48130268", "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.", "SC6-1s Ultrasonic Probe(FDA)", "120-013162-00", "Extracorporeal ultrasound imaging transducer, hand-held", "jk9u48130268", "Emergency Room", "Emergency room CC", "MRH2507706"]
];

async function getFacilityId() {
  const asset = await Asset.findOne({
    ctrlNumber: { $in: FACILITY_LOOKUP_ASSETS }
  }).lean();

  if (!asset) {
    throw new Error("Could not find an existing Mary Rutan asset to copy facilityId from.");
  }

  return asset.facilityId;
}

async function upsertAsset(payload) {
  return Asset.findOneAndUpdate(
    { ctrlNumber: payload.ctrlNumber },
    { $set: payload },
    { upsert: true, new: true, runValidators: true }
  );
}

function cleanModel(model, modelNumber) {
  if (!model || String(model).toUpperCase() === "NA") return modelNumber || "Unknown";
  return model;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const facilityId = await getFacilityId();

  for (const parent of parentUltrasounds) {
    await upsertAsset({
      ctrlNumber: parent.ctrlNumber,
      templateId: new mongoose.Types.ObjectId(parent.templateId),
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
        modelNumber: parent.modelNumber,
        di: parent.di,
        coverageCode: "Not Covered",
        coverageLevel: parent.coverageLevel,
        importedForRelationshipMapping: true
      }
    });

    console.log(`Parent ultrasound ready: ${parent.ctrlNumber}`);
  }

  // First pass: create/update all transducer assets without parentAsset.
  for (const row of transducers) {
    const [
      ctrlNumber,
      manufacturer,
      model,
      modelNumber,
      description,
      serialNumber,
      department,
      locationNote,
      parentAssetTag
    ] = row;

    await upsertAsset({
      ctrlNumber,
      manufacturer,
      model: cleanModel(model, modelNumber),
      description,
      serialNumber,
      status: "Active",
      facilityId,
      departmentId: null,
      locationNote,
      parentAsset: null,
      relationToParent: "Accessory",
      contractId: null,
      contractValue: 0,
      attributes: {
        sourceSystem: "TruAsset",
        department,
        truAssetModel: model,
        modelNumber,
        parentAssetTag,
        assetCategory: "Ultrasound Transducer",
        coverageCode: "Not Covered"
      }
    });

    console.log(`Transducer staged: ${ctrlNumber}`);
  }

  // Second pass: resolve parent relationships after all possible parents/transducers exist.
  for (const row of transducers) {
    const ctrlNumber = row[0];
    const parentAssetTag = row[8];

    if (!parentAssetTag) {
      console.log(`No parent listed: ${ctrlNumber}`);
      continue;
    }

    const parent = await Asset.findOne({ ctrlNumber: parentAssetTag }).select("_id ctrlNumber").lean();

    if (!parent) {
      console.warn(`WARNING: Parent not found for ${ctrlNumber}: ${parentAssetTag}`);
      continue;
    }

    await Asset.updateOne(
      { ctrlNumber },
      {
        $set: {
          parentAsset: parent._id,
          relationToParent: "Accessory"
        }
      }
    );

    console.log(`Linked: ${ctrlNumber} -> ${parentAssetTag}`);
  }

  await mongoose.disconnect();
  console.log("Done importing Mary Rutan ultrasound parents/transducers.");
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});