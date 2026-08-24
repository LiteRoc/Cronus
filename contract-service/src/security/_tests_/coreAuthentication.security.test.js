import { createRequire } from "node:module";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import contractMongoose from "mongoose";
import { jest } from "@jest/globals";
import { createIsolatedMongoHarness } from "./securityTestHarness.js";

const requireCore = createRequire(new URL("../../../../core-service/package.json", import.meta.url));
const coreMongoose = requireCore("mongoose");
const bcrypt = requireCore("bcryptjs");

const JWT_SECRET = "cronus-security-suite-only-secret-with-adequate-length";
const JWT_ISSUER = "cronus.api";
const JWT_AUDIENCE = "cronus.app";
const PLAINTEXT_PASSWORD = "Security-test-password-42!";

let authRouter;
let authenticateToken;
let authorizeRoles;
let User;
let authApp;
let roleApp;
let mongoHarness;

function tokenFor(overrides = {}, options = {}) {
  const payload = {
    id: new coreMongoose.Types.ObjectId().toString(),
    role: "admin",
    facilities: [],
    ...overrides,
  };

  if (Object.prototype.hasOwnProperty.call(overrides, "role") && overrides.role === undefined) {
    delete payload.role;
  }

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

async function assertSecureStoredPasswordAndLogin(email) {
  const stored = await User.findOne({ email });
  expect(stored).not.toBeNull();
  expect(stored.password).not.toBe(PLAINTEXT_PASSWORD);
  expect(() => bcrypt.getRounds(stored.password)).not.toThrow();
  expect(bcrypt.getRounds(stored.password)).toBeGreaterThanOrEqual(10);
  await expect(bcrypt.compare(PLAINTEXT_PASSWORD, stored.password)).resolves.toBe(true);

  await request(authApp)
    .post("/auth/login")
    .send({ email, password: PLAINTEXT_PASSWORD })
    .expect(200);
}

beforeAll(async () => {
  process.env.NODE_ENV = "security-test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISS = JWT_ISSUER;
  process.env.JWT_AUD = JWT_AUDIENCE;

  mongoHarness = await createIsolatedMongoHarness({ coreMongoose, contractMongoose });

  authRouter = requireCore("./src/routers/authRouter.js");
  ({ authenticateToken, authorizeRoles } = requireCore("./src/middleware/authMiddleware.js"));
  User = requireCore("./src/models/User.js");

  authApp = express();
  authApp.use(express.json());
  authApp.use("/auth", authRouter);

  roleApp = express();
  roleApp.get(
    "/admin-only",
    authenticateToken,
    authorizeRoles("admin"),
    (_req, res) => res.sendStatus(204),
  );
  roleApp.get(
    "/technician-work",
    authenticateToken,
    authorizeRoles("admin", "tech"),
    (_req, res) => res.sendStatus(204),
  );
});

afterEach(async () => {
  await User.deleteMany({});
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoHarness.stop();
});

describe("registration and password handling", () => {
  test.each([
    ["no role", undefined, 201],
    ["admin", "admin", 403],
    ["tech", "tech", 400],
    ["technician", "technician", 201],
    ["customer", "customer", 201],
    ["viewer", "viewer", 201],
  ])("registration with %s has the secure outcome", async (_label, role, expectedStatus) => {
    const suffix = role ?? "default";
    const body = {
      username: `security-${suffix}`,
      email: `security-${suffix}@example.test`,
      password: PLAINTEXT_PASSWORD,
      ...(role ? { role } : {}),
      ...(role === "customer"
        ? { customerId: new coreMongoose.Types.ObjectId().toString() }
        : {}),
    };

    const response = await request(authApp).post("/auth/register").send(body);
    expect(response.status).toBe(expectedStatus);

    if (response.status === 201) {
      await assertSecureStoredPasswordAndLogin(body.email);
    }
  });

  test("an unauthenticated caller cannot create an administrator", async () => {
    await request(authApp)
      .post("/auth/register")
      .send({
        username: "public-admin-attempt",
        email: "public-admin-attempt@example.test",
        password: PLAINTEXT_PASSWORD,
        role: "admin",
      })
      .expect(403);

    await expect(User.exists({ email: "public-admin-attempt@example.test" })).resolves.toBeNull();
  });
});

describe("core role authorization", () => {
  test.each([
    ["admin", 204],
    ["tech", 403],
    ["technician", 403],
    ["customer", 403],
    ["viewer", 403],
    ["user", 403],
    ["missing role", 403],
    ["invalid role", 403],
  ])("admin-only authorization for %s", async (role, expectedStatus) => {
    const claims = role === "missing role" ? { role: undefined } : { role };
    await request(roleApp)
      .get("/admin-only")
      .set(bearer(tokenFor(claims)))
      .expect(expectedStatus);
  });

  test.each([
    ["admin", 204],
    ["tech", 403],
    ["technician", 204],
    ["customer", 403],
    ["viewer", 403],
    ["user", 403],
    ["missing role", 403],
    ["invalid role", 403],
  ])("canonical technician authorization for %s", async (role, expectedStatus) => {
    const claims = role === "missing role" ? { role: undefined } : { role };
    await request(roleApp)
      .get("/technician-work")
      .set(bearer(tokenFor(claims)))
      .expect(expectedStatus);
  });
});

describe("core JWT validation", () => {
  test("accepts a correctly signed, unexpired token with the expected issuer and audience", async () => {
    await request(roleApp).get("/admin-only").set(bearer(tokenFor())).expect(204);
  });

  test.each([
    ["missing issuer", {}],
    ["wrong issuer", { issuer: "not-cronus.api" }],
    ["missing audience", { issuer: JWT_ISSUER }],
    ["wrong audience", { audience: "not-cronus.app" }],
  ])("rejects a token with %s", async (_label, options) => {
    const signOptions = { expiresIn: "10m", ...options };
    const token = jwt.sign({ id: "jwt-user", role: "admin" }, JWT_SECRET, signOptions);
    await request(roleApp).get("/admin-only").set(bearer(token)).expect(403);
  });

  test("rejects an expired token", async () => {
    await request(roleApp)
      .get("/admin-only")
      .set(bearer(tokenFor({}, { expiresIn: -1 })))
      .expect(403);
  });

  test("rejects a token with an invalid signature", async () => {
    const token = jwt.sign(
      { id: "jwt-user", role: "admin" },
      "different-security-suite-secret-with-adequate-length",
      { expiresIn: "10m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    await request(roleApp).get("/admin-only").set(bearer(token)).expect(403);
  });
});

describe("core authentication logging", () => {
  test("login and authenticated requests do not log passwords, hashes, or bearer tokens", async () => {
    const storedUser = await User.create({
      username: "logging-user",
      email: "logging-user@example.test",
      password: PLAINTEXT_PASSWORD,
      role: "admin",
    });
    const hash = storedUser.password;

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const login = await request(authApp)
      .post("/auth/login")
      .send({ email: "logging-user@example.test", password: PLAINTEXT_PASSWORD })
      .expect(200);
    await request(roleApp)
      .get("/admin-only")
      .set(bearer(login.body.token))
      .expect(204);

    const output = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((value) => {
        if (typeof value === "string") return value;
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      })
      .join("\n");

    expect(output).not.toContain("password");
    expect(output).not.toContain(PLAINTEXT_PASSWORD);
    expect(output).not.toContain(hash);
    expect(output).not.toContain(login.body.token);
    expect(output).not.toContain(`Bearer ${login.body.token}`);
  });
});

