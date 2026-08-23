import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { createRequire } from "node:module";
import { jest } from "@jest/globals";
import { createIsolatedMongoHarness } from "./securityTestHarness.js";
import Contract from "../../models/Contract.js";
import Counter from "../../models/Counter.js";

const JWT_SECRET = "cronus-security-suite-only-secret-with-adequate-length";
const JWT_ISSUER = "cronus.api";
const JWT_AUDIENCE = "cronus.app";

let app;
let mongoHarness;

const requireCore = createRequire(new URL("../../../../core-service/package.json", import.meta.url));
const coreMongoose = requireCore("mongoose");

function tokenFor(role = "admin", options = {}) {
  const payload = {
    id: new mongoose.Types.ObjectId().toString(),
    facilityId: new mongoose.Types.ObjectId().toString(),
    facilities: [],
  };
  if (role !== null) payload.role = role;

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "10m",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    ...options,
  });
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  process.env.NODE_ENV = "security-test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;
  process.env.MONGO_URI = "mongodb://configured-database-access-is-forbidden.invalid/blocked";

  mongoHarness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose: mongoose });

  // createApp has no database connection, listener, cron startup, or dotenv loading.
  const { createApp } = await import("../../../app.js");
  app = createApp();
});

afterEach(async () => {
  await Promise.all([Contract.deleteMany({}), Counter.deleteMany({})]);
  jest.restoreAllMocks();
});

describe("contract-service JWT validation", () => {
  test("accepts a correctly signed, unexpired token with the expected issuer and audience", async () => {
    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(tokenFor()))
      .expect(404);
  });

  test.each([
    ["missing issuer", {}],
    ["wrong issuer", { issuer: "not-cronus.api" }],
    ["missing audience", { issuer: JWT_ISSUER }],
    ["wrong audience", { audience: "not-cronus.app" }],
  ])("rejects a token with %s", async (_label, options) => {
    const token = jwt.sign(
      { id: "contract-jwt-user", role: "admin", facilities: [] },
      JWT_SECRET,
      { expiresIn: "10m", ...options },
    );
    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(token))
      .expect(403);
  });

  test("rejects an expired token", async () => {
    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(tokenFor("admin", { expiresIn: -1 })))
      .expect(403);
  });

  test("rejects a token with an invalid signature", async () => {
    const token = jwt.sign(
      { id: "contract-jwt-user", role: "admin", facilities: [] },
      "different-security-suite-secret-with-adequate-length",
      { expiresIn: "10m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(token))
      .expect(403);
  });

  test("does not elevate a token with no role to administrator", async () => {
    await request(app)
      .delete(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(tokenFor(null)))
      .expect(403);
  });
});

describe("contract mutation role authorization", () => {
  test.each([
    ["admin", 404],
    ["tech", 403],
    ["technician", 403],
    ["customer", 403],
    ["viewer", 403],
    ["user", 403],
    ["missing role", 403],
    ["invalid role", 403],
  ])("DELETE /contracts/:id enforces authorization for %s", async (role, expectedStatus) => {
    const claim = role === "missing role" ? null : role;
    await request(app)
      .delete(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(tokenFor(claim)))
      .expect(expectedStatus);
  });

  test.each([
    ["POST /contracts/:id/approve", "approve"],
    ["POST /contracts/:id/terminate", "terminate"],
    ["POST /contracts/:id/amendments/0/apply", "amendments/0/apply"],
  ])("representative lifecycle mutation %s rejects a customer", async (_label, path) => {
    await request(app)
      .post(`/contracts/${new mongoose.Types.ObjectId()}/${path}`)
      .set(bearer(tokenFor("customer")))
      .send({})
      .expect(403);
  });
});

describe("contract tenant invariants and audit provenance", () => {
  const contractPayload = {
    name: "Security Test Contract",
    type: "customer",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T23:59:59.999Z",
    totalValue: 1000,
    coveredAssets: [],
  };

  test("admin can create a facility-scoped contract with authenticated audit provenance", async () => {
    const userId = new mongoose.Types.ObjectId();
    const facilityId = new mongoose.Types.ObjectId();
    const token = jwt.sign(
      { id: String(userId), role: "admin", facilityId: String(facilityId), facilities: [] },
      JWT_SECRET,
      { expiresIn: "10m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );

    const response = await request(app)
      .post("/contracts")
      .set(bearer(token))
      .set("x-facility-id", String(facilityId))
      .send({ ...contractPayload, facilityId: new mongoose.Types.ObjectId().toString() })
      .expect(201);

    const created = await Contract.findById(response.body.contract._id).lean();
    expect(String(created.facilityId)).toBe(String(facilityId));
    expect(String(created.createdBy)).toBe(String(userId));
    await request(app)
      .post("/contracts/" + created._id + "/submit")
      .set(bearer(token))
      .set("x-facility-id", String(facilityId))
      .expect(200);

    const submitted = await Contract.findById(created._id).lean();
    expect(String(submitted.submittedBy)).toBe(String(userId));
  });

  test("cross-facility mutation is rejected", async () => {
    const facilityA = new mongoose.Types.ObjectId();
    const facilityB = new mongoose.Types.ObjectId();
    const contract = await Contract.create({
      contractNumber: "SEC-CROSS-FACILITY",
      ...contractPayload,
      facilityId: facilityB,
    });

    await request(app)
      .delete(`/contracts/${contract._id}`)
      .set(bearer(tokenFor("admin")))
      .set("x-facility-id", String(facilityA))
      .expect(404);

    await expect(Contract.exists({ _id: contract._id })).resolves.not.toBeNull();
  });

  test("active-for-asset returns only the selected facility contract", async () => {
    const assetId = new mongoose.Types.ObjectId();
    const facilityA = new mongoose.Types.ObjectId();
    const facilityB = new mongoose.Types.ObjectId();
    const [contractA] = await Contract.create([
      {
        contractNumber: "SEC-ASSET-A",
        ...contractPayload,
        status: "active",
        facilityId: facilityA,
        coveredAssets: [assetId],
      },
      {
        contractNumber: "SEC-ASSET-B",
        ...contractPayload,
        status: "active",
        facilityId: facilityB,
        coveredAssets: [assetId],
      },
    ]);

    const response = await request(app)
      .get(`/contracts/active-for-asset/${assetId}`)
      .query({ date: "2026-06-01T00:00:00.000Z" })
      .set(bearer(tokenFor("admin")))
      .set("x-facility-id", String(facilityA))
      .expect(200);

    expect(String(response.body.contractId)).toBe(String(contractA._id));
  });
});

describe("contract authentication logging", () => {
  test("authentication does not log bearer tokens", async () => {
    const token = tokenFor("admin");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await request(app)
      .get(`/contracts/${new mongoose.Types.ObjectId()}`)
      .set(bearer(token))
      .expect(404);

    const output = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map(String)
      .join("\n");
    expect(output).not.toContain(token);
    expect(output).not.toContain(`Bearer ${token}`);
    expect(output).not.toContain("password");
  });
});

afterAll(async () => {
  await mongoHarness.stop();
});

