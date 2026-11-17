import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useFacility } from '../../context/FacilityContext';
import { useUser } from '../../context/UserContext';
import { getYearEndReport } from '../../services/yearEndReportAPI';
import { yearEndReportCsv } from '../../utils/yearEndReportCsv';
import type { YearEndFilters, YearEndReport } from '../../types/YearEndReport';
const COLORS = ['#2563eb', '#0d9488', '#9333ea', '#ea580c', '#db2777', '#4f46e5'];
const money = (v: number | null) => v === null ? 'Unavailable' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function CountChart({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  return <section className="rounded-xl border bg-white p-5 space-y-3" aria-label={title}><h2 className="font-semibold">{title}</h2>
    {data.length ? <><div aria-hidden="true"><ResponsiveContainer width="100%" height={260}><BarChart data={data} margin={{ bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Work Orders" radius={[6, 6, 0, 0]}>{data.map((r, i) => <Cell key={r.label} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
      <details><summary>Chart counts</summary><table className="w-full text-sm"><thead><tr><th className="text-left">Category</th><th>Work Orders</th></tr></thead><tbody>{data.map(r => <tr key={r.label}><td>{r.label}</td><td className="text-center">{r.count}</td></tr>)}</tbody></table></details></> : <p>No Work Orders in this cohort.</p>}</section>;
}
export default function YearEndReportPage() {
  const { selectedFacilityId } = useFacility(), { user } = useUser();
  const [filters, setFilters] = React.useState<YearEndFilters>({ yearEnding: '', startMonth: '1', includeArchived: 'false' });
  const [captured, setCaptured] = React.useState<{ key: string; report: YearEndReport } | null>(null), [loading, setLoading] = React.useState(false), [error, setError] = React.useState(''), [page, setPage] = React.useState(0);
  const identity = `${user?._id}|${user?.role}|${selectedFacilityId}`, key = `${identity}|${JSON.stringify(filters)}`;
  const [pdfBusy, setPdfBusy] = React.useState(false), [pdfError, setPdfError] = React.useState<{ key: string; message: string } | null>(null);
  const currentKey = React.useRef(key); currentKey.current = key;
  const sequence = React.useRef(0), current = React.useRef(identity); current.current = identity;
  React.useEffect(() => { sequence.current++; setCaptured(null); setError(''); setLoading(false); setPage(0); }, [identity]);
  const report = !loading && !error && captured?.key === key ? captured.report : null;
  async function generate(e: React.FormEvent) {
    e.preventDefault(); if (!selectedFacilityId) return;
    const ticket = ++sequence.current, requestIdentity = identity, requestKey = key; setLoading(true); setError(''); setCaptured(null);
    try { const result = await getYearEndReport(selectedFacilityId, filters); if (ticket === sequence.current && current.current === requestIdentity) { setCaptured({ key: requestKey, report: result }); setPage(0); } }
    catch (failure: any) { if (ticket === sequence.current && current.current === requestIdentity) setError(failure?.response?.data?.error ?? 'Unable to generate year-end report.'); }
    finally { if (ticket === sequence.current && current.current === requestIdentity) setLoading(false); }
  }
  async function downloadPdf() {
    if (!report || pdfBusy) return;
    const requestKey = key; setPdfBusy(true); setPdfError(null);
    try { const { buildOperationsReportPdf } = await import('../../utils/operationsReportPdf'); if (currentKey.current !== requestKey) return; const doc = buildOperationsReportPdf(report); if (currentKey.current === requestKey) doc.save('year-end-' + report.facility.id + '-' + report.period.yearEnding + '.pdf'); }
    catch { if (currentKey.current === requestKey) setPdfError({ key: requestKey, message: 'Unable to create PDF. Please try again.' }); }
    finally { setPdfBusy(false); }
  }
  function download() { if (!report) return; const url = URL.createObjectURL(new Blob([yearEndReportCsv(report)], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = `year-end-${report.facility.id}-${report.period.yearEnding}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return <main className="p-6 space-y-5"><Link className="text-blue-700 underline" to="/reports">Back to Reports</Link>
    <header className="rounded-xl border-t-4 border-blue-800 bg-white shadow-sm p-6"><p className="text-sm font-semibold tracking-wide text-blue-800">The Sigma Asset Management Group</p><h1 className="text-2xl font-semibold mt-2">Year-end Operations</h1>{report && <p className="text-xl text-teal-800 mt-1">{report.facility.name} · {report.period.yearEnding}</p>}<p className="text-slate-600 mt-2">Recorded completion activity and current backlog for one hospital.</p></header>
    <form className="flex flex-wrap items-end gap-3" onSubmit={generate}><label>Year ending<input required type="number" min="1901" max="9999" className="block border rounded p-2" value={filters.yearEnding} onChange={e => { setFilters(f => ({ ...f, yearEnding: e.target.value })); setError(''); }} /></label><label>Year starts in<select className="block border rounded p-2" value={filters.startMonth} onChange={e => { setFilters(f => ({ ...f, startMonth: e.target.value })); setError(''); }}>{['January (calendar year)', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select></label>
      <label>Completion cohort<select className="block border rounded p-2" value={filters.includeArchived} onChange={e => { setFilters(f => ({ ...f, includeArchived: e.target.value })); setError(''); }}><option value="false">Completed only</option><option value="true">Include archived with completion dates</option></select></label>
      <button disabled={loading || !selectedFacilityId || !filters.yearEnding} className="bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Generating...' : 'Generate year-end report'}</button>
      {report && <button type="button" onClick={download} className="border rounded px-4 py-2">Download year-end CSV</button>}
      {report && <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="bg-teal-700 text-white rounded px-4 py-2 disabled:opacity-50">{pdfBusy ? 'Creating PDF...' : 'Download year-end PDF'}</button>}</form>
    {!selectedFacilityId && <p>Select a hospital in the sidebar.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{pdfError?.key === key && <p role="alert" className="text-red-700">{pdfError.message}</p>}
    {report && <><p>UTC period: {report.period.start.slice(0, 10)} through {new Date(+new Date(report.period.endExclusive) - 86400000).toISOString().slice(0, 10)}. <strong>{report.facility.name}</strong> · Year ending {report.period.yearEnding} · Generated {report.generatedAt} (UTC)</p>
      {report.period.isInProgress && <p className="rounded bg-amber-100 p-3 text-amber-900">Reporting year in progress — this is a provisional report.</p>}
      <div className="grid gap-4 md:grid-cols-3"><section className="rounded-xl bg-blue-50 border border-blue-200 p-5"><h2>Completion cohort</h2><p className="text-3xl font-bold text-blue-800">{report.activity.summary.count}</p><p>{report.activity.summary.archived} archived; {report.activity.summary.unavailableAssets} unavailable assets</p></section>
        <section className="rounded-xl bg-teal-50 border border-teal-200 p-5"><h2>Recorded internal hours</h2><p className="text-2xl font-bold text-teal-800">{report.activity.summary.laborHours} labor · {report.activity.summary.travelHours} travel</p><p>Whole-WO hours, not hours worked within this reporting year.</p><p>{report.activity.summary.invalidTimeEntries} invalid time entries</p></section>
        <section className="rounded-xl bg-purple-50 border border-purple-200 p-5"><h2>Completion cohort direct costs</h2><p>Known subtotal: <strong>{money(report.activity.summary.cost.knownSubtotal)}</strong></p><p>Complete total: <strong>{money(report.activity.summary.cost.total)}</strong></p><p>Whole-WO costs, not annual expenses.</p></section></div>
      <p>Vendor-reported hours, separate from internal: known labor {report.activity.summary.vendorKnownLaborHours}; known travel {report.activity.summary.vendorKnownTravelHours}. Missing vendor labor: {report.activity.summary.vendorMissingLaborHours}; missing vendor travel: {report.activity.summary.vendorMissingTravelHours}.</p>
      <div className="grid gap-4 xl:grid-cols-2"><CountChart title="Completed activity by Work Order type" data={report.charts.completedByType} /><CountChart title="Current backlog by priority — at generation" data={report.charts.backlogByPriority} /></div>
      <section className="rounded-xl border bg-white p-5 space-y-3" aria-label="Completion activity across the reporting year"><h2 className="font-semibold">Completion activity across the reporting year (UTC)</h2><div aria-hidden="true"><ResponsiveContainer width="100%" height={260}><LineChart data={report.charts.monthlyCompletions}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line type="linear" dataKey="count" name="Work Orders" stroke="#0d9488" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
        <details><summary>Monthly counts</summary><ul>{report.charts.monthlyCompletions.map(r => <li key={r.month}>{r.month}: {r.count === null ? 'Future month' : r.count}</li>)}</ul></details></section>
      <CountChart title="Current backlog by work category - at generation" data={report.backlogBreakdown} />
      <section className="rounded-xl border bg-white p-5 overflow-x-auto"><h2 className="font-semibold">Monthly completion cohort totals</h2><p>Future months are unobserved. Hours and costs are whole-WO amounts.</p><table className="w-full text-sm"><thead><tr><th>Month (UTC)</th><th>State</th><th>Completions</th><th>Labor hours</th><th>Travel hours</th><th>Known cost</th><th>Complete cost</th></tr></thead><tbody>{report.months.map(m => <tr key={m.month} className="border-t"><td>{m.month}</td><td>{m.state}</td><td>{m.state === 'future' ? '—' : m.summary.count}</td><td>{m.state === 'future' ? '—' : m.summary.laborHours}</td><td>{m.state === 'future' ? '—' : m.summary.travelHours}</td><td>{m.state === 'future' ? '—' : money(m.summary.cost.knownSubtotal)}</td><td>{m.state === 'future' ? '—' : money(m.summary.cost.total)}</td></tr>)}</tbody></table></section>
      <section className="rounded-xl border-l-4 border-orange-500 bg-orange-50 p-5"><h2 className="font-semibold">Current backlog at generation — not year-end backlog</h2><p>{report.backlog.summary.count} open; {report.backlog.summary.overdue} overdue; {report.backlog.summary.missingDueDates} missing due dates.</p><div className="grid gap-3 md:grid-cols-3 mt-4">{report.backlogBreakdown.map((group, i) => <section key={group.label} className="rounded-lg bg-white p-4 border" style={{ borderTop: '4px solid ' + COLORS[i] }}><h3 className="font-semibold">{group.label}</h3><p className="text-2xl font-bold">{group.count}</p><p>{group.overdue} overdue; {group.missingDueDates} missing due dates</p></section>)}</div><p className="mt-3">These categories cover all current open Work Orders. Backlog detail is included separately in the CSV.</p></section>
      <details className="rounded border p-4"><summary>Report basis and limitations</summary><ul className="list-disc pl-5">{report.notes.map(n => <li key={n}>{n}</li>)}</ul></details>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Completion cohort Work Orders</h2>{!report.activity.rows.length && <p>No completion activity for this selection.</p>}
        {report.activity.rows.slice(page * 50, page * 50 + 50).map(r => <article key={r.id} className="rounded border bg-white p-4"><Link className="text-blue-700 underline" to={`/workorders/edit/${r.id}`}>Work Order {r.number || r.id}</Link><p>{r.type} · {r.status} · {r.asset?.controlNumber || 'Asset unavailable'} · {r.completed} (UTC)</p><p>Internal labor {r.laborHours}h; travel {r.travelHours}h. Known direct cost {money(r.cost.knownSubtotal)}; complete {money(r.cost.total)}.</p></article>)}
        {report.activity.rows.length > 50 && <div className="flex gap-4"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(report.activity.rows.length / 50)}; CSV includes all records</span><button disabled={(page + 1) * 50 >= report.activity.rows.length} onClick={() => setPage(page + 1)}>Next</button></div>}</section>
    </>}
  </main>;
}
