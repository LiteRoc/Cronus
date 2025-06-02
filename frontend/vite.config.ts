import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,       // Needed for Docker to expose the dev server externally
    port: 5173,        // Optional, but make sure it matches your docker-compose.yml
    strictPort: true   // Optional: ensures it fails if port is taken
  }
})