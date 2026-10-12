// Match Contract's explicit opt-out; default scheduling remains unchanged.
if (process.env.CRON_ENABLED === 'false') {
  console.log('[cron] Core scheduling disabled (CRON_ENABLED=false)');
} else {
  require('./cronJobs');             // existing overdue + maintenance
}

// Called by app.js after DB readiness; never activates the legacy jobs.
module.exports.startLifecycleScheduling = () =>
  require('./lifecycleScheduler').startLifecycleCacheScheduler();
