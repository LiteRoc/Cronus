import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { createApp } from "../../../app.js";
import Contract from "../../models/Contract.js"; // adjust if your model path differs

const d = (s) => new Date(s);

describe("GET /contracts/:id/value", () => {
  let mongo;
  let app;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await Contract.deleteMany({});
  });

  test("returns annualValueAsOf for baseline inventory contract", async () => {
    const contract = await Contract.create({
      name: "Mary Rutan CAM Contract",
      type: "customer",
      startDate: d("2024-09-16T00:00:00.000Z"),
      endDate: d("2027-09-15T23:59:59.000Z"),
      status: "active",
      totalValue: 0, // ✅ your chosen truth model
      amendments: [
        {
          date: d("2024-09-16T00:00:00.000Z"),
          description: "Initial Inventory - 3 Trophon EPRs",
          changeType: "add",
          items: [
            { assetId: new mongoose.Types.ObjectId(), deltaValue: 1610 },
            { assetId: new mongoose.Types.ObjectId(), deltaValue: 1610 },
            { assetId: new mongoose.Types.ObjectId(), deltaValue: 1610 }
          ],
          totalDelta: 4830,
          status: "draft",
          appliedAt: d("2024-09-16T00:00:00.000Z"),
          appliedBy: new mongoose.Types.ObjectId()
        }
      ]
    });

    const saved = await Contract.findById(contract._id).lean();

    //console.log("SAVED amendments:", JSON.stringify(saved.amendments, null, 2));

    expect(saved.amendments?.length).toBe(1);
    expect(saved.amendments[0].status).toBe("draft");
    expect(saved.amendments[0].items?.length).toBe(3);
    expect(saved.amendments[0].items[0].deltaValue).toBe(1610);

    const doc = await Contract.findById(contract._id);
    doc.amendments[0].status = "submitted";
    await doc.save();

    doc.amendments[0].status = "approved";
    await doc.save();

    doc.amendments[0].status = "applied";
    doc.amendments[0].appliedAt = d("2024-09-16T00:00:00.000Z");
    doc.amendments[0].appliedBy = new mongoose.Types.ObjectId();
    await doc.save();

    const res = await request(app)
      .get(`/contracts/${contract._id}/value`)
      .query({ asOf: "2024-09-16T00:00:00.000Z" })
      .expect(200);

    expect(res.body.annualBase).toBe(0);
    expect(res.body.annualValueAsOf).toBe(4830);
    expect(res.body.appliedEventsAsOf.length).toBe(1);
  });

  test("returns 404 for missing contract", async () => {
    const missingId = new mongoose.Types.ObjectId();

    await request(app)
      .get(`/contracts/${missingId}/value`)
      .query({ asOf: "2024-09-16T00:00:00.000Z" })
      .expect(404);
  });

  test("returns 400 for invalid date", async () => {
    const contract = await Contract.create({
      name: "Test",
      type: "customer",
      startDate: d("2024-09-16T00:00:00.000Z"),
      endDate: d("2027-09-15T23:59:59.000Z"),
      status: "draft",
      totalValue: 0,
      amendments: []
    });

    const res = await request(app)
      .get(`/contracts/${contract._id}/value`)
      .query({ asOf: "not-a-date" })
      .expect(400);

    expect(res.body.message.toLowerCase()).toContain("asof");
  });
});