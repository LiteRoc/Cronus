import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import SigmaContractReport from '../../src/pages/Contracts/components/SigmaContractReport';
import { contractId, hospitalA, hospitalB, PreviewContext, previewSettings, type Scenario } from './synthetic';
import '../../src/styles/index.css';

function WorkOrderPlaceholder() {
  const { id } = useParams();
  return <section className="rounded border bg-white p-5 space-y-3"><h2 className="text-xl font-semibold">Synthetic work-order destination</h2>
    <p>The report link opened this local placeholder: {id}</p><Link className="text-blue-700 underline" to="/">Back to the report</Link></section>;
}
function Preview() {
  const [scenario, setScenario] = React.useState<Scenario>('partial');
  const [facilityId, setFacility] = React.useState<string | null>(hospitalA);
  const [role, setRole] = React.useState('admin');
  return <PreviewContext.Provider value={{ role, facilityId }}><MemoryRouter>
    <main className="min-h-screen bg-slate-100 p-6"><div className="max-w-6xl mx-auto space-y-5">
      <header className="rounded-xl bg-slate-900 text-white p-5 space-y-2"><h1 className="text-2xl font-semibold">Sigma report browser check</h1>
        <p>Temporary synthetic preview. No sign-in, live API, database, or browser storage is used.</p>
        <p className="text-sm">CSV files from this preview contain invented data. Work-order links open local placeholders.</p></header>
      <section className="rounded-xl border bg-white p-4 flex flex-wrap gap-4" aria-label="Synthetic preview controls">
        <label>Scenario<select className="block border rounded p-2" value={scenario} onChange={event => { const next = event.target.value as Scenario; previewSettings.scenario = next; setScenario(next); }}>
          <option value="partial">Incomplete travel costs</option><option value="complete">Complete work-order costs</option><option value="empty">No work orders</option><option value="unavailable">Report unavailable</option></select></label>
        <label>Hospital<select className="block border rounded p-2" value={facilityId ?? ''} onChange={event => setFacility(event.target.value || null)}>
          <option value={hospitalA}>Synthetic Hospital A</option><option value={hospitalB}>Synthetic Hospital B</option><option value="">No hospital selected</option></select></label>
        <label>Role<select className="block border rounded p-2" value={role} onChange={event => setRole(event.target.value)}><option value="admin">Administrator</option><option value="viewer">Viewer</option></select></label>
      </section>
      {role !== 'admin' && <p>The internal report is hidden for this role.</p>}
      <Routes><Route path="/" element={<SigmaContractReport key={scenario} contractId={contractId} contractType="customer" />} />
        <Route path="/workorders/edit/:id" element={<WorkOrderPlaceholder />} /></Routes>
    </div></main>
  </MemoryRouter></PreviewContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
