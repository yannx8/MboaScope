/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api is proxied to the FastAPI server, so the frontend needs no CORS setup.
// In production, set VITE_API_URL to the deployed backend (see .env.example).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
    // The Method page imports docs/methodology.md from the repository root.
    fs: { allow: ['..'] },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy chart and map libraries out of the main chunk (task B10).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\/](recharts|d3-[^\/]+|victory-vendor)[\/]/.test(id)) return 'charts'
          if (/[\/](leaflet|react-leaflet|@react-leaflet)[\/]/.test(id)) return 'map'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
