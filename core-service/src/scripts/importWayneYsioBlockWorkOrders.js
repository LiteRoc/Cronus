import mongoose from "mongoose";
import WorkOrder from "../models/WorkOrder.js";

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  ysio: new mongoose.Types.ObjectId("6a247c66e56db8fb392144c8"),
};

const workOrders = [
  {
    fsr: "SR-0437277",
    date: "2025-03-28",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    source: "0437277_FSR_03.31.2025.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0437277
System: Siemens Ysio Max
Serial: 1226
Service Type: Partial Standard

Issue:
System would not expose when taking/snapping an image.

Resolution:
Adjusted the wall bucky, tightened hardware, and tested the system.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs
Note: Labor/travel not listed on report.`
  },
  {
    fsr: "SR-0438338",
    date: "2025-04-10",
    type: "Corrective Maintenance",
    labor: 0.5,
    travel: 0,
    source: "0438338_FSR_04.10.2025.pdf / 0438338_FSR_04.17.2025.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0438338
System: Siemens Ysio Max
Serial: 1226
Service Type: Hard-Down Standard

Issue:
Wall and table required calibration. Brakes were failing; wall bucky could be moved without unlocking. Collision / emergency stop error was occurring.

Resolution:
Evaluated system and calibrated complete system. Set up PACS, tested system, created backups, and returned system to customer.

Vendor Labor: 0.5 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0438935",
    date: "2025-04-18",
    type: "Corrective Maintenance",
    labor: 1.5,
    travel: 0,
    source: "DocSrvcRqst 2025-07-31 11_38_19.pdf / Siemens 400113184445",
    desc: `Block / Siemens Vendor Service Report Import

FSR: SR-0438935
System: Siemens Ysio Max
Serial: 1226
Service Type: Partial Standard

Issue:
Customer needed help identifying username/password. Prior exam sets and protocols were missing after previous work. Customer could not access PEX Editor with provided passwords, and wall bucky could not pass calibration.

Resolution:
Restored old PEX database from 2024. Reset password so customer could access PEX Editor again. Restored organ programs and protocols. Performed new wall bucky calibration successfully.

Vendor Labor: 1.5 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0439697",
    date: "2025-04-25",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    source: "0439697_FSR_4.25.2025.pdf / 0439697_FSR_04.30.2025.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0439697
System: Siemens Ysio Max
Serial: 1226
Service Type: Partial Standard

Issue:
Wall bucky would not lock. Wallstand brake was weak and wallstand slowly moved down when a patient put weight on it.

Resolution:
Installed Block Imaging part / new motor and calibrated room per CBdocs. Tested room; passed. Block and hospital radiology techs informed of completion.

Parts:
- Siemens Motor cpl., qty 1, serial/part reference 8600

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs
Note: Labor/travel not listed on report.`
  },
  {
    fsr: "SR-0443809",
    date: "2025-06-10",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    source: "0443809_FSR_06.09.2025.pdf / 0443809_FSR_06.10.2025.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0443809
System: Siemens Ysio Max
Serial: 1226
Service Type: Partial Standard

Issue:
Detector in the rad room was not charging/changing the bucky. System indicated it needed to be plugged in when already plugged in. Bucky below temperature.

Resolution:
Replaced FDR board and portable detector battery. Room was returned to service.

Parts:
- Siemens Portable Detector Battery, qty 1, serial PO-104321-37
- Siemens FDR Board, qty 1, serial PO-106156-28

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs
Note: SR-0443800 appears to be a duplicate intake ticket and was not separately imported.`
  },
  {
    fsr: "SR-0444716",
    date: "2025-06-24",
    type: "Corrective Maintenance",
    labor: 4,
    travel: 0,
    source: "0444716_FSR_06.24.2025.pdf / Siemens 400113290258",
    desc: `Block / Siemens Vendor Service Report Import

FSR: SR-0444716
System: Siemens Ysio Max
Serial: 1226
Service Type: Partial Standard

Issue:
Detector was not charging or holding a charge after recent replacement. System would not allow table bucky/tabletop selection but allowed wall bucky selection.

Resolution:
Replaced FLC, COPRA, and FDR. Made a new ghost. Tested room with different flat detectors. Powered unit off and on approximately five times. Flat detectors stayed connected with no issue and testing passed. Room returned to service. Work order was kept open for monitoring and other parts were left on site until issue resolution was confirmed.

Parts:
- Siemens FL-C M460 VC10, qty 1, serial YK7T065100
- Siemens FDR Board, qty 1, serial 2412737199
- Siemens COPRA Board, qty 1, serial 2504770500

Vendor Labor: 4 hrs
Vendor Travel: 0 hrs`
  }
];

async function run() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");

  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.ysio,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.ysio,
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
      { _id: ids.ysio },
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