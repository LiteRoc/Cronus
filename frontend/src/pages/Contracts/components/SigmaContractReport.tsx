import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../../context/UserContext';
import { useFacility } from '../../../context/FacilityContext';
import { getSigmaContractReport } from '../../../services/contractAPI';
import type { SigmaReport } from '../../../types/SigmaReport';
import { sigmaReportCsv } from '../../../utils/sigmaReportCsv';

const money = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SigmaContractReport({ contractId, contractType }: { contractId: string; contractType: string }) {
  const { user } = useUser() ?? {};
  const { selectedFacilityId, availableFacilities } = useFacility();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(today.slice(0, 7) + '-01');
  const [endDate, setEndDate] = React.useState(today);
  const [report, setReport] = React.useState<SigmaReport | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const request = React.useRef(0);
  const context = `${contractId}|${selectedFacilityId}|${user?.role}`;
  const currentContext = React.useRef(context);
  currentContext.current = context;
  React.useEffect(() => { request.current++; setReport(null); setError(''); setLoading(false); }, [context]);
  const visible = report && report.contract.id === contractId && report.contract.facilityId === selectedFacilityId &&
    report.period.startDate === startDate && report.period.endDate === endDate ? report : null;
  if (user?.role !== 'admin' || contractType !== 'customer') return null;
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFacilityId) { setError('Select a hospital before generating a report.'); return; }
    const sequence = ++request.current, requestedContext = context;
    setLoading(true); setReport(null); setError('');
    try {
      const data = await getSigmaContractReport(contractId, startDate, endDate, selectedFacilityId);
      if (request.current === sequence && currentContext.current === requestedContext) setReport(data);
    } catch (failure: any) {
      if (request.current === sequence && currentContext.current === requestedContext) setError(failure?.response?.data?.error ?? 'Unable to generate report.');
    } finally {
      if (request.current === sequence && currentContext.current === requestedContext) setLoading(false);
    }
  }
  function download() {
    if (!visible) return;
    const url = URL.createObjectURL(new Blob([sigmaReportCsv(visible)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `sigma-contract-${contractId}-${visible.period.startDate}-${visible.period.endDate}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const facility = availableFacilities.find(item => item._id === selectedFacilityId);
  return <section className="rounded-xl border bg-white p-5 space-y-4" aria-label="Sigma internal Contract report">
    <div><h2 className="text-xl font-semibold">Sigma internal Contract report</h2>
      <p className="text-sm text-gray-600">Select a period to review contract value and recorded service activity. Dates use UTC.</p></div>
    <form onSubmit={generate} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Start date<input required type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} className="block border rounded p-2" /></label>
      <label className="text-sm">End date (inclusive)<input required type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} className="block border rounded p-2" /></label>
      <button disabled={loading || !selectedFacilityId} className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{loading ? 'Generating…' : 'Generate report'}</button>
      {visible && <button type="button" onClick={download} className="rounded border px-4 py-2">Download CSV for Excel</button>}
    </form>
    {!selectedFacilityId && <p>Select a hospital to generate this report.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {visible && <>
      <div className="text-sm"><strong>{visible.contract.number} — {visible.contract.name}</strong><p>{facility?.name ?? visible.contract.facilityId} · {visible.period.startDate} through {visible.period.endDate} · Generated {visible.generatedAt}</p></div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div><p className="text-gray-600">Prorated contract value</p><strong>{money(visible.contractValue)}</strong><p className="text-xs">Contract currency; not invoiced or collected revenue</p></div>
        <div><p className="text-gray-600">Known direct work-order costs</p><strong>{money(visible.costs.scopes.directMaintenance.knownSubtotal)}</strong><p className="text-xs">{visible.costs.scopes.directMaintenance.fullyPricedCount} of {visible.activity.total} work orders fully priced</p></div>
        <div><p className="text-gray-600">Period contribution / margin</p><strong>Unavailable</strong><p className="text-xs">Period expense attribution is not established</p></div>
      </div>
      <p className="text-sm">{visible.activity.total} work orders · {visible.activity.preventive} preventive · {visible.activity.open} open now · {visible.activity.closed} closed now · {visible.activity.laborHours} recorded labor hours · {visible.activity.travelHours} recorded travel hours</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-semibold">Recorded costs for selected work orders</caption>
        <thead><tr className="text-left border-b"><th>Category</th><th>Known subtotal</th><th>Complete total</th><th>Fully priced work orders</th></tr></thead>
        <tbody>{[['Internal labor', visible.costs.components.internalLabor], ['Internal travel', visible.costs.components.internalTravel], ['Internal parts', visible.costs.components.internalParts], ['Direct vendor expenses', visible.costs.scopes.vendorDirect], ['Total direct maintenance', visible.costs.scopes.directMaintenance]].map(([label, value]) => {
          const cost = value as SigmaReport['costs']['scopes'][string];
          return <tr key={String(label)} className="border-b"><th className="text-left py-2">{String(label)}</th><td>{money(cost.knownSubtotal)}</td><td>{money(cost.total)}</td><td>{cost.fullyPricedCount} / {visible.activity.total}</td></tr>;
        })}</tbody></table></div>
      <details open className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><summary className="font-semibold">Report basis and limitations</summary><ul className="list-disc pl-5 space-y-1 mt-2">{visible.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-semibold">Supporting work orders</caption>
        <thead><tr className="text-left border-b"><th>Work order</th><th>Requested (UTC)</th><th>Type / status</th><th>Labor / travel hours</th><th>Known direct cost</th><th>Cost completeness</th></tr></thead>
        <tbody>{visible.workOrders.map(row => <tr key={row.id} className="border-b"><td className="py-2"><Link className="text-blue-700 underline" to={`/workorders/edit/${row.id}`}>{row.number || row.id}</Link></td><td>{row.requestDate.slice(0, 10)}</td><td>{row.type} / {row.status}</td><td>{row.laborHours} / {row.travelHours}</td><td>{money(row.cost.knownSubtotal)}</td><td>{row.cost.isComplete ? 'Complete' : row.cost.missingComponents.map(item => item.reason ?? 'Unknown cost').join(', ')}</td></tr>)}</tbody>
      </table>{!visible.workOrders.length && <p className="py-3">No linked, non-archived work orders were requested in this period within the Contract term.</p>}</div>
    </>}
  </section>;
}
