import React from 'react';
import { Link } from 'react-router-dom';
import { useFacility } from '../../context/FacilityContext';
import { useUser } from '../../context/UserContext';
import { getInventoryOptions, getInventoryReport } from '../../services/inventoryReportAPI';
import { inventoryReportCsv } from '../../utils/inventoryReportCsv';
import type { AssetInventoryReport, InventoryFilters } from '../../types/AssetInventoryReport';

export default function ReportsPage() {
  const { selectedFacilityId } = useFacility();
  const { user } = useUser();
  const [filters, setFilters] = React.useState<InventoryFilters>({ archive: 'exclude' });
  const [captured, setCaptured] = React.useState<{ report: AssetInventoryReport; key: string } | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [choices, setChoices] = React.useState<{ identity: string; departments: { id: string; name: string }[] } | null>(null);
  const [choicesError, setChoicesError] = React.useState(false);
  const sequence = React.useRef(0);
  const identity = `${user?._id}|${user?.role}|${selectedFacilityId}`;
  const currentIdentity = React.useRef(identity); currentIdentity.current = identity;
  const filterKey = JSON.stringify(filters);
  React.useEffect(() => { sequence.current++; setCaptured(null); setFilters({ archive: 'exclude' }); setError(''); setLoading(false); setPage(0); }, [identity]);
  React.useEffect(() => {
    let active = true;
    setChoices(null); setChoicesError(false);
    if (selectedFacilityId) getInventoryOptions(selectedFacilityId).then(departments => {
      if (active) setChoices({ identity, departments });
    }).catch(() => { if (active) setChoicesError(true); });
    return () => { active = false; };
  }, [identity, selectedFacilityId]);
  React.useEffect(() => { setPage(0); }, [filterKey]);
  const report = !loading && !error && captured?.key === `${identity}|${filterKey}` ? captured.report : null;
  const options = choices?.identity === identity ? choices.departments : [];
  function change(key: keyof InventoryFilters, value: string) { setError(''); setFilters(previous => ({ ...previous, [key]: value })); }
  async function generate(event: React.FormEvent) {
    event.preventDefault(); if (!selectedFacilityId) return;
    const ticket = ++sequence.current, requestIdentity = identity, requestKey = `${identity}|${filterKey}`;
    setLoading(true); setError('');
    try {
      const result = await getInventoryReport(selectedFacilityId, filters);
      if (sequence.current === ticket && currentIdentity.current === requestIdentity) { setCaptured({ report: result, key: requestKey }); setPage(0); }
    } catch (failure: any) {
      if (sequence.current === ticket && currentIdentity.current === requestIdentity) setError(failure?.response?.data?.error ?? 'Unable to generate inventory report.');
    } finally { if (sequence.current === ticket && currentIdentity.current === requestIdentity) setLoading(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([inventoryReportCsv(report)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `asset-inventory-${report.facility.id}-${report.generatedAt.slice(0, 10)}.csv`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="p-6 space-y-5">
    <header><h1 className="text-2xl font-semibold">Reports</h1><p className="text-gray-600">Generate a report for the hospital selected in the sidebar.</p></header>
    <Link to="/reports/asset-history" className="inline-block text-blue-700 underline">Asset Detail and Service History</Link>
    <Link to="/reports/work-orders" className="inline-block text-blue-700 underline">Work Order Reports</Link>
    <section className="rounded-xl border bg-white p-5 space-y-4" aria-label="Asset Inventory">
      <h2 className="text-xl font-semibold">Asset Inventory</h2>
      <p className="text-sm text-gray-600">Current equipment identifiers, location, status and recorded PM schedule. Archived assets are excluded by default.</p>
      <form onSubmit={generate} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Department<select className="block border rounded p-2" value={filters.departmentId ?? ''} onChange={event => change('departmentId', event.target.value)}>
          <option value="">All departments</option><option value="unassigned">Unassigned</option>{options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="text-sm">Status<select className="block border rounded p-2" value={filters.status ?? ''} onChange={event => change('status', event.target.value)}><option value="">All statuses</option>{['Active', 'Inactive', 'Pending', 'Retired'].map(status => <option key={status}>{status}</option>)}</select></label>
        <label className="text-sm">Archived assets<select className="block border rounded p-2" value={filters.archive} onChange={event => change('archive', event.target.value)}><option value="exclude">Exclude archived</option><option value="only">Archived only</option><option value="all">Include archived</option></select></label>
        <label className="text-sm">Equipment class<input maxLength={120} className="block border rounded p-2" value={filters.equipmentClass ?? ''} onChange={event => change('equipmentClass', event.target.value)} placeholder="Exact class (optional)" /></label>
        <label className="text-sm">Search equipment<input maxLength={120} className="block border rounded p-2" value={filters.q ?? ''} onChange={event => change('q', event.target.value)} placeholder="Control, serial, model…" /></label>
        <button disabled={loading || !selectedFacilityId} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{loading ? 'Generating…' : 'Generate inventory'}</button>
        {report && <button type="button" onClick={download} className="rounded border px-4 py-2">Download CSV for Excel</button>}
      </form>
      {!selectedFacilityId && <p>Select a hospital first.</p>}
      {choicesError && <p className="text-sm text-amber-800">Department choices could not be loaded. Other filters remain available.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {report && <>
        <p><strong>{report.facility.name}</strong> · {report.rowCount} assets · Generated {report.generatedAt} (UTC)</p>
        <p className="text-sm">Missing serial: {report.dataQuality.missingSerial} · Unassigned department: {report.dataQuality.unassignedDepartment} · Unavailable department: {report.dataQuality.unavailableDepartment} · Missing next PM: {report.dataQuality.missingNextPM}</p>
        <details className="text-sm"><summary>Report basis</summary><ul className="list-disc pl-5">{report.notes.map(note => <li key={note}>{note}</li>)}</ul></details>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b">{['Control number', 'Manufacturer / model', 'Serial number', 'Equipment class', 'Department / location', 'Status', 'PM frequency', 'Last PM (UTC)', 'Next PM (UTC)'].map(label => <th className="pr-4 py-2" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.rows.slice(page * 50, page * 50 + 50).map(row => <tr className="border-b" key={row.id}>
            <td className="pr-4 py-2"><Link className="text-blue-700 underline" to={`/assets/edit/${row.id}`}>{row.ctrlNumber || row.id}</Link><p className="text-xs text-gray-600">{row.description}</p><Link className="text-xs text-blue-700 underline" to={`/reports/asset-history?assetId=${row.id}`}>Service history report</Link></td>
            <td className="pr-4">{row.manufacturer} / {row.model}</td><td className="pr-4">{row.serialNumber || 'Not recorded'}</td><td className="pr-4">{row.equipmentClass || 'Not recorded'}</td>
            <td className="pr-4">{row.department || (row.departmentState === 'unassigned' ? 'Unassigned' : 'Unavailable reference')}<p>{row.location}</p></td><td className="pr-4">{row.status}{row.isArchived ? ' (Archived)' : ''}</td>
            <td className="pr-4">{row.pmFrequency || 'Not recorded'}</td><td className="pr-4">{row.lastPM?.slice(0, 10) ?? 'Not recorded'}</td><td>{row.nextPM?.slice(0, 10) ?? 'Not recorded'}</td>
          </tr>)}</tbody></table></div>
        {!report.rowCount && <p>No assets match these filters.</p>}
        {report.rowCount > 50 && <div className="flex gap-3 items-center"><button disabled={!page} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button><span>Page {page + 1} of {Math.ceil(report.rowCount / 50)} · CSV includes all {report.rowCount} assets</span><button disabled={(page + 1) * 50 >= report.rowCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button></div>}
      </>}
    </section>
  </main>;
}
