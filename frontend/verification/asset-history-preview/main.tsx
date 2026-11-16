import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import ReportsRoute from '../../src/pages/Reports/ReportsRoute';
import AssetHistoryReportPage from '../../src/pages/Reports/AssetHistoryReportPage';
import { hospitalA, hospitalB, previewAssetId, PreviewContext, settings, type Scenario } from './synthetic';
import '../../src/styles/index.css';
const reportPath = `/reports/asset-history?assetId=${previewAssetId}`;
function Placeholder() { const { id } = useParams(); return <section className="bg-white p-5"><p>Synthetic record destination: {id}</p><Link className="text-blue-700 underline" to={reportPath}>Return to history report</Link></section>; }
function Preview() {
  const [role, setRole] = React.useState('admin'); const [facilityId, setFacility] = React.useState<string | null>(hospitalA); const [scenario, setScenario] = React.useState<Scenario>('sample');
  return <PreviewContext.Provider value={{ role, facilityId }}><MemoryRouter initialEntries={[reportPath]}><div className="min-h-screen bg-slate-100 p-6"><div className="max-w-6xl mx-auto space-y-4">
    <header className="rounded-xl bg-slate-900 text-white p-5"><h1 className="text-2xl font-semibold">Asset History browser check</h1><p>Synthetic data only. Sample asset: SYN-HIST-001. No live Cronus connection.</p></header>
    <section className="rounded border bg-white p-4 flex flex-wrap gap-4">
      <label>Scenario<select className="block border rounded p-2" value={scenario} onChange={event => { const value = event.target.value as Scenario; settings.scenario = value; setScenario(value); }}><option value="sample">Sample service history</option><option value="pages">30 Work Orders (pagination)</option><option value="empty">No recorded history</option><option value="unavailable">Unavailable</option></select></label>
      <label>Hospital<select className="block border rounded p-2" value={facilityId ?? ''} onChange={event => setFacility(event.target.value || null)}><option value={hospitalA}>Synthetic Hospital A</option><option value={hospitalB}>Synthetic Hospital B (no matching asset)</option><option value="">No hospital</option></select></label>
      <label>Role<select className="block border rounded p-2" value={role} onChange={event => setRole(event.target.value)}><option value="admin">Administrator</option><option value="technician">Technician</option><option value="viewer">Viewer</option></select></label>
      <Link className="self-end p-2 text-blue-700 underline" to={reportPath}>Open history report</Link>
    </section>
    <Routes><Route path="/reports/asset-history" element={<ReportsRoute content={<AssetHistoryReportPage key={scenario} />} />} />
      <Route path="/reports" element={<Link className="text-blue-700 underline" to={reportPath}>Return to the synthetic history report</Link>} />
      <Route path="/assets/edit/:id" element={<Placeholder />} /><Route path="/workorders/edit/:id" element={<Placeholder />} />
      <Route path="/dashboard" element={<p>Reports access denied. Restore Administrator or Technician, then Open history report.</p>} /></Routes>
  </div></div></MemoryRouter></PreviewContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
