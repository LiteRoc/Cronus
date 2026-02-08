// src/jobs/contractLifecycleJob.js

import cron from "node-cron";

export const startCronHeartbeat = () => {
  cron.schedule("*/1 * * * *", () => {
    console.log(`[cron] heartbeat ${new Date().toISOString()}`);
  });

  console.log("[cron] heartbeat scheduled: every 1 minute");
};