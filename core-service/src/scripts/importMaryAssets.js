import mongoose from "mongoose";
import xlsx from "xlsx";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const filePath = process.argv[2];

if (!MONGO_URI) throw new Error("Missing MONGO_URI/MONGODB_URI");
if (!filePath) throw new Error("Usage: node src/scripts/importMaryAssets.js /path/to/file.xlsx");

const MRH_FACILITY_ID = new mongoose.Types.ObjectId("69cfa11c41f774bb2a19f6b8");

function money(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

function coverageCode(resp) {
  const r = String(resp || "").trim().toUpperCase();
  if (["FSWPS", "FSWPA", "FSWP", "SWEEP", "UNDEFINED", ""].includes(r)) return "FSC";
  if (r === "FSNP") return "LBR";
  if (r === "PMWPA") return "PMWP";
  return "FSC";
}

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

await mongoose.connect(MONGO_URI);

const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

let inserted = 0;
let updated = 0;

for (const row of rows) {
  const ctrlNumber = clean(row["Tag #"]);
  if (!ctrlNumber) continue;

  const responsibility = clean(row["Responsibility"]);
  const contractValue = money(row["Contract Value"]);

  const doc = {
    ctrlNumber,
    manufacturer: clean(row["Manufacturer"]) || "Unknown",
    model: clean(row["Model"]) || clean(row["Model Number"]) || "Unknown",
    description: clean(row["Description"]),
    serialNumber: clean(row["Serial Number"]),
    status: clean(row["Status"]).toLowerCase() === "inactive" ? "Inactive" : "Active",
    facilityId: MRH_FACILITY_ID,
    departmentId: null,
    contractValue,
    attributes: {
      sourceSystem: "TruAsset",
      department: clean(row["Department"]),
      truAssetResponsibility: responsibility,
      coverageCode: coverageCode(responsibility),
      truAssetAmendment: clean(row["Amendment"]),
      coverageEffectiveDate: row["Effective Date"] || "",
    },
  };

  const result = await mongoose.connection.db.collection("assets").updateOne(
    { ctrlNumber },
    { $set: doc },
    { upsert: true }
  );

  if (result.upsertedCount) inserted++;
  else updated++;
}

const summary = await mongoose.connection.db.collection("assets").aggregate([
  { $match: { facilityId: MRH_FACILITY_ID } },
  { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: "$contractValue" } } },
]).toArray();

console.log({ inserted, updated, summary: summary[0] });

await mongoose.disconnect();