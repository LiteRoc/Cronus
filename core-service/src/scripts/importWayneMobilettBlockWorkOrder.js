import mongoose from "mongoose";
import WorkOrder from "../models/WorkOrder.js";

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  mobilett: new mongoose.Types.ObjectId("6a247c66e56db8fb392144ae"),
};

const workOrders = [
  {
    fsr: "SR-0450270",
    date: "2025-08-27",
    type: "Corrective Maintenance",
    labor: 10.5,
    travel: 0,
    source: "DocSrvcRqst 2025-09-11 13_58_48.pdf / Siemens 400113397991-24, -13, -27",
    desc: `Block / Siemens Vendor Service Report Import

FSR: SR-0450270
System: Siemens Mobilett Mira Max
Serial: 1510
Service Type: Hard-Down Standard

Issue:
Generator would not turn on. No error displayed.

Service History:
Initial Siemens visit found no power to D810 or D830 and required follow-up troubleshooting.
Second visit replaced D820, found no LEDs lit, no power to D810 or D830, normal LEDs on D848, and ordered new D820/U5 attachment board and power reel.
Final visit replaced D820/D824. Generator powered up successfully. Drive and X-ray testing passed.

Parts:
- Siemens D820 POWER BOARD, qty 1
- D820/D824 referenced in resolution

Resolution:
Replaced D820/D824. Generator powered up. Drive and X-ray testing passed. Hospital and Block Imaging informed of resolution.

Vendor Labor: 10.5 hrs
Vendor Travel: 0 hrs
Note: Labor total from Siemens service reports: 2.0 + 6.5 + 2.0 hrs.`
  }
];

async function run() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");

  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.mobilett,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.mobilett,
      contractId: ids.contract,
      workOrderType: item.type,
      description: item.desc,
      status: "Completed",
      requestDate: new Date(item.date),
      completionDate: new Date(item.date),
      createdFrom: "api",
      vendorService: {
        vendorName: "Block Imaging",
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
      { _id: ids.mobilett },
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