// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/core-api": {
        target: "http://192.168.1.185:4000",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/core-api/, ""),
      },
      "/contract-api": {
        target: "http://192.168.1.185:5001",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/contract-api/, ""),
      },
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // to reference file paths using @
    },
    preserveSymlinks: true,
  },
});