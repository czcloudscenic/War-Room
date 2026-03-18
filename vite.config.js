import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://majestic-cassata-aa16e9.netlify.app',
        changeOrigin: true,
      },
    },
  },
});
