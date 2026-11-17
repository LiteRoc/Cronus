import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportsRoute from '../../src/pages/Reports/ReportsRoute';
import YearEndReportPage from '../../src/pages/Reports/YearEndReportPage';
import { hospitalA, hospitalB, PreviewContext, settings, type Scenario } from './synthetic';
import '../../src/styles/index.css';
function Preview() {
  const [role, setRole] = React.useState('admin'), [facilityId, setFacility] = React.useState<string | null>(hospitalA), [scenario, setScenario] = React.useState<Scenario>('sample');
  return <PreviewContext.Provider value={{ role, facilityId }}><MemoryRouter initialEntries={['/reports/year-end']}><div className="p-6 space-y-4">
    <h1 className="text-2xl font-semibold">Synthetic Year-end browser check</h1><p>No live Cronus connection. Fixed generation time: November 17, 2026, 12:00 UTC.</p>
    <section className="flex flex-wrap gap-4 border p-4"><label>Scenario<select value={scenario} onChange={e => { settings.scenario = e.target.value as Scenario; setScenario(settings.scenario); }}><option value="sample">Sample</option><option value="pages">55 completions</option><option value="empty">Empty</option><option value="unavailable">Unavailable</option></select></label>
      <label>Hospital<select value={facilityId || ''} onChange={e => setFacility(e.target.value || null)}><option value={hospitalA}>Synthetic Hospital A</option><option value={hospitalB}>Synthetic Hospital B (empty)</option><option value="">No hospital</option></select></label>
      <label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="admin">Administrator</option><option value="technician">Technician</option><option value="viewer">Viewer</option></select></label><Link to="/reports/year-end">Open Year-end reports</Link></section>
    <Routes><Route path="/reports/year-end" element={<ReportsRoute content={<YearEndReportPage key={scenario} />} />} />
      <Route path="/dashboard" element={<p>Reports access denied. Restore an allowed role, then Open Year-end reports.</p>} />
      <Route path="*" element={<p>Synthetic navigation placeholder. <Link to="/reports/year-end">Return to reports</Link></p>} /></Routes>
  </div></MemoryRouter></PreviewContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
