import { createRequire } from "node:module";
import mongoose from "mongoose";
import { createIsolatedMongoHarness } from "../../security/_tests_/securityTestHarness.js";
import Contract from "../../models/Contract.js";
import { runContractLifecycleJob } from "../contractLifecycleJob.js";

const requireCore = createRequire(new URL("../../../../core-service/package.json", import.meta.url));
const coreMongoose = requireCore("mongoose");
const NOW = new Date("2026-08-23T12:00:00.000Z");

let mongoHarness;
let sequence = 0;

function amendment(overrides = {}) {
  sequence += 1;
  return {
    amendmentNumber: `LIFECYCLE.${sequence}`,
    status: "approved",
    date: new Date(NOW),
    changeType: "update",
    items: [{ assetId: new mongoose.Types.ObjectId(), deltaValue: 10 }],
    totalDelta: 10,
    approvedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function createContract(overrides = {}) {
  sequence += 1;
  return Contract.create({
    contractNumber: `LIFECYCLE-${sequence}`,
    name: "Lifecycle automation test",
    type: "customer",
    facilityId: new mongoose.Types.ObjectId(),
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T23:59:59.999Z"),
    status: "active",
    totalValue: 1000,
    amendmentSeq: 0,
    amendments: [],
    ...overrides,
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongoHarness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose: mongoose });
});

afterEach(async () => {
  await Contract.deleteMany({});
});

afterAll(async () => {
  await mongoHarness.stop();
});

describe("contract lifecycle boundaries", () => {
  test("approved contract before its start instant remains approved", async () => {
    const contract = await createContract({
      status: "approved",
      startDate: new Date(NOW.getTime() + 1),
    });

    const summary = await runContractLifecycleJob({ now: NOW });
    expect(summary.contractsActivated).toBe(0);
    expect((await Contract.findById(contract._id)).status).toBe("approved");
  });

  test.each([
    ["at", new Date(NOW)],
    ["after", new Date(NOW.getTime() - 1)],
  ])("approved contract %s its start instant activates without overwriting approval", async (_label, startDate) => {
    const approvedAt = new Date("2026-08-01T00:00:00.000Z");
    const contract = await createContract({ status: "approved", startDate, approvedAt });

    const summary = await runContractLifecycleJob({ now: NOW });
    const saved = await Contract.findById(contract._id).lean();
    expect(summary.contractsActivated).toBe(1);
    expect(saved.status).toBe("active");
    expect(saved.activatedAt).toEqual(NOW);
    expect(saved.activatedBy).toBeNull();
    expect(saved.approvedAt).toEqual(approvedAt);
  });

  test.each([
    ["before", new Date(NOW.getTime() + 1)],
    ["at", new Date(NOW)],
  ])("active contract %s its end instant remains active", async (_label, endDate) => {
    const contract = await createContract({ endDate });
    const summary = await runContractLifecycleJob({ now: NOW });
    expect(summary.contractsExpired).toBe(0);
    expect((await Contract.findById(contract._id)).status).toBe("active");
  });

  test("active contract after its end instant expires with system audit", async () => {
    const contract = await createContract({ endDate: new Date(NOW.getTime() - 1) });
    const summary = await runContractLifecycleJob({ now: NOW });
    const saved = await Contract.findById(contract._id).lean();
    expect(summary.contractsExpired).toBe(1);
    expect(saved.status).toBe("expired");
    expect(saved.expiredAt).toEqual(NOW);
    expect(saved.expiredBy).toBeNull();
  });
});

describe("scheduled amendment lifecycle", () => {
  test("approved amendment before its effective instant remains approved", async () => {
    const contract = await createContract({
      amendmentSeq: 1,
      amendments: [amendment({ date: new Date(NOW.getTime() + 1) })],
    });

    const summary = await runContractLifecycleJob({ now: NOW });
    expect(summary.amendmentsApplied).toBe(0);
    expect((await Contract.findById(contract._id)).amendments[0].status).toBe("approved");
  });

  test("due amendment applies once without changing its number or sequence", async () => {
    const due = amendment();
    const contract = await createContract({ amendmentSeq: 1, amendments: [due] });

    const first = await runContractLifecycleJob({ now: NOW });
    const afterFirst = await Contract.findById(contract._id).lean();
    const appliedAt = afterFirst.amendments[0].appliedAt;
    expect(first.amendmentsApplied).toBe(1);
    expect(afterFirst.amendments[0].status).toBe("applied");
    expect(afterFirst.amendments[0].amendmentNumber).toBe(due.amendmentNumber);
    expect(afterFirst.amendments[0].appliedBy).toBeNull();
    expect(afterFirst.amendmentSeq).toBe(1);

    const second = await runContractLifecycleJob({ now: new Date(NOW.getTime() + 1000) });
    const afterSecond = await Contract.findById(contract._id).lean();
    expect(second.amendmentsApplied).toBe(0);
    expect(afterSecond.amendments[0].appliedAt).toEqual(appliedAt);
    expect(afterSecond.totalValue).toBe(afterFirst.totalValue);
  });

  test("multiple amendments apply in effective-date order", async () => {
    const assetId = new mongoose.Types.ObjectId();
    const laterRemove = amendment({
      amendmentNumber: "ORDER.2",
      date: new Date(NOW.getTime() - 1000),
      changeType: "remove",
      items: [{ assetId, deltaValue: -25 }],
      totalDelta: -25,
    });
    const earlierAdd = amendment({
      amendmentNumber: "ORDER.1",
      date: new Date(NOW.getTime() - 2000),
      changeType: "add",
      items: [{ assetId, deltaValue: 25 }],
      totalDelta: 25,
    });
    const contract = await createContract({
      amendmentSeq: 2,
      amendments: [laterRemove, earlierAdd],
    });

    const summary = await runContractLifecycleJob({ now: NOW });
    const saved = await Contract.findById(contract._id).lean();
    expect(summary.amendmentsApplied).toBe(2);
    expect(saved.amendments.map((item) => item.status)).toEqual(["applied", "applied"]);
    expect(saved.coveredAssets.map(String)).not.toContain(String(assetId));
    expect(saved.totalValue).toBe(1000);
  });

  test("one invalid amendment does not prevent another contract from applying", async () => {
    const invalid = await createContract({
      amendmentSeq: 1,
      amendments: [amendment({ amendmentNumber: undefined, date: new Date(NOW.getTime() - 2) })],
    });
    const valid = await createContract({
      amendmentSeq: 1,
      amendments: [amendment({ date: new Date(NOW.getTime() - 1) })],
    });

    const summary = await runContractLifecycleJob({ now: NOW });
    expect(summary.amendmentsApplied).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({
      operation: "apply-amendment",
      contractId: String(invalid._id),
    });
    expect((await Contract.findById(invalid._id)).amendments[0].status).toBe("approved");
    expect((await Contract.findById(valid._id)).amendments[0].status).toBe("applied");
  });

  test("dry run reports eligible work without persisting changes", async () => {
    const approved = await createContract({ status: "approved", startDate: new Date(NOW) });
    const active = await createContract({
      amendmentSeq: 1,
      amendments: [amendment()],
    });

    const summary = await runContractLifecycleJob({ now: NOW, dryRun: true });
    expect(summary).toMatchObject({ dryRun: true, contractsActivated: 1, amendmentsApplied: 1 });
    expect((await Contract.findById(approved._id)).status).toBe("approved");
    expect((await Contract.findById(active._id)).amendments[0].status).toBe("approved");
  });
});
