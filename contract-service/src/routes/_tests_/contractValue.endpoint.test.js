import { createRequire } from "node:module";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { createIsolatedMongoHarness } from "../../security/_tests_/securityTestHarness.js";
import Contract from "../../models/Contract.js";

const JWT_SECRET = "cronus-value-suite-only-secret-with-adequate-length";
const JWT_ISSUER = "cronus.api";
const JWT_AUDIENCE = "cronus.app";
const requireCore = createRequire(new URL("../../../../core-service/package.json", import.meta.url));
const coreMongoose = requireCore("mongoose");
const date = (value) => new Date(value);

let app;
let mongoHarness;
let facilityId;
let token;

function headers() {
  return { Authorization: `Bearer ${token}`, "x-facility-id": String(facilityId) };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;
  mongoHarness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose: mongoose });
  const { createApp } = await import("../../../app.js");
  app = createApp();
});

beforeEach(() => {
  facilityId = new mongoose.Types.ObjectId();
  token = jwt.sign(
    {
      id: new mongoose.Types.ObjectId().toString(),
      role: "admin",
      facilityId: String(facilityId),
      facilities: [],
    },
    JWT_SECRET,
    { expiresIn: "10m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
});

afterEach(async () => {
  await Contract.deleteMany({});
});

afterAll(async () => {
  await mongoHarness.stop();
});

describe("GET /contracts/:id/value", () => {
  test("returns immutable base and signed applied timeline values", async () => {
    const contract = await Contract.create({
      contractNumber: "VALUE-ENDPOINT-1",
      name: "Value endpoint contract",
      type: "customer",
      facilityId,
      startDate: date("2026-01-01T00:00:00.000Z"),
      endDate: date("2027-01-01T00:00:00.000Z"),
      status: "active",
      totalValue: 100000,
      amendmentSeq: 2,
      amendments: [
        {
          amendmentNumber: "VALUE-ENDPOINT-1.1",
          date: date("2026-04-01T00:00:00.000Z"),
          changeType: "add",
          items: [{ assetId: new mongoose.Types.ObjectId(), deltaValue: 10000 }],
          totalDelta: 10000,
          status: "applied",
        },
        {
          amendmentNumber: "VALUE-ENDPOINT-1.2",
          date: date("2026-10-01T00:00:00.000Z"),
          changeType: "remove",
          items: [{ assetId: new mongoose.Types.ObjectId(), deltaValue: -20000 }],
          totalDelta: -20000,
          status: "applied",
        },
      ],
    });

    const between = await request(app)
      .get(`/contracts/${contract._id}/value`)
      .set(headers())
      .query({ asOf: "2026-06-01T00:00:00.000Z" })
      .expect(200);
    expect(between.body).toMatchObject({
      annualBase: 100000,
      annualDeltaApplied: 10000,
      annualValueAsOf: 110000,
    });
    expect(between.body.appliedEventsAsOf).toHaveLength(1);
    expect(between.body.fullTimeline).toHaveLength(2);

    const after = await request(app)
      .get(`/contracts/${contract._id}/value`)
      .set(headers())
      .query({
        asOf: "2026-10-01T00:00:00.000Z",
        rangeStart: "2026-01-01T00:00:00.000Z",
        rangeEnd: "2027-01-01T00:00:00.000Z",
      })
      .expect(200);
    expect(after.body.annualValueAsOf).toBe(90000);
    expect(after.body.proratedRangeValue).toBeGreaterThan(90000);
  });

  test("returns 404 for a tenant-scoped missing contract", async () => {
    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}/value`)
      .set(headers())
      .query({ asOf: "2026-06-01T00:00:00.000Z" })
      .expect(404);
  });

  test("returns 400 for an invalid as-of date", async () => {
    const contract = await Contract.create({
      contractNumber: "VALUE-ENDPOINT-INVALID-DATE",
      name: "Invalid date test",
      type: "customer",
      facilityId,
      startDate: date("2026-01-01"),
      endDate: date("2027-01-01"),
      status: "draft",
      totalValue: 100000,
      amendments: [],
    });

    const response = await request(app)
      .get(`/contracts/${contract._id}/value`)
      .set(headers())
      .query({ asOf: "not-a-date" })
      .expect(400);
    expect(response.body.message.toLowerCase()).toContain("asof");
  });
});
