import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// A static site. It calls the demo API at VITE_API_URL, or at its own origin when that is unset (the demo API and
// the site served together). In development the API runs beside it: DEMO_API defaults to http://127.0.0.1:8787.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: { assetsInlineLimit: 0 },
  server: {
    proxy: {
      '/v1': process.env['DEMO_API'] ?? 'http://127.0.0.1:8787',
      '/health': process.env['DEMO_API'] ?? 'http://127.0.0.1:8787',
    },
  },
});
