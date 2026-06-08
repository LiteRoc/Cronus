import mongoose from "mongoose";
import WorkOrder from "../models/WorkOrder.js";

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  luminos: new mongoose.Types.ObjectId("6a247c66e56db8fb392144bd"),
};

const workOrders = [
  {
    fsr: "SR-0439653",
    date: "2025-04-25",
    type: "Corrective Maintenance",
    labor: 0.5,
    travel: 0,
    source: "DocSrvcRqst 2025-05-02 16_40_53.pdf / Siemens 400113198176",
    desc: `Block / Siemens Vendor Service Report Import

FSR: SR-0439653
System: Siemens Axiom Luminos dRF
Serial: 1459
Service Type: Partial Standard

Issue: Collimator light missing illumination squares / collimator light issue.

Resolution:
Collimator light bulb was burned out. Replaced with new bulb that hospital had on site. Tested room and light field; passed.

Vendor Labor: 0.5 hrs
Vendor Travel: 0 hrs
Parts: Collimator bulb customer-supplied`
  },
  {
    fsr: "SR-0438339",
    date: "2025-04-10",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    source: "0438339_FSR_04.11.2025.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0438339
System: Siemens Axiom Luminos dRF
Serial: 1459
Service Type: Hard-Down Standard

Issue: Detent not working and system not recognizing position for images.

Resolution:
Checked error logs with no clear issue found. Checked detents but could not reproduce issue. Recalibrated 3D Long and X-verse pots. Created system backups and returned system to customer.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs
Note: Labor/travel not listed on report.`
  },
  {
    fsr: "CASE-0031033",
    date: "2025-07-14",
    type: "Corrective Maintenance",
    labor: 1.5,
    travel: 4.5,
    source: "Wayne Healthcare Siemens Axiom Luminos dRF, Greenville, OH.pdf",
    desc: `Block Imaging Vendor Service Report Import

Case: 0031033
System: Siemens Axiom Luminos Digital R/F Room
Serial: 1459
Service Type: Partial

Issue: Tube hanger would not align to wallstand.

Resolution:
Checked wallstand detent. Ran position check and found transverse position constantly changing. Removed hanger covers to identify B302 encoder/potentiometer. Transverse position stabilized. Reseated B302 connector. Powered system back up and cycled power multiple times. System functioning at time of service.

Recommendation:
B302 encoder/potentiometer should be replaced sooner rather than later.

Vendor Labor: 1.5 hrs
Vendor Travel: 4.5 hrs`
  },
  {
    fsr: "SR-0446874",
    date: "2025-08-08",
    type: "Corrective Maintenance",
    labor: 1.5,
    travel: 0,
    source: "DocSrvcRqst 2025-08-12 16_12_56.pdf / Siemens 400113364761",
    desc: `Block / Siemens Vendor Service Report Import

FSR: SR-0446874
System: Siemens Axiom Luminos dRF
Serial: 1459
Service Type: Hard-Down Standard

Issue: Overhead tube not in position and not locking / not parking correctly.

Resolution:
Adjusted park sensor on transverse rail to correct 2D overhead tube not going into park consistently. Sensor was not making full contact. All tests passed.

Vendor Labor: 1.5 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0443030",
    date: "2025-12-19",
    type: "Preventive Maintenance",
    labor: 0,
    travel: 0,
    source: "DocSrvcRqst 2025-12-30 11_07_46.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0443030
System: Siemens Axiom Luminos dRF
Serial: 1459
Service Type: Preventative Maintenance Standard

Resolution:
Preventive maintenance completed by Magnum Professional Imaging - Service.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs
Note: Labor/travel not listed on report.`
  }
];

async function run() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");

  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.luminos,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.luminos,
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
      { _id: ids.luminos },
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