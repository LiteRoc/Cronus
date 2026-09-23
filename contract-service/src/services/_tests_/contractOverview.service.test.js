import { jest } from "@jest/globals";
import { buildAssetAnalyticsOverview } from "../contractOverviewService.js";

const rangeStart = new Date("2026-01-01T00:00:00.000Z");
const rangeEnd = new Date("2026-12-31T23:59:59.999Z");

function coreClientReturning(workOrders) {
  return {
    get: jest.fn().mockResolvedValue({ data: { items: workOrders } }),
  };
}

function calculate(workOrders, overrides = {}) {
  return buildAssetAnalyticsOverview({
    coreClient: coreClientReturning(workOrders),
    assetIds: overrides.assetIds ?? ["asset-1"],
    rangeStart,
    rangeEnd,
    laborRate: overrides.laborRate ?? 50,
    travelRate: overrides.travelRate ?? 20,
  });
}

describe("buildAssetAnalyticsOverview", () => {
  test("returns a complete zero-value analytics object for no work orders", async () => {
    const result = await calculate([], { assetIds: [] });

    expect(result).toMatchObject({
      workOrders: [],
      assetCosts: [],
      workOrdersSummary: {
        totalYTD: 0,
        avgResponseTimeHours: 0,
        openCount: 0,
        closedCount: 0,
      },
      pmSummary: {
        compliancePercent: 100,
        dueThisYear: 0,
        completedThisYear: 0,
        overdue: 0,
      },
      parts: { totalUsed: 0, totalPartCost: 0 },
      labor: { hoursYTD: 0, costYTD: 0, blendedRate: null },
      travel: { hoursYTD: 0, costYTD: 0, blendedRate: null },
      performance: { costToServeYTD: 0 },
    });
  });

  test("retains operational PM metrics but never reprices legacy economics", async () => {
    const workOrder = {
      assetId: "asset-1",
      status: "Completed",
      workOrderType: "Preventive Maintenance",
      partsUsed: [{ extendedCost: 100 }],
      timeLogs: [{ timeSpent: 120 }],
      travelLogs: [{ travelTime: 30 }],
      responseTimeHours: 1.25,
    };

    const result = await calculate([workOrder]);

    expect(result.assetCosts).toMatchObject([
      {
        assetId: "asset-1",
        woCount: 1,
        partsCost: null,
        laborHours: 2,
        travelHours: 0.5,
        laborCost: null,
        travelCost: null,
        totalCost: null,
      },
    ]);
    expect(result.workOrdersSummary).toEqual({
      totalYTD: 1,
      avgResponseTimeHours: 1.3,
      openCount: 0,
      closedCount: 1,
    });
    expect(result.pmSummary).toEqual({
      compliancePercent: 100,
      dueThisYear: 1,
      completedThisYear: 1,
      overdue: 0,
    });
    expect(result.performance.costToServeYTD).toBeNull();
  });

  test("keeps legacy economics unknown and vendor hours separate from internal labor", async () => {
    const workOrders = [
      {
        assetId: "asset-a",
        status: "Open",
        type: "PM",
        dueDate: "2000-01-01T00:00:00.000Z",
        partsUsed: [{ extendedCost: 25 }],
        timeLogs: [{ timeSpent: 60 }],
        travelLogs: [{ travelTime: 30 }],
      },
      {
        assetId: "asset-a",
        status: "Completed",
        workOrderType: "Preventive Maintenance",
        partsUsed: [{ extendedCost: 40 }],
        timeLogs: [{ timeSpent: 30 }],
        travelLogs: [{ travelTime: 30 }],
        vendorService: {
          laborHours: 2,
          travelHours: 1,
          partsCost: 10,
          shippingCost: 5,
        },
      },
      {
        assetId: "asset-b",
        status: "In Progress",
        completionDate: "2026-06-01T00:00:00.000Z",
        partsUsed: [{ extendedPrice: 20 }],
        vendorService: {
          laborHours: 0,
          travelHours: 0.5,
          partsCost: 30,
          shippingCost: 5,
        },
      },
    ];

    const result = await calculate(workOrders, {
      assetIds: ["asset-a", "asset-b"],
      laborRate: 100,
      travelRate: 50,
    });

    expect(result.workOrdersSummary).toEqual({
      totalYTD: 3,
      avgResponseTimeHours: 0,
      openCount: 1,
      closedCount: 2,
    });
    expect(result.assetCosts).toMatchObject([
      {
        assetId: "asset-a",
        woCount: 2,
        partsCost: null,
        laborHours: 1.5,
        travelHours: 1,
        laborCost: null,
        travelCost: null,
        totalCost: null,
      },
      {
        assetId: "asset-b",
        woCount: 1,
        partsCost: null,
        laborHours: 0,
        travelHours: 0,
        laborCost: null,
        travelCost: null,
        totalCost: null,
      },
    ]);
    expect(result.parts).toEqual({ totalUsed: 3, totalPartCost: null });
    expect(result.labor).toEqual({ hoursYTD: 1.5, costYTD: null, blendedRate: null });
    expect(result.travel).toEqual({ hoursYTD: 1, costYTD: null, blendedRate: null });
    expect(result.performance.costToServeYTD).toBeNull();
    expect(result.performance.economics.directMaintenance).toMatchObject({isComplete:false,legacyCount:3,knownSubtotal:0});
    expect(result.pmSummary).toEqual({
      compliancePercent: 50,
      dueThisYear: 2,
      completedThisYear: 1,
      overdue: 1,
    });
  });
});

test('missing canonical response is unavailable, never complete zero',async()=>{
  await expect(buildAssetAnalyticsOverview({coreClient:{get:async()=>({data:{}})},assetIds:['asset-1'],rangeStart,rangeEnd})).rejects.toThrow('analytics unavailable');
});
