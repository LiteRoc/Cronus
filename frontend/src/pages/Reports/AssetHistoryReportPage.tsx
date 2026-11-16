import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFacility } from '../../context/FacilityContext';
import { useUser } from '../../context/UserContext';
import { getAssetHistoryReport } from '../../services/assetHistoryReportAPI';
import { assetHistoryReportCsv } from '../../utils/assetHistoryReportCsv';
import type { AssetHistoryReport, HistoryFilters } from '../../types/AssetHistoryReport';
const amount = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shown = (value: string | null) => value || 'Not recorded';
export default function AssetHistoryReportPage() {
  const { selectedFacilityId } = useFacility(); const { user } = useUser(); const [params] = useSearchParams();
  const assetId = params.get('assetId') ?? '';
  const [kind, setKind] = React.useState<'assetId' | 'controlNumber'>(assetId ? 'assetId' : 'controlNumber');
  const [selection, setSelection] = React.useState(assetId); const [start, setStart] = React.useState(''); const [end, setEnd] = React.useState('');
  const [captured, setCaptured] = React.useState<{ key: string; report: AssetHistoryReport } | null>(null);
  const [error, setError] = React.useState(''); const [loading, setLoading] = React.useState(false); const [page, setPage] = React.useState(0);
  const sequence = React.useRef(0); const identity = `${user?._id}|${user?.role}|${selectedFacilityId}|${assetId}`;
  const currentIdentity = React.useRef(identity); currentIdentity.current = identity;
  const key = `${identity}|${kind}|${selection}|${start}|${end}`;
  React.useEffect(() => { sequence.current++; setCaptured(null); setError(''); setLoading(false); setPage(0); setKind(assetId ? 'assetId' : 'controlNumber'); setSelection(assetId); setStart(''); setEnd(''); }, [identity, assetId]);
  const report = !loading && !error && captured?.key === key ? captured.report : null;
  async function generate(event: React.FormEvent) {
    event.preventDefault(); if (!selectedFacilityId) return;
    const ticket = ++sequence.current, requestIdentity = identity, requestKey = key;
    const filters: HistoryFilters = { [kind]: selection.trim(), ...(start || end ? { startDate: start, endDate: end } : {}) };
    setLoading(true); setError(''); setCaptured(null);
    try { const result = await getAssetHistoryReport(selectedFacilityId, filters); if (ticket === sequence.current && currentIdentity.current === requestIdentity) { setCaptured({ key: requestKey, report: result }); setPage(0); } }
    catch (failure: any) { if (ticket === sequence.current && currentIdentity.current === requestIdentity) setError(failure?.response?.data?.error ?? 'Unable to generate asset history.'); }
    finally { if (ticket === sequence.current && currentIdentity.current === requestIdentity) setLoading(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([assetHistoryReportCsv(report)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `asset-history-${report.asset.id}-${report.generatedAt.slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="p-6 space-y-5"><Link to="/reports" className="text-blue-700 underline">Back to Reports</Link>
    <h1 className="text-2xl font-semibold">Asset Detail and Service History</h1>
    <p>Current equipment summary and recorded Work Orders, newest request date first. Archived Work Orders are included.</p>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={generate}>
      <label>Find asset by<select className="block border rounded p-2" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setSelection(''); setError(''); }}><option value="controlNumber">Exact control number</option><option value="assetId">Asset ID</option></select></label>
      <label>{kind === 'assetId' ? 'Asset ID' : 'Control number'}<input required maxLength={120} className="block border rounded p-2" value={selection} onChange={event => { setSelection(event.target.value); setError(''); }} /></label>
      <label>Request start date (optional)<input type="date" required={Boolean(end)} max={end || undefined} className="block border rounded p-2" value={start} onChange={event => { setStart(event.target.value); setError(''); }} /></label>
      <label>Request end date (inclusive)<input type="date" required={Boolean(start)} min={start || undefined} className="block border rounded p-2" value={end} onChange={event => { setEnd(event.target.value); setError(''); }} /></label>
      <button disabled={loading || !selectedFacilityId || !selection.trim()} className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{loading ? 'Generating…' : 'Generate asset history'}</button>
      {report && <button type="button" onClick={download} className="rounded border px-4 py-2">Download history CSV</button>}
    </form>
    {!selectedFacilityId && <p>Select a hospital in the sidebar.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {report && <>
      <section className="rounded-xl border bg-white p-5 space-y-3"><h2 className="text-xl font-semibold">{report.asset.ctrlNumber} — {report.asset.manufacturer} {report.asset.model}</h2>
        <p>{report.facility.name} · Generated {report.generatedAt} (UTC)</p><p>{report.asset.description}</p>
        <div className="grid md:grid-cols-3 gap-3 text-sm"><p>Serial: {shown(report.asset.serialNumber)}</p><p>Department: {report.asset.department || report.asset.departmentState}</p><p>Location: {shown(report.asset.location)}</p>
          <p>Status: {report.asset.status}{report.asset.isArchived ? ' (Archived)' : ''}</p><p>Equipment class: {shown(report.asset.equipmentClass)}</p><p>PM frequency: {shown(report.asset.pmFrequency)}</p>
          <p>Last PM (UTC): {shown(report.asset.lastPM?.slice(0, 10) ?? null)}</p><p>Next PM (UTC): {shown(report.asset.nextPM?.slice(0, 10) ?? null)}</p>
          <p>Acquired (UTC): {shown(report.asset.acquisitionDate?.slice(0, 10) ?? null)}</p><p>Installed (UTC): {shown(report.asset.installationDate?.slice(0, 10) ?? null)}</p><p>Service start (UTC): {shown(report.asset.serviceStartDate?.slice(0, 10) ?? null)}</p><p>Retired (UTC): {shown(report.asset.retirementDate?.slice(0, 10) ?? null)}</p></div>
        <Link className="text-blue-700 underline" to={`/assets/edit/${report.asset.id}`}>Open asset record</Link>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-3"><h2 className="text-xl font-semibold">Recorded service summary</h2>
        <p>{report.summary.workOrderCount} Work Orders · {report.summary.archivedCount} archived · {report.summary.laborHours} internal labor hours · {report.summary.travelHours} internal travel hours</p>
        <p>{report.summary.fullyPricedCount} fully priced · {report.summary.invalidTimeEntries} invalid time entries · {report.summary.missingRequestDates} missing request dates</p>
        <table className="text-sm w-full"><thead><tr className="text-left border-b"><th>Cost scope / component</th><th>Known subtotal</th><th>Complete total</th></tr></thead><tbody>{Object.entries({ ...report.summary.components, ...report.summary.scopes }).map(([name, value]) => <tr key={name} className="border-b"><th className="text-left py-2">{{ internalLabor: 'Internal labor', internalTravel: 'Internal travel', internalParts: 'Internal parts', internal: 'Internal subtotal', vendorDirect: 'Direct vendor expenses', directMaintenance: 'Total direct maintenance' }[name] ?? name}</th><td>{amount(value.knownSubtotal)}</td><td>{amount(value.total)}</td></tr>)}</tbody></table>
        <details className="text-sm"><summary>Report basis and limitations</summary><ul className="list-disc pl-5">{report.notes.map(note => <li key={note}>{note}</li>)}</ul></details>
      </section>
      <section className="space-y-3" aria-label="Service history"><h2 className="text-xl font-semibold">Service history</h2>
        {!report.rows.length && <p>No recorded Work Orders match this asset and date range.</p>}
        {report.rows.slice(page * 25, page * 25 + 25).map(row => <article key={row.id} className="rounded-xl border bg-white p-5 space-y-2">
          <h3 className="font-semibold"><Link className="text-blue-700 underline" to={`/workorders/edit/${row.id}`}>Work Order {row.number || row.id}</Link> · {row.type} · {row.status}</h3>
          <p className="text-sm">Requested (UTC): {shown(row.requested)} · Completed (UTC): {shown(row.completed)}</p><p className="whitespace-pre-wrap">{row.description || 'No description recorded'}</p>
          <p className="text-sm">Internal labor: {row.labor.recorded}h · Travel: {row.travel.recorded}h · Invalid time entries: {row.labor.invalidEntries + row.travel.invalidEntries}</p>
          <p className="text-sm">Known direct cost: {amount(row.scopes.directMaintenance.knownSubtotal)} · Complete direct cost: {amount(row.scopes.directMaintenance.total)}</p>
          {!row.scopes.directMaintenance.isComplete && <p className="text-sm text-amber-800">Missing cost evidence: {[...new Set(row.scopes.directMaintenance.missingComponents.map(item => item.reason))].join(', ')}</p>}
          <details className="text-sm"><summary>Recorded service notes and parts</summary>
            {row.serviceNotes.length ? row.serviceNotes.map((note, index) => <p className="whitespace-pre-wrap" key={index}>{note.workDate || 'Date not recorded'}: {note.description || 'No service note recorded'}</p>) : <p>No labor notes recorded.</p>}
            {row.parts.length ? <ul className="list-disc pl-5">{row.parts.map((part, index) => <li key={index}>{part.number || part.id || 'Unavailable part'} · {part.description || 'Catalog label unavailable'} · Qty {part.quantity ?? 'unknown'} · {part.note} ({part.referenceState})</li>)}</ul> : <p>No parts recorded.</p>}
          </details>
          {row.vendor && <p className="text-sm">Recorded vendor: {row.vendor.name || 'Not recorded'} · Vendor WO: {row.vendor.workOrderNumber || 'Not recorded'} · Vendor labor: {row.vendor.laborHours ?? 'Unknown'}h · Vendor travel: {row.vendor.travelHours ?? 'Unknown'}h</p>}
        </article>)}
        {report.rows.length > 25 && <div className="flex gap-3 items-center"><button disabled={!page} onClick={() => setPage(page - 1)} className="border rounded px-3 py-1 disabled:opacity-50">Previous</button><span>Page {page + 1} of {Math.ceil(report.rows.length / 25)} · CSV includes all {report.rows.length} Work Orders</span><button disabled={(page + 1) * 25 >= report.rows.length} onClick={() => setPage(page + 1)} className="border rounded px-3 py-1 disabled:opacity-50">Next</button></div>}
      </section>
    </>}
  </main>;
}
