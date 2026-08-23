// Compatibility export for older callers. Production startup imports the same
// singleton scheduler from jobs/contractLifecycleCron.js.
export { startContractLifecycleCron as startCron } from "./jobs/contractLifecycleCron.js";
