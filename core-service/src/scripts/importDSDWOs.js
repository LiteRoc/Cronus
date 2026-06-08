// src/scripts/importWayneVendorWorkOrders.js

const mongoose = require("mongoose");
const WorkOrder = require("../models/WorkOrder");

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  medivator: new mongoose.Types.ObjectId("6a247c66e56db8fb392144ad"),
  scopeCabinet: new mongoose.Types.ObjectId("6a247c66e56db8fb392144cb"),
};

const workOrders = [
  {
    assetId: ids.medivator,
    workOrderType: "Preventive Maintenance",
    completionDate: new Date("2025-02-13"),
    description: `Vendor Service Report Import

Vendor: MedService Repair
Vendor WO: 00000816
Equipment: DSD Edge
Serial: 75954346

PM completed successfully.
Waterline disinfect completed.
Recommended SSG PM.
Reservoirs/pumps beginning to yellow.

Vendor Repair Time: 5 hrs
Vendor Travel Time: 11 hrs
Total Vendor Time: 16 hrs`,
  },
  {
    assetId: ids.medivator,
    workOrderType: "Corrective Maintenance",
    completionDate: new Date("2025-07-02"),
    description: `Vendor Service Report Import

Vendor: MedService Repair
Vendor WO: 00001417
Equipment: DSD Edge
Serial: 75954346

Problem: B side high temperature alarms.

Service completed:
Tested basin thermistor and mixing block probe.
Incoming water temperature was high.
Diagnosis pointed to facility mixing valve issue.
Recommended new mixing valve.
Ran test cycles on both sides to completion without errors.

Vendor Repair Time: 1 hr
Vendor Travel Time: 12 hrs
Total Vendor Time: 13 hrs`,
  },
  {
    assetId: ids.medivator,
    workOrderType: "Preventive Maintenance",
    completionDate: new Date("2026-01-21"),
    description: `Vendor Service Report Import

Vendor: MedService Repair
Vendor WO: 00002292
Equipment: DSD Edge
Serial: 75954346

Annual PM completed.
Installed PM kit parts.
Ran A and B side test cycles to completion with no leaks or errors.
Changed all three water filters at customer request.

Vendor Repair Time: 6 hrs
Vendor Travel Time: 3.5 hrs
Total Vendor Time: 9.5 hrs`,
  },

  {
    assetId: ids.scopeCabinet,
    workOrderType: "Corrective Maintenance",
    completionDate: new Date("2025-03-17"),
    description: `Vendor Service Report Import

Vendor: Preventive Maintenance Medical
Vendor WO: 24336
Equipment: Medivator Sterile Dryer / Scope Cabinet
Serial: ESC22072

Problem: Compressor feet crumbled causing loud vibration.

Resolution:
Replaced both compressors.
Test satisfactory.

Labor: 1 hr
Travel: 2 hrs
Parts: ESC Compressor Kit #1, ESC Compressor Kit #2, shipping
Total Charges: $1,697.38`,
  },
  {
    assetId: ids.scopeCabinet,
    workOrderType: "Preventive Maintenance",
    completionDate: new Date("2025-03-17"),
    description: `Vendor PM Inspection Import

Vendor: Preventive Maintenance Medical
Equipment: Medivator Scope Cabinet / ESC Drying Cabinet
Serial: ESC22072

PM inspection completed.
Cabinetry, electrical, fans, filters, doors, chamber, and final operation checks passed.`,
  },
  {
    assetId: ids.scopeCabinet,
    workOrderType: "Corrective Maintenance",
    completionDate: new Date("2025-04-09"),
    description: `Vendor Service Report Import

Vendor: Preventive Maintenance Medical
Vendor WO: 24582-R
Equipment: Medivator Sterile Dryer / Scope Cabinet
Serial: ESC22072

Customer requested tubing replacement.
Replaced tubing.
Reset service timer.
Test satisfactory.

Labor: 1 hr
Travel: 2 hrs
Parts: Tubing, shipping
Total Charges: $76.12`,
  },
  {
    assetId: ids.scopeCabinet,
    workOrderType: "Corrective Maintenance",
    completionDate: new Date("2025-06-13"),
    description: `Vendor Service Report Import

Vendor: Preventive Maintenance Medical
Vendor WO: 25081
Equipment: Medivator Sterile Dryer / Scope Cabinet
Serial: ESC22072

Problem: Display screen blank/black.

Resolution:
Replaced programmed computer kit.
Programmed display.
Test satisfactory.

Labor: 3 hrs
Travel: 4 hrs
Parts: Programmed Computer Kit, overnight shipping
Total Charges: $7,336.93`,
  },
  {
    assetId: ids.scopeCabinet,
    workOrderType: "Preventive Maintenance",
    completionDate: new Date("2025-09-17"),
    description: `Vendor PM Inspection Import

Vendor: Preventive Maintenance Medical
Equipment: Medivator Scope Cabinet / ESC Drying Cabinet
Serial: ESC22072

PM inspection completed.
Cabinetry, electrical, fans, filters, doors, chamber, and final operation checks passed.`,
  },
  {
    assetId: ids.scopeCabinet,
    workOrderType: "Preventive Maintenance",
    completionDate: new Date("2026-03-20"),
    description: `Vendor Service Report Import

Vendor: Preventive Maintenance Medical
Vendor WO: 69896-1
Equipment: Medivator ESC Drying Cabinet / Scope Cabinet
Serial: ESC22072

PM service completed.
Checked filters.
Air compressors running and pushing air.
Monitor operating properly.
Unit status: running.
Recommended next PM: filter change out.

Labor: 0.5 hrs
Travel: 2 hrs`,
  },
];

async function run() {
  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: item.assetId,
      contractId: ids.contract,
      workOrderType: item.workOrderType,
      description: item.description,
      status: "Completed",
      completionDate: item.completionDate,
      requestDate: item.completionDate,
      createdFrom: "api",
    });

    await wo.save();

    await mongoose.connection.collection("assets").updateOne(
      { _id: item.assetId },
      { $addToSet: { workOrders: wo._id } }
    );

    await mongoose.connection.collection("contracts").updateOne(
      { _id: ids.contract },
      { $addToSet: { linkedWorkOrders: wo._id } }
    );

    console.log(`Created Cronus WO ${wo.workOrderNumber}: ${wo._id}`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});