// src/cron.js

import cron from "node-cron";
import { runContractLifecycleJob } from "./jobs/contractLifecycleJob.js";

export function startCron() {
  // every hour at minute 5
  cron.schedule("5 * * * *", async () => {
    try {
      const result = await runContractLifecycleJob({
        actorId: process.env.SYSTEM_ACTOR_ID || null,
        dryRun: process.env.CRON_DRY_RUN === "true",
      });
      console.log("contract lifecycle job result:", result);
    } catch (e) {
      console.error("contract lifecycle job crashed:", e);
    }
  });
}