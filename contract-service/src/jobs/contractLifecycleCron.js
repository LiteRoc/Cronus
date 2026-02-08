// src/jobs/contractLifecycleCron.js

import cron from "node-cron";
import Contract from "../models/Contract.js";

function startOfTodayUTC(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

let started = false;

export const startContractLifecycleCron = () => {
  if (started) return;
  started = true;

  if (process.env.CRON_ENABLED === "false") {
    console.log("[cron] Contract lifecycle disabled (CRON_ENABLED=false)");
    return;
  }

  // TEMP: every minute for testing
  //const expr = "*/1 * * * *"; // every minute   --- DEV ---
  // PROD: daily 03:10 ET
  const expr = "10 3 * * *"; // 03:10 AM daily

  cron.schedule(
    expr,
    async () => {
      const todayUTC = startOfTodayUTC(new Date());
      const now = new Date();

      try {
        const toActivate = await Contract.find({
          status: "approved",
          startDate: { $lte: todayUTC },
          endDate: { $gte: todayUTC },
        });

        let activated = 0;
        for (const c of toActivate) {
          c.status = "active";
          c.activatedAt = now;
          c.activatedBy = null;
          await c.save();
          activated++;
        }

        const toExpire = await Contract.find({
          status: "active",
          endDate: { $lt: todayUTC },
        });

        let expired = 0;
        for (const c of toExpire) {
          c.$locals._systemBypassValidation = true; // ✅ matches your schema
          c.status = "expired";
          // c.expiredAt = now; // add to schema if you want it
          await c.save();
          expired++;
        }

        console.log(
          `[cron] lifecycle ok | activated=${activated} expired=${expired} | todayUTC=${todayUTC.toISOString()}`
        );
      } catch (err) {
        console.error("[cron] lifecycle failed:", err);
      }
    },
    { timezone: "America/New_York" }
  );

  console.log(`[cron] Contract lifecycle scheduled: "${expr}" (America/New_York)`);
};