import mongoose from "mongoose";
import WorkOrder from "../models/WorkOrder.js";

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  ecam: new mongoose.Types.ObjectId("6a247c66e56db8fb392144c2"),
};

const workOrders = [
  {
    fsr: "SR-0425915",
    date: "2024-12-03",
    type: "Corrective Maintenance",
    labor: 6,
    travel: 4.5,
    source: "SR-0425915.PDF.pdf / FSR-00500345940.pdf",
    desc: `Block Imaging / Alpha Source Vendor Service Report Import

FSR: SR-0425915
Alpha Source WO: 00500345940
System: Siemens E.CAM Dual Head Nuclear Camera
Serial: 7614
System ID: NM86632
Service Type: Partial Standard

Issue:
Detector 2 would not pass coarse tune.

Resolution:
Troubleshot Detector 2 tuning issue. PMT51 on HD2 was maxed out to the negative gain value. Detector information onsite indicated PAD2 PMTs, so no gain adjustment was available on PMTs. Adjusted HV value on AIMDR board and was able to pass coarse tune and fine tune on Detector 2. ZMAP values remained above -10, causing ZMAP variance warning at the end of tuning. Performed image quality evaluation for possible reburn. System could be used because final intrinsic QC image was within specification. Recommended full detector reburn on both detectors.

Vendor Labor: 6 hrs
Vendor Travel: 4.5 hrs
Note: Labor/travel taken from Alpha Source detailed work order rather than 27-hour elapsed labor entry on Block FSR.`
  },
  {
    fsr: "SR-0435379",
    date: "2025-03-04",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    source: "DocSrvcRqst 2025-03-06 13_50_17.pdf",
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0435379
System: Siemens E.CAM Dual Head Nuclear Camera
Serial: 7614
Service Type: Tech Support

Issue:
Site requested tech/phone support regarding the collimator wheel. Staff were asking about replacing the collimator wheel, and customer requested assistance understanding the issue.

Resolution:
Vendor attempted phone/text support with no response.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0440283",
    date: "2025-11-12",
    type: "Preventive Maintenance",
    labor: 5,
    travel: 9,
    source: "DocSrvcRqst 2025-11-24 11_23_08.pdf / Wayne Hospital Greenville,OH ECam 6714 FSR 111225.pdf",
    desc: `Block Imaging Vendor PM Import

FSR: SR-0440283
System: Siemens E.CAM Dual Head Nuclear Camera
Serial: 7614
Service Type: Preventive Maintenance

PM Result:
Preventive maintenance completed to manufacturer's specifications.

Findings:
Discussed issues with customer. Performed PM. Found both system detectors unable to pass fine tuning. Detector 1 failed due to Tube 51 gain value at max negative value. Detector 2 failed due to ZMap uniformity. Detector 1 was corrected by increasing high voltage. Detector 2 could not be corrected. System failed 5FOV intrinsic flood due to Detector 2 non-uniformity. System reburn is necessary to correct image quality. Verified system operation and returned system to customer partially functional.

Further Action Required:
System reburn necessary to correct image quality.

Vendor Labor: 5 hrs
Vendor Travel: 9 hrs`
  }
];

async function run() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");

  await mongoose.connect(MONGO_URI);

  // Clean up E.CAM serial/site ID while we're here.
  await mongoose.connection.collection("assets").updateOne(
    { _id: ids.ecam },
    {
      $set: {
        serialNumber: "7614",
        "attributes.oemSiteId": "400-100056",
        "attributes.previousSerialNumber": "400-1000056",
      },
    }
  );

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.ecam,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.ecam,
      contractId: ids.contract,
      workOrderType: item.type,
      description: item.desc,
      status: "Completed",
      requestDate: new Date(item.date),
      completionDate: new Date(item.date),
      createdFrom: "api",
      vendorService: {
        vendorName: "Block Imaging / Alpha Source",
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
      { _id: ids.ecam },
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