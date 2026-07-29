import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY || 'https://majestic-cassata-aa16e9.netlify.app';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        // dev-only (server.proxy never ships): drop the localhost Origin so
        // requireUser's prod-origin allowlist doesn't 403 proxied dev calls
        configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin')),
      },
    },
  },
});
