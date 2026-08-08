import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { createRequire } from "node:module";
import { jest } from "@jest/globals";
import { createIsolatedMongoHarness } from "./securityTestHarness.js";

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

afterEach(() => {
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

