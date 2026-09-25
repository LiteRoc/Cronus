// Match Contract's explicit opt-out; default scheduling remains unchanged.
if (process.env.CRON_ENABLED === 'false') {
  console.log('[cron] Core scheduling disabled (CRON_ENABLED=false)');
} else {
  require('./cronJobs');             // existing overdue + maintenance
  require('./lifecycleScheduler');   // lifecycle recompute
}
