// Registration is separate from bounded canonical cache refresh. No import-time execution.
const cron = require('node-cron');
const {
  refreshLifecycleCaches
} = require('../services/lifecycleCacheRefresh');
let cursor = null;
async function scheduledRefresh() {
  const result = await refreshLifecycleCaches({
    afterId: cursor
  });
  if (result.state !== 'overlap_skipped') cursor = result.nextCursor;
  console.log('[lifecycle-cache] refresh', result);
  return result;
}
if (process.env.CRON_ENABLED !== 'false') cron.schedule('*/15 * * * *', () => scheduledRefresh().catch(() => console.error('[lifecycle-cache] refresh failed')));
module.exports = {
  refreshLifecycleCaches,
  scheduledRefresh,
  recomputeLifecycleForAllAssets: scheduledRefresh
};
