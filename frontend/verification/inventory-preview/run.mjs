import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, createServer, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
const root = fileURLToPath(new URL('.', import.meta.url));
const frontend = path.resolve(root, '../..');
const synthetic = path.join(root, 'synthetic.tsx');
const replacements = new Set(['../../context/UserContext', '../../context/FacilityContext', '../../services/inventoryReportAPI']);
const replaced = new Set();
const options = {
  configFile: false, envDir: false, root,
  plugins: [{ name: 'inventory-synthetic-boundary', enforce: 'pre',
    resolveId(source, importer) {
      if (importer && /\/src\/pages\/Reports\/(ReportsPage|ReportsRoute)\.tsx$/.test(normalizePath(importer)) && replacements.has(source)) { replaced.add(source); return synthetic; }
      return null;
    },
    generateBundle() {
      if (replaced.size !== replacements.size) throw new Error('Synthetic preview boundary incomplete');
      for (const module of this.getModuleIds()) if (/\/src\/(services\/(inventoryReportAPI|apiClient)|context\/(UserContext|FacilityContext))\./.test(normalizePath(module))) throw new Error('Live adapter entered the synthetic preview');
    },
  }, react()],
  server: { host: '127.0.0.1', port: 5189, strictPort: true, open: false, fs: { strict: true, allow: [frontend] } },
  build: { outDir: path.join(frontend, 'node_modules/.tmp/inventory-synthetic-preview'), emptyOutDir: true },
};
if (process.argv.includes('--build')) {
  await build({ ...options, build: { ...options.build, write: false } });
  console.log('Inventory preview verified in memory: live API/context adapters excluded.');
} else {
  const server = await createServer(options); await server.listen();
  console.log('\nSynthetic Inventory preview: http://127.0.0.1:5189');
  console.log('Local browser preview only. Stop with Ctrl+C.');
  let closing = false;
  async function close() { if (closing) return; closing = true; await server.close(); process.exit(0); }
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
