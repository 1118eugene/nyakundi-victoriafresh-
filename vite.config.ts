import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Produce a clean dist/ every build
    emptyOutDir: true,
  },
  define: {
    // Expose the production API URL at build time.
    // Set VITE_API_URL in Vercel → Settings → Environment Variables.
    // Falls back to relative /api so the Vercel rewrite handles it.
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL ?? ''
    ),
  },
})
