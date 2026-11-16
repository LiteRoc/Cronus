import React from 'react';
import { Link } from 'react-router-dom';
import { useFacility } from '../../context/FacilityContext';
import { useUser } from '../../context/UserContext';
import { getWorkOrderReport } from '../../services/workOrderReportAPI';
import { workOrderReportCsv } from '../../utils/workOrderReportCsv';
import type { WorkOrderReport, WorkOrderReportFilters } from '../../types/WorkOrderReport';
const shown = (v: string | number | null) => v == null || v === '' ? 'Not recorded' : v;
const money = (v: number | null) => v === null ? 'Unavailable' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function WorkOrderReportPage({ initialMode = 'open' }: { initialMode?: WorkOrderReportFilters['mode'] }) {
  const { selectedFacilityId } = useFacility(); const { user } = useUser();
  const [filters, setFilters] = React.useState<WorkOrderReportFilters>({ mode: initialMode });
  const [captured, setCaptured] = React.useState<{ key: string; report: WorkOrderReport } | null>(null);
  const [loading, setLoading] = React.useState(false), [error, setError] = React.useState(''), [page, setPage] = React.useState(0);
  const identity = `${user?._id}|${user?.role}|${selectedFacilityId}|${initialMode}`, key = `${identity}|${JSON.stringify(filters)}`;
  const sequence = React.useRef(0), currentIdentity = React.useRef(identity); currentIdentity.current = identity;
  React.useEffect(() => { sequence.current++; setCaptured(null); setLoading(false); setError(''); setPage(0); setFilters({ mode: initialMode }); }, [identity]);
  const report = !loading && !error && captured?.key === key ? captured.report : null;
  function change(k: keyof WorkOrderReportFilters, value: string) { setError(''); setPage(0); setFilters(f => ({ ...f, [k]: value })); }
  async function generate(event: React.FormEvent) {
    event.preventDefault(); if (!selectedFacilityId) return;
    const ticket = ++sequence.current, requestIdentity = identity, requestKey = key;
    setLoading(true); setError(''); setCaptured(null);
    try { const result = await getWorkOrderReport(selectedFacilityId, filters); if (ticket === sequence.current && currentIdentity.current === requestIdentity) { setCaptured({ key: requestKey, report: result }); setPage(0); } }
    catch (failure: any) { if (ticket === sequence.current && currentIdentity.current === requestIdentity) setError(failure?.response?.data?.error ?? 'Unable to generate Work Order report.'); }
    finally { if (ticket === sequence.current && currentIdentity.current === requestIdentity) setLoading(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([workOrderReportCsv(report)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `work-orders-${report.filters.mode}-${report.facility.id}-${report.generatedAt.slice(0, 10)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="p-6 space-y-5"><Link to="/reports" className="text-blue-700 underline">Back to Reports</Link><h1 className="text-2xl font-semibold">{filters.mode === 'pm' ? 'Open PM Report' : 'Work Order Reports'}</h1>
    <p>Current backlog, open PM Work Orders or recorded closed activity for the selected hospital.</p>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={generate}>
      <label>Report<select className="block border rounded p-2" value={filters.mode} onChange={e => { setFilters({ mode: e.target.value as WorkOrderReportFilters['mode'] }); setError(''); setPage(0); }}><option value="open">Open backlog</option><option value="closed">Closed activity</option><option value="pm">Open PM</option></select></label>
      {filters.mode === 'pm' && <><p>Outstanding Planned Maintenance, Preventive Maintenance and PM Work Orders. This is not a PM compliance measure.</p>
        <label>PM due selection<select className="block border rounded p-2" value={filters.dueStatus || 'all'} onChange={e => { setFilters(f => ({ mode: 'pm', priority: f.priority, dueStatus: e.target.value })); setError(''); setPage(0); }}><option value="all">All due dates</option><option value="overdue">Overdue</option><option value="next30">Next 30 days</option><option value="missing">Missing due date</option><option value="range">Due date range</option></select></label>
        {filters.dueStatus === 'range' && <><label>PM due start (UTC)<input required type="date" max={filters.endDate || undefined} className="block border rounded p-2" value={filters.startDate || ''} onChange={e => change('startDate', e.target.value)} /></label><label>PM due end (UTC, inclusive)<input required type="date" min={filters.startDate || undefined} className="block border rounded p-2" value={filters.endDate || ''} onChange={e => change('endDate', e.target.value)} /></label></>}
      </>}
      {filters.mode === 'closed' && <><label>Completion start (UTC)<input required type="date" max={filters.endDate || undefined} className="block border rounded p-2" value={filters.startDate || ''} onChange={e => change('startDate', e.target.value)} /></label>
        <label>Completion end (UTC, inclusive)<input required type="date" min={filters.startDate || undefined} className="block border rounded p-2" value={filters.endDate || ''} onChange={e => change('endDate', e.target.value)} /></label>
        <label>Archived records<select className="block border rounded p-2" value={filters.includeArchived || 'false'} onChange={e => change('includeArchived', e.target.value)}><option value="false">Completed only</option><option value="true">Include archived with completion dates</option></select></label></>}
      <label>Priority<select className="block border rounded p-2" value={filters.priority || ''} onChange={e => change('priority', e.target.value)}><option value="">All priorities</option>{['Low', 'Normal', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}</select></label>
      {filters.mode !== 'pm' && <label>Work Order type<input maxLength={120} placeholder="Exact type (optional)" className="block border rounded p-2" value={filters.workOrderType || ''} onChange={e => change('workOrderType', e.target.value)} /></label>}
      <button disabled={loading || !selectedFacilityId} className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{loading ? 'Generating...' : 'Generate Work Order report'}</button>
      {report && <button type="button" onClick={download} className="rounded border px-4 py-2">Download Work Order CSV</button>}
    </form>
    {!selectedFacilityId && <p>Select a hospital in the sidebar.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {report && <><section className="rounded-xl border bg-white p-5 space-y-2"><h2 className="font-semibold">{report.facility.name}</h2><p>Generated {report.generatedAt} (UTC)</p>
      <p>{report.summary.count} Work Orders; {report.summary.archived} archived; {report.summary.unavailableAssets} unavailable asset references</p>
      {report.filters.mode !== 'closed' && <p>{report.summary.overdue} overdue at generation; {report.summary.missingDueDates} missing due dates; {report.summary.missingRequestDates} missing request dates</p>}
      <p>Known direct cost subtotal: {money(report.summary.cost.knownSubtotal)}; Complete direct cost total: {money(report.summary.cost.total)}</p>
      <details><summary>Report basis and limitations</summary><ul className="list-disc pl-5">{report.notes.map(n => <li key={n}>{n}</li>)}</ul></details></section>
      {!report.rows.length && <p>No Work Orders match these filters.</p>}
      {report.rows.slice(page * 50, page * 50 + 50).map(r => <article key={r.id} className="rounded-xl border bg-white p-4 space-y-2"><h2 className="font-semibold"><Link className="text-blue-700 underline" to={`/workorders/edit/${r.id}`}>Work Order {r.number || r.id}</Link> - {r.status} - {r.priority}</h2>
        <p>{r.type}: {r.description}</p><p>{r.asset ? <Link className="text-blue-700 underline" to={`/reports/asset-history?assetId=${r.asset.id}`}>{r.asset.controlNumber || r.asset.id} - {r.asset.manufacturer} {r.asset.model}</Link> : 'Asset reference unavailable'}</p>
        <p>Requested: {shown(r.requested)}; Scheduled: {shown(r.scheduled)}; Due: {shown(r.due)}; Completed: {shown(r.completed)} (UTC)</p>
        {report.filters.mode !== 'closed' && <p>Age: {r.ageDays === null ? 'Unknown' : `${r.ageDays} days`}; Overdue: {r.overdue === null ? 'Unknown' : r.overdue ? 'Yes' : 'No'}</p>}
        <p>Known direct cost: {money(r.cost.knownSubtotal)}; Complete direct cost: {money(r.cost.total)}</p></article>)}
      {report.rows.length > 50 && <div className="flex gap-3"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(report.rows.length / 50)}; CSV includes all {report.rows.length} Work Orders</span><button disabled={(page + 1) * 50 >= report.rows.length} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>}
  </main>;
}
