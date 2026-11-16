import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, createServer, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
const root = fileURLToPath(new URL('.', import.meta.url)), frontend = path.resolve(root, '../..'), synthetic = path.join(root, 'synthetic.tsx');
const replacements = new Set(['../../context/UserContext', '../../context/FacilityContext', '../../services/workOrderReportAPI', '../../services/inventoryReportAPI']);
const seen = new Set();
const options = { root, configFile: false, envDir: false, plugins: [{ name: 'work-order-synthetic-boundary', enforce: 'pre',
  resolveId(source, importer) { if (importer && /\/src\/pages\/Reports\/(ReportsPage|ReportsRoute|WorkOrderReportPage)\.tsx$/.test(normalizePath(importer)) && replacements.has(source)) { seen.add(source); return synthetic; } return null; },
  generateBundle() {
    if (seen.size !== replacements.size) throw new Error('Synthetic preview boundary incomplete');
    for (const module of this.getModuleIds()) if (/\/src\/(services\/(workOrderReportAPI|inventoryReportAPI|apiClient)|context\/(UserContext|FacilityContext))\./.test(normalizePath(module))) throw new Error('Live adapter entered work-order preview');
  },
}, react()], server: { host: '127.0.0.1', port: 5192, strictPort: true, open: false, fs: { strict: true, allow: [frontend] } },
build: { write: false } };
if (process.argv.includes('--build')) { await build(options); console.log('Open PM preview verified in memory: live adapters excluded.'); }
else {
  const server = await createServer(options); await server.listen();
  console.log('\nSynthetic Open PM preview: http://127.0.0.1:5192'); console.log('Local browser preview only. Stop with Ctrl+C.');
  let closing = false; async function close() { if (closing) return; closing = true; await server.close(); process.exit(0); }
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
