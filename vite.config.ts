import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built assets also work inside the Android WebView.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The sandbox proxy serves the app from a *.e2b.app host.
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
