import { createRequire } from "node:module";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { createIsolatedMongoHarness } from "../../security/_tests_/securityTestHarness.js";
import Contract from "../../models/Contract.js";
import Counter from "../../models/Counter.js";

const JWT_SECRET = "cronus-amendment-suite-only-secret-with-adequate-length";
const JWT_ISSUER = "cronus.api";
const JWT_AUDIENCE = "cronus.app";

const requireCore = createRequire(new URL("../../../../core-service/package.json", import.meta.url));
const coreMongoose = requireCore("mongoose");

let app;
let mongoHarness;
let facilityId;
let userId;
let token;

function bearer() {
  return { Authorization: `Bearer ${token}`, "x-facility-id": String(facilityId) };
}

function draftPayload(overrides = {}) {
  return {
    date: "2026-06-01T00:00:00.000Z",
    description: "Add covered equipment",
    changeType: "add",
    items: [{ assetId: new mongoose.Types.ObjectId().toString(), deltaValue: 125 }],
    ...overrides,
  };
}

async function createContract(overrides = {}) {
  return Contract.create({
    contractNumber: `AMEND-${new mongoose.Types.ObjectId()}`,
    name: "Amendment lifecycle test",
    type: "customer",
    facilityId,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T23:59:59.999Z"),
    status: "active",
    totalValue: 1000,
    amendmentSeq: 0,
    amendments: [],
    ...overrides,
  });
}

async function createDraft(contract, payload = draftPayload()) {
  return request(app)
    .post(`/contracts/${contract._id}/amendments/draft`)
    .set(bearer())
    .send(payload);
}

async function transition(contract, idx, action, body = {}) {
  return request(app)
    .post(`/contracts/${contract._id}/amendments/${idx}/${action}`)
    .set(bearer())
    .send(body);
}

beforeAll(async () => {
  process.env.NODE_ENV = "security-test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;

  mongoHarness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose: mongoose });
  const { createApp } = await import("../../../app.js");
  app = createApp();
});

beforeEach(() => {
  facilityId = new mongoose.Types.ObjectId();
  userId = new mongoose.Types.ObjectId();
  token = jwt.sign(
    {
      id: String(userId),
      role: "admin",
      facilityId: String(facilityId),
      facilities: [],
    },
    JWT_SECRET,
    { expiresIn: "10m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
});

afterEach(async () => {
  await Promise.all([Contract.deleteMany({}), Counter.deleteMany({})]);
});

afterAll(async () => {
  await mongoHarness.stop();
});

describe("amendment numbering and validation", () => {
  test("first and second drafts receive the correct index and sequence", async () => {
    const contract = await createContract();

    const first = await createDraft(contract);
    expect(first.status).toBe(201);
    expect(first.body.amendmentIndex).toBe(0);
    expect(first.body.amendmentNumber).toBe(`${contract.contractNumber}.1`);
    expect(first.body.amendment.amendmentNumber).toBe(`${contract.contractNumber}.1`);

    const second = await createDraft(contract, draftPayload({ description: "Second draft" }));
    expect(second.status).toBe(201);
    expect(second.body.amendmentIndex).toBe(1);
    expect(second.body.amendmentNumber).toBe(`${contract.contractNumber}.2`);

    const saved = await Contract.findById(contract._id).lean();
    expect(saved.amendmentSeq).toBe(2);
    expect(saved.amendments).toHaveLength(2);
  });

  test("invalid drafts do not consume sequence numbers", async () => {
    const contract = await createContract();

    const invalid = await createDraft(contract, draftPayload({ date: "not-a-date" }));
    expect(invalid.status).toBe(400);

    const afterInvalid = await Contract.findById(contract._id).lean();
    expect(afterInvalid.amendmentSeq).toBe(0);
    expect(afterInvalid.amendments).toHaveLength(0);

    const valid = await createDraft(contract);
    expect(valid.status).toBe(201);
    expect(valid.body.amendmentNumber).toBe(`${contract.contractNumber}.1`);
  });

  test("derives totalDelta from numeric item values", async () => {
    const contract = await createContract();
    const response = await createDraft(
      contract,
      draftPayload({
        totalDelta: 999999,
        items: [
          { assetId: new mongoose.Types.ObjectId().toString(), deltaValue: 25.5 },
          { assetId: new mongoose.Types.ObjectId().toString(), deltaValue: -5.25 },
        ],
      })
    );

    expect(response.status).toBe(201);
    expect(response.body.amendment.totalDelta).toBe(20.25);
  });

  test.each([
    ["invalid asset ID", { items: [{ assetId: "not-an-object-id", deltaValue: 1 }] }],
    [
      "non-numeric delta",
      { items: [{ assetId: new mongoose.Types.ObjectId().toString(), deltaValue: "10" }] },
    ],
  ])("rejects %s without consuming a sequence", async (_label, overrides) => {
    const contract = await createContract();
    const response = await createDraft(contract, draftPayload(overrides));
    expect(response.status).toBe(400);

    const saved = await Contract.findById(contract._id).lean();
    expect(saved.amendmentSeq).toBe(0);
    expect(saved.amendments).toHaveLength(0);
  });
});

describe("amendment lifecycle", () => {
  test("submit, approve, and apply populate audit fields without incrementing sequence twice", async () => {
    const contract = await createContract();
    const draft = await createDraft(contract);
    expect(draft.status).toBe(201);

    expect((await transition(contract, 0, "submit")).status).toBe(200);
    let saved = await Contract.findById(contract._id).lean();
    expect(saved.amendments[0].status).toBe("submitted");
    expect(saved.amendments[0].submittedAt).toBeInstanceOf(Date);
    expect(String(saved.amendments[0].submittedBy)).toBe(String(userId));

    expect((await transition(contract, 0, "approve")).status).toBe(200);
    saved = await Contract.findById(contract._id).lean();
    expect(saved.amendments[0].status).toBe("approved");
    expect(saved.amendments[0].approvedAt).toBeInstanceOf(Date);
    expect(String(saved.amendments[0].approvedBy)).toBe(String(userId));

    expect((await transition(contract, 0, "apply")).status).toBe(200);
    saved = await Contract.findById(contract._id).lean();
    expect(saved.amendments[0].status).toBe("applied");
    expect(saved.amendments[0].appliedAt).toBeInstanceOf(Date);
    expect(String(saved.amendments[0].appliedBy)).toBe(String(userId));
    expect(saved.amendmentSeq).toBe(1);
    expect(saved.amendments[0].amendmentNumber).toBe(`${contract.contractNumber}.1`);

    expect((await transition(contract, 0, "apply")).status).toBe(400);
  });

  test("decline succeeds only from submitted and records its audit fields", async () => {
    const contract = await createContract();
    await createDraft(contract);
    expect((await transition(contract, 0, "decline", { reason: "Not approved" })).status).toBe(400);
    expect((await transition(contract, 0, "submit")).status).toBe(200);
    expect((await transition(contract, 0, "decline", { reason: "Not approved" })).status).toBe(200);

    const saved = await Contract.findById(contract._id).lean();
    expect(saved.amendments[0].status).toBe("declined");
    expect(saved.amendments[0].declinedAt).toBeInstanceOf(Date);
    expect(String(saved.amendments[0].declinedBy)).toBe(String(userId));
    expect(saved.amendments[0].declineReason).toBe("Not approved");
  });

  test("submit and approve reject invalid source states", async () => {
    const contract = await createContract();
    await createDraft(contract);

    expect((await transition(contract, 0, "approve")).status).toBe(400);
    expect((await transition(contract, 0, "submit")).status).toBe(200);
    expect((await transition(contract, 0, "submit")).status).toBe(400);
  });

  test.each(["draft", "submitted", "approved"])(
    "void succeeds from %s and persists audit fields",
    async (status) => {
      const contract = await createContract({
        amendmentSeq: 1,
        amendments: [{
          amendmentNumber: "VOID-TEST.1",
          status,
          date: new Date("2026-06-01T00:00:00.000Z"),
          changeType: "update",
          items: [{ assetId: new mongoose.Types.ObjectId(), deltaValue: 0 }],
          totalDelta: 0,
        }],
      });

      expect((await transition(contract, 0, "void")).status).toBe(200);
      const saved = await Contract.findById(contract._id).lean();
      expect(saved.amendments[0].status).toBe("voided");
      expect(saved.amendments[0].voidedAt).toBeInstanceOf(Date);
      expect(String(saved.amendments[0].voidedBy)).toBe(String(userId));
    }
  );

  test("void rejects applied amendments", async () => {
    const contract = await createContract({
      amendmentSeq: 1,
      amendments: [{
        amendmentNumber: "APPLIED-TEST.1",
        status: "applied",
        date: new Date("2026-06-01T00:00:00.000Z"),
        changeType: "update",
        items: [{ assetId: new mongoose.Types.ObjectId(), deltaValue: 0 }],
        totalDelta: 0,
      }],
    });

    expect((await transition(contract, 0, "void")).status).toBe(400);
  });

  test("business fields are locked after submission", async () => {
    const contract = await createContract();
    await createDraft(contract);
    await transition(contract, 0, "submit");

    const submitted = await Contract.findById(contract._id);
    submitted.amendments[0].description = "Forbidden edit";
    await expect(submitted.save()).rejects.toThrow("business fields are locked after submission");
  });
});
