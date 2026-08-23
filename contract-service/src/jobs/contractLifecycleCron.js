import cron from "node-cron";
import { runContractLifecycleJob } from "./contractLifecycleJob.js";

export const CONTRACT_LIFECYCLE_CRON_EXPRESSION = "10 3 * * *";
export const CONTRACT_LIFECYCLE_TIMEZONE = "America/New_York";

let started = false;

export const startContractLifecycleCron = () => {
  if (started) return;
  started = true;

  if (process.env.CRON_ENABLED === "false") {
    console.log("[cron] Contract lifecycle disabled (CRON_ENABLED=false)");
    return;
  }

  cron.schedule(
    CONTRACT_LIFECYCLE_CRON_EXPRESSION,
    async () => {
      try {
        const summary = await runContractLifecycleJob({
          actorId: null,
          dryRun: process.env.CRON_DRY_RUN === "true",
        });
        console.log("[cron] contract lifecycle completed", summary);
      } catch (error) {
        console.error("[cron] contract lifecycle job crashed", error?.message || String(error));
      }
    },
    { timezone: CONTRACT_LIFECYCLE_TIMEZONE, noOverlap: true }
  );

  console.log(
    `[cron] Contract lifecycle scheduled: "${CONTRACT_LIFECYCLE_CRON_EXPRESSION}" (${CONTRACT_LIFECYCLE_TIMEZONE})`
  );
};
