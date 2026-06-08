const mongoose = require("mongoose");
const WorkOrder = require("../models/WorkOrder");

const MONGO_URI = process.env.MONGO_URI;

const ids = {
  facility: new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6ba"),
  contract: new mongoose.Types.ObjectId("6a24833acadf08b99044baa0"),
  ct: new mongoose.Types.ObjectId("6a247c66e56db8fb392144ac"),
};

const workOrders = [
  {
    fsr: "SR-0429306",
    date: "2025-02-12",
    type: "Preventive Maintenance",
    labor: 4,
    travel: 2,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0429306
System: Siemens Definition CT
Service Type: Preventative Maintenance Standard

Completed 6-month preventive maintenance service.
PM report completed.
Slip ring power brushes ordered/recommended.

Vendor Labor: 4 hrs
Vendor Travel: 2 hrs
Parts noted: Siemens SIGNAL BRUSH TIP ASSY/POWER`
  },
  {
    fsr: "SR-0436471",
    date: "2025-03-18",
    type: "Corrective Maintenance",
    labor: 0.6,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0436471
System: Siemens Definition CT
Service Type: Tech Support

Configuration / dose report support issue.
Siemens indicated Team Play is used for dose reports.
Issue resolved / no further callback.

Vendor Labor: 0.6 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0437223",
    date: "2025-03-28",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0437223
System: Siemens Definition CT
Service Type: Tech Support

Requested tech support to walk site through configuration.
Resolution: Bill called.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0441362",
    date: "2025-05-12",
    type: "Corrective Maintenance",
    labor: 1,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0441362
System: Siemens Definition CT
Service Type: Partial Standard

Issue: Not able to view one patient's information.
Filters checked. Remote/site access would be needed for deeper event log review.
Site rescanned patient and issue was closed.

Vendor Labor: 1 hr
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0454974",
    date: "2025-10-20",
    type: "Corrective Maintenance",
    labor: 0.33,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0454974
System: Siemens Definition CT
Service Type: Partial Standard

Issue: Multiple images/jams not being put into proper folders.
Spoke with site. Issue occurred on one patient. Suspected PACS problem.
System rebooted and images sent correctly. No issue since.

Vendor Labor: 0.33 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0456251",
    date: "2025-11-04",
    type: "Corrective Maintenance",
    labor: 25.5,
    travel: 4,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0456251
System: Siemens Definition CT
Service Type: Hard-Down Standard

Issue: Windows detected hardware problem. Unable to back information up to system.
Troubleshot system, ordered ICS computer, installed ICS computer, restored system backup, restored files/service packs, ran quality and constancy checks, verified scanning/networking.

Parts noted:
- Siemens Molecular Imaging ICS 11E Tower
- Serial 1492

Vendor Labor: 25.5 hrs
Vendor Travel: 4 hrs`
  },
  {
    fsr: "SR-0456930",
    date: "2025-11-12",
    type: "Corrective Maintenance",
    labor: 0,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0456930
System: Siemens Definition CT
Service Type: Partial Standard

Issue: System time approximately one hour off after CPU repair.
Resolution: Informed site where to set date/time through Options / Configuration.

Vendor Labor: 0 hrs
Vendor Travel: 0 hrs`
  },
  {
    fsr: "SR-0440451",
    date: "2025-12-11",
    type: "Preventive Maintenance",
    labor: 4,
    travel: 2,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0440451
System: Siemens Definition CT
Service Type: Preventative Maintenance Standard

Completed preventive maintenance service.
PM report completed.

Vendor Labor: 4 hrs
Vendor Travel: 2 hrs`
  },
  {
    fsr: "SR-0463731",
    date: "2026-02-06",
    type: "Corrective Maintenance",
    labor: 0.5,
    travel: 0,
    parts: 0,
    total: 0,
    desc: `Block Imaging Vendor Service Report Import

FSR: SR-0463731
System: Siemens Definition CT
Service Type: Hard-Down Standard

Issue: Gantry would not come back on after reboot/shutdown. Cooling/system initialization errors.
Service started to go onsite, but system came back up and site was able to scan patients.

Vendor Labor: 0.5 hrs
Vendor Travel: 0 hrs`
  }
];

async function run() {
  await mongoose.connect(MONGO_URI);

  for (const item of workOrders) {
    const exists = await WorkOrder.findOne({
      contractId: ids.contract,
      assetId: ids.ct,
      "vendorService.vendorWorkOrderNumber": item.fsr,
    }).lean();

    if (exists) {
      console.log(`Skipping existing ${item.fsr} - WO ${exists.workOrderNumber}`);
      continue;
    }

    const wo = new WorkOrder({
      facilityId: ids.facility,
      assetId: ids.ct,
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
        partsCost: item.parts,
        shippingCost: 0,
        totalCost: item.total,
        sourceDocument: item.fsr,
      },
    });

    await wo.save();

    await mongoose.connection.collection("assets").updateOne(
      { _id: ids.ct },
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