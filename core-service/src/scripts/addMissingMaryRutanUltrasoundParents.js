require("dotenv").config();
const mongoose = require("mongoose");

const Asset = require("../models/Asset");
const EquipmentTemplate = require("../models/EquipmentTemplate");

const VOLUSON_EXPERT_TEMPLATE_ID = "6a298c9b30ca88097a2707e9";

const FACILITY_LOOKUP_ASSETS = [
  "MRH2522001",
  "MRH2100701",
  "MRH2201102",
  "MRH2500605"
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

async function getOrCreateMindrayTeXTemplate() {
  let template = await EquipmentTemplate.findOne({
    manufacturer: "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.",
    model: "TE X"
  });

  if (!template) {
    template = await EquipmentTemplate.create({
      manufacturer: "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.",
      model: "TE X",
      description: "Ultrasound - Diagnostic, General Purpose",
      equipmentClass: "Class 2",
      verified: false,
      status: "Active",
      kind: "GenericAsset",
      autoAddPmProcedure: true,
      requirePmPlan: false,
      manufacturerRecommendedPMFrequency: 12
    });

    console.log(`Created generic Mindray TE X template: ${template._id}`);
  } else {
    console.log(`Using existing Mindray TE X template: ${template._id}`);
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

  const facilityId = await getFacilityId();
  const mindrayTemplate = await getOrCreateMindrayTeXTemplate();

  const parents = [
    {
      ctrlNumber: "MRH2521101",
      templateId: VOLUSON_EXPERT_TEMPLATE_ID,
      manufacturer: "GE Healthcare Austria GmbH & Co OG",
      model: "Voluson",
      description: "Voluson Expert 18 BT25",
      serialNumber: "F106344",
      department: "OB/GYN Clinic",
      locationNote: "Ultrasound Room 1",
      modelNumber: "Expert 18 BT25",
      di: "00195278770226",
      coverageLevel: "NEW"
    },
    {
      ctrlNumber: "MRH2507706",
      templateId: String(mindrayTemplate._id),
      manufacturer: "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.",
      model: "TE X",
      description: "Ultrasound - Diagnostic, General Purpose",
      serialNumber: "LJ6-4C001224",
      department: "Emergency Room",
      locationNote: "ed",
      modelNumber: "TE X",
      di: "",
      coverageLevel: "NEW"
    },
    {
      ctrlNumber: "MRH2410105",
      templateId: String(mindrayTemplate._id),
      manufacturer: "Shenzhen Mindray Bio-Medical Electronics Co., Ltd.",
      model: "TE X",
      description: "Ultrasound - Diagnostic, General Purpose",
      serialNumber: "LJ6-41000519",
      department: "Anesthesia",
      locationNote: "Anesthesia",
      modelNumber: "TE X",
      di: "",
      coverageLevel: "Undefined"
    }
  ];

  for (const parent of parents) {
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

    console.log(`Parent ready: ${parent.ctrlNumber}`);
  }

  const links = [
    ["199642KRO", "MRH2521101"],
    ["1486327WX8", "MRH2521101"],

    ["CB3C4C135915", "MRH2507706"],
    ["HP8R47035109", "MRH2507706"],
    ["jk9u48130268", "MRH2507706"],

    ["JK9U3C100880", "MRH2410105"]
  ];

  for (const [childTag, parentTag] of links) {
    const parent = await Asset.findOne({ ctrlNumber: parentTag }).select("_id ctrlNumber").lean();

    if (!parent) {
      console.warn(`WARNING: Parent not found: ${parentTag}`);
      continue;
    }

    await Asset.updateOne(
      { ctrlNumber: childTag },
      {
        $set: {
          parentAsset: parent._id,
          relationToParent: "Accessory",
          "attributes.parentAssetTag": parentTag
        }
      }
    );

    console.log(`Linked: ${childTag} -> ${parentTag}`);
  }

  await mongoose.disconnect();
  console.log("Done adding missing Mary Rutan ultrasound parents and linking transducers.");
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});