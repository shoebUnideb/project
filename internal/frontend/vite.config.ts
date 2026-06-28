import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // More-specific prefix first — auth endpoints go to auth-service
      '/api/auth': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      // Org portal API → internal-portal
      '/api/org': {
        target: 'http://127.0.0.1:8003',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8003',
        changeOrigin: true,
      },
      '/ws/org': {
        target: 'ws://127.0.0.1:8003',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
