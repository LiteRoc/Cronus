require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Asset = require("../models/Asset");
const WorkOrder = require("../models/WorkOrder");

const TREAVOR_USER_ID = "69cfa1470d79ab43d7d18f89";

const TEXT_FILE = path.join(
  __dirname,
  "imports",
  "mary-rutan-work-orders.txt"
);

const COMMIT = process.argv.includes("--commit");

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseServiceDate(value) {
  if (!value) return null;
  const d = new Date(`${value} 2025`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesToHours(hh, mm) {
  return Number(hh || 0) + Number(mm || 0) / 60;
}

function getFirstMatch(block, regex) {
  const match = block.match(regex);
  return match ? match[1].trim() : "";
}

function normalizeTag(tag) {
  return String(tag || "").trim();
}

function mapStatus(closedDate, closeCode) {
  if (!closedDate) return "Open";
  return "Completed";
}

function mapWorkOrderType(blockType, serviceCodes, reason) {
  const text = `${blockType} ${serviceCodes.join(" ")} ${reason}`.toLowerCase();

  if (
    text.includes("pm") ||
    text.includes("preventive maintenance") ||
    text.includes("vendor pm") ||
    text.includes("scheduled")
  ) {
    return "PM";
  }

  return "Corrective";
}

function cleanNotes(value) {
  return String(value || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseServices(block) {
  const services = [];

  const servicesSection = block.split(/Services Performed/i)[1]?.split(/Test Equipment Used|Procedures/i)[0] || "";

  const lines = servicesSection
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)+)\s+(\d{2}):(\d{2})\s+-\s+([A-Z0-9]+)\s+([A-Z][a-z]{2}\s+\d{1,2}\s+\d{4})\s+(.+)$/);

    if (!match) continue;

    services.push({
      techName: match[1].trim(),
      hours: minutesToHours(match[2], match[3]),
      serviceCode: match[4].trim(),
      serviceDate: parseDate(match[5].trim()),
      serviceDescription: match[6].trim()
    });
  }

  return services;
}

function parseNotes(block) {
  const notes = block.split(/Notes/i)[1]?.split(/Services Performed/i)[0] || "";
  return cleanNotes(notes);
}

function parseProcedure(block) {
  const procSection = block.split(/Procedures/i)[1] || "";
  if (!procSection) return { procedureName: "", procedureText: "" };

  const procedureName =
    getFirstMatch(procSection, /Procedure:\s*([^\n]+)/i) ||
    getFirstMatch(procSection, /Procedure\s+([^\n]+)/i);

  return {
    procedureName: procedureName.trim(),
    procedureText: cleanNotes(procSection)
  };
}

function parseTestEquipment(block) {
  const section = block.split(/Test Equipment Used/i)[1]?.split(/Procedures/i)[0] || "";
  return cleanNotes(section);
}

function parseBlocks(text) {
  const matches = [...text.matchAll(/(?=WO#:\s*\d+)/g)];
  const blocks = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end);

    const type =
      chunk.match(/Scheduled Work Order/i)?.[0] ||
      chunk.match(/Unscheduled Work Order/i)?.[0] ||
      "Unknown Work Order";

    blocks.push({
      rawType: type,
      text: chunk
    });
  }

  return blocks;
}

function parseWorkOrderBlock(block) {
  const text = block.text;

  const woNumber = getFirstMatch(text, /WO#:\s*([^\n]+)/i);
  const tag = normalizeTag(getFirstMatch(text, /Tag#:\s*([^\n]+)/i));
  const department = getFirstMatch(text, /Department:\s*([^\n]+)/i);
  const created = getFirstMatch(text, /Created:\s*([^\n]+)/i);
  const closed = getFirstMatch(text, /Closed:\s*([^\n]+)/i);
  const closeCode = getFirstMatch(text, /Close Code:\s*([^\n]+)/i);
  const nextDue = getFirstMatch(text, /Next Due:\s*([^\n]+)/i);
  const requestedBy = getFirstMatch(text, /Requested By:\s*([^\n]+)/i);
  const phone = getFirstMatch(text, /Phone:\s*([^\n]+)/i);
  const location = getFirstMatch(text, /Location:\s*([^\n]+)/i);
  const assignedToName = getFirstMatch(text, /Assigned To:\s*([^\n]+)/i);

  const manufacturer = getFirstMatch(text, /• Manufacturer:\s*([^\n]+)/i);
  const model = getFirstMatch(text, /• Model:\s*([^\n]+)/i);
  const modelNumber = getFirstMatch(text, /• Model Number:\s*([^\n]+)/i);
  const serialNumber = getFirstMatch(text, /• Serial Number:\s*([^\n]+)/i);
  const deviceClass = getFirstMatch(text, /• Class:\s*([^\n]+)/i);
  const risk = getFirstMatch(text, /• Risk:\s*([^\n]+)/i);
  const reason = getFirstMatch(text, /• Reason:\s*([\s\S]*?)(?:Notes|Services Performed|Device Information)/i);

  const services = parseServices(text);
  const notes = parseNotes(text);
  const testEquipmentText = parseTestEquipment(text);
  const procedure = parseProcedure(text);

  const serviceCodes = [...new Set(services.map(s => s.serviceCode).filter(Boolean))];

  return {
    woNumber,
    tag,
    rawType: block.rawType,
    department,
    createdDate: parseDate(created),
    closedDate: parseDate(closed),
    closeCode,
    nextDueDate: parseDate(nextDue),
    requestedBy,
    phone,
    location,
    assignedToName,
    manufacturer,
    model,
    modelNumber,
    serialNumber,
    deviceClass,
    risk,
    reason: cleanNotes(reason),
    services,
    serviceCodes,
    notes,
    testEquipmentText,
    procedureName: procedure.procedureName,
    procedureText: procedure.procedureText
  };
}

async function findAssetByTag(tag) {
  if (!tag) return null;

  const exact = await Asset.findOne({ ctrlNumber: tag });
  if (exact) return exact;

  const insensitive = await Asset.findOne({
    ctrlNumber: new RegExp(`^${escapeRegExp(tag)}$`, "i")
  });

  return insensitive;
}

function buildDescription(parsed) {
  return cleanNotes(`
[TruAsset WO#: ${parsed.woNumber}]
${parsed.rawType}
Tag: ${parsed.tag}
Department: ${parsed.department}
Close Code: ${parsed.closeCode || "N/A"}
Service Codes: ${parsed.serviceCodes.join(", ") || "N/A"}
Procedure: ${parsed.procedureName || "N/A"}

Reason:
${parsed.reason || "N/A"}

Notes:
${parsed.notes || "N/A"}

Test Equipment Used:
${parsed.testEquipmentText || "N/A"}

Procedure Detail:
${parsed.procedureText || "N/A"}
`);
}

async function importOne(parsed, asset) {
  const existing = await WorkOrder.findOne({
    description: new RegExp(`\\[TruAsset WO#:\\s*${escapeRegExp(parsed.woNumber)}\\]`, "i")
  });

  if (existing) {
    return { action: "skip-existing", id: existing._id };
  }

  const timeLogs = parsed.services
    .filter(s => s.hours > 0)
    .map(s => ({
      userId: new mongoose.Types.ObjectId(TREAVOR_USER_ID),
      timeSpent: Math.max(1, Math.round(s.hours * 60)),
      description: `[${s.serviceCode}] ${s.serviceDescription || "Imported TruAsset labor"}`
    }));

  const payload = {
    assetId: asset._id,
    facilityId: asset.facilityId,
    description: buildDescription(parsed),
    status: mapStatus(parsed.closedDate, parsed.closeCode),
    requestDate: parsed.createdDate || parsed.closedDate || new Date(),
    dueDate: parsed.nextDueDate || undefined,
    scheduledDate: parsed.createdDate || undefined,
    completionDate: parsed.closedDate || undefined,
    assignedTo: new mongoose.Types.ObjectId(TREAVOR_USER_ID),
    workOrderType: mapWorkOrderType(parsed.rawType, parsed.serviceCodes, parsed.reason),
    notificationsSent: false,
    timeLogs,
    travelLogs: [],
    partsUsed: [],
    taskResults: []
  };

  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  const wo = await WorkOrder.create(payload);

  await Asset.updateOne(
    { _id: asset._id },
    { $addToSet: { workOrders: wo._id } }
  );

  return { action: "created", id: wo._id };
}

async function main() {
  if (!fs.existsSync(TEXT_FILE)) {
    throw new Error(`Missing text file: ${TEXT_FILE}`);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const text = fs.readFileSync(TEXT_FILE, "utf8");
  const parsedBlocks = parseBlocks(text).map(parseWorkOrderBlock).filter(w => w.woNumber);

  console.log(`Mode: ${COMMIT ? "COMMIT" : "DRY RUN"}`);
  console.log(`Parsed work orders: ${parsedBlocks.length}`);

  const summary = {
    parsed: parsedBlocks.length,
    matched: 0,
    unmatched: 0,
    created: 0,
    skippedExisting: 0,
    errors: 0
  };

  const unmatched = [];

  for (const parsed of parsedBlocks) {
    const asset = await findAssetByTag(parsed.tag);

    if (!asset) {
      summary.unmatched++;
      unmatched.push({
        woNumber: parsed.woNumber,
        tag: parsed.tag,
        manufacturer: parsed.manufacturer,
        model: parsed.model,
        serialNumber: parsed.serialNumber,
        department: parsed.department
      });
      continue;
    }

    summary.matched++;

    if (!COMMIT) {
      console.log(
        `DRY: WO ${parsed.woNumber} -> ${asset.ctrlNumber} | ${parsed.workOrderType || parsed.rawType} | ${parsed.serviceCodes.join(",") || "no service"} | ${parsed.services.length} service rows`
      );
      continue;
    }

    try {
      const result = await importOne(parsed, asset);

      if (result.action === "created") {
        summary.created++;
        console.log(`CREATED: WO ${parsed.woNumber} -> ${asset.ctrlNumber}`);
      } else {
        summary.skippedExisting++;
        console.log(`SKIP EXISTING: WO ${parsed.woNumber}`);
      }
    } catch (err) {
      summary.errors++;
      console.error(`ERROR importing WO ${parsed.woNumber}:`, err.message);
    }
  }

  console.log("\nSUMMARY");
  console.log(summary);

  if (unmatched.length) {
    console.log("\nUNMATCHED ASSETS");
    console.table(unmatched.slice(0, 100));
    console.log(`Total unmatched: ${unmatched.length}`);
  }

  await mongoose.disconnect();
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});