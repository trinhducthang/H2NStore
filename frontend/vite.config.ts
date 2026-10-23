import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: proxy /api và /uploads sang backend Spring Boot để cookie refresh token là same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
      '/uploads': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
  },
});
