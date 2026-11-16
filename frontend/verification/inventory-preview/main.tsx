import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import ReportsRoute from '../../src/pages/Reports/ReportsRoute';
import { hospitalA, hospitalB, PreviewContext, settings, type Scenario } from './synthetic';
import '../../src/styles/index.css';
function Placeholder() { const { id } = useParams(); return <section className="bg-white p-6"><h2>Synthetic asset destination: {id}</h2><Link to="/reports" className="underline text-blue-700">Return to inventory</Link></section>; }
function Preview() {
  const [role, setRole] = React.useState('admin');
  const [facilityId, setFacility] = React.useState<string | null>(hospitalA);
  const [scenario, setScenario] = React.useState<Scenario>('normal');
  return <PreviewContext.Provider value={{ role, facilityId }}><MemoryRouter initialEntries={['/reports']}>
    <div className="min-h-screen bg-slate-100 p-6"><div className="max-w-7xl mx-auto space-y-4">
      <header className="bg-slate-900 rounded-xl text-white p-5"><h1 className="text-2xl font-semibold">Asset Inventory browser check</h1><p>Synthetic data only. No connection to your live Cronus installation.</p></header>
      <section className="bg-white rounded border p-4 flex flex-wrap gap-4">
        <label>Scenario<select className="block border rounded p-2" value={scenario} onChange={event => { const value = event.target.value as Scenario; settings.scenario = value; setScenario(value); }}><option value="normal">Sample inventory</option><option value="pages">60 assets (pagination)</option><option value="empty">No assets</option><option value="unavailable">Unavailable</option></select></label>
        <label>Hospital<select className="block border rounded p-2" value={facilityId ?? ''} onChange={event => setFacility(event.target.value || null)}><option value={hospitalA}>Synthetic Hospital A</option><option value={hospitalB}>Synthetic Hospital B</option><option value="">No hospital</option></select></label>
        <label>Role<select className="block border rounded p-2" value={role} onChange={event => setRole(event.target.value)}><option value="admin">Administrator</option><option value="technician">Technician</option><option value="viewer">Viewer</option></select></label>
        <Link className="text-blue-700 underline self-end p-2" to="/reports">Open Reports</Link>
      </section>
      <Routes><Route path="/reports" element={<ReportsRoute key={scenario} />} /><Route path="/assets/edit/:id" element={<Placeholder />} /><Route path="/dashboard" element={<p>Reports access denied for this role. Choose Administrator or Technician, then Open Reports.</p>} /></Routes>
    </div></div>
  </MemoryRouter></PreviewContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
