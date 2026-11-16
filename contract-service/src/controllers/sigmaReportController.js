import Contract from '../models/Contract.js';
import { buildSigmaReport, reportPeriod } from '../services/sigmaReportService.js';

export async function getSigmaContractReport(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const facilityId = req.headers['x-facility-id'];
  if (typeof facilityId !== 'string' || !/^[a-f\d]{24}$/i.test(facilityId) || !/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'A valid Contract and selected Facility are required' });
  }
  let period;
  try { period = reportPeriod(req.query.startDate, req.query.endDate); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    // Exact Facility equality deliberately excludes global records.
    const contract = await Contract.findOne({ _id: req.params.id, facilityId }).lean();
    if (!contract) return res.status(404).json({ error: 'Contract not found in selected Facility' });
    if (contract.type !== 'customer' || !['active', 'expired', 'terminated', 'superseded'].includes(contract.status)) {
      return res.status(400).json({ error: 'Report requires an active or historical customer Contract' });
    }
    const data = await buildSigmaReport({ contract, coreClient: req.core, period });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (_) {
    return res.status(503).json({ error: 'Report unavailable. Contract inputs or scoped Work Order data could not be verified.' });
  }
}
