import mongoose from "mongoose";
import WorkOrder from "../models/WorkOrder.js";

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  dexa: new mongoose.Types.ObjectId("6a247c66e56db8fb392144c3"),
};

const workOrders = [
  {
    fsr: "SR-0448276",
    date: "2025-07-31",
    type: "Corrective Maintenance",
    labor: 0.5,
    travel: 0,
    source: "DocSrvcRqst 2025-08-05 15_36_19.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0448276
System: GE Lunar Prodigy Primo / Prodigy
Serial: 81654GA
Service Type: Tech Support / Partial Standard

Issue:
Weight graph was no longer showing on the report. Site could view reports but could not view the graph. No error messages reported.

Resolution:
Remote troubleshooting performed. Gathered materials and information for tech support call. Called site to troubleshoot and emailed manual to Judah. Issue resolved.

Vendor Labor: 0.5 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0450697",
    date: "2025-08-29",
    type: "Corrective Maintenance",
    labor: 0.02,
    travel: 0,
    source: "DocSrvcRqst 2025-08-29 11_53_26.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0450697
System: GE Lunar Prodigy Primo / Prodigy
Serial: 81654GA
Service Type: Tech Support

Issue:
Images were not transferring to PACS.

Resolution:
Site power cycled system and confirmed issue was resolved.

Vendor Labor: 0.02 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "00500358348",
    date: "2025-11-21",
    type: "Preventive Maintenance",
    labor: 3,
    travel: 4,
    source: "00500358348.pdf / DocSrvcRqst 2025-11-25 10_44_14.pdf / DF+500167_358346.pdf",
    desc: `Alpha Source / Block Imaging Vendor PM Import

Service Order: 00500358348
Related Block FSR: SR-0440282
System: GE Lunar Prodigy Primo / Prodigy
Serial: 81654GA
System ID: DF+500167
Service Type: Annual Preventive Maintenance

PM Results:
PM completed to OEM specifications. QA history and error log reviewed. Host PC maintenance performed. Mechanical inspection performed. Beam wobble test passed. Limit switch positions verified. Three quality assurance tests passed. Three aluminum phantom scans passed. Phantom scan results passed. Archive and data backups performed. Computer maintenance performed. System returned to customer for scanning.

Vendor Labor: 3 hrs
Vendor Travel: 4 hrs
Note: Labor/travel based on Alpha Source PM estimate for service order DF+500167.`
  }
];

async function run() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");

  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.dexa,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.dexa,
      contractId: ids.contract,
      workOrderType: item.type,
      description: item.desc,
      status: "Completed",
      requestDate: new Date(item.date),
      completionDate: new Date(item.date),
      createdFrom: "api",
      vendorService: {
        vendorName: item.fsr === "00500358348" ? "Alpha Source" : "Block Imaging",
        vendorWorkOrderNumber: item.fsr,
        laborHours: item.labor,
        travelHours: item.travel,
        laborCost: 0,
        travelCost: 0,
        partsCost: 0,
        shippingCost: 0,
        totalCost: 0,
        sourceDocument: item.source,
      },
    });

    await wo.save();

    await mongoose.connection.collection("assets").updateOne(
      { _id: ids.dexa },
      { $addToSet: { workOrders: wo._id } }
    );

    await mongoose.connection.collection("contracts").updateOne(
      { _id: ids.contract },
      { $addToSet: { linkedWorkOrders: wo._id } }
    );

    console.log(`Created ${item.fsr} as Cronus WO ${wo.workOrderNumber}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});